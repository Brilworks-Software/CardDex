# CardDex

A mobile app that lets users scan QR codes on physical cards to unlock animated digital versions in a personal binder. Admins can generate reveal videos using Google's Veo AI directly from the card image.

**Developed by Dr. Dhaval Trivedi**

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Running the App Locally](#running-the-app-locally)
- [First-Time Local Setup Checklist](#first-time-local-setup-checklist)
- [Testing the Full Flow Locally](#testing-the-full-flow-locally)
- [Admin Panel Authentication](#admin-panel-authentication)
- [Environment Variables — Local vs Production](#environment-variables--local-vs-production)
- [Firebase Security Rules](#firebase-security-rules)
- [Production Setup](#production-setup)
- [Deploying to Production](#deploying-to-production)
- [AI Video Generation (Veo)](#ai-video-generation-veo)
- [Adding New Cards](#adding-new-cards)
- [Project Architecture](#project-architecture)
- [Firestore Data Schema](#firestore-data-schema)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

**How it works end-to-end:**

1. A physical card is printed with a unique QR code sticker
2. User scans the QR code → redirected to download CardDex (if not installed)
3. User creates an account in the mobile app
4. App validates the QR code (one-time use, atomic transaction) and adds the card to their binder
5. Card reveal plays: static image animates → transitions into a looping video
6. Card is permanently saved to the user's digital binder
7. Binder shows all cards — collected in full color, missing as numbered silhouettes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native + Expo (TypeScript) |
| Navigation | Expo Router (file-based) |
| Animations | React Native Reanimated 2 |
| Video | expo-video |
| QR Scanning | expo-camera |
| Backend | Firebase (Auth + Firestore + Storage) |
| Admin Panel | React (Create React App, TypeScript) |
| AI Video Generation | Google Veo 2 via Gemini API or Vertex AI |
| Local Emulation | Firebase Emulators (Auth, Firestore, Storage) |

---

## Repository Structure

```
CardDex/
│
├── mobile/                          # Expo React Native app (iOS + Android)
│   ├── app/
│   │   ├── _layout.tsx              # Root layout, gesture handler
│   │   ├── index.tsx                # Auth gate — redirects to binder or login
│   │   ├── (auth)/
│   │   │   ├── login.tsx            # Email/password login screen
│   │   │   └── register.tsx         # Account creation screen
│   │   └── (app)/
│   │       ├── binder.tsx           # Main binder grid (all card slots)
│   │       ├── scan.tsx             # QR scanner — calls redeemCode transaction
│   │       └── card/[id].tsx        # Card reveal + detail screen
│   ├── components/
│   │   └── CardSlot.tsx             # Single card slot (owned vs missing state)
│   ├── constants/
│   │   └── theme.ts                 # Colors, fonts, rarity styles
│   ├── firebase/
│   │   ├── config.ts                # ⚡ Auto-switches: emulator (dev) / real Firebase (prod)
│   │   ├── auth.ts                  # register, login, logout helpers
│   │   ├── cards.ts                 # getAllCards, getCard
│   │   └── qrcodes.ts               # redeemCode (Firestore transaction), getUserBinder
│   ├── hooks/
│   │   └── useAuth.ts               # Auth state hook
│   ├── .env.example                 # Template for production env vars
│   └── app.json                     # Expo config (name, scheme, permissions)
│
├── admin-panel/                     # Web admin panel (requires admin login)
│   └── src/
│       ├── App.tsx                  # Auth gate + main panel (Cards / Add Card / QR Codes / AI Settings)
│       ├── AdminLogin.tsx           # Admin sign-in screen (checks admin custom claim)
│       ├── VideoGenerator.tsx       # AI video generation component (Veo)
│       ├── Settings.tsx             # AI provider config (Gemini / Vertex AI)
│       ├── App.css                  # Admin UI styles
│       ├── firebase.ts              # ⚡ Auto-switches: emulator (dev) / real Firebase (prod)
│       └── .env.example             # Template for production env vars
│
├── admin/
│   ├── seed.js                      # Seeds 10 cards + QR codes via Firebase Admin SDK
│   ├── set-admin-claim.js           # Grants/revokes { admin: true } custom claim on a user
│   └── package.json                 # Dependencies: firebase, firebase-admin, uuid
│
├── firebase.json                    # Emulator config + Hosting + Firestore/Storage rule paths
├── firestore.rules                  # ✅ Production-grade rules (same file used locally and in prod)
├── firestore.indexes.json           # Composite indexes for qr_codes queries
├── storage.rules                    # ✅ Production-grade storage rules
├── .firebaserc                      # Firebase project aliases
├── .gitignore                       # Ignores .env files, service-account.json, build artifacts
└── SETUP.md                         # Quick-start cheatsheet
```

---

## Prerequisites

| Tool | Version | Check | Install |
|------|---------|-------|---------|
| Node.js | 18+ | `node --version` | https://nodejs.org |
| npm | 9+ | `npm --version` | bundled with Node |
| Java | 21+ | `java -version` | see below |
| Firebase CLI | Latest | `firebase --version` | `npm i -g firebase-tools` |

**Install Java 21** (required by Firebase emulators — no sudo needed):
```bash
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh
sdk install java 21.0.5-tem
```

---

## Local Development Setup

> Local dev uses **Firebase Emulators** — no real Firebase project or credentials needed.
> The same strict security rules that run in production are enforced locally too.
> Data lives in-memory and resets when the emulator stops.

### Step 1 — Install dependencies

```bash
cd CardDex/mobile       && npm install
cd ../admin-panel       && npm install
cd ../admin             && npm install
```

### Step 2 — Understand the auto-switch

The Firebase config in both apps automatically detects the environment:

| App | Condition | Firebase target |
|-----|-----------|----------------|
| Mobile (`mobile/firebase/config.ts`) | `__DEV__ === true` (expo start) | Local emulator |
| Mobile | `__DEV__ === false` (eas build) | Real Firebase (env vars) |
| Admin panel (`admin-panel/src/firebase.ts`) | `NODE_ENV === 'development'` (npm start) | Local emulator |
| Admin panel | `NODE_ENV === 'production'` (npm run build) | Real Firebase (env vars) |

**No manual changes needed** — it switches automatically.

---

## Running the App Locally

Open **3 terminals**:

### Terminal 1 — Firebase Emulators

```bash
cd CardDex

# Load Java 21 if installed via SDKMAN:
source ~/.sdkman/bin/sdkman-init.sh

firebase emulators:start --project carddex-local
```

Wait for: `✔  All emulators ready!`

| Emulator | Port | Dashboard URL |
|----------|------|--------------|
| Auth | 9099 | http://localhost:4000/auth |
| Firestore | 8080 | http://localhost:4000/firestore |
| Storage | 9199 | http://localhost:4000/storage |
| **UI Dashboard** | **4000** | **http://localhost:4000** |

### Terminal 2 — Seed the database

> Run once per emulator session. Re-run after every emulator restart.
> Uses Firebase Admin SDK — bypasses security rules (correct for a server-side script).

```bash
cd CardDex/admin
node seed.js
```

Prints sample QR code UUIDs for each card — save these for testing.

### Terminal 2 (reuse) — Admin Panel

```bash
cd CardDex/admin-panel
npm start
# → http://localhost:3000
```

### Terminal 3 — Mobile App

```bash
cd CardDex/mobile

# Browser (fastest for UI work):
npx expo start --web --port 8084
# → http://localhost:8084

# Android emulator:
npx expo start --android

# iOS simulator (Mac only):
npx expo start --ios

# Physical device via Expo Go:
npx expo start
```

---

## First-Time Local Setup Checklist

Complete these steps **once** when setting up a new dev environment:

```
☐ 1. Start Firebase emulators (Terminal 1)
☐ 2. Run: cd admin && node seed.js
☐ 3. Create a user account in the mobile app (http://localhost:8084 → Register)
☐ 4. Grant admin access: cd admin && node set-admin-claim.js your@email.com
☐ 5. Sign out and back in on the mobile app (refreshes the auth token)
☐ 6. Open admin panel (http://localhost:3000) → sign in with same credentials
☐ 7. Admin panel loads — you now have full access
```

---

## Testing the Full Flow Locally

1. **Open** http://localhost:8084 → create an account → land on the binder (all missing slots)
2. **Open** http://localhost:3000 → sign in as admin → **QR Codes** tab → **Download QR** for any available code
3. Display the QR PNG on screen and scan with the mobile app camera (use Expo Go on your phone for best results)
4. Card reveal animation plays → tap **Add to Binder**
5. The binder slot fills in with the card image
6. Inspect live data at http://localhost:4000 → Firestore tab

**Testing without a camera** — use the UUID codes printed by `seed.js` as raw QR data. Enter them into any QR code generator site, display on screen, then scan.

---

## Admin Panel Authentication

The admin panel requires sign-in. After login it checks for the `{ admin: true }` Firebase custom claim — access is denied if the claim is absent.

### Granting admin access (one-time per person)

```bash
cd CardDex/admin

# Local emulator:
node set-admin-claim.js your@email.com

# Production (requires service-account.json — see Production Setup):
FIREBASE_ENV=prod node set-admin-claim.js your@email.com

# Revoke admin access:
node set-admin-claim.js your@email.com --revoke
```

> The user must **sign out and sign back in** after the claim is set for it to take effect (tokens are cached).

### How it works

```
Admin opens http://localhost:3000
         │
         ▼
AdminLogin.tsx — email/password sign-in
         │
         ▼
getIdTokenResult() — check for token.claims.admin === true
         │
    ┌────┴─────┐
    │          │
  admin      not admin
    │          │
    ▼          ▼
Admin panel  "Access denied" + sign out
```

---

## Environment Variables — Local vs Production

### Setting up production credentials

**Mobile app:**
```bash
cd mobile
cp .env.example .env.production
# Fill in EXPO_PUBLIC_FIREBASE_* values from Firebase Console
```

**Admin panel:**
```bash
cd admin-panel
cp .env.example .env.production
# Fill in REACT_APP_FIREBASE_* values from Firebase Console
```

Get the values from: Firebase Console → Project Settings → Your Apps → Web App → `firebaseConfig`

> **Never commit `.env.production`** — it is listed in `.gitignore`. For CI/CD pipelines, set these as environment secrets.

---

## Firebase Security Rules

### Overview

The **same rules file** is used for both the local emulator and production — there is no "open dev mode". This means security is tested locally before it ever reaches production.

### Firestore rules (`firestore.rules`)

| Collection | Read | Create | Update | Delete |
|-----------|------|--------|--------|--------|
| `/cards` | Any authenticated user | Admin only | Admin only | Admin only |
| `/qr_codes` | Any authenticated user | Admin only | Redeem only (strict) | Admin only |
| `/users` | Own profile only | Own profile at registration | Own `binder`/`displayName` only | Admin only |

**QR code update rule** — only a valid redeem is allowed:
- Code was not already used (`used == false`)
- Sets `used → true`
- Sets `claimedBy` to the caller's own UID
- Does not change `cardId`
- Only touches `used`, `claimedBy`, `claimedAt` fields

**Admin check** — uses a Firebase custom claim:
```
function isAdmin() {
  return request.auth != null && request.auth.token.admin == true;
}
```

### Storage rules (`storage.rules`)

| Path | Read | Write |
|------|------|-------|
| `cards/{cardId}/card.jpg` | Any authenticated user | Admin only |
| `cards/{cardId}/card.png` | Any authenticated user | Admin only |
| `cards/{cardId}/reveal.mp4` | Any authenticated user | Admin only |
| Everything else | Denied | Denied |

Write also enforces a 200 MB file size limit.

### Deploying rules to production

```bash
cd CardDex
firebase deploy --only firestore:rules,firestore:indexes,storage --project carddex-prod
```

### Firestore indexes (`firestore.indexes.json`)

Two composite indexes are defined for `qr_codes`:
- `cardId ASC + used ASC` — for filtering available codes per card in the admin panel
- `claimedBy ASC + claimedAt DESC` — for auditing which codes a user claimed

---

## Production Setup

### Step 1 — Create a Firebase project

1. Go to https://console.firebase.google.com → **Create Project** → name it `carddex-prod`
2. **Authentication** → Get Started → Sign-in method → **Email/Password** → Enable
3. **Firestore Database** → Create database → **Production mode** → choose a region
4. **Storage** → Get started → **Production mode** → same region as Firestore
5. **Project Settings** → Your Apps → **Add Web App** → copy the `firebaseConfig` object

### Step 2 — Fill in `.env.production` files

See [Environment Variables](#environment-variables--local-vs-production) above.

### Step 3 — Deploy security rules and indexes

```bash
cd CardDex
firebase deploy --only firestore:rules,firestore:indexes,storage --project carddex-prod
```

### Step 4 — Seed production cards

Download a service account key:
- Firebase Console → Project Settings → **Service accounts** → **Generate new private key**
- Save as `admin/service-account.json` (this file is in `.gitignore` — never commit it)

```bash
cd admin
FIREBASE_ENV=prod node seed.js
```

### Step 5 — Grant yourself admin access in production

```bash
cd admin
FIREBASE_ENV=prod node set-admin-claim.js your@email.com
```

Sign out and back in on the admin panel. You now have full access to the production admin panel.

---

## Deploying to Production

### Mobile App (EAS Build)

```bash
npm install -g eas-cli
cd mobile
eas login
eas build:configure

# Production build for both platforms:
eas build --platform all --profile production

# Test build (no app store required):
eas build --platform android --profile preview
```

EAS automatically reads `.env.production` during the build. The `__DEV__` flag is `false` in all EAS builds, so the app connects to real Firebase automatically.

### Admin Panel

```bash
cd admin-panel
npm run build        # reads .env.production automatically
```

Deploy the `/build` folder:

```bash
# Firebase Hosting (recommended — already configured in firebase.json):
firebase deploy --only hosting --project carddex-prod

# Vercel:
vercel --prod

# Netlify:
netlify deploy --prod --dir=build
```

---

## AI Video Generation (Veo)

The admin panel includes a **"✦ Generate with AI"** option when adding cards. It uses Google's Veo 2 model to animate your card image into a looping reveal video.

### Setting up

1. Open Admin Panel → sign in → **⚙ AI Settings** tab
2. Choose a provider:

| Provider | What you need | Best for |
|----------|--------------|----------|
| **Gemini Developer API** *(recommended)* | API key from AI Studio | Getting started quickly |
| **Vertex AI** | Google Cloud Project ID + API key | Enterprise / high volume |

3. Get a Gemini API key: https://aistudio.google.com/app/apikey
4. Paste it → **Test Connection** → **Save Settings**

> API keys are stored in the browser's `localStorage` only — never sent to any server other than Google's API.

### Generating a video

1. **+ Add Card** → fill in details → upload card image
2. In the **Reveal Video** section → click **✦ Generate with AI**
3. Review and edit the auto-generated prompt
4. Choose duration: **5s** / **8s** (default) / **10s**
5. Click **Generate Video with AI**
6. Wait 2–5 minutes (progress bar shows elapsed time)
7. Preview → **Regenerate** or proceed to **Save Card**

The video is automatically uploaded to Firebase Storage and attached to the card.

### Auto-prompt logic

The prompt is built from card data automatically:

| Field used | Example output |
|-----------|---------------|
| Name + Type + Rarity + Description | *"The card art comes alive in an epic, dramatic scene. [description]. Flames dance and flicker... seamless looping animation."* |

### API cost reference (Veo 2, Gemini API)

| Duration | Approx. cost |
|----------|-------------|
| 5s | ~$0.35 |
| 8s | ~$0.55 |
| 10s | ~$0.70 |

*Check https://ai.google.dev/pricing for current rates.*

---

## Adding New Cards

All done through the Admin Panel — **no code changes, no deploys needed**.

### Steps

1. Sign in to the Admin Panel
2. **+ Add Card** → fill in: number, name, type, HP, rarity, description
3. Upload card image (JPG/PNG)
4. Reveal Video — choose:
   - **Upload Video** — select `.mp4` directly
   - **✦ Generate with AI** — Veo animates the card image (requires AI Settings)
5. Set number of QR codes to generate (e.g. 50 for a print run)
6. **Save Card & Generate QR Codes**
7. **QR Codes** tab → **Download QR** → PNG ready to print

### Card asset specs

| Asset | Format | Recommended size |
|-------|--------|-----------------|
| Card image | JPG / PNG | 400 × 560 px |
| Reveal video | MP4 (H.264) | 400 × 560 px, looping, 5–10s, no audio |

### Scaling beyond the initial cards

The binder automatically shows a slot for every document in `/cards`, ordered by `number`. Add card #11 in the admin panel and every user immediately sees the new missing slot — no code change, no deploy.

---

## Project Architecture

### Firebase environment auto-switch

```
expo start  ──►  __DEV__ = true   ──►  connects to local emulators (localhost)
eas build   ──►  __DEV__ = false  ──►  reads EXPO_PUBLIC_FIREBASE_* env vars
                                        connects to real Firebase project

npm start   ──►  NODE_ENV = development  ──►  connects to local emulators
npm build   ──►  NODE_ENV = production   ──►  reads REACT_APP_FIREBASE_* env vars
                                               connects to real Firebase project
```

### Admin authentication flow

```
Open admin panel (http://localhost:3000 or hosted URL)
        │
        ▼
onAuthStateChanged fires
        │
   ┌────┴────┐
   │         │
  No user   User exists
   │         │
   ▼         ▼
AdminLogin  getIdTokenResult()
screen      check token.claims.admin
              │
         ┌────┴────┐
         │         │
       admin    not admin
         │         │
         ▼         ▼
     AdminPanel  Sign out +
                 show error
```

### QR code redemption (atomic transaction)

```
User scans QR code → carddex://redeem/{uuid}
        │
        ▼
redeemCode(code, uid) in qrcodes.ts
        │
        ▼
runTransaction(db, async tx => {
  read qr_codes/{code}    ─► not found?  → error: not_found
  read users/{uid}        ─► already used? → error: already_used
                          ─► already owns? → error: already_owned
  tx.update qr_codes: used=true, claimedBy=uid, claimedAt=now
  tx.update users: binder = arrayUnion(cardId)
}) ─ atomic: if two users scan simultaneously, only the first commit wins
        │
        ▼
Navigate to card reveal screen
```

### Card reveal animation sequence

```
1. Static card image fades in (spring scale)
2. Glow ring pulses — colour matches card rarity
3. Shimmer sweeps across the card twice
4. Card shakes (crack-open effect)
5. Image crossfades → looping video plays
6. "Add to Binder" button appears
7. Tap → binder updated → navigate to binder
```

### AI video generation flow

```
Admin uploads card image
        │
        ▼
"✦ Generate with AI" clicked
        │
        ▼
Image converted to base64
        │
        ▼
POST to Veo 2 API (Gemini or Vertex AI)
payload: { image, prompt, durationSeconds }
        │
        ▼
Receive operation name (long-running job)
        │
        ▼
Poll GET every 5s until done (2–5 min)
        │
        ▼
Response: video bytes (base64)
        │
        ▼
Convert → Blob → local preview shown to admin
        │
        ▼
Upload Blob → Firebase Storage: cards/{cardId}/reveal.mp4
        │
        ▼
Store download URL → attached to card form → saved to Firestore
```

---

## Firestore Data Schema

### `/cards/{cardId}`

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `number` | int | `1` | Display order in binder |
| `name` | string | `"Blazefire"` | |
| `type` | string | `"Fire"` | Used to generate AI prompt |
| `hp` | int | `180` | |
| `rarity` | string | `"legendary"` | `common` / `uncommon` / `rare` / `legendary` |
| `description` | string | `"Born from a volcanic eruption…"` | Used to generate AI prompt |
| `imageUrl` | string | Firebase Storage URL | Static card image |
| `videoUrl` | string | Firebase Storage URL | Reveal video (can be empty) |
| `createdAt` | timestamp | | |

### `/qr_codes/{uuid}`

| Field | Type | Notes |
|-------|------|-------|
| `cardId` | string | Points to a `/cards` document ID |
| `used` | boolean | `false` until redeemed — one-time only |
| `claimedBy` | string? | Firebase Auth UID of the redeemer |
| `claimedAt` | timestamp? | When it was redeemed |
| `createdAt` | string | ISO date string |

### `/users/{uid}`

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth UID (immutable) |
| `email` | string | Immutable after registration |
| `displayName` | string | Trainer name — user can update |
| `binder` | string[] | Array of `cardId`s the user owns |
| `createdAt` | timestamp | Immutable after registration |

---

## Troubleshooting

### Firebase emulators won't start — "Java version before 21"
```bash
source ~/.sdkman/bin/sdkman-init.sh
sdk install java 21.0.5-tem
# Retry: firebase emulators:start --project carddex-local
```

### Port already in use
```bash
kill $(lsof -t -i:8080 -i:9099 -i:9199 -i:4000) 2>/dev/null
```

### Expo "Port 8081 is already in use"
```bash
npx expo start --web --port 8084
```

### Seed script fails — PERMISSION_DENIED
The seed script uses Firebase Admin SDK which bypasses security rules. If you see this error, the Admin SDK is not connecting to the emulator correctly. Make sure:
1. The emulator is running (`firebase emulators:start`)
2. You are running the script from the `admin/` directory: `cd admin && node seed.js`

Do **not** open up security rules to fix this — that would remove production protections.

### Admin panel shows "Access denied" after login
The user does not have the `admin: true` custom claim. Run:
```bash
cd admin
node set-admin-claim.js your@email.com
```
Then **sign out and sign back in** on the admin panel (cached tokens need refreshing).

### Admin panel redirects to login even though I'm signed in
The admin claim may not be set yet. Verify:
```bash
cd admin
node set-admin-claim.js your@email.com
```
Then sign out and back in.

### QR scanning doesn't work in browser
Browser tab camera access is limited. Use:
- **Expo Go** on a physical phone (scan the QR in Terminal 3)
- Admin Panel → download a QR PNG → display on screen → scan with phone camera

### Physical phone can't reach the emulator
The app auto-detects the Metro bundler host IP via `expo-constants` and uses that for emulator connections. Make sure your phone and computer are on the **same Wi-Fi network**.

### "already_used" error when scanning
Each code can only be redeemed once. For new test codes: re-run `node seed.js` (local) or generate new codes from the admin panel.

### Emulator data disappears after restart
Expected — emulators are in-memory only. Re-run `cd admin && node seed.js` after each restart.

### AI video generation — 403 or quota error
- Go to **⚙ AI Settings** → click **Test Connection** to verify the key is valid
- Veo requires a paid/billing-enabled Google AI Studio account
- For Vertex AI: ensure the **Vertex AI API** is enabled in the GCP project console
- Check quota usage at https://console.cloud.google.com

### AI video generation returns "no video in response"
Veo can fail silently on the first attempt. Click **Regenerate** — this is normal for generative models.

### Service account key missing for production seed/admin-claim
Download from Firebase Console → Project Settings → Service accounts → **Generate new private key** → save as `admin/service-account.json`. This file is in `.gitignore` and must never be committed.
