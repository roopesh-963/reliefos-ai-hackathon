/**
 * config/db.js
 * ------------
 * Connects to MongoDB using Mongoose.
 * Called once at server startup from server.js.
 */

const mongoose = require('mongoose');

const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017/reliefos';

const getCandidateUris = () => {
  const configuredUri = process.env.MONGO_URI?.trim();
  const localUri = process.env.MONGO_URI_LOCAL?.trim() || LOCAL_FALLBACK_URI;
  const candidates = [];

  if (configuredUri) {
    candidates.push(configuredUri);
  }

  if (process.env.NODE_ENV !== 'production' && localUri && localUri !== configuredUri) {
    candidates.push(localUri);
  }

  return candidates;
};

const connectDB = async () => {
  const candidateUris = getCandidateUris();
  let lastError = null;

  for (const uri of candidateUris) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });

      if (uri !== candidateUris[0]) {
        console.warn(`Primary MongoDB unavailable. Falling back to local database at ${uri}`);
      }

      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      lastError = error;
      console.error(`MongoDB connection failed for ${uri}: ${error.message}`);

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
      }
    }
  }

  if (lastError) {
    console.error('No MongoDB connection could be established.');
    process.exit(1);
  }
};

module.exports = connectDB;
