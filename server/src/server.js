const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const seedDemoData = require('./seed/seedDemoData');

async function startServer() {
  try {
    // 1. Connect to Database (with in-memory fallback if MONGODB_URI not provided/unreachable)
    await connectDB();

    // 2. Auto-seed initial demo data if database is fresh/empty
    await seedDemoData();

    // 3. Start listening for incoming HTTP requests
    const server = app.listen(env.PORT, () => {
      console.log('====================================================');
      console.log(`Care Sync Backend running at: http://localhost:${env.PORT}`);
      console.log(`Frontend UI accessible at:    http://localhost:${env.PORT}/`);
      console.log(`API Health Check:             http://localhost:${env.PORT}/api/health`);
      console.log(`Environment:                  ${env.NODE_ENV}`);
      console.log('====================================================');
    });

    // Graceful shutdown
    const handleShutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDB();
        console.log('[Server] Database disconnected. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  } catch (err) {
    console.error('[Server Start Error]', err);
    process.exit(1);
  }
}

startServer();
