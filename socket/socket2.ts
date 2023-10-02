// require('dotenv').config();
import { config } from 'dotenv';
import { OutgoingMessage } from 'http';
import { Observable, Subject, interval } from 'rxjs';
import { Server } from "socket.io";
import { io } from "socket.io-client";
import { Message } from '../interfaces/message';

config()
let client: string

let outGoingInterval = interval(1000)
let outGoingMessage: Subject<Message> = new Subject()
let generalSubject: Subject<any> = new Subject()
generalSubject.subscribe((element) => {
    console.log(element)
})

connectIOserver(process.env.URL as string, outGoingMessage).subscribe((res) => {
    generalSubject.next(res)
})
registerUser(outGoingMessage)

/* ---------------------------------------------------------------------------------------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------------------------------------------------------------------------------------- */


function connectIOserver(clientUrl: string, outGoingMessage?: Subject<any> | Observable<any>): Subject<any> {
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

    outGoingMessage?.subscribe({
        next: message => {
            ioClient.emit('message', message)
        }
    })

    return responseSubject
}

function registerUser(subjectStream: Subject<Message>) {
    setTimeout(() => {
        let message: Message = {
            user: 'guest',
            action: {
                action: 'register',
                description: 'JWT token acquisition',
                payload: {
                    email: `test@email.com`,
                    username: 'testUser',
                    password: '1234'
                }
            }
        }
        subjectStream.next(message)
    }, 2000)
}
