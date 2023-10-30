import * as express from 'express'
import * as dotenv from 'dotenv'
import { AuthService } from './src/services/auth.service'
import { MongoConnectionService } from './src/services/mongo.service'
import { UtilityService } from './src/services/utility/utility'

dotenv.config()
const app = express()
const port = process.env.PORT as string
const authService: AuthService = new AuthService(new MongoConnectionService(), new UtilityService())

// Apparently it is important to be used to read json from HTTP?? will need to do more research on this
app.use(express.json({ limit: '10mb' })); // Adjust the limit as needed

app.get('/', (req, res) => {
  res.send('Auth Server');
});

// Receives supposed REST api request from react UI to register 
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  authService.registerUser(username, email, password).then((user) => {
    let message = {
      message: `User ${user.username} registered successfully`
    }
    res.status(201).json(message)
    console.log(message.message)
  }).catch((err: string) => {
    console.error(err)
    res.status(500).json({ message: err })
  })
});

// Return JWT token
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  authService.loginUser(username, password).then((userData) => {
    let token = authService.assignJWTtoken(userData)
    let message = {
      message: `User: ${userData.username} successfully logged In. Token: ${token} `
    }
    res.status(200).json(message);
    console.log(message.message)
  }).catch((err) => {
    console.error(err)
  })

});

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});