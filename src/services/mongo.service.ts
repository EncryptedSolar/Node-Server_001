import mongoose, { Model, Schema } from 'mongoose';
import { Subject } from 'rxjs';

export class MongoConnectionService {


}


// Comment
/* In this case, you export a single, shared instance of the MongoConnectionService, which can be used directly without the need to create new instances.
Using export default new MongoConnectionService() is often more convenient when you want to have a single, shared instance of a service or class that
should be reused throughout your application, such as a connection manager or a service responsible for handling certain tasks. It provides a consistent
instance across different parts of your application without the need to create new instances each time. */

