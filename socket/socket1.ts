// require('dotenv').config();
import { config } from 'dotenv';
import { Subject, interval } from 'rxjs';
import { Server } from "socket.io";

config()

const sequentialNumbers$ = interval(1000);
sequentialNumbers$.subscribe((e: number) => requestSubject.next(e))

let generalSubject: Subject<any> = new Subject()
generalSubject.subscribe(e => console.log(e))
let requestSubject: Subject<any> = new Subject()

createIOserver(parseInt(process.env.PORT as string), requestSubject).subscribe((res) => {
    generalSubject.next(res)
})


function createIOserver(port: number, requestSubject?: Subject<any>): Subject<any> {
    let responseSubject: Subject<any> = new Subject()
    requestSubject?.subscribe({
        next: (element) => { ioServer.emit('message', `notification: ${element}`) },
        error: (err) => { console.error(err) },
        complete: () => { }
    })
    // Creating IO Server
    const ioServer = new Server();
    ioServer.listen(port);
    console.log(`Socket.IO server is running on port ${port}`);

    // Define a connection event handler
    ioServer.on(`connection`, (socket) => {
        console.log(`Client connected with ID: ${socket.id}`);
        ioServer.emit('message', `Connection Established: ${socket.id}`)

        // Handle messages from clients
        socket.on('message', (message) => {
            responseSubject.next(message)
            let acknowledge = `Message${message.id || ''} received. Instructions acknowledged`
            ioServer.to(socket.id).emit('acknowledgement', acknowledge)
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log("A user disconnected");
        });

    });

    return responseSubject
}

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------------------------------------------------------------------- */


function checkMessagse(message): any {
    /* Check the messages. What is it and how to reply them */
    let resposne
    return resposne
}