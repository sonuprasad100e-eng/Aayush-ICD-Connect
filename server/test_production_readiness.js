/**
 * CareSync Production Readiness & Deployment Safety Test Suite
 *
 * Verifies:
 * 1. JWT Security: Missing/insecure/default secrets fail startup in production; valid 32+ char secrets accepted.
 * 2. Database Fallback: In production, missing or unreachable MONGODB_URI throws fatal error (no in-memory fallback).
 * 3. Demo Account Seeding: In production, demo doctor accounts with password123 are never created automatically.
 * 4. CORS Policy: In production, unauthorized cross-origin requests are rejected (403), while same-host and CLIENT_URL origins are permitted.
 * 5. Local Development Preservation: In development, in-memory MongoDB, default JWT, and open CORS continue to work.
 */

const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  passedTests++;
  console.log(`  [PASS] ${name}`);
}

function fail(name, err) {
  failedTests++;
  console.error(`  [FAIL] ${name}:`, err.message || err);
}

async function runTests() {
  console.log('====================================================');
  console.log(' RUNNING CARESYNC PRODUCTION READINESS TEST SUITE   ');
  console.log('====================================================\n');

  // -----------------------------------------------------------------
  // 1. JWT Security in Production
  // -----------------------------------------------------------------
  console.log('[TEST GROUP 1] JWT Secret Validation & Production Safety');
  const env = require('./src/config/env');
  const { validateJwtSecret } = env;

  // 1.1 Development fallback
  try {
    const devSecret = validateJwtSecret(undefined, false);
    assert.strictEqual(devSecret, 'care_sync_super_secret_jwt_key_2026');
    pass('Development mode accepts missing secret and applies dev default');
  } catch (err) {
    fail('Development mode accepts missing secret', err);
  }

  // 1.2 Missing secret in production
  try {
    validateJwtSecret('', true);
    fail('Production mode rejects empty JWT_SECRET', new Error('Did not throw'));
  } catch (err) {
    assert(err.message.includes('JWT_SECRET environment variable is required in production'));
    assert(!err.message.includes('care_sync_super_secret_jwt_key_2026')); // No secrets printed
    pass('Production mode strictly rejects empty JWT_SECRET');
  }

  // 1.3 Default placeholder secret in production
  try {
    validateJwtSecret('care_sync_super_secret_jwt_key_2026', true);
    fail('Production mode rejects default placeholder secret', new Error('Did not throw'));
  } catch (err) {
    assert(err.message.includes('Insecure JWT_SECRET detected in production'));
    pass('Production mode strictly rejects hardcoded development default secret');
  }

  try {
    validateJwtSecret('your_jwt_secret_key_change_in_production', true);
    fail('Production mode rejects .env.example placeholder secret', new Error('Did not throw'));
  } catch (err) {
    assert(err.message.includes('Insecure JWT_SECRET detected in production'));
    pass('Production mode strictly rejects .env.example template placeholder');
  }

  // 1.4 Short secret in production (< 32 characters)
  try {
    validateJwtSecret('too_short_secret_under_32_chars', true);
    fail('Production mode rejects secrets under 32 chars', new Error('Did not throw'));
  } catch (err) {
    assert(err.message.includes('must be a secure string of at least 32 characters'));
    pass('Production mode rejects short secrets (< 32 characters)');
  }

  // 1.5 Valid strong secret in production (e.g. 48-byte hex string)
  try {
    const strongSecret = '64818d2decbbec3737550ef0a4485e1eaac990e884bb6409b6aed0ab05050bbb125a34b5b5f9fc3e426d45fac945f712';
    const validated = validateJwtSecret(strongSecret, true);
    assert.strictEqual(validated, strongSecret);
    pass('Production mode accepts strong 32+ character JWT secret');
  } catch (err) {
    fail('Production mode accepts strong 32+ character JWT secret', err);
  }

  // -----------------------------------------------------------------
  // 2. Database Fallback Safety in Production
  // -----------------------------------------------------------------
  console.log('\n[TEST GROUP 2] Database Connection & Production Fallback Policy');
  const db = require('./src/config/db');

  // Test missing MONGODB_URI in production
  const origNodeEnv = env.NODE_ENV;
  const origUri = env.MONGODB_URI;

  try {
    env.NODE_ENV = 'production';
    env.MONGODB_URI = '';
    await db.connectDB();
    fail('Production connectDB rejects empty MONGODB_URI', new Error('Did not throw'));
  } catch (err) {
    assert(err.message.includes('MONGODB_URI environment variable is required when NODE_ENV=production'));
    assert(err.message.includes('In-memory fallback is disabled in production'));
    pass('Production connectDB strictly rejects empty MONGODB_URI without in-memory fallback');
  } finally {
    env.NODE_ENV = origNodeEnv;
    env.MONGODB_URI = origUri;
  }

  // Test unreachable MONGODB_URI in production
  try {
    env.NODE_ENV = 'production';
    env.MONGODB_URI = 'mongodb://127.0.0.1:59999/unreachable_prod_db?serverSelectionTimeoutMS=1000';
    await db.connectDB();
    fail('Production connectDB rejects unreachable host', new Error('Did not throw'));
  } catch (err) {
    assert(err.message.includes('Production database connection failed'));
    assert(err.message.includes('In-memory fallback is disabled in production'));
    pass('Production connectDB fails fast on unreachable MongoDB Atlas without falling back to memory');
  } finally {
    env.NODE_ENV = origNodeEnv;
    env.MONGODB_URI = origUri;
  }

  // -----------------------------------------------------------------
  // 3. Demo Account Seeding Prevention in Production
  // -----------------------------------------------------------------
  console.log('\n[TEST GROUP 3] Demo Account Seeding Guard in Production');
  const memoryServer = await MongoMemoryServer.create();
  const testDbUri = memoryServer.getUri();
  await mongoose.connect(testDbUri);

  const User = require('./src/models/User');
  const TerminologyCrosswalk = require('./src/models/TerminologyCrosswalk');
  const seedDemoData = require('./src/seed/seedDemoData');

  try {
    // Simulate production environment
    env.NODE_ENV = 'production';

    // Call seedDemoData() without allowExplicitDemo
    await seedDemoData();

    // Verify NO demo doctor accounts were created
    const doctorCount = await User.countDocuments({ email: { $in: ['sonu@caresync.in', 'doctor@caresync.in'] } });
    assert.strictEqual(doctorCount, 0);
    pass('Production seedDemoData() creates 0 demo doctor accounts');

    // Verify baseline crosswalks were still safely initialized
    const crosswalkCount = await TerminologyCrosswalk.countDocuments();
    assert.strictEqual(crosswalkCount, 9);
    pass('Production seedDemoData() safely seeds essential reference crosswalks');

    // Verify accounts with password123 do not exist
    const totalUsers = await User.countDocuments();
    assert.strictEqual(totalUsers, 0);
    pass('Production startup completely prevents accounts with password123');

    // Test explicit manual CLI seed (allowExplicitDemo: true)
    await seedDemoData({ allowExplicitDemo: true });
    const doctorAfterExplicit = await User.countDocuments({ email: 'sonu@caresync.in' });
    assert.strictEqual(doctorAfterExplicit, 1);
    pass('Explicit CLI seeding (npm run seed) remains available for manual development setup');
  } catch (err) {
    fail('Demo seeding production guard', err);
  } finally {
    env.NODE_ENV = origNodeEnv;
    await mongoose.disconnect();
    await memoryServer.stop();
  }

  // -----------------------------------------------------------------
  // 4. CORS Policy Enforcement in Production vs Development
  // -----------------------------------------------------------------
  console.log('\n[TEST GROUP 4] CORS Enforcement in Production vs Development');
  const app = require('./src/app');

  const testServer = http.createServer(app);
  await new Promise(resolve => testServer.listen(0, resolve));
  const serverPort = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  function makeRequest(originHeader, hostHeader) {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (originHeader) headers['Origin'] = originHeader;
      if (hostHeader) headers['Host'] = hostHeader;

      const req = http.request(`${baseUrl}/api/health`, { method: 'GET', headers }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // 4.1 Development mode: cross-origin is allowed
    env.NODE_ENV = 'development';
    const devRes = await makeRequest('https://any-external-domain.com');
    assert.strictEqual(devRes.status, 200);
    assert.strictEqual(devRes.headers['access-control-allow-origin'], 'https://any-external-domain.com');
    pass('Development mode permits cross-origin requests for local debugging');

    // 4.2 Production mode: unauthorized origin is blocked (403)
    env.NODE_ENV = 'production';
    env.CLIENT_URL = 'http://localhost:8000,https://caresync.example.com';

    const blockedRes = await makeRequest('https://malicious-site.com');
    assert.strictEqual(blockedRes.status, 403);
    assert(blockedRes.body.includes('CORS policy violation'));
    pass('Production mode strictly rejects unauthorized cross-origin requests with 403');

    // 4.3 Production mode: authorized CLIENT_URL is allowed
    const allowedRes = await makeRequest('https://caresync.example.com');
    assert.strictEqual(allowedRes.status, 200);
    assert.strictEqual(allowedRes.headers['access-control-allow-origin'], 'https://caresync.example.com');
    pass('Production mode allows configured CLIENT_URL origin');

    // 4.4 Production mode: same-host request is allowed (Express serving client/ on Render)
    const sameHostRes = await makeRequest('https://caresync-app.onrender.com', 'caresync-app.onrender.com');
    assert.strictEqual(sameHostRes.status, 200);
    assert.strictEqual(sameHostRes.headers['access-control-allow-origin'], 'https://caresync-app.onrender.com');
    pass('Production mode allows same-host frontend served by Express');

    // 4.5 Production mode: requests with no Origin header (same-origin, curl, mobile)
    const noOriginRes = await makeRequest(null);
    assert.strictEqual(noOriginRes.status, 200);
    pass('Production mode allows requests without Origin header (same-origin / API clients)');
  } catch (err) {
    fail('CORS production enforcement', err);
  } finally {
    env.NODE_ENV = origNodeEnv;
    await new Promise(resolve => testServer.close(resolve));
  }

  // -----------------------------------------------------------------
  // 5. Summary & Verdict
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(` RESULTS: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('[Unhandled Test Error]', err);
  process.exit(1);
});
