import { Observable, Subject, elementAt, interval, map, switchMap } from 'rxjs';
import { MongoConnectionService } from './mongo.service';
import { IUser, UserModel } from '../interfaces/user.schema';
import { Connection, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken'
// Your secret key for signing the JWT. Keep this secret!
import * as bcrypt from 'bcrypt'
import { UtilityService } from './utility/utility';
const dotenv = require('dotenv')
dotenv.config()

export class AuthService {
    private intervalForRefreshingSecretKey: number = parseInt(process.env.rotateKeyInterval as string)
    private userModel: Model<any> | null | undefined
    private mongoURI: string = process.env.MONGO as string
    private databaseName: string = process.env.DATABASE1 as string
    private secretKeySubject: Subject<string> = new Subject()
    private currentSecretKey: string | null = null

    constructor(private mongoService: MongoConnectionService, private utilityService: UtilityService) {
        this.rotateKey(this.intervalForRefreshingSecretKey)
        this.mongoService.createConnection(this.databaseName, this.mongoURI).then(() => {
            this.mongoService.getConnectedMongoDatabase(this.databaseName).then((connection: Connection) => {
                this.userModel = connection.model('User', UserModel.schema)
            }).catch((err) => {
                console.error(err)
            })
            // this.mongoService.getConnectedMongoDatabase(__________).then((connection: Connection) => {
            //     this.________Model = connection.model(__________, require(__________))
            // }).catch((err) => {
            //     console.error(err)
            // })
        }).catch((err) => {
            console.error(err)
        })
    }

    // Register a new user with a hashed password
    public async registerUser(username: string, email: string, pwd: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            console.log(`Registering User ${username}....`);
            const saltRounds = 10;

            // Use bcrypt to hash the password
            bcrypt.hash(pwd, saltRounds, (err, hash) => {
                if (err) {
                    console.error('Password hashing failed');
                    reject(err);
                } else {
                    if (this.userModel) {
                        let role: string = 'User'
                        let userId: string = uuidv4()
                        if (username == 'admin') {
                            role = 'Admin'
                        }
                        const newUser = new this.userModel({
                            userId,
                            username,
                            role,
                            email,
                            password: hash, // Store the hashed password
                        });

                        newUser.save()
                            .then((user) => {
                                resolve(user);
                            })
                            .catch((error) => {
                                reject(error);
                            });
                    } else {
                        let message: string = 'Mongoose Model is not retrieved. Please liaise with MongoService';
                        console.log(message);
                        reject(message);
                    }
                }
            });
        });
    }


    // Find a user by username and verify the password
    public async loginUser(username, password): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {

                if (this.userModel) {
                    const user = await this.userModel.findOne({ username });
                    if (!user || !(await bcrypt.compare(password, user.password))) {
                        reject(`Invalid username or password`)
                    }
                    resolve(user); // Return the user document
                }
            }
            catch (err) {
                console.error(err)
            }
        })
    }

    public assignJWTtoken(user: IUser): string {
        let payload = {
            id: user.userId,
            username: user.username,
            roles: user.role,
        };
        // Sign the token with the secret key and set an expiration (e.g., 1 hour)
        const token = jwt.sign(payload, this.currentSecretKey, { expiresIn: '1h' });
        return token;
    }

    private rotateKey(minutes: number) {
        let intervalDuration = minutes * 60 * 1000
        // Assign the key first, and then subscribe 
        this.currentSecretKey = this.utilityService.generateSecretKey(32);
        console.log(`Current Secret Key is ${this.currentSecretKey}`)
        interval(intervalDuration)
            .pipe(
                map(() => {
                    const newKey: string = this.utilityService.generateSecretKey(32);
                    console.log(`New secret key generated. Secret key ${newKey.substring(0, 5)}`)
                    this.secretKeySubject.next(newKey);
                })
            ).subscribe()
    }
}
