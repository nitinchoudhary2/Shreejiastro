// server/admin-tools.js
// Node.js script to set custom claim 'admin' for a user (by uid or email).
// Usage: node admin-tools.js --email admin@example.com
// Requires: serviceAccountKey.json (Firebase Admin SDK service account)

import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('email', { type: 'string', describe: 'Admin user email' })
  .option('uid', { type: 'string', describe: 'Admin user uid' })
  .demandOption(['email'], 'Please provide --email or --uid')
  .argv;

// Load service account key (download from Firebase Console)
const keyPath = './serviceAccountKey.json';
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found. Download from Firebase Console and place here.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

async function setAdminByEmail(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { admin: true });
    console.log(`Custom claim set: ${email} is now admin (uid: ${user.uid})`);
  } catch (err) {
    console.error('Error setting admin claim:', err);
  }
}

async function main() {
  if (argv.email) {
    await setAdminByEmail(argv.email);
  } else if (argv.uid) {
    try {
      await auth.setCustomUserClaims(argv.uid, { admin: true });
      console.log(`Custom claim set for uid: ${argv.uid}`);
    } catch (err) {
      console.error('Error:', err);
    }
  }
  process.exit(0);
}

main();
