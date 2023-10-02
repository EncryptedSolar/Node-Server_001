import * as grpc from '@grpc/grpc-js';
import { rejects } from 'assert';
import * as fs from 'fs'
import { Subject, interval, map, throttleTime } from 'rxjs';

// Subject for bidirectional communication
const message_proto = require('./protos/server.proto')
let numueric = interval(1000)
let notificationSubject: Subject<any> = new Subject()
let errorSubject: Subject<any> = new Subject()
// Example: Send data to the server
numueric.pipe(map(
  number => `Notification ${number} from Client`
)).subscribe((message: string) => notificationSubject.next(message))

errorSubject.subscribe(info => console.log(info))

// Create a bidirectional streaming call
async function connectServer(server): Promise<string> {
  let subscription;
  let unsubscribed = false;

  return new Promise((resolve, reject) => {
    const client = new message_proto.Message(server, grpc.credentials.createInsecure());
    const call = client.sendMessageStream();

    call.on('data', (response) => {
      console.log(`Received data from Server: ${response.message}`);
    });

    call.on('error', (err) => {
      errorSubject.next(err);
    });

    call.on('end', () => {
      console.log('Server stream ended');
      if (!unsubscribed && subscription) {
        subscription.unsubscribe();
        unsubscribed = true;
      }
      resolve('Server Error');
    });

    // Subscribe to the RxJS subject to send data to the server
    subscription = notificationSubject.subscribe((message: string) => {
      if (!unsubscribed) {
        console.log('Sending data to server:', message);
        call.write({ message });
      }
    });

  });
}

async function checkServerHealth(): Promise<any> {
  return new Promise((resolve, reject) => {
    const healthCheck = new message_proto.Message('localhost:3001', grpc.credentials.createInsecure());
    healthCheck.Check({}, (error, response) => {
      if (!error) {
        console.log(`Health check status: ${response.status}`);
        resolve(response.status);
      } else {
        console.error(`Health check failed: ${error}`);
        errorSubject.next(error)
        reject(error);
      }
    });
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

      // If there are 10 consecutive resolutions, log an error and break the loop
      if (consecutiveResolutions >= 10) {
        console.error('Connection failed 10 times. Stopping connection attempts.');

        break;
      }
    } catch (error) {
      // Connection did not resolve, reset the count
      consecutiveResolutions = 0;
      console.error('Connection attempt failed:', error);
    }

    // Check for a pause of more than 5 seconds since the last resolution attempt
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





// Example usage
manageConnection().catch(error => {
  console.error('Unexpected error:', error);
});


setTimeout(() => {
  checkServerHealth()
    .then((status) => {
      // Handle success
    })
    .catch((error) => {
      // Handle error
    });
}, 3000)

