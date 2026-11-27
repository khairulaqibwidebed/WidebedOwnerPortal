# Widebed Owner Portal: setup (26 Nov 2026)

A separate website for property owners. Own Firebase project, own GitHub repo, own Vercel project.
It reads the PMS only through its server functions (`api/`), with a service account key kept in Vercel.

## What the owner can do
- Register (only if their email is an owner or co-owner email in the PMS), verify the email, sign in, forgot password.
- Property and Units (read only), Check-ins and check-outs (dates, nights and gross rental, no guest names), Payments (only PAID months: Owner Statement PDF, pay slip), Maintenance (status only, photos and videos), Profile (name, email, change password).
- Installable on a phone (PWA).

## How it stays safe
- The browser never talks to the PMS. `/api/portal` checks the owner's portal login, requires a VERIFIED email, finds the PMS owner by that email (re-checked every time), and returns only that owner's units.
- The portal's own Firestore refuses every browser request (`firestore.rules`). Only the server writes `ownerLinks/{uid}`.
- No guest names, no booking amounts, no costs, no bank details leave the server. Tickets marked "Hide from owner" in the PMS never reach the portal.
- A switched-off owner, or an owner whose contact email changes, loses access within a minute.

## Steps for Khairul (one thing at a time)

### 1. New Firebase project
console.firebase.google.com > Add project (for example `widebed-owner-portal`, free Spark plan).
- Build > Authentication > Get started > Sign-in method > Email/Password > Enable.
- Build > Firestore Database > Create database (production mode, asia-southeast1).
- Build > Firestore > Rules: paste the contents of `firestore.rules`, Publish.
- Project settings > General > Your apps > Web app (`</>`) > register app. Copy the config values (apiKey, authDomain, projectId, appId).
- Authentication > Settings > Authorized domains: add the Vercel domain of the portal once you have it.
- Authentication > Templates: change the "Email address verification" and "Password reset" sender name to Widebed (optional).

### 2. Service account keys (never paste them in chat or git)
- Portal project: Project settings > Service accounts > Generate new private key. This is `PORTAL_ADMIN_JSON`.
- PMS project (widebed-pmsdashboard): same page > Generate new private key. This is `PMS_ADMIN_JSON`. (The PMS Vercel project already has one as `FIREBASE_ADMIN_JSON`; you can paste that same key.)
  The portal only reads from the PMS. If you want to be extra careful, make a separate service account in Google Cloud IAM with the role "Cloud Datastore Viewer" and use its key.

### 3. GitHub and Vercel
- New GitHub repo (for example `widebed-owner-portal`), push this folder.
- Vercel > Add New Project > import that repo. Framework: Vite.
- Environment variables (Production AND Preview):
  - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (from step 1)
  - `PORTAL_FIREBASE_API_KEY` (same value as `VITE_FIREBASE_API_KEY`)
  - `PORTAL_ADMIN_JSON`, `PMS_ADMIN_JSON` (step 2, paste the whole JSON)
  - Drive (same values the PMS Vercel project uses): `DRIVE_SCRIPT_URL` and `DRIVE_SCRIPT_KEY`, or `GOOGLE_SERVICE_ACCOUNT_JSON` and `DRIVE_ROOT_FOLDER_ID`
- Deploy, then add the Vercel domain to Firebase Authorized domains (step 1).

### 4. In the PMS
- Owners need their email saved on Portfolio > Owners (contact details). A co-owner's email is saved the same way and gets their own login to the same data.
- Older owners with no saved email: a Director runs Owners > "Set up contact details" first.
- Maintenance tickets: tick "Hide from owner" on a ticket to keep it out of the portal (see HANDOFF note; needs PMS rules draft).

## Local test (optional)
```
npm install
npm run dev
```
Put the `VITE_FIREBASE_*` values in `.env.local` (never committed). The `api/` functions only run on Vercel (or `vercel dev`).

## Tests
```
npm test
```
`tests/api.test.js` checks with pretend data that an owner only sees their own units, stays, paid statements and visible tickets.
`tests/rules.test.js` needs the Firestore emulator (firebase-tools): `firebase emulators:exec --only firestore --project demo-owner-portal "npm run test:rules"`.

## Limits to know
- Reads from the PMS count against the PMS Firestore free limit (50,000 reads a day). Each owner data is kept 30 seconds on the server, so a page open costs a few dozen reads at most.
- Stays show the last 14 months and the next 3 months.
- Fixed rent units: their payment row shows, but there is no statement PDF (Finance's fixed rent summary is per property).
- Videos are streamed through the server. Very large videos depend on Vercel's streaming limits and need a real test.
- Units an owner sold earlier are not listed (only units they own now).
