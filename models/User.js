const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    valueIdentificationCompleted: {
        type: Boolean,
        default: false
    },
    identifiedValues: {
        type: String,
        default: ''
    },
    darkMode: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('User', UserSchema);