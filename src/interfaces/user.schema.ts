import mongoose, { Schema } from "mongoose";

// 1. Create an interface representing a document in MongoDB.
export interface IUser {
    userId: string;
    username: string;
    role: `Admin` | `User` | `Master`
    email: string;
    password: string;
}

// 2. Create a Schema corresponding to the document interface.
const userSchema = new Schema<IUser>({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    role: { type: String, enum: [`Master`, `Admin`, `User`], default: `User` },
    email: { type: String, required: true },
    password: { type: String, required: true },
},
    {
        methods: {
            findUser(username) {
                return mongoose.model('User').find({ username: this.username }, username);
            }
        }
    });

// const User = mongoose.model('User', userSchema);

// module.exports = User;
export const UserModel = mongoose.model<IUser>('User', userSchema);