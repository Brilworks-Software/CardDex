# CardDex — Setup Guide

## Project Structure
```
CardDex/
├── mobile/          ← Expo React Native app (iOS + Android)
├── admin-panel/     ← Web admin panel (React)
└── admin/seed.js    ← One-time Firestore seed script
```

---

## Step 1 — Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Create Project" → name it `carddex`
3. Enable **Authentication** → Sign-in method → Email/Password
4. Enable **Firestore Database** → Start in test mode
5. Enable **Storage** → Start in test mode
6. Go to Project Settings → Your Apps → Add Web App → copy the config

---

## Step 2 — Add Firebase Config

Paste your Firebase config into **both** of these files:

- `mobile/firebase/config.ts`
- `admin-panel/src/firebase.ts`
- `admin/seed.js`

Replace the `YOUR_*` placeholder values.

---

## Step 3 — Seed the Database (10 placeholder cards)

```bash
cd admin
npm install firebase uuid
node seed.js
```

This writes 10 cards + 30 QR codes (3 per card) to Firestore.

---

## Step 4 — Run the Mobile App

```bash
cd mobile
npm install
npx expo start
```

- Scan the QR code with **Expo Go** (iOS/Android) to preview instantly
- Or run on simulator: `npx expo run:ios` / `npx expo run:android`

---

## Step 5 — Run the Admin Panel

```bash
cd admin-panel
npm install
npm start
```

Opens at http://localhost:3000

### Admin Panel Features:
- **All Cards** — view cards, download QR codes for printing
- **+ Add Card** — upload image + video, auto-generates QR codes
- **QR Codes** — see all codes, claimed/available status, download individual QRs

---

## Step 6 — Test the Full Flow

1. Open the admin panel → All Cards → Download QR Codes for any card
2. Print or display the QR code on screen
3. Open mobile app → Create account → tap "Scan Card"
4. Scan the QR code
5. Watch the card reveal animation
6. Card appears in your binder!

---

## Adding More Cards (after launch)

In the admin panel → click "+ Add Card":
- Fill in name, number, type, HP, rarity, description
- Upload card image (.jpg/.png)
- Upload reveal video (.mp4) — the looping animation shown after reveal
- Set how many QR codes to generate
- Click Save — card appears instantly in all users' binders as a missing slot

---

## Adding Real Card Videos

When you have the looping reveal videos ready:
1. Go to Admin Panel → + Add Card
2. Upload the `.mp4` video in the "Reveal Video" field
3. Or update an existing card's `videoUrl` directly in the Firebase console

The card reveal screen will automatically:
1. Show the static card image
2. Pulse with a glow animation
3. Shimmer across the card
4. Crossfade into the looping video

---

## Firestore Data Structure

```
/cards/{cardId}
  number: int
  name: string
  type: string
  hp: int
  rarity: "common" | "uncommon" | "rare" | "legendary"
  description: string
  imageUrl: string
  videoUrl: string

/qr_codes/{uuid}
  cardId: string
  used: boolean
  claimedBy: uid | null
  claimedAt: timestamp | null

/users/{uid}
  email: string
  displayName: string
  binder: [cardId, ...]
  createdAt: timestamp
```
