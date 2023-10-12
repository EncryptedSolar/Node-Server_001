import * as _ from 'lodash'
import * as fs from 'fs'
import mongoose, { Model, Schema } from 'mongoose';
import { Observable, Subject, Subscription, from } from 'rxjs'
import { ColorCode, MessageLog, ReportStatus } from '../interfaces/general.interface'
require('dotenv').config();

// Implement status chain refactoring
export class FisErrorHandlingService {
    private mongoUrl: string = process.env.MONGO + 'emergencyStorage'
    private bufferedStorage: MessageLog[] = []
    private mongoConnection: any
    private messageModel: any

    constructor() {
        // Connect to mongoDB. 
        this.manageMongoConnection()
        this.mongoConnection.once('open', () => {
            this.messageModel = this.mongoConnection.model('Message', require('../models/message.schema'));
        })
    }

    // Main function that intercepts outgoing messages by communicating || intepreting report status from grpc connection as indicator 
    public handleMessage(messageToBePublished: Subject<MessageLog>, statusReport: Subject<ReportStatus>): Subject<MessageLog> {
        let releaseMessageSubject: Subject<MessageLog> = new Subject() // A return value
        // Using the concept of toggling to improve the eficacy of subscription control && data flow
        let messageReleaseSubscription: Subscription | null = null 
        let messageBufferSubscription: Subscription | null = null
        let messageStreamToMongo: Subscription | null = null

        statusReport.subscribe((report: any) => {
            if (report.code == ColorCode.GREEN) {
                console.log(`Connection status report && ${report.message ?? 'No Message'}`)
                /* Status Chain begins */
                let status: Status = 1
                if (status === 1) {
                    messageStreamToMongo = this.deactivateMongoStreamSubscription(messageStreamToMongo) 
                    if (messageStreamToMongo) status = -1 
                }
                if (status === 1) {
                    messageBufferSubscription = this.deactivateBufferSubscription(messageBufferSubscription)
                    if (messageBufferSubscription) status = -1
                }
                if (status === 1) {
                    messageReleaseSubscription = this.activateReleaseSubscription(messageReleaseSubscription, messageToBePublished, releaseMessageSubject)
                    if (!messageReleaseSubscription) status = -1
                }
                if (status === 1) {
                    this.releaseMessageFromLocalBuffer(this.bufferedStorage).then((resObs: Observable<MessageLog>) => {
                        resObs.subscribe({
                            next: message => releaseMessageSubject.next(message),
                            error: err => console.error(err),
                            complete: () => {
                                this.bufferedStorage = []
                                console.log(`Reset buffer Storage count: ${this.bufferedStorage.length}. All messages have been released back into the stream.`)
                            }
                        })
                    }).catch((err) => {
                        status = -1
                        console.error(err)
                    })
                }
                if (status === 1) {
                    this.releaseMessageFromMongoStorage().then((resObs: Subject<MessageLog>) => {
                        resObs.subscribe({
                            next: message => releaseMessageSubject.next(message),
                            error: err => console.error(err),
                            complete: () => console.log(`All Mongo data are transferred `)
                        })
                    }).catch((err) => {
                        status = -1
                        console.error(err)
                    })
                }
                if (status === -1) {
                    console.log(`Something Went Wrong in handling ${ColorCode.RED} report.`)
                }

            }
            if (report.code == ColorCode.YELLOW) {
                console.log(`Connection status report && ${report.message ?? 'No Message'}`)

                let status: Status = 1
                /* Status Chain begins */
                if (status === 1) {
                    messageBufferSubscription = this.activateBufferSubscription(this.bufferedStorage, messageBufferSubscription, messageToBePublished)
                    if (!messageBufferSubscription) status = -1
                }
                if (status === 1) {
                    messageReleaseSubscription = this.deactivateReleaseSubscription(messageReleaseSubscription)
                    if (messageReleaseSubscription) status = -1
                }
                if (status === -1) {
                    console.log(`Something Went Wrong in handling ${ColorCode.RED} report.`)
                }
            }
            if (report.code == ColorCode.RED) {
                console.log(`Connection status report: Server down. ${report.message} lol`)

                let status: Status = 1
                if (status === 1) {
                    messageStreamToMongo = this.activateMongoStreamSubscription(messageStreamToMongo, messageToBePublished)
                    if (!messageStreamToMongo) status = -1
                }
                if (status === 1) {
                    messageBufferSubscription = this.deactivateBufferSubscription(messageBufferSubscription)
                    if (messageBufferSubscription) status = -1
                }
                if (status === 1) {
                    this.transferBufferedMessagseToMongoStorage(this.bufferedStorage, messageBufferSubscription).then((res: MessageLog[]) => {
                        if (res.length !== this.bufferedStorage.length || this.bufferedStorage.length > 0) status = -1 // this promise function should return an empty array
                    })
                }
                if (status === -1) {
                    console.log(`Something Went Wrong in handling ${ColorCode.RED} report.`)
                }

            }
            if (!report.code || report.code == "") {
                console.log(`Unknown message...`)
            }
        })
        return releaseMessageSubject
    }

