import * as _ from 'lodash'
import * as fs from 'fs'
import mongoose, { Model, Schema } from 'mongoose';
import { Observable, Subject, Subscription, from } from 'rxjs'
import { ColorCode, MessageLog, ReportStatus } from '../interfaces/general.interface'
require('dotenv').config();
export class ErrorHandlingService {
    private mongoUrl: string = process.env.MONGO + 'emergencyStorage'
    private bufferedStorage: MessageLog[] = []
    private connectionStatus: boolean = true
    private mongoConnection: any
    private messageModel: any
    private storageOptions: string = process.env.Storage as string

    constructor() {
        this.manageMongoConnection()
        this.mongoConnection.once('open', () => {
            this.messageModel = this.mongoConnection.model('Message', require('../models/message.schema'));
        })
    }

    public handleMessage(messageToBePublished: Subject<MessageLog>, statusReport: Subject<ReportStatus>): Subject<MessageLog> {
        let releaseMessageSubject: Subject<MessageLog> = new Subject()
        let messageReleaseSubscription: Subscription | null = null; // Initialize as null
        let messageBufferSubscription: Subscription | null = null
        let messageStreamToMongo: Subscription | null = null
        statusReport.subscribe((report: any) => {
            if (report?.code == ColorCode.GREEN) {
                this.connectionStatus = true
                console.log(`Connection status report: ${this.connectionStatus} && ${report.message ?? report.errorMsg ?? 'No Message'}`)
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
            }
            if (report?.code == ColorCode.YELLOW) {
                this.connectionStatus = false
                console.log(`Connection status report: ${this.connectionStatus} && ${report.message ?? report.errorMsg ?? 'No Message'}`)
                messageReleaseSubscription = this.deactivateReleaseSubscription(messageReleaseSubscription)
                messageBufferSubscription = this.activateBufferSubscription(this.bufferedStorage, messageBufferSubscription, messageToBePublished)
            }
            if (report?.code == ColorCode.RED) {
                this.connectionStatus = false
                console.log(`Connection status report: Server down. ${report.message} lol`)
                this.transferBufferedMessagseToMongoStorage(this.bufferedStorage, messageBufferSubscription)
                messageBufferSubscription = this.deactivateBufferSubscription(messageBufferSubscription)
                messageStreamToMongo = this.activateMongoStreamSubscription(messageStreamToMongo, messageToBePublished)
            }
            if (!report.code || report.code == "") {
                console.log(`Unknown message...`)
            }
        })
        return releaseMessageSubject
    }

    // Function to activate the subscription
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
            console.log(`Subscription message release  is already active.`);
        }
        return messageReleaseSubscription
    }

    // Function to deactivate the subscription
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

    // Function to activate the subscription
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

    // Function to deactivate the subscription
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

    // Function to activate the subscription
    private activateMongoStreamSubscription(messageStreamToMongo, messageToBePublished): any {
        if (!messageStreamToMongo) {
            messageStreamToMongo = messageToBePublished.subscribe({
                next: (message: MessageLog) => {
                    console.log(`Saving ${message.appData.msgId}...`);
                    this.saveToMongo(message)
                },
                error: (err) => console.error(err),
                complete: () => { },
            });
            console.log(`Subscription message mongo stream activated.`);
        } else {
            console.log(`Subscription message mongo stream  is already active.`);
        }
        return messageStreamToMongo
    }

    // Function to deactivate the subscription
    private deactivateMongoStreamSubscription(messageStreamToMongo): any {
        if (messageStreamToMongo) {
            messageStreamToMongo.unsubscribe();
            messageStreamToMongo = null;
            console.log(`Subscription message mongo stream deactivated.`);
        } else {
            console.log(`Subscription message mongo stream is already deactivated.`);
        }
        return messageStreamToMongo
    }

    private async transferMessageToLocalStorage(message: Subject<MessageLog>): Promise<void> {
        let localArray: MessageLog[] = this.bufferedStorage
        let filename = `localstorage.json`;

        while (localArray.length > 0) {
            let objectToWrite = this.bufferedStorage[0];
            await writeMessage(objectToWrite, filename)
        }
        message.subscribe((message: MessageLog) => {
            writeMessage(message, filename)
        })

        if (localArray.length < 1) this.bufferedStorage = localArray
        console.log('Local Array is empty. Finished transferring to files.')

        async function writeMessage(message: MessageLog, filename: string) {
            try {
                let stringifiedMessage = JSON.stringify(message);
                await fs.promises.appendFile(filename, stringifiedMessage + "\r\n")
                console.log(`Successfully transferred ${filename}`);
                localArray.shift();
            } catch (err) {
                console.error(`Error trasferring ${filename}:`, err);
            }
        }
    }

    private async saveToMongo(message: MessageLog): Promise<boolean> {
        return new Promise((resolve, reject) => {
            // let messageModel: Model<any> = this.mongoConnection.model('Message', require('../models/message.schema'))
            this.messageModel.create(message).then(() => {
                console.log(`Saved MessageID ${message.appData.msgId} into ${this.mongoUrl}`);
                resolve(true)
            }).catch((err) => {
                console.log(`MongoSaveError: ${err.message}`)
                reject(err)
            })
        })
    }

    private async transferBufferedMessagseToMongoStorage(bufferedMessage: MessageLog[], messageBufferSubscription) {
        let bufferedStorage: Observable<MessageLog> = from(bufferedMessage)
        bufferedStorage.subscribe({
            next: (message: MessageLog) => {
                this.saveToMongo(message).then((res) => {
                    console.log(`Message ${message.appData.msgId} saved successfully...`)
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

    private async releaseMessageFromMongoStorage(): Promise<Subject<MessageLog>> {
        return new Promise((resolve, reject) => {
            let dataSubject: Subject<MessageLog> = new Subject()
            const cursor = this.messageModel.find().lean().cursor();

            cursor.on('data', (message) => {
                // Emit each document to the subject
                dataSubject.next(message);
            });

            cursor.on('end', async () => {
                // All data has been streamed, complete the subject
                dataSubject.complete();

                // Delete the data once it has been streamed
                try {
                    await this.messageModel.deleteMany({});
                    console.log('Data in Mongo deleted successfully.');
                } catch (err) {
                    console.error('Error deleting data:', err);
                    reject(err)
                }
            });
            resolve(dataSubject)
        })
    }

    private async connectToMongoDatabase(): Promise<any> {
        return new Promise((resolve, reject) => {
            console.log(this.mongoUrl)
            this.mongoConnection = mongoose.createConnection(this.mongoUrl)
            this.mongoConnection.on('error', (error) => {
                console.error('Connection error:', error);
                resolve('')
            });
            this.mongoConnection.once('open', () => {
                console.log(`Connected to ${process.env.MONGO}`);
            });
        })
    }

    private async manageMongoConnection() {
        while (true) {
            try {
                await this.connectToMongoDatabase();
            } catch (error) {
                // Connection did not resolve, 
                console.log(`Something Wrong occured. Please check at manageMongoConnection`)
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before the next attempt
        }
    }

}
