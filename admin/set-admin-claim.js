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

const serviceAccount = isProd
  ? require('./service-account.json')   // only needed for prod
  : null;

if (!admin.apps.length) {
  admin.initializeApp(
    isProd
      ? { credential: admin.credential.cert(serviceAccount), projectId: 'carddex-prod' }
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
      console.error('✗ Failed:', e.message);
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
