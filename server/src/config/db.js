const mongoose = require('mongoose');
const env = require('./env');

let mongoMemoryServer = null;

async function connectDB() {
  const uri = env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    try {
      console.log(`[DB] Attempting connection to MongoDB at: ${uri.replace(/:[^:]*@/, ':****@')}`);
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('[DB] Successfully connected to MongoDB.');
      return mongoose.connection;
    } catch (err) {
      console.warn(`[DB] Could not connect to configured MONGODB_URI: ${err.message}`);
      console.log('[DB] Falling back to MongoDB In-Memory Server...');
    }
  } else {
    console.log('[DB] No MONGODB_URI provided. Starting in-memory MongoDB server...');
  }

  // Fallback: mongodb-memory-server
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[DB] Connected to MongoDB In-Memory Server successfully: ${memoryUri}`);
    return mongoose.connection;
  } catch (memErr) {
    console.error('[DB] Failed to start in-memory MongoDB:', memErr);
    throw memErr;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}

module.exports = {
  connectDB,
  disconnectDB
};
