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

  public async registerUser(message: Message): Promise<number> {
    return new Promise(async (resolve, reject) => {
      let email: string = message.action.payload?.email
      let username: string = message.action.payload?.user
      let password: string = message.action.payload?.password

      // Check if the user already exists
      try {
        this.mongoService.checkIfUserExist(email).then(async (res) => {
          if (res == `User already existed `) {
            console.log(`User registeration Failed`)
            reject(0)
          } else {
            // Hash the password before saving it to the database
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Create a new user document
            const newUser = new User({
              username,
              email,
              password: hashedPassword,
            });

            this.mongoService.registerUser(newUser).then((res) => {
              if (res == 1) resolve(res)
            })
          }
        })
      }
      catch (error) {
        reject(error)
        console.error(`Error: ${error}`)
      }
    })
  }

  public async loginUser(email, password) {
    try {
      // Find the user by email
      const user = await User.findOne({ email });

      // Check if the user exists and verify the password
      if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Invalid credentials');
      }

      // Generate a JWT token
      const token = jwt.sign({ userId: user._id }, this.tokenSecret, { expiresIn: this.tokenExpiration });

      return { success: true, token };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Login failed' };
    }
  }
}

