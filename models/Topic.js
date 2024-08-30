const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    suggestionCount: { type: Number, default: 1 },
    status: { type: String, enum: ['normal', 'trending'], default: 'normal' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Topic', topicSchema);