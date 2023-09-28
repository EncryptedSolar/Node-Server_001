import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

const PROTO_PATH = __dirname + '/message.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const message_proto: any = grpc.loadPackageDefinition(packageDefinition).message;

// Implement your gRPC service methods
const server = new grpc.Server();

// Implement the streamingData function for sendMessageStream
function streamingData(call: grpc.ServerDuplexStream<any, any>) {
    console.log('Client connected.');

    // Create an RxJS interval observable that emits data every second.
    const dataStream = interval(1000);

    // Subscribe to the data stream and send each value to the client.
    const subscription = dataStream.pipe(
        takeUntil(call)
    ).subscribe(
        (value) => {
            const response = { message: `Message ${value}` };
            call.write(response);
        },
        (error) => {
            console.error('Error:', error);
        },
        () => {
            console.log('Streaming completed.');
            call.end();
        }
    );

    // Handle client stream end event.
    call.on('end', () => {
        console.log('Client disconnected.');
        subscription.unsubscribe(); // Stop the RxJS subscription when the client disconnects.
    });
}

function sayHello(callback) {
    callback(null, { message: 'Hello ' + 'come on!' });
}

// Add the streamingData function to the gRPC service
server.addService(message_proto.Message.service, { sendMessage: sayHello });

// Bind and start the server
server.bindAsync('0.0.0.0:3001', grpc.ServerCredentials.createInsecure(), () => {
    console.log('gRPC server is running on port 3001');
    server.start();
});
