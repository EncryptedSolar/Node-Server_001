import * as grpc from '@grpc/grpc-js';
import { Subject } from 'rxjs';
import { ColorCode, MessageLog, ReportStatus } from '../interfaces/general.interface';
import { Status } from '@grpc/grpc-js/build/src/constants';
const message_proto = require('./protos/server.proto')

export class GrpcService {
    private grpcServerConnection: any = {}

    constructor() { }

    public async createGrpcServer(serverUrl: string, errorBroadcast?: Subject<any>): Promise<any> { // '0.0.0.0:3001'
        return new Promise((resolve, reject) => {
            let server = new grpc.Server();
            let errorSubject: Subject<any> = errorBroadcast ?? new Subject() // temporarily putting it here, just in case....

            // Add the streamingData function to the gRPC service
            // Define your message_proto.Message service methods
            server.addService(message_proto.Message.service, {
                sendMessageStream: (call) => { // this is for bidirectional streaming. Need to have another one for unary calls for web clients
                    call.on('data', (data: any) => {
                        // console.log(data) // it does return in string format
                        let payload = JSON.parse(data.message)
                        console.log(`Received Message from Client: ${payload.appData?.msgId}`);
                        // Forward the received message to the RxJS subject
                        let respmsg: any = {
                            msgId: payload.appData?.msgId,
                            confirmationMessage: `Message ${payload.appData?.msgId} acknowledged!`
                        }
                        let message: string = JSON.stringify(respmsg)
                        console.log(`Responding to client: ${respmsg.msgId}`);
                        // Note: The parameter here MUST BE STRICTLY be the same letter as defined in proto. Eg: message MessageRequest { string >>'message'<< = 1 }
                        call.write({ message });
                    });

                    call.on('end', () => {
                        console.log('Client stream ended');
                    });

                    call.on('error', (err) => {
                        errorSubject.next(err.message);
                    });

                    errorSubject.subscribe(info => {
                        console.log(info)
                    });
                },

                HandleMessage: (call) => { // this will be for unary call: Link https://github.com/improbable-eng/grpc-web
                    // my logic here 
                },

                Check: (_, callback) => {
                    // health check logic here
                    // for now it is just sending the status message over to tell the client it is alive
                    // For simplicity, always return "SERVING" as status
                    callback(null, { status: 'SERVING' });
                },
            });

            // Bind and start the server
            server.bindAsync(serverUrl, grpc.ServerCredentials.createInsecure(), () => {
                console.log(`gRPC server is running on ${serverUrl}`);
                server.start();
            });
            this.grpcServerConnection[serverUrl] = server
            resolve(server)
        })
    }

