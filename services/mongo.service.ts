import mongoose, { Schema } from 'mongoose';
import { Subject } from 'rxjs';

export class MongoConnectionService {
    private connections: Record<string, mongoose.Connection> = {}
    private mongoUrl: any // an object
    private messageModel: any

    constructor() {
    }

    // Enter indefinite loop for mongo connection
    public async manageMongoConnection(dbName: string, dbUrl: string) {
        while (true) {
            try {
                this.mongoUrl = {
                    dbName: dbName,
                    dbUrl: dbUrl,
                    mongoUrl: dbUrl + dbName
                }
                await this.createConnection(this.mongoUrl.dbName, this.mongoUrl.mongoUrl);
            } catch (error) {
                // Connection did not resolve, 
                console.log(`Something Wrong occured. Please check at manageMongoConnection`)
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 1 second before the next attempt
        }
    }


    public getConnectionStatusDetails(dbName: string): Subject<string> {
        if (this.connections[dbName]) {
            let mongoStatusNotification: Subject<string> = new Subject()
            // Listen for the 'connected' event to check for a successful connection
            this.connections[dbName].on('connected', () => {
                mongoStatusNotification.next(`[MongoService] Mongoose connection to ${dbName} is open.`)
            });

            // Listen for the 'error' event to check for connection errors
            this.connections[dbName].on('error', (err) => {
                mongoStatusNotification.next('[MongoService] Mongoose connection error:')
            });

            // Listen for the 'disconnected' event to check for disconnections
            this.connections[dbName].on('disconnected', () => {
                mongoStatusNotification.next(`[MongoService] Mongoose connection to ${dbName} is disconnected`)
            });

            // Listen for the 'close' event to check when the connection is fully closed
            this.connections[dbName].on('close', () => {
                mongoStatusNotification.next(`[MongoService] Mongoose connection to ${dbName} is closed.`)
            });
            return mongoStatusNotification
        }
        throw new Error(`[MongoService]Connection for database '${dbName}' not found.`);
    }

    public getAllConnectionStatus(): any {
        if (this.connections) {
            const connectionStatus = {};
            for (const key in this.connections) {
                if (this.connections.hasOwnProperty(key)) {
                    const connection = this.connections[key];
                    if (connection.readyState === 1) {
                        connectionStatus[key] = 'open (ready)';
                    } else {
                        connectionStatus[key] = 'not yet open';
                    }
                }
            }
            return connectionStatus
        } else {
            return `[MongoService] No Mongo Connection established.`;
        }
    }

    // To be used by mongoStreamSubscription to perform the saving execution
    public async saveToMongo(message: any): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.messageModel.create(message).then(() => {
                console.log(`Saved MessageID ${message.appData?.msgId} into ${this.mongoUrl.dbName}`);
                resolve(true)
            }).catch((err) => {
                console.log(`MongoSaveError: ${err.message}`)
                reject(err)
            })
        })
    }

    public async extractAllMessages(subjectArgs: Subject<any>): Promise<void> {
        if (this.messageModel) {
            const eventStream = this.messageModel.find().lean().cursor()
            eventStream.on('data', (message) => {
                // Emit each document to the subject
                subjectArgs.next(message);
            });

            eventStream.on('end', async () => {
                // All data has been streamed, complete the subject
                subjectArgs.complete();

                // Delete the data once it has been streamed
                try {
                    await this.messageModel.deleteMany({});
                    console.log('Data in Mongo deleted successfully.');
                } catch (err) {
                    console.error('Error deleting data:', err);
                }
            });
        } else {
            console.log(`Error: Message Model is ${this.messageModel}!! Please set up the mongoose connectino properly!`)
        }

    }


    private async createConnection(dbName: string, dbUrl: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                let connection = await mongoose.createConnection(dbUrl)
                this.connections[dbName] = connection
                this.connections[dbName].on('error', (error) => {
                    console.error('Connection error:', error);
                    resolve('')
                });
                this.connections[dbName].once('open', () => {
                    console.log(`Connected to ${process.env.MONGO}`);
                    this.messageModel = this.connections[this.mongoUrl.dbName].model('Message', require('../models/message.schema'));
                });
            }
            catch (error) {
                console.log(`Something wrong here at create COnnection???`)
                reject(error)
            }
        })
    }

}


// Comment
/* In this case, you export a single, shared instance of the MongoConnectionService, which can be used directly without the need to create new instances.
Using export default new MongoConnectionService() is often more convenient when you want to have a single, shared instance of a service or class that
should be reused throughout your application, such as a connection manager or a service responsible for handling certain tasks. It provides a consistent
instance across different parts of your application without the need to create new instances each time. */

