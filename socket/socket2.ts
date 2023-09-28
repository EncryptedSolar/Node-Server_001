// require('dotenv').config();
import { config } from 'dotenv';
import { Subject, interval } from 'rxjs';
import { Server } from "socket.io";
import { io } from "socket.io-client";

config()
let client: string

let messageInterval = interval(1000)
messageInterval.subscribe(e => {
    requestSubject.next(e)
})
let requestSubject: Subject<any> = new Subject()
let generalSubject: Subject<any> = new Subject()
generalSubject.subscribe((element) => {
    console.log(element)
})
// createIOserver(parseInt(process.env.PORT2 as string)).subscribe((res) => {
//     generalSubject.next(res)
// })
connectIOserver(process.env.URL as string, requestSubject).subscribe((res) => {
    generalSubject.next(res)
})



function createIOserver(port: number): Subject<any> {
    let responseSubject: Subject<any> = new Subject()
    // Creating IO Server
    const ioServer = new Server();
    ioServer.listen(port);
    console.log(`Socket.IO server is running on port ${port}`);

    // Define a connection event handler
    ioServer.on(`connection`, (socket) => {
        console.log(`Client connected with ID: ${socket.id}`);

        // Handle messages from clients
        socket.on('message', (message) => {
            let acknowledge = 'Message RECEIVED.'
            ioServer.to(socket.id).emit('acknowledgement', acknowledge)
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`${socket.id} is disconnected.`);
        });
    });

    return responseSubject
}

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------------------------------------------------------------------- */


function connectIOserver(clientUrl: string, requestSubject?: Subject<any>): Subject<any> {
    let responseSubject: Subject<any> = new Subject()
    // Declare target server to be connected
    const ioClient = io(clientUrl); // Replace with your server address and port

    // Listen for the "connect" event
    ioClient.on('connect', () => {
        let message = `Attempting connection with main server...`
        responseSubject.next(message)
    });

    // Listen for incoming messages
    ioClient.on('message', (message: string) => {
        responseSubject.next(message)
    });
    
    // Listen for incoming messages
    ioClient.on('acknowledgement', (message) => {
        responseSubject.next(message)
    });

    // Listen for the "disconnect" event
    ioClient.on('disconnect', () => {
        let message = `Disconnected from Server: ${clientUrl}`
        responseSubject.next(message)
    });

    requestSubject?.subscribe({
        next: e => {
            let message = {
                id: e,
                message: `Plese do something`
            }
            ioClient.emit('message', message)
        }
    })

    return responseSubject
}