    public async stopServer(serverUrl: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.grpcServerConnection[serverUrl]) {
                console.log(`Shutting down the gRPC server:${serverUrl} ...`);
                // this.grpcServerConnection[serverUrl].tryShutdown(() => {
                //     console.log(`Server ${serverUrl} has been gracefully stopped.`);
                //     resolve('')
                // })
                resolve(this.grpcServerConnection[serverUrl].forceShutdown())
                console.log(`Server ${serverUrl} is forced to shut down!`)
                // simply removing the reference to the GrpcService instance associated with the specific serverUrl from the grpcServerConnection object.
                // However, the gRPC server instance itself continues to run as long as it has not been explicitly shut down using methods like tryShutdown.
                console.log(`Deleting grpc connection instance:${serverUrl} .....`)
                delete this.grpcServerConnection[serverUrl];
            } else {
                console.log(`Server${serverUrl} is not running.`);
                reject()
            }
        })
    }

    public getAllGrpcServerConnectionInstance(): any {
        console.log(this.grpcServerConnection)
        return this.grpcServerConnection
    }

    public async createGrpcClientConnectionInstance(serverUrl: string, statusControl: Subject<ReportStatus>, messageToBeTransmitted: Subject<MessageLog>): Promise<any> {
        return new Promise((resolve, reject) => {
            resolve(this.manageConnection(serverUrl, messageToBeTransmitted, statusControl))
        })

    }

    // To be migrated into a service in the immediate future
    private async manageConnection(serverUrl: string, messageToBePublished: Subject<MessageLog>, reportStatus: Subject<ReportStatus>) {
        let messageToBeTransmitted: Subject<MessageLog> = messageToBePublished
        let statusControl: Subject<ReportStatus> = reportStatus
        let consecutiveResolutions = 0;
        let lastResolutionTime = Date.now();
        let alreadyHealthCheck: boolean = false
        let yellowErrorEmission: boolean = false
        let redErrorEmission: boolean = false

        while (true) {
            try {
                await this.connectServer(serverUrl, alreadyHealthCheck, messageToBeTransmitted, statusControl);
                // If connection resolves (indicating failure), increment the count
                consecutiveResolutions++;
                console.log(`Reconnection Attempt: ${consecutiveResolutions}`)
                alreadyHealthCheck = true


                // If there are 60 consecutive resolutions, log an error and break the loop
                if (consecutiveResolutions >= parseInt(process.env.ReconnectionAttempt as string) && redErrorEmission == false) {
                    redErrorEmission = true
                    console.error(`Connection failed ${consecutiveResolutions} times. Stopping connection attempts.`);
                    let error: ReportStatus = {
                        code: ColorCode.RED,
                        message: 'Initiate Doomsday protocol....'
                    }
                    statusControl.next(error)
                }
                if (consecutiveResolutions < 5 && yellowErrorEmission == false) {
                    yellowErrorEmission = true
                    let error: ReportStatus = {
                        code: ColorCode.YELLOW,
                        // message: `Reconnection Attempt: ${consecutiveResolutions}. Server has yet to respond`
                        message: `Attempting reconnection... Server has yet to respond`
                    }
                    statusControl.next(error);
                }
            } catch (error) {
                // Connection did not resolve, reset the count
                consecutiveResolutions = 0;
                console.error('Connection attempt failed:', error);
            }

            // Check for a pause of more than 3 seconds since the last resolution attempt
            const currentTime = Date.now();
            const timeSinceLastResolution = currentTime - lastResolutionTime;
            if (timeSinceLastResolution > 3000) {
                consecutiveResolutions = 0;
                yellowErrorEmission = false
                redErrorEmission = false
                alreadyHealthCheck = false
            }

            // Update the last resolution time
            lastResolutionTime = currentTime;

            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before the next attempt
            // timeout generate message to trigger this reconnection
        }
    }

    // Create a bidirectional streaming call
    private async connectServer(server: string, alreadyHealthCheck: boolean, messageToBeTransmitted: Subject<MessageLog>, statusControl: Subject<ReportStatus>): Promise<string> {
        let subscription: any
        let unsubscribed: boolean = false

        return new Promise(async (resolve, reject) => {
            const client = new message_proto.Message(server, grpc.credentials.createInsecure());
            const call = client.sendMessageStream();

            call.on('status', (status: Status) => {
                // console.log(status) // For more info: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
                // https://grpc.io/docs/what-is-grpc/core-concepts/#streaming
                if (status) { // only returns a status when there's error. Otherwise it just waits
                    //   if (status.code === grpc.status.OK) {
                    //     console.log(`Message trasmission operation is successful`)
                    //     // RPC completed successfully
                    //   } 
                    resolve('No connection established. Server is not responding..')
                }
            });
            checkConnectionHealth()

            // All the grpc operations are here
            // Subscribe to the RxJS subject to send data to the server
            subscription = messageToBeTransmitted.subscribe((data: any) => {
                if (!unsubscribed) {
                    let message: string = JSON.stringify(data)
                    console.log(`Sending Data to Server: ${data.appData?.msgId}`);
                    // Note: The parameter here MUST BE STRICTLY be the same letter as defined in proto. Eg: message MessageRequest { string >>'message'<< = 1 }
                    call.write({ message });
                }
            });

            call.on('data', (data: any) => {
                // console.log(data)
                let message = JSON.parse(data.message)
                console.log(`Received acknowledgement from Server: ${message.msgId ?? `Invalid`}`);
            });

            call.on('error', (err) => {
                resolve(err)
            });

            call.on('end', () => {
                if (!unsubscribed && subscription) { // kill subcription to prevent memory leaks
                    subscription.unsubscribe();
                    unsubscribed = true;
                }
                resolve('Server Error');
            });

            /* Check the health to see if the other side will give back any. If they do give back health report status, it will resolve true, and then
            proceed with following GRPC operations. And if grpc operations emits connection error, than it will resolve the error, and then the outler
            layer of the promise will also resolve, prompting the manageConnection  function to destroy this GRPC instance upon the resolve, and then
            creating a new one in the next second. */

            // Check connection To be Update. This function is destroying my code flow
            async function checkConnectionHealth(): Promise<boolean> {
                return new Promise((resolve, reject) => {
                    client.Check({}, (error, response) => {
                        if (response) {
                            console.log(`GRPC Health check status: ${response.status} Server Connected`);
                            let report: ReportStatus = {
                                code: ColorCode.GREEN,
                                message: `Good to go!!!`
                            }
                            resolve(true)
                            statusControl.next(report)
                        } else {
                            if (alreadyHealthCheck == false) console.error(`Health check failed: ${error}`);
                        }
                    })
                })
            }
        })
    }


}




