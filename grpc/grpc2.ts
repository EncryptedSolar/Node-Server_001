import * as fs from 'fs'
import { Subject } from 'rxjs';
import { ErrorHandlingService } from '../services/error.handling.service';
import { ReportStatus } from '../interfaces/general.interface';
import { GrpcService } from '../services/grpc.service';
import { MongoConnectionService } from '../services/mongo.service';

// Subject for bidirectional communication
const mongoService: MongoConnectionService = new MongoConnectionService()
const errorHandlingService: ErrorHandlingService = new ErrorHandlingService(mongoService)
const grpcService: GrpcService = new GrpcService()
const messagesJSON: any = fs.readFileSync('payload.json')
let parsedMessages: any[] = JSON.parse(messagesJSON) // load the fake messages generated for this trial 
let messageToBeTransmitted: Subject<any> = new Subject() // Sample message to be transmitted over to target server
let messageToBeReleased: Subject<any> = new Subject() // Sample message to be transmitted over to target server
let statusControl: Subject<ReportStatus> = new Subject() // Listening for error events and states
let dataMessages = stream() // Emulate messges to be sent over to target server
let server1: string = 'localhost:3000'

errorHandlingService.handleMessage(dataMessages, statusControl).subscribe((messages) => {
  messageToBeReleased.next(messages)
})

grpcService.createGrpcClientConnectionInstance(server1, statusControl, messageToBeReleased)

// Create a bidirectional streaming call

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

