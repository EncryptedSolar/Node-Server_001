import * as grpc from '@grpc/grpc-js';
import { Subject } from 'rxjs';
const message_proto = require('./protos/server.proto')

// const message_proto = require('./protos/server.proto')
const server = new grpc.Server();
const errorSubject: Subject<any> = new Subject()

// Add the streamingData function to the gRPC service
// Define your message_proto.Message service methods
server.addService(message_proto.Message.service, {
    sendMessageStream: (call) => {
        // Create a stream to send data to the client
        const stream = call;

        call.on('data', (data: any) => {
            // console.log(data) // it does return in string format
            let payload = JSON.parse(data.message)
            console.log(`Received Message from Client: ${payload.id}`);
            // Forward the received message to the RxJS subject
            let respmsg: any = {
                message: `Message ${payload.id} acknowledged!`
            }
            let message: string = JSON.stringify(respmsg)
            console.log(`Responding to client: ${respmsg.message}`);
            call.write({ message });
        });

        call.on('end', () => {
            console.log('Client stream ended');
        });

        call.on('error', (err) => {
            errorSubject.next(err.message);
        });

        errorSubject.subscribe(info => {
            // call.emit('error', info)
        });
    },

    Check: (_, callback) => {
        // health check logic here
        // For simplicity, always return "SERVING" as status
        callback(null, { status: 'SERVING' });
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