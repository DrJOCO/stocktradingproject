# Signal Analyzer

A React + Vite trading dashboard for scanning symbols, analyzing technical signals, reviewing backtests, and exporting shareable visuals.

## Stack
- React 19
- Vite 8
- Remotion for video exports
- Yahoo Finance data proxied through the Vite dev server in local development
- Vercel serverless API routes for production deployments
- Optional Firebase Auth + Firestore sync for cross-device state

## Getting Started
1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open the local Vite URL shown in the terminal.

## Available Scripts
- `npm run dev` - start the local development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint
- `npm run studio` - open Remotion Studio
- `npm run render-signal` - render the signal card video
- `npm run render-leaderboard` - render the leaderboard video
- `npm run render-heatmap` - render the sector heatmap video

## Data Notes
- Local development uses the `/yahoo` and `/yahoo2` Vite proxies.
- Production deployments use same-origin `/api/yahoo/*` routes, so the app can be hosted publicly without exposing secrets or depending on a local proxy.
- No API key is required for the default data flow.
- Screener inputs and the most recent screener results are cached in `localStorage` so they survive tab switches and refreshes.

## Environment
- No client environment variables are required for the default market data flow.
- To enable sign-in and cross-device sync, create a Firebase web app and set the `VITE_FIREBASE_*` variables shown in `.env.example`.
- Vercel will need the same `VITE_FIREBASE_*` variables added in Project Settings -> Environment Variables before you redeploy.
- Keep secrets out of git. `.env.example` is the only env file intended to be shared.

## Project Structure
- `src/App.jsx`
- `src/components`
- `src/api`
- `src/indicators`
- `src/backtest`
- `api/yahoo`

## Deploy Free On Vercel
1. Push the repo to GitHub.
2. Import the repo into [Vercel](https://vercel.com/).
3. Keep the default Vite build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy.

The app will use the bundled Vercel API routes under `/api/yahoo/*` for market data in production, so the deployed site works the same way as local development.

## Mobile Notes
- The main analyzer, signal cards, journal, heatmap, and utility screens now use auto-fitting grids so they stack more cleanly on phones.
- `index.html` already includes a responsive viewport meta tag, so the app is ready for mobile browser use after deployment.

## Enable Firebase Sync
1. Create a Firebase project and add a Web app.
2. Enable:
   - Authentication -> Google provider
   - Firestore Database
3. Add your local dev URL and deployed Vercel URL to Firebase Authentication -> Authorized domains.
4. Copy the web app config values into `.env.local` using the keys in `.env.example`.
5. Add the same variables in Vercel and redeploy.

The app will keep working in local-only mode until Firebase is configured. Once you sign in, watchlists, screener state, alerts, journal entries, and account settings will sync through Firestore.

### Firestore Rules
Use authenticated per-user rules for the sync document:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/state/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

That matches this app’s storage path: `users/{uid}/state/app`.
