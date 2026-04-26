const mongoose = require('mongoose');

const assistantMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    page: {
      type: String,
      default: 'dashboard',
      trim: true,
    },
    mode: {
      type: String,
      default: 'admin',
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const assistantChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['citizen', 'rescue_team', 'admin', 'guest'],
      default: 'guest',
    },
    page: {
      type: String,
      default: 'dashboard',
      trim: true,
    },
    mode: {
      type: String,
      default: 'admin',
      trim: true,
    },
    messages: {
      type: [assistantMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssistantChat', assistantChatSchema);
