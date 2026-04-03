/**
 * CardDex — Set Admin Custom Claim
 *
 * Grants a user the { admin: true } custom claim, which unlocks:
 *   - Admin panel access
 *   - Card writes in Firestore
 *   - QR code generation in Firestore
 *   - Card image/video uploads to Firebase Storage
 *
 * ── LOCAL (emulator) ────────────────────────────────────────────────────────
 *   node set-admin-claim.js <email>
 *   (FIREBASE_AUTH_EMULATOR_HOST is set automatically)
 *
 * ── PRODUCTION ──────────────────────────────────────────────────────────────
 *   1. Download a service account key from Firebase Console:
 *      Project Settings → Service accounts → Generate new private key
 *      Save as: admin/service-account.json  (this file is in .gitignore)
 *   2. Run:
 *      FIREBASE_ENV=prod node set-admin-claim.js <email>
 */

const isProd = process.env.FIREBASE_ENV === 'prod';

if (!isProd) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}

const admin = require('firebase-admin');

let serviceAccount = null;
if (isProd) {
  try {
    serviceAccount = require('./service-account.json');
  } catch (e) {
    console.error('✗ Missing admin/service-account.json');
    console.error('  Download a service account key from Firebase Console and save it as: admin/service-account.json');
    console.error('  Then re-run: FIREBASE_ENV=prod node set-admin-claim.js <email>');
    process.exit(1);
  }
}

if (!admin.apps.length) {
  admin.initializeApp(
    isProd
      ? {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
        }
      : { projectId: 'carddex-local' }
  );
}

async function setAdminClaim(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`✓ Admin claim granted to: ${email} (uid: ${user.uid})`);
    console.log('  The user must sign out and sign back in for the claim to take effect.');
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.error(`✗ No account found for: ${email}`);
      console.error('  Create an account in the mobile app first, then re-run this script.');
    } else {
      const message = e?.message || String(e);
      console.error('✗ Failed:', message);
      if (!isProd && /ECONNREFUSED/i.test(message)) {
        console.error('  It looks like the Firebase Auth emulator is not running on localhost:9099.');
        console.error('  Start emulators from the repo root:');
        console.error('    firebase emulators:start');
        console.error('  Or, to set claims in real Firebase, run:');
        console.error('    FIREBASE_ENV=prod node set-admin-claim.js <email>');
      }
    }
    process.exit(1);
  }
}

async function removeAdminClaim(email) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: false });
  console.log(`✓ Admin claim removed from: ${email}`);
}

const [,, email, flag] = process.argv;

if (!email) {
  console.log('Usage:');
  console.log('  Grant admin:  node set-admin-claim.js <email>');
  console.log('  Revoke admin: node set-admin-claim.js <email> --revoke');
  console.log('  Production:   FIREBASE_ENV=prod node set-admin-claim.js <email>');
  process.exit(1);
}

const fn = flag === '--revoke' ? removeAdminClaim : setAdminClaim;
fn(email).then(() => process.exit(0)).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
