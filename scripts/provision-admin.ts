/**
 * Trusted server-side CLI script to provision single-vendor admin privileges
 * using Firebase Admin SDK (Blaze / Production projects with a Service Account).
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json npx tsx scripts/provision-admin.ts bnagladeshbodnaparty@gmail.com
 */
import fs from 'node:fs';
import {cert, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';

async function main() {
  const targetEmail = process.argv[2] || 'bnagladeshbodnaparty@gmail.com';
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!saPath || !fs.existsSync(saPath)) {
    console.error('Missing FIREBASE_SERVICE_ACCOUNT_PATH pointing to your Firebase service account JSON.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
  const app = initializeApp({credential: cert(serviceAccount)});
  const auth = getAuth(app);
  const db = getFirestore(app);

  const userRecord = await auth.getUserByEmail(targetEmail);
  await auth.setCustomUserClaims(userRecord.uid, {admin: true, role: 'admin'});
  await db.collection('admins').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: targetEmail,
      role: 'admin',
      createdAt: FieldValue.serverTimestamp(),
    },
    {merge: true}
  );
  await db.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: targetEmail,
      role: 'admin',
      updatedAt: FieldValue.serverTimestamp(),
    },
    {merge: true}
  );

  console.log(`Provisioned single-vendor admin claim & Firestore /admins/${userRecord.uid} for ${targetEmail}`);
}

main().catch((err) => {
  console.error('Admin provisioning failed:', err);
  process.exit(1);
});
