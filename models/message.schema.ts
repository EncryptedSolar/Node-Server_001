import mongoose from 'mongoose';
const { Schema } = mongoose;

const appData = {
    msgId: {
        type: String,
        required: true,
    },
    msgLogDateTime: {
        type: Date,
        required: true,
        default: () => Date.now()
    },
    msgDateTime: {
        type: Date,
        required: true,
        default: () => Date.now()
    },
    msgTag: [String],
    msgPayload: {
        type: String,
        required: true
    }
}

const appDataSchema = new mongoose.Schema(
    appData
)
const messageSchema = new mongoose.Schema({
    appLogLocId: {
        type: String,
        ref: `appLogLoc`,
        required: true
    },
    appData: appData
});

module.exports = messageSchema