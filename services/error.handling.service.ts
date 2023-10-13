import * as _ from 'lodash'
import { Observable, Subject, Subscription, from } from 'rxjs'
import { ColorCode, MessageLog, ReportStatus } from '../interfaces/general.interface'
import { MongoConnectionService } from './mongo.service';
require('dotenv').config();

// Implement status chain refactoring
export class ConnectionAuditService {
    private bufferedStorage: MessageLog[] = []
    private database: string = `emergencyStorage`
    private mongoUrl: string = process.env.MONGO as string
    private maximumBufferLength: number = parseInt(process.env.MaxBufferLoad as string) // right now just put as 15

    constructor(private mongoService: MongoConnectionService) {
        mongoService.manageMongoConnection(this.database, this.mongoUrl)
    }

    // Main function that intercepts outgoing messages by communicating || intepreting report status from grpc connection as indicator
    public handleMessage(messageToBePublished: Subject<MessageLog>, statusReport: Subject<ReportStatus>): Subject<MessageLog> {
        let releaseMessageSubject: Subject<MessageLog> = new Subject()
        let messageReleaseSubscription: Subscription | null = null; // Initialize as null
        let messageBufferSubscription: Subscription | null = null
        let messageStreamToMongo: Subscription | null = null
        this.checkBufferLimit(messageToBePublished, statusReport)
        statusReport.subscribe((report: any) => {
            if (report.code == ColorCode.GREEN) {
                console.log(`Connection status report: ${report.message ?? 'No Message'}`)
                messageStreamToMongo = this.deactivateMongoStreamSubscription(messageStreamToMongo)
                this.releaseMessageFromLocalBuffer(this.bufferedStorage).then((resObs: Observable<MessageLog>) => {
                    resObs.subscribe({
                        next: message => releaseMessageSubject.next(message),
                        error: err => console.error(err),
                        complete: () => {
                            this.bufferedStorage = []
                            console.log(`Reset buffer Storage count: ${this.bufferedStorage.length}. All messages have been released back into the stream.`)
                        }
                    })
                }).catch((err) => console.error(err))
                this.releaseMessageFromMongoStorage().then((resObs: Subject<MessageLog>) => {
                    resObs.subscribe({
                        next: message => releaseMessageSubject.next(message),
                        error: err => console.error(err),
                        complete: () => console.log(`All Mongo data are transferred `)
                    })
                }).catch((err) => console.error(err))
                messageReleaseSubscription = this.activateReleaseSubscription(messageReleaseSubscription, messageToBePublished, releaseMessageSubject)
                messageBufferSubscription = this.deactivateBufferSubscription(messageBufferSubscription)
            }
            if (report.code == ColorCode.YELLOW) {
                if (report.payload) {
                    console.log(`Rebuffering ${report.payload.appData?.msgId} into buffer...`)
                    this.bufferedStorage.push(report.payload)
                }
                console.log(`Connection status report: ${report.message ?? 'No Message'}`)
                messageBufferSubscription = this.activateBufferSubscription(this.bufferedStorage, messageBufferSubscription, messageToBePublished)
                messageReleaseSubscription = this.deactivateReleaseSubscription(messageReleaseSubscription)
            }
            if (report.code == ColorCode.RED) {
                console.log(`Connection status report: Server down. ${report.message} lol`)
                messageStreamToMongo = this.activateMongoStreamSubscription(messageStreamToMongo, messageToBePublished)
                messageBufferSubscription = this.deactivateBufferSubscription(messageBufferSubscription)
                this.transferBufferedMessagseToMongoStorage(this.bufferedStorage, messageBufferSubscription)
            }
            if (!report.code || report.code == "") {
                console.log(`Unknown message...`)
            }
        })
        return releaseMessageSubject
    }

    private checkBufferLimit(message: Subject<any>, statusReport: Subject<ReportStatus>) {
        message.subscribe(() => {
            if (this.bufferedStorage.length >= this.maximumBufferLength) {
                // for every messges that comes in, check the bufffer size, if it exceesd more than designated amount, push a red report status i
                console.log(`Buffer length exceeds limit imposed!!!`)
                let report: ReportStatus = {
                    code: ColorCode.RED,
                    message: `Buffer is exceeding limit. Initiate storage transfer to designated database. `
                }
                statusReport.next(report)

            }
        })
    }

    // Release the incoming Messages to be returned to the caller
    private activateReleaseSubscription(messageReleaseSubscription, messageToBePublished, releaseMessageSubject): any {
        if (!messageReleaseSubscription) {
            messageReleaseSubscription = messageToBePublished.subscribe({
                next: (message: MessageLog) => {
                    console.log(`Releasing ${message.appData.msgId}...`);
                    releaseMessageSubject.next(message);
                },
                error: (err) => console.error(err),
                complete: () => { },
            });
            console.log(`Subscription message release activated.`);
        } else {
            console.log(`Subscription message release is already active.`);
        }
        return messageReleaseSubscription
    }

    // Stop the incoming Messaes to be returned to caller
    private deactivateReleaseSubscription(messageReleaseSubscription): any {
        if (messageReleaseSubscription) {
            messageReleaseSubscription.unsubscribe();
            messageReleaseSubscription = null;
            console.log(`Subscription message release deactivated.`);
        } else {
            console.log(`Subscription message release is already deactivated.`);
        }
        return messageReleaseSubscription
    }

    // Begin to push the incoming messages into local instantarray
    private activateBufferSubscription(bufferStorage: MessageLog[], messageBufferSubscription, messageToBePublished): any {
        if (!messageBufferSubscription) {
            messageBufferSubscription = messageToBePublished.subscribe({
                next: (message: MessageLog) => {
                    console.log(`Buffering ${message.appData.msgId}...  Local array length: ${bufferStorage.length}`);
                    bufferStorage.push(message)
                },
                error: (err) => console.error(err),
                complete: () => { },
            });
            console.log(`Subscription message buffer activated.`);
        } else {
            console.log(`Subscription message buffer is already active.`);
        }
        return messageBufferSubscription
    }

    // Stop pushing the incoming messages into local instantarray
    private deactivateBufferSubscription(messageBufferSubscription): any {
        if (messageBufferSubscription) {
            messageBufferSubscription.unsubscribe();
            messageBufferSubscription = null;
            console.log(`Subscription message buffer deactivated.`);
        } else {
            console.log(`Subscription message buffer is already deactivated.`);
        }
        return null
    }

    // Change the streaming direction of the incoming messages into mongo streaming subject( to be saved in local databse )
    private activateMongoStreamSubscription(messageStreamToMongo, messageToBePublished): any {
        if (!messageStreamToMongo) {
            messageStreamToMongo = messageToBePublished.subscribe({
                next: (message: MessageLog) => {
                    console.log(`Saving ${message.appData.msgId}...`);
                    this.mongoService.saveToMongo(message)
                },
                error: (err) => console.error(err),
                complete: () => { },
            });
            console.log(`Subscription message streaming to Mongo activated.`);
        } else {
            console.log(`Subscription message streaming to Mongo  is already active.`);
        }
        return messageStreamToMongo
    }

    // Stop or cut off the mongo streaming
    private deactivateMongoStreamSubscription(messageStreamToMongo): any {
        if (messageStreamToMongo) {
            messageStreamToMongo.unsubscribe();
            messageStreamToMongo = null;
            console.log(`Subscription message streaming to Mongo deactivated.`);
        } else {
            console.log(`Subscription message streaming to Mongo is already deactivated.`);
        }
        return messageStreamToMongo
    }

    // As the name implies, transder all the messages from the local instance into mongoStorage. Local instance should be emptied after transfer is completed
    private async transferBufferedMessagseToMongoStorage(bufferedMessage: MessageLog[], messageBufferSubscription) {
        console.log(`Transferring buffered messages into database.`)
        let bufferedStorage: Observable<MessageLog> = from(bufferedMessage)
        bufferedStorage.subscribe({
            next: (message: MessageLog) => {
                this.mongoService.saveToMongo(message).then((res) => {
                    console.log(`Bufferd Message ${message.appData.msgId} transferred successfully...`)
                }).catch((err) => console.error(err))
            },
            error: (error) => console.error(error),
            complete: () => {
                this.bufferedStorage = []
                if (messageBufferSubscription) {
                    console.log(`All ${bufferedMessage.length} buffered messages have been sent for transfer to ${this.mongoUrl}. Current length: ${this.bufferedStorage.length}`)
                }
            }
        })
    }

    // As the name implies, transder all the messages from the local instance into mongoStorage. Local instance should be emptied after transfer is completed
    private async releaseMessageFromLocalBuffer(bufferedStorage: MessageLog[]): Promise<Observable<MessageLog>> {
        return new Promise((resolve, reject) => {
            if (bufferedStorage.length > 1) {
                let caseVariable = this.bufferedStorage.length > 1;
                console.log(`Releasing data from local buffer instance. There ${caseVariable ? "is" : "are"} ${this.bufferedStorage.length} messages...`);
                let returnArrayObs: Observable<MessageLog> = from(bufferedStorage)
                resolve(returnArrayObs)
            } else {
                let message = `There is no data in stored in local instance`
                reject(message)
            }
        })
    }
    // Transder all the stored messages in designated mongo databases. It should be empty after all the data has been transferred.
    private async releaseMessageFromMongoStorage(): Promise<Subject<MessageLog>> {
        return new Promise((resolve, reject) => {
            let dataSubject: Subject<MessageLog> = new Subject()
            try {
                this.mongoService.extractAllMessages(dataSubject)
            }
            catch (error) {
                reject(error)
            }
            resolve(dataSubject)
        })
    }

}

