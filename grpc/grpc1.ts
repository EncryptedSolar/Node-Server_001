import { Subject } from "rxjs";
import { GrpcService } from "../services/grpc.service";
import * as fs from 'fs'
import { FisErrorHandlingService } from "../services/error.handling.service.fis";
import { ReportStatus } from "../interfaces/general.interface";
import { ConnectionAuditService } from "../services/error.handling.service";
import { MongoConnectionService } from "../services/mongo.service";

const messagesJSON: any = fs.readFileSync('payload.json')
const mongoService: MongoConnectionService = new MongoConnectionService()
// const errorHandlingService: FisErrorHandlingService = new FisErrorHandlingService()
const errorHandlingService: ConnectionAuditService = new ConnectionAuditService(mongoService)
const gprcService: GrpcService = new GrpcService()

let parsedMessages: any[] = JSON.parse(messagesJSON) // load the fake messages generated for this trial 
let dataMessages = stream() // Emulate messges to be sent over to target server
let messageToBePublished: Subject<any> = new Subject()
let statusControl: Subject<ReportStatus> = new Subject()

/* For server streaming */
// errorHandlingService.handleMessage(dataMessages, statusControl).subscribe((messages) => {
//   messageToBePublished.next(messages)
// })
// let server1 = 'localhost:3000'
// gprcService.createGrpcInstance(server1, messageToBePublished, statusControl, { instanceType: 'server', serviceMethod: 'server streaming' })


/* For bidiretional streaming*/
errorHandlingService.handleMessage(dataMessages, statusControl).subscribe((messages) => {
  messageToBePublished.next(messages)
})
let server1 = 'localhost:3000'
gprcService.createGrpcInstance(server1, messageToBePublished, statusControl, { instanceType: 'server', serviceMethod: 'bidirectional' })


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
  }, 500)

  return result
}
