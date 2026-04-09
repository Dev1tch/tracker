# Life Tracker Mobile

Expo-powered React Native port of the existing web app.

## What’s Included

- Auth flow using the existing backend
- Habits screen with:
  - weekly mobile tracking
  - habit CRUD
  - category CRUD
  - daily log editing
- Tasks screen with:
  - status-grouped mobile board
  - task CRUD
  - task category management
  - quick status changes
- Calendar screen with:
  - Google account connect/disconnect
  - agenda view
  - event CRUD
  - calendar visibility toggles
  - task due-date merge into the daily agenda
- Finance placeholder matching the web app

## Shared Logic

The mobile app reuses the parent project’s API layer from `../src/lib/api`.

To make that work, the Expo app uses:

- `metro.config.js` to watch the parent workspace
- `src/shared/runtime.js` to hydrate auth and Google account storage into the shared API runtime

## Environment

Create `mobile-app/.env` from `mobile-app/.env.example`.

Required values:

- `EXPO_PUBLIC_API_URL`
  - backend API base URL
- `EXPO_PUBLIC_WEB_APP_URL`
  - reachable URL for the Next.js app
  - needed for mobile Google Calendar OAuth and `/api/google/*` routes

For real-device testing, `EXPO_PUBLIC_WEB_APP_URL` must be reachable from the phone.
If you run the Next app locally, a LAN IP is enough for normal app traffic, but Google Calendar OAuth on a real iPhone needs a public HTTPS URL for the Next app callback.

For Google Calendar on a physical device, also set `GOOGLE_NEXT_PUBLIC_APP_URL` in the root `.env.development` to the same public HTTPS URL and add:

```bash
https://your-public-url.example/api/google/callback
```

to the Google Cloud OAuth client’s authorized redirect URIs.

Example:

```bash
EXPO_PUBLIC_API_URL=https://tracker-backend-mocha.vercel.app/api/v1
EXPO_PUBLIC_WEB_APP_URL=http://192.168.1.40:3000
```

## Run

```bash
cd mobile-app
npm install
npm run start
```

Then open with Expo Go or run:

```bash
npm run android
npm run ios
```

## Verification

The app was verified with:

- `npm run lint`
- `npx expo export --platform android --output-dir dist-export`
