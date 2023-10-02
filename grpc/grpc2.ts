import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Observable, Subject } from 'rxjs';
const PROTO_PATH = __dirname + '/message.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
// Subject for bidirectional communication
const subject = new Subject();
const message_proto: any = grpc.loadPackageDefinition(packageDefinition).message;
const client = new message_proto.StreamingService(
  'localhost:3001',
  grpc.credentials.createInsecure()
);

// Create a bidirectional streaming call
const call = client.StreamData();

call.on('data', (response) => {
  console.log('Received data from server:', response.message);
});

call.on('end', () => {
  console.log('Server stream ended');
});

// Subscribe to the RxJS subject to send data to the server
subject.subscribe((message) => {
  console.log('Sending data to server:', message);
  call.write({ message });
});

// Example: Send data to the server
subject.next('Hello from client');
subject.next('Another message from client');
