import mongoose, { Connection, Model, Schema } from 'mongoose';
import * as dotenv from 'dotenv'
import { rejects } from 'assert';
dotenv.config()
export class MongoConnectionService {
    private url: string = process.env.MONGO as string
    private connectedMongoDB: Connection[] = []

    constructor() {
    }

    // An option for the client to see what's available. But if it serves no purpose, this will be rid off
    public async getConnectedMongoDatabase(databaseName?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!databaseName) resolve(this.connectedMongoDB)
            console.log(this.connectedMongoDB[0].name)
            let database: Connection
            this.connectedMongoDB.find((connection: Connection) => {
                if (connection.name === databaseName) {
                    database = connection
                    console.log(`Database found!! ${database.name}`)
                    resolve(database)
                } else {
                    reject(`Database is not found.`); // This exits the forEach loop
                }
            })
        })
    }

    public async createConnection(databaseName: string, url?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let connectionUri: string = (url ?? this.url) + databaseName;
            let connection: Connection = mongoose.createConnection(connectionUri);

            // Event listener for successful connection
            connection.on('connected', () => {
                resolve(connection)
                this.connectedMongoDB.push(connection)
                console.log(`Database: ${this.url}${connection.name} is connected`);
            });

            // Event listener for connection error
            connection.on('error', (err) => {
                console.error(`Mongoose Connection Error: ${err}`);
                reject(err)
            });

            // Event listener for disconnection
            connection.on('disconnected', () => {
                console.log(`Mongoose disconnected from the database ${this.url}${connection.name}`);
            });

            // Event listener for graceful termination
            process.on('SIGINT', () => {
                connection.close().then(() => {
                    console.log('Mongoose connection terminated due to application termination');
                    process.exit(0);
                });
            });

        })
    }

}
// Comment
/* When you run a Node.js application, you can terminate it by pressing Ctrl+C in the terminal. 
This sends a SIGINT signal to the application, indicating that the user wants to interrupt and terminate the program.

By listening for the SIGINT signal, you can perform cleanup and graceful shutdown operations before the application exits. 
In the code provided, it's used to close the Mongoose connection to the database using db.close(). 
This ensures that the database connection is properly closed before the application terminates.
*/
