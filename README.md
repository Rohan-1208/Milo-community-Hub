# Milo Community Hub

Production-ready Expo/React web app (static export) with Firebase Auth/Firestore and Vercel hosting.

## Quick Start

- Preview locally: `npx serve -s dist -l 8084`
- Build for web: `npx expo export --platform web`

## Deployment (Vercel)

This repo includes `vercel.json` for SPA routing and security headers. Steps:

1. Create a new Vercel project and connect this repository.
2. Set Environment Variables (Project Settings → Environment Variables):
   - `EXPO_PUBLIC_FIREBASE_API_KEY`
   - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
   - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `EXPO_PUBLIC_FIREBASE_APP_ID`
   - `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`
3. Ensure Firebase Auth → Email/Password provider is enabled and your domain is in Authorized Domains.
4. Deploy: Vercel will run `npx expo export --platform web` and serve `dist`.

## Post-Deploy Checks

- Visit `/auth`, sign in with a test user, confirm redirect to `/home`.
- Refresh to confirm session persistence.
- Navigate `/home`, `/discover`, `/communities` without redirect.
- Sign out and sign back in.

## Scripts

- `npm run web:build`: `expo export --platform web`
- `npm run web:serve`: `serve -s dist -l 8084`