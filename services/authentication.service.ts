import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { Message } from '../interfaces/message';
import { MongoConnectionService } from './mongo.service';

// User model (import or define your User model here)
const User = require('../models/user.schema'); // Use CommonJS-style require

export class AuthService {
  private mongoService: MongoConnectionService = new MongoConnectionService()
  private tokenSecret: string
  private tokenExpiration: string
  
  constructor() {
    // You can configure settings like token secret here
    this.tokenSecret = 'your-secret-key'; // Replace with a secure secret key
    this.tokenExpiration = '1h'; // Token expiration (e.g., 1 hour)
  }

  public async registerUser(message: Message): Promise<any> {
    return new Promise(async (resolve, reject) => {
      let email: string = message.action.payload?.email
      let username: string = message.action.payload?.user
      let password: string = message.action.payload?.password
      try {
        // Logic here 
        resolve('')
      }
      catch (error) {
        reject()
      }
    })
  }

  public async loginUser(email, password): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Logic here 
        resolve('')
      }
      catch (error) {
        reject()
      }
    })
  }
}

