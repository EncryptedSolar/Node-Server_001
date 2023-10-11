import { Subject } from "rxjs";
import { GrpcService } from "../services/grpc.service";
import * as fs from 'fs'
import { FisErrorHandlingService } from "../services/error.handling.service.fis";
import { ReportStatus } from "../interfaces/general.interface";

const gprcService: GrpcService = new GrpcService()
const messagesJSON: any = fs.readFileSync('payload.json')
const errorHandlingService: FisErrorHandlingService = new FisErrorHandlingService()

let parsedMessages: any[] = JSON.parse(messagesJSON) // load the fake messages generated for this trial 
let dataMessages = stream() // Emulate messges to be sent over to target server
let messageToBePublished: Subject<any> = new Subject()
let statusControl: Subject<ReportStatus> = new Subject()
errorHandlingService.handleMessage(dataMessages, statusControl).subscribe((messages) => {
  messageToBePublished.next(messages)
})

let server1 = 'localhost:3000'
let server2 = 'localhost:3001'

// gprcService.createGrpcInstance(server1, messageToBePublished, statusControl, { instanceType: 'server', serviceMethod: 'bidirectional'})
gprcService.createGrpcInstance(server1, dataMessages, statusControl, { instanceType: 'server', serviceMethod: 'server streaming' })


// setTimeout(() => {
//   gprcService.stopServer(server1).then((res) => {
//     gprcService.getAllGrpcServerConnectionInstance()
//   })
// }, 3000)

// setTimeout(() => {
//   gprcService.createGrpcServerStreamingServer(server1).then((res) => {
//     gprcService.getAllGrpcServerConnectionInstance()
//   })
// }, 10000)

/* Behaviour
When server is disconnected, the client will still send regardless of whether server is alive. 
Of course, an error will be shown on client side if there's no connection established with the server.
But nevertheless it will attempt to send. ALthough the sad news is, even if the server is restarted,
the client would not automatically attempt to reconnect. 
As for the error message trigger, it seems that on the server side, if the error is triggered, in
that call.emit('error'), it will cease it's own operation. Further investigation is to be conducted
to understand the operatives of grpc
*/


// this is just to publish an array of fake data as a Subject
function stream(): Subject<any> {
  let result: Subject<any> = new Subject()
  let messages: any[] = parsedMessages
  let count = 0
  const intervalId = setInterval(() => {
    result.next(messages[count]);
    count++;
    if (count >= 1000) {
      clearInterval(intervalId);
      result.complete();
    }
  }, 1000)

  return result
}
