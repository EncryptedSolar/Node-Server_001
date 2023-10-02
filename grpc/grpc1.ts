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
const server = new grpc.Server();
const respmsgSubject: Subject<any> = new Subject()
const errorSubject: Subject<any> = new Subject()

// Add the streamingData function to the gRPC service
// server.addService(message_proto.Message.service, { sendMessage: sayHello });
server.addService(message_proto.Message.service, {
    sendMessageStream: (call) => {
        call.on('data', (message) => {
            if(message.message == 'Error') {
                call.emit(`error`, new Error(`Custom Error from server`))
            }
            console.log('Received message from client:', message);
            // Forward the received message to the RxJS subject
            let respmsg = `${message.message} acknowledged!`
            respmsgSubject.next(respmsg);
        });

        call.on('end', () => {
            console.log('Client stream ended');
        });

        call.on('error', (err) => {
            errorSubject.next(err)
        })

        // Create a stream to send data to the client
        const stream = call;
        respmsgSubject.subscribe((message) => {
            console.log('Sending data to client:', message);
            stream.write({ message });
        });

        errorSubject.subscribe(info => console.log(info))
    },
});

// Bind and start the server
server.bindAsync('0.0.0.0:3001', grpc.ServerCredentials.createInsecure(), () => {
    console.log('gRPC server is running on port 3001');
    server.start();
});


/* Behaviour
When server is disconnected, the client will still send regardless of whether server is alive. 
Of course, an error will be shown on client side if there's no connection established with the server.
But nevertheless it will attempt to send. ALthough the sad news is, even if the server is restarted,
the client would not automatically attempt to reconnect. 
As for the error message trigger, it seems that on the server side, if the error is triggered, in
that call.emit('error'), it will cease it's own operation. Further investigation is to be conducted
to understand the operatives of grpc
*/