import * as grpc from '@grpc/grpc-js';
import * as fs from 'fs'
import { Subject } from 'rxjs';
import { ErrorHandlingService } from '../services/error.handling.service';
import { Status } from '@grpc/grpc-js/build/src/constants';
import { ColorCode, ReportStatus } from '../interfaces/general.interface';

// Subject for bidirectional communication
const message_proto = require('./protos/server.proto')
const errorHandlingService: ErrorHandlingService = new ErrorHandlingService()
const messagesJSON: any = fs.readFileSync('payload.json')
let parsedMessages: any[] = JSON.parse(messagesJSON) // load the fake messages generated for this trial 
let messageToBeTransmitted: Subject<any> = new Subject() // Sample message to be transmitted over to target server
let statusControl: Subject<ReportStatus> = new Subject() // Listening for error events and states
let dataMessages = stream() // Emulate messges to be sent over to target server

errorHandlingService.handleMessage(dataMessages, statusControl).subscribe((messages) => {
  messageToBeTransmitted.next(messages)
})

// Create a bidirectional streaming call
async function connectServer(server: string, alreadyHealthCheck: boolean): Promise<string> {
  let subscription: any
  let unsubscribed: boolean = false

  return new Promise(async (resolve, reject) => {
    const client = new message_proto.Message(server, grpc.credentials.createInsecure());
    const call = client.sendMessageStream();

    call.on('status', (status: Status) => {
      // console.log(status) // For more info: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
      if (status) { // only returns a status when there's error. Otherwise it just waits
        resolve('No connection established. Server is not responding..')
      } else {
      }
    });

    checkConnectionHealth()
    proceedWithGrpcOperations().then((res) => {
      resolve(res)
    })

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

    // All the grpc operations are here
    async function proceedWithGrpcOperations(): Promise<any> {
      return new Promise((resolve, reject) => {

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

        // This guy doesnt work. It is for the entire RPC call. Because I am using bi-directional streaming here
        // https://grpc.io/docs/what-is-grpc/core-concepts/#streaming
        // call.on('status', (status) => {
        //   if (status.code === grpc.status.OK) {
        //     console.log(`Message trasmission operation is successful`)
        //     // RPC completed successfully
        //   } else {
        //     // Handle the error using status.code and status.details
        //     console.error(`Error code: ${status.code}`);
        //     console.error(`Error details: ${status.details}`);
        //   }
        // });

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
      })
    }
  });
}

// To be migrated into a service in the immediate future
async function manageConnection() {
  let consecutiveResolutions = 0;
  let lastResolutionTime = Date.now();
  let alreadyHealthCheck: boolean = false
  let yellowErrorEmission: boolean = false
  let redErrorEmission: boolean = false

  while (true) {
    try {
      await connectServer('localhost:3001', alreadyHealthCheck);
      // If connection resolves (indicating failure), increment the count
      consecutiveResolutions++;
      console.log(`Reconnection Attempt: ${consecutiveResolutions}`)
      alreadyHealthCheck = true


      // If there are 60 consecutive resolutions, log an error and break the loop
      if (consecutiveResolutions >= 5 && redErrorEmission == false) {
        redErrorEmission = true
        console.error('Connection failed 60 times. Stopping connection attempts.');
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
  }
}

// this is just to publish an array of fake data as a Subject
function stream(): Subject<any> {
  let result: Subject<any> = new Subject()
  let messages: any[] = parsedMessages
  let count = 0
  const intervalId = setInterval(() => {
    result.next(messages[count]);
    count++;
    if (count >= 1000) {
      clearInterval(intervalId);
      result.complete();
    }
  }, 1000)

  return result
}

// Example usage
manageConnection().catch(error => {
  console.error('Unexpected error:', error);
});

