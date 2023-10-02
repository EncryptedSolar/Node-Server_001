import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Subject } from 'rxjs';
const PROTO_PATH = __dirname + '/message.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const message_proto: any = grpc.loadPackageDefinition(packageDefinition).message;
const subject = new Subject();
const server = new grpc.Server();

function sayHello(callback) {
    callback(null, { message: 'Hello ' + 'come on!' });
}

// Add the streamingData function to the gRPC service
// server.addService(message_proto.Message.service, { sendMessage: sayHello });
server.addService(message_proto.Message.service, {
    sendMessageStream: (call) => {
        call.on('data', (data) => {
            console.log('Received data from client:', data.message);
            // Forward the received data to the RxJS subject
            subject.next(data.message);
        });

        call.on('end', () => {
            console.log('Client stream ended');
        });

        // Create a stream to send data to the client
        const stream = call;
        subject.subscribe((message) => {
            console.log('Sending data to client:', message);
            stream.write({ message });
        });
    },
});

// Bind and start the server
server.bindAsync('0.0.0.0:3001', grpc.ServerCredentials.createInsecure(), () => {
    console.log('gRPC server is running on port 3001');
    server.start();
});
