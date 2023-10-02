import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Observable, Subject, interval, map } from 'rxjs';
const PROTO_PATH = __dirname + '/message.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
// Subject for bidirectional communication
const message_proto: any = grpc.loadPackageDefinition(packageDefinition).message;
const client = new message_proto.Message('localhost:3001',
  grpc.credentials.createInsecure());
const call = client.sendMessageStream();

let numueric = interval(1000)
let notifcationSubject: Subject<any> = new Subject()
let errorSubject: Subject<any> = new Subject()

// Example: Send data to the server
numueric.pipe(map(
  number => `Notification ${number} from Client`
)).subscribe((message: string) => notifcationSubject.next(message))


// Create a bidirectional streaming call
call.on('data', (response) => {
  console.log(`Receied data from Server: ${response.message}`);
});

call.on('error', (err) => {
  errorSubject.next(err)
})

call.on('end', () => {
  console.log('Server stream ended');
});

// Subscribe to the RxJS subject to send data to the server
notifcationSubject.subscribe((message: string) => {
  console.log('Sending data to server:', message);
  call.write({ message });
});

errorSubject.subscribe(info => console.log(info))

setTimeout(() => {
  notifcationSubject.next('Error')
}, 3000)
