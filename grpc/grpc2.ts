import * as fs from 'fs'
import { Subject } from 'rxjs';
import { ColorCode, ReportStatus } from '../interfaces/general.interface';
import { GrpcService } from '../services/grpc.service';
import { FisErrorHandlingService } from '../services/error.handling.service.fis';

// Subject for bidirectional communication
const errorHandlingService: FisErrorHandlingService = new FisErrorHandlingService()
const grpcService: GrpcService = new GrpcService()
const messagesJSON: any = fs.readFileSync('payload.json')
let parsedMessages: any[] = JSON.parse(messagesJSON) // load the fake messages generated for this trial 
let messageToBeReleased: Subject<any> = new Subject() // Sample message to be transmitted over to target server
let statusControl: Subject<ReportStatus> = new Subject() // Listening for error events and states
let dataMessages = stream() // Emulate messges to be sent over to target server
let server1: string = 'localhost:3000'
let unaryRequestSubject: Subject<any> = new Subject()

errorHandlingService.handleMessage(unaryRequestSubject, statusControl).subscribe((messages) => {
  messageToBeReleased.next(messages)
})

grpcService.createGrpcInstance(server1, unaryRequestSubject, statusControl, { instanceType: 'client', serviceMethod: 'server streaming' })
// grpcService.createGrpcInstance(server1, messageToBeReleased, statusControl, { instanceType: 'client', serviceMethod: 'bidirectional' })

let testMessageRequest = {
  appLogLocId: "68ca0bae-2acd-44f2-b54c-836d6af92890",
  appData: {
    msgId: "74023eec-2cf9-422c-ab15-e65c6e08b213",
    msgLogDateTime: "2023-09-10T17:07:35.262Z",
    msgDateTime: "2023-01-16T04:51:29.595Z",
    msgTag: [
      "free",
      "enterprise",
      "rich"
    ],
    msgPayload: "Autus ducimus deinde thema. Succurro tui denuncio nostrum summisse aiunt statua. Cribro commemoro utique.\nUlterius apparatus copia argentum solium textor denego inventore thymbra aegre. Acsi cometes color perspiciatis. Pax caste derelinquo amicitia tui molestiae culpo cohaero.\nRepudiandae desipio tero decretum atrocitas. Trado aptus sunt utor arcus quos molestias. Tabella enim curto clibanus cavus usus villa.\nCondico viriliter reprehenderit unus curriculum. Numquam velut adsuesco adversus veritatis callide delibero umquam vulariter deporto. Inventore astrum cavus ambulo creptio.\nSuspendo demo carus fuga. Decerno dolores deficio accusator. Aestus quod dedico contigo magni."
  }
}

setTimeout(() => {
  unaryRequestSubject.next(testMessageRequest)
}, 2000)
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