    // Release the incoming Messages to be returned to the caller
    private activateReleaseSubscription(messageReleaseSubscription, messageToBePublished, releaseMessageSubject): Subscription | null {
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
    private deactivateReleaseSubscription(messageReleaseSubscription): Subscription | null {
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
    private activateBufferSubscription(bufferStorage: MessageLog[], messageBufferSubscription: Subscription | null, messageToBePublished: Subject<any>): Subscription | null {
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
    private deactivateBufferSubscription(messageBufferSubscription: Subscription | null): Subscription | null {
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
    private activateMongoStreamSubscription(messageStreamToMongo: Subscription | null, messageToBePublished: Subject<any>): Subscription | null {
        if (!messageStreamToMongo) {
            messageStreamToMongo = messageToBePublished.subscribe({
                next: (message: MessageLog) => {
                    console.log(`Saving ${message.appData.msgId}...`);
                    this.saveToMongo(message)
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
    private deactivateMongoStreamSubscription(messageStreamToMongo: Subscription | null): Subscription | null {
        if (messageStreamToMongo) {
            messageStreamToMongo.unsubscribe();
            messageStreamToMongo = null;
            console.log(`Subscription message streaming to Mongo deactivated.`);
        } else {
            console.log(`Subscription message streaming to Mongo is already deactivated.`);
        }
        return messageStreamToMongo
    }

    // Store in json file in this project folder. To be enabled in future
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

    // To be used by mongoStreamSubscription to perform the saving execution
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

    // As the name implies, transder all the messages from the local instance into mongoStorage. Local instance should be emptied after transfer is completed
    private async transferBufferedMessagseToMongoStorage(bufferedMessage: MessageLog[], messageBufferSubscription): Promise<MessageLog[]> {
        return new Promise((resolve, reject) => {
            let bufferedStorage: Observable<MessageLog> = from(bufferedMessage)
            bufferedStorage.subscribe({
                next: (message: MessageLog) => {
                    this.saveToMongo(message).then((res) => {
                        console.log(`Message ${message.appData.msgId} saved successfully...`)
                    }).catch((err) => console.error(err))
                },
                error: (error) => {
                    reject(error)
                    console.error(error)
                },
                complete: () => {
                    this.bufferedStorage = []
                    if (messageBufferSubscription) {
                        console.log(`All ${bufferedMessage.length} buffered messages have been sent for transfer to ${this.mongoUrl}. Current length: ${this.bufferedStorage.length}`)
                    }
                    resolve(this.bufferedStorage)
                }
            })
        })
    }

    // Transfer stored messages from the local instance back into the stream to be returned to the caller.
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
            const mongoEvent = this.messageModel.find().lean().cursor();

            mongoEvent.on('data', (message) => {
                // Emit each document to the subject
                dataSubject.next(message);
            });

            mongoEvent.on('end', async () => {
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

    // Connect to designated mongodatabase.
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

    // Manage mongoCOnnectino. The logic used would be different across differnet application. This will loop the process indefinitely os it is always trying to connect to database.
    private async manageMongoConnection(): Promise<boolean> {
        while (true) {
            try {
                await this.connectToMongoDatabase()
            } catch (error) {
                console.log(`Something Wrong occured. Please check at manageMongoConnection`)
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before the next attempt
        }
    }

}

type Status = -1 | 0 | 1 // For status chain effect
