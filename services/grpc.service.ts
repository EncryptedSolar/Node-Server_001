import * as grpc from '@grpc/grpc-js';
import { Subject } from 'rxjs';
import { ColorCode, GrpcConnectionType, MessageLog, ReportStatus } from '../interfaces/general.interface';
import { Status } from '@grpc/grpc-js/build/src/constants';
const message_proto = require('./protos/server.proto')

export class GrpcService {
    private grpcServerConnection: any = {}

    constructor() { }

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

    // To be migrated into a service in the immediate future
    public async createGrpcInstance(serverUrl: string, messageToBePublished: Subject<MessageLog>, reportStatus: Subject<ReportStatus>, connectionType: GrpcConnectionType) {
        let messageToBeTransmitted: Subject<MessageLog> = messageToBePublished
        let statusControl: Subject<ReportStatus> = reportStatus
        let consecutiveResolutions = 0;
        let lastResolutionTime = Date.now();
        let alreadyHealthCheck: boolean = false
        let yellowErrorEmission: boolean = false
        let redErrorEmission: boolean = false

        while (true) {
            try {
                if (connectionType.instanceType == 'client' && connectionType.serviceMethod == 'bidirectional') {
                    await this.createBidirectionalStreamingClient(serverUrl, alreadyHealthCheck, messageToBeTransmitted, statusControl);
                }
                if (connectionType.instanceType == 'client' && connectionType.serviceMethod == 'server streaming') {
                    await this.createServerStreamingClient(serverUrl, alreadyHealthCheck, messageToBeTransmitted, statusControl);
                }
                if (connectionType.instanceType == 'server' && connectionType.serviceMethod == 'bidirectional') {
                    await this.createGrpcBidirectionalServer(serverUrl, messageToBeTransmitted, statusControl)
                }
                if (connectionType.instanceType == 'server' && connectionType.serviceMethod == 'server streaming') {
                    await this.createServerStreamingServer(serverUrl, alreadyHealthCheck, messageToBePublished, statusControl)
                }
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
            if (timeSinceLastResolution > 2000) {
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

    private async createGrpcBidirectionalServer(serverUrl: string, messageToBeStream: Subject<any>, statusControl: Subject<ReportStatus>): Promise<any> { // '0.0.0.0:3001'
        return new Promise((resolve, reject) => {
            try {
                // https://github.com/grpc/proposal/blob/master/L5-node-client-interceptors.md
                let server: grpc.Server = new grpc.Server();
                let clients: any = {}
                // Add the streamingData function to the gRPC service
                // Define your message_proto.Message service methods

                server.addService(message_proto.Message.service, {
                    sendMessageStream: (call) => { // this is for bidirectional streaming. Need to have another one for unary calls for web clients
                        let clientAddress = call.getPeer();
                        clients[clientAddress] = clientAddress

                        console.log(`Client connected from: ${clientAddress}`);

                        // Right now this is being broadcast.
                        messageToBeStream.subscribe({
                            next: (payload: any) => {
                                console.log(`Sending ${payload.appData.msgId}`)
                                let message: string = JSON.stringify(payload)
                                call.write({ message })
                                // let operation = call.write({ message })
                                // console.log(operation) // Somehow returns boolean
                            },
                            error: err => console.error(err),
                            complete: () => { } //it will never complete
                        })

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
                            // call.write({ message });
                        });

                        call.on('end', () => {
                            console.log('Client stream ended');
                            // but the stream never ends. THis is not a reliable way to tell if a client is disconnected
                        });

                        call.on('error', (err) => {
                            // Error that may occue during the rpc call. Id there's an error, put a callbacn function there to check the connection for client
                            // emit a yellow report to halt message release. If the server does not reply to the callback function, then emit a red card
                            // the call back function will be to write and then the client should response immediately through test
                        });

                        call.on('close', () => {
                            console.log('Unknown cause for diconnectivity');
                            // Handle client closure, which may be due to errors or manual termination
                        });

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
            }
            catch (error) {
                resolve(error)
            }

        })
    }

    // Create a bidirectional streaming call
    private async createBidirectionalStreamingClient(server: string, alreadyHealthCheck: boolean, messageToBeTransmitted: Subject<any>, statusControl: Subject<ReportStatus>): Promise<string> {
        let subscription: any
        let unsubscribed: boolean = false

        return new Promise(async (resolve, reject) => {
            const client = new message_proto.Message(server, grpc.credentials.createInsecure());
            const call = client.sendMessageStream();

            call.on('status', (status: Status) => {
                // console.log(status) // For more info: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
                // https://grpc.io/docs/what-is-grpc/core-concepts/#streaming
                if (status == grpc.status.UNAVAILABLE) { // only returns a status when there's error. Otherwise it just waits
                    resolve('No connection established. Server is not responding..')
                }
            });
            this.checkConnectionHealth(client, statusControl, alreadyHealthCheck)

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
                console.log(`Something wrong with RPC call...`)
            });

            call.on('end', () => {
                if (!unsubscribed && subscription) { // kill subcription to prevent memory leaks
                    subscription.unsubscribe();
                    unsubscribed = true;
                }
                resolve('Server Error');
            });

        })
    }

    private async createServerStreamingServer(serverUrl: string, alreadyHealthCheck: boolean, messageToBeStream: Subject<any>, statusControl: Subject<ReportStatus>): Promise<any> { // '0.0.0.0:3001'
        return new Promise((resolve, reject) => {
            try {
                // https://github.com/grpc/proposal/blob/master/L5-node-client-interceptors.md
                let server: grpc.Server = new grpc.Server();
                let clients: any = {}
                // Add the streamingData function to the gRPC service
                // Define your message_proto.Message service methods

                server.addService(message_proto.Message.service, {
                    HandleMessage: (call) => { // this is for bidirectional streaming. Need to have another one for unary calls for web clients
                        let clientAddress = call.getPeer();
                        clients[clientAddress] = clientAddress

                        console.log(`Client connected from: ${clientAddress}`);

                        // Right now this is being broadcast.
                        messageToBeStream.subscribe({
                            next: (payload: any) => {
                                console.log(`Sending ${payload.appData.msgId}`)
                                let message: string = JSON.stringify(payload)
                                call.write({ message })
                                // let operation = call.write({ message }) 
                                console.log(call.cancelled) // Somehow returns boolean
                            },
                            error: err => console.error(err),
                            complete: () => { } //it will never complete
                        })

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
                            // but the stream never ends. THis is not a reliable way to tell if a client is disconnected
                        });

                        call.on('error', (err) => {
                            // Error that may occue during the rpc call. Id there's an error, put a callbacn function there to check the connection for client
                            // emit a yellow report to halt message release. If the server does not reply to the callback function, then emit a red card
                            // the call back function will be to write and then the client should response immediately through test
                        });

                        call.on('close', () => {
                            console.log('Unknown cause for diconnectivity');
                            // Handle client closure, which may be due to errors or manual termination
                        });

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
            }
            catch (error) {
                resolve(error)
            }

        })
    }

    // Create a bidirectional streaming call
    private async createServerStreamingClient(server: string, alreadyHealthCheck: boolean, unaryRequestSubject: Subject<any>, statusControl: Subject<ReportStatus>): Promise<string> {
        let subscription: any
        let unsubscribed: boolean = false

        return new Promise(async (resolve, reject) => {
            const client = new message_proto.Message(server, grpc.credentials.createInsecure());

            unaryRequestSubject.subscribe({
                next: (request: any) => {
                    let message = {
                        id: '123',
                        message: JSON.stringify(request)
                    }
                    console.log(`Sending request: ${message.id} over to server....`)
                    const call = client.HandleMessage(message);
                    call.on('status', (status: Status) => {
                        // console.log(status) // For more info: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
                        // https://grpc.io/docs/what-is-grpc/core-concepts/#streaming
                        if (status == grpc.status.OK) { // only returns a status when there's error. Otherwise it just waits
                            console.log(`Message trasmission operation is successful`)
                            // RPC completed successfully
                        } if (status == grpc.status.UNAVAILABLE) {
                            resolve('No connection established. Server is not responding..')
                        }
                    });

                    this.checkConnectionHealth(client, statusControl, alreadyHealthCheck)

                    // All the grpc operations are here
                    // Subscribe to the RxJS subject to send data to the server

                    call.on('data', (data: any) => {
                        let message = JSON.parse(data.message)
                        console.log(`Received data from Server: ${message.appData?.msgId ?? `Invalid`}`);
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
                }
            })


        })
    }

    // Check connection To be Update. This function is destroying my code flow
    private async checkConnectionHealth(client: any, statusControl: Subject<ReportStatus>, alreadyHealthCheck: boolean): Promise<boolean> {
        return new Promise((resolve, reject) => {
            client.Check({}, (error, response) => {
                if (response) {
                    console.log(`GRPC Health check status: ${response.status} Server Connected`);
                    let report: ReportStatus = {
                        code: ColorCode.GREEN,
                        message: `Good to go!!!`
                    }
                    statusControl.next(report)
                } else {
                    if (alreadyHealthCheck == false) console.error(`Health check failed: ${error}`);
                }
            })
        })
    }

}

