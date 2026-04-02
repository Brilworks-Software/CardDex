/**
 * CardDex — Firebase Seed Script
 * Uses Firebase Admin SDK so it bypasses security rules (correct behaviour
 * for a server-side admin script).
 *
 * Usage (local emulator):
 *   cd admin && node seed.js
 *
 * Usage (production — requires service-account.json):
 *   FIREBASE_ENV=prod node seed.js
 *
 * Make sure the Firebase emulator is running first (local):
 *   firebase emulators:start --project carddex-local
 */

const isProd = process.env.FIREBASE_ENV === 'prod';

// Point Admin SDK at the local emulator
if (!isProd) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
}

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

if (!admin.apps.length) {
  if (isProd) {
    const serviceAccount = require('./service-account.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({ projectId: 'carddex-local' });
  }
}

const db = admin.firestore();

const CARDS = [
  { id: 'card-001', number: 1,  name: 'Blazefire',  rarity: 'legendary', type: 'Fire',     hp: 180, description: 'A fierce creature born from a volcanic eruption. Its mane burns eternally.',        imageUrl: 'https://picsum.photos/seed/blazefire/400/560',  videoUrl: '' },
  { id: 'card-002', number: 2,  name: 'Aquashade',  rarity: 'rare',      type: 'Water',    hp: 140, description: 'Lurks in the deepest ocean trenches, rarely seen by human eyes.',                    imageUrl: 'https://picsum.photos/seed/aquashade/400/560',  videoUrl: '' },
  { id: 'card-003', number: 3,  name: 'Thornveil',  rarity: 'uncommon',  type: 'Grass',    hp: 110, description: 'Its thorny shell can deflect even the sharpest attacks.',                            imageUrl: 'https://picsum.photos/seed/thornveil/400/560',  videoUrl: '' },
  { id: 'card-004', number: 4,  name: 'Voltspike',  rarity: 'rare',      type: 'Electric', hp: 130, description: 'Generates 10,000 volts in its tail with every step it takes.',                       imageUrl: 'https://picsum.photos/seed/voltspike/400/560',  videoUrl: '' },
  { id: 'card-005', number: 5,  name: 'Froststorm', rarity: 'rare',      type: 'Ice',      hp: 120, description: 'Breathes ice so cold it can freeze a river solid in seconds.',                       imageUrl: 'https://picsum.photos/seed/froststorm/400/560', videoUrl: '' },
  { id: 'card-006', number: 6,  name: 'Shadowpaw',  rarity: 'uncommon',  type: 'Dark',     hp: 100, description: 'Can vanish completely in the shadow of any object.',                                 imageUrl: 'https://picsum.photos/seed/shadowpaw/400/560',  videoUrl: '' },
  { id: 'card-007', number: 7,  name: 'Stoneclash', rarity: 'common',    type: 'Rock',     hp: 90,  description: 'Its fists are harder than granite and never tire.',                                  imageUrl: 'https://picsum.photos/seed/stoneclash/400/560', videoUrl: '' },
  { id: 'card-008', number: 8,  name: 'Windrift',   rarity: 'common',    type: 'Flying',   hp: 80,  description: 'Rides the jet stream at altitudes beyond any mountain peak.',                         imageUrl: 'https://picsum.photos/seed/windrift/400/560',   videoUrl: '' },
  { id: 'card-009', number: 9,  name: 'Psybloom',   rarity: 'uncommon',  type: 'Psychic',  hp: 105, description: 'Can read thoughts of anything within a 100-mile radius.',                            imageUrl: 'https://picsum.photos/seed/psybloom/400/560',   videoUrl: '' },
  { id: 'card-010', number: 10, name: 'Ironclad',   rarity: 'rare',      type: 'Steel',    hp: 150, description: 'Its armor plating has never once been dented in battle.',                            imageUrl: 'https://picsum.photos/seed/ironclad/400/560',   videoUrl: '' },
];

const CODES_PER_CARD = 3;

async function seed() {
  console.log(`Seeding CardDex ${isProd ? 'PRODUCTION' : 'local emulator'}...\n`);

  // Write cards
  const cardBatch = db.batch();
  for (const card of CARDS) {
    const { id, ...data } = card;
    cardBatch.set(db.collection('cards').doc(id), {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await cardBatch.commit();
  console.log(`✓ ${CARDS.length} cards written`);

  // Write QR codes
  const sampleCodes = [];
  // Firestore batch limit is 500 — chunk if needed
  const allCodes = CARDS.flatMap((card) =>
    Array.from({ length: CODES_PER_CARD }, () => ({
      code: uuidv4(),
      cardId: card.id,
      cardName: card.name,
    }))
  );

  const BATCH_SIZE = 400;
  for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
    const chunk = allCodes.slice(i, i + BATCH_SIZE);
    const qrBatch = db.batch();
    for (const { code, cardId } of chunk) {
      qrBatch.set(db.collection('qr_codes').doc(code), {
        cardId,
        used: false,
        claimedBy: null,
        claimedAt: null,
        createdAt: new Date().toISOString(),
      });
    }
    await qrBatch.commit();
  }

  console.log(`✓ ${allCodes.length} QR codes written (${CODES_PER_CARD} per card)\n`);

  // Print one sample code per card
  console.log('Sample test codes (one per card):');
  for (let i = 0; i < CARDS.length; i++) {
    const { code, cardName } = allCodes[i * CODES_PER_CARD];
    console.log(`  ${cardName.padEnd(12)} → ${code}`);
  }

  console.log('\n✅ Seed complete!');
}

seed().catch((e) => {
  console.error('\n❌ Seed failed:', e.message);
  process.exit(1);
});
