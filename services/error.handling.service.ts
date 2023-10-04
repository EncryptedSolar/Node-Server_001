import * as _ from 'lodash'
import { Subject } from 'rxjs'

export class ErrorHandlingService {
    private trackedMessage: stateMessage[] = []
    private bufferedStorage: stateMessage[] = []

    public handleMessage(args: any) {
        console.log(`Processing data....`)
        this.processArgument(args)
    }

    public displayTable() {
        if (Array.isArray(this.trackedMessage) && this.trackedMessage.length > 0) {
            const headerRow = Object.keys(this.trackedMessage[0]).join('\t');
            console.log(headerRow);

            // Create a separator row
            const separatorRow = '-'.repeat(headerRow.length);
            console.log(separatorRow);

            // Create rows for the data
            this.trackedMessage.forEach((row) => {
                const rowData = Object.values(row).join('\t');
                console.log(rowData);
            });
        } else {
            console.log("No data available in 'trackedMessage'");
        }
    }

    private processArgument(args: any): boolean {
        switch (true) {
          case this.isMessageLog(args):
            console.log(`Valid Message Object! ${args.appData.msgId}`);
            this.assignTracker(args as MessageLog);
            break;
          case this.isServerResponse(args):
            console.log(`Valid Server Response: ${args.msgId}`);
            this.removeTrackedMessage(args as ServerResponse);
            break;
          case this.isErrorResponse(args):
            console.log('Valid Error or UnknownObject');
            // You can add code here for error handling
            break;
          default: 
            console.log('Unknown argument type');
            break;
        }
        return false;
      }
      

    private assignTracker(message: MessageLog): stateMessage {
        console.log(`Assigning state to ${message.appData.msgId}`)
        let assignTracking: stateMessage = {
            id: message.appData?.msgId ?? 'no id found',
            state: 'not sent'
        }
        this.trackedMessage.push(assignTracking)
        return assignTracking
    }

    private removeTrackedMessage(args: ServerResponse) {
        this.trackedMessage.forEach((message: stateMessage) => {
            if (message.id == args.msgId) {
                let indexToRemove = this.trackedMessage.findIndex(obj => obj.id === message.id);
                if (indexToRemove !== -1) {
                    console.log(`Deleting ${args.msgId}...`)
                    this.trackedMessage.splice(indexToRemove, 1);
                }
            }
        })
    }

    private storeMessageInBuffer(message: stateMessage) {
        this.bufferedStorage.push(message)
    }

    private isServerResponse(obj: any): obj is ServerResponse {
        return (
            'confirmationMessage' in obj &&
            'msgId' in obj
        )
    }

    private isErrorResponse(obj: any): obj is any {
        return obj
    }

    private isMessageLog(obj: any): obj is MessageLog {
        return (
            'appLogLocId' in obj &&
            'appData' in obj &&
            'msgId' in obj.appData &&
            'msgLogDateTime' in obj.appData &&
            'msgDateTime' in obj.appData &&
            'msgTag' in obj.appData &&
            'msgPayload' in obj.appData
        );
    }



}
interface stateMessage {
    id: string,
    state: 'not sent' | 'sent' | 'acknowledged by server' | 'stored in array instance' | 'stored in local storage',
    date?: Date,
}
interface MessageLog {
    appLogLocId: string,
    appData: {
        msgId: string,
        msgLogDateTime: string,
        msgDateTime: string,
        msgTag: string[],
        msgPayload: any
    }
}
interface ServerResponse {
    confirmationMessage: string,
    msgId: string
}


// public handleMessage(messageToBePublished: Subject<any> | Observable<any>): Subject<any> | Observable<any> {
//     messageToBePublished.pipe(map(
//         message => {
//             let trackMsg: stateMessage = {
//                 id: message.appData?.msgId ?? 'no Id found',
//                 state: 'not sent'
//             }
//             this.trackedMessage.push(trackMsg)
//         }
//     ))

//     return messageToBePublished
// }