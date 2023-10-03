import mongoose, { Schema } from 'mongoose';
import { Subject } from 'rxjs';

export class MongoConnectionService {
    private connections: Record<string, mongoose.Connection> = {}

    public async createConnection(dbName: string, dbURI: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const connection = await mongoose.createConnection(dbURI);
                this.connections[dbName] = connection;
                console.log(`[MongoService] Connecting to MongoDB database: ${dbURI}...`);
                connection.on('connected', () => {
                    resolve(dbName);
                });
            } catch (error) {
                console.error(`[MongoService] MongoDB connection error for ${dbName}:`, error);
                reject(error);
            }
        });
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

    public async checkIfUserExist(email: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                // Check for an existing connection or request one
                const connection = await this.establishConnection('usersDatabase', {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    // Other connection options as needed
                });

                // Use the connection to perform the database operation
                const existingUser = await connection.model('User').findOne({ email: email });

                if (!existingUser) {
                    resolve('User not found');
                } else {
                    reject('User already exists!');
                }
            } catch (error) {
                console.log(`Error: ${error}`);
                reject(error);
            }
        });
    }


    public async registerUser(user: any): Promise<number> {
        return new Promise((resolve, reject) => {

        })
    }

    private async establishConnection(connectionIdentifier, connectionOptions): Promise<any> {
        return new Promise(async (resolve, reject) => {
            console.log(this.connections);
            // Check if a connection with the given identifier already exists
            if (this.connections[connectionIdentifier]) {
                resolve(connectionIdentifier);
            } else {
                console.log(`No connection with identifier '${connectionIdentifier}' found. Request a connection first.`);
                reject(`No connection with identifier '${connectionIdentifier}' found. Request a connection first.`);
            }
        });
    }

}


// Comment
/* In this case, you export a single, shared instance of the MongoConnectionService, which can be used directly without the need to create new instances.
Using export default new MongoConnectionService() is often more convenient when you want to have a single, shared instance of a service or class that
should be reused throughout your application, such as a connection manager or a service responsible for handling certain tasks. It provides a consistent
instance across different parts of your application without the need to create new instances each time. */

