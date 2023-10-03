import * as _ from 'lodash'
import { Subject, map } from 'rxjs'

export class ErrorHandlingService {

    public mapMessageWithStatesAndId(messageSubject: Subject<any>): Subject<stateMessage> {
        let transformedMessage: Subject<stateMessage> = new Subject()
        let count = 0; // Move count outside of the map function

        messageSubject.pipe(
            map(messages => {
                let transformedMsg: stateMessage = {
                    id: count++,
                    state: 'not sent',
                    message: messages
                }
                return transformedMsg; // Return the transformed message
            })
        ).subscribe(transformedMsg => {
            transformedMessage.next(transformedMsg); // Emit the transformed message
        });

        return transformedMessage;
    }
}
interface stateMessage {
    id: number,
    state: 'not sent' | 'sent' | 'stored in array instance' | 'stored in local storage',
    message: any
}