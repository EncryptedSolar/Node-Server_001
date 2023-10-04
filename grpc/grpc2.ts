import * as grpc from '@grpc/grpc-js';
import * as fs from 'fs'
import { Subject } from 'rxjs';
import { ErrorHandlingService } from '../services/error.handling.service';

// Subject for bidirectional communication
const message_proto = require('./protos/server.proto')
const errorHandlingService: ErrorHandlingService = new ErrorHandlingService()
const messagesJSON: any = fs.readFileSync('payload.json')
let parsedMessages = JSON.parse(messagesJSON) // load the fake messages generated for this trial 
let notificationSubject: Subject<any> = new Subject() // Sample notification message to be transmitted over to target server
let errorSubject: Subject<any> = new Subject()
let statusControl: Subject<any> = new Subject()

statusControl.subscribe((message) => {
  errorHandlingService.handleMessage(message)
})

errorSubject.subscribe(info => {
  console.log(info)
  // statusControl.next(info)
})

// Create a bidirectional streaming call
async function connectServer(server): Promise<string> {
  let subscription: any
  let unsubscribed: boolean = false
  let connectionStatus: boolean = false

  return new Promise((resolve, reject) => {
    const client = new message_proto.Message(server, grpc.credentials.createInsecure());
    const call = client.sendMessageStream();
    
    // Check connection
    client.Check({}, (error, response) => {
      if (error) {
        console.error(`Health check failed: ${error}`);
        errorSubject.next(error)
        connectionStatus = false
        resolve(error.message); // it should have been resolved here, and the following code would not have run
      } else {
        console.log(`Health check status: ${response.status} Server Connected`);
        connectionStatus = true
      }
    })

    // the issue is the connection status was made true somewhere here hence the error 

    if (connectionStatus = true) {
      proceedWithGrpcOperations().then((res) => {
        resolve(res)
      })
    } else {
      resolve(`Connection status is ${connectionStatus}`)
    }

    // All the grpc operations are here
    async function proceedWithGrpcOperations(): Promise<any> {
      return new Promise((resolve, reject) => {
        // Subscribe to the RxJS subject to send data to the server
        subscription = notificationSubject.subscribe((data: any) => {
          if (!unsubscribed) {
            let message: string = JSON.stringify(data)
            console.log(`Sending Data to Server: ${data.appData?.msgId}`);
            statusControl.next(data)
            // Note: The parameter here MUST BE STRICTLY be the same letter as defined in proto. Eg: message MessageRequest { string >>'message'<< = 1 }
            call.write({ message });
          }
        });

        call.on('data', (data: any) => {
          // console.log(data)
          let message = JSON.parse(data.message)
          statusControl.next(message)
          console.log(`Received data from Server: ${message.msgId ?? `Invalid`}`);
          // errorHandlingService.displayTable()
        });

        call.on('error', (err) => {
          errorSubject.next(err);
          resolve(err)
        });

        call.on('end', () => {
          console.log('Server stream ended');
          if (!unsubscribed && subscription) { // kill subcription to prevent memory leaks
            subscription.unsubscribe();
            unsubscribed = true;
          }
          errorSubject.next('Server Disconnected or destroyed by server') // Based on the assumptions that the server should not be dead
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

  while (true) {
    try {
      await connectServer('localhost:3001');
      // If connection resolves (indicating failure), increment the count
      consecutiveResolutions++;
      console.log(`Reconnection Attempt: ${consecutiveResolutions}`)

      // If there are 60 consecutive resolutions, log an error and break the loop
      if (consecutiveResolutions >= 60) {
        console.error('Connection failed 10 times. Stopping connection attempts.');

        break;
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
    }

    // Update the last resolution time
    lastResolutionTime = currentTime;

    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before the next attempt
  }
}

// this is just to publish an array of fake data as a Subject
function stream(): Subject<any> {
  let result: Subject<any> = new Subject()
  let messages = parsedMessages
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

let messageStream: Subject<any> = stream()
messageStream.subscribe({
  next: (message: any) => {
    notificationSubject.next(message)
  },
  error: (err) => console.error(err),
  complete: () => { }
})

// Example usage
manageConnection().catch(error => {
  console.error('Unexpected error:', error);
});

