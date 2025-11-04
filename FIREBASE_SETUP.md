# Firebase Setup Guide

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "milo-community-hub")
4. Enable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

## 3. Create a Web App

1. In your Firebase project, click the web icon (`</>`) to add a web app
2. Enter an app nickname (e.g., "milo-web")
3. Check "Also set up Firebase Hosting" (optional)
4. Click "Register app"
5. Copy the Firebase configuration object

## 4. Add Firebase Environment Variables

1. Create a `.env.local` file in the project root.
2. Paste your Web app config as Expo public env vars:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

3. Do not edit `config/firebase.ts`; it reads from env at runtime.
4. Restart the dev server after adding or changing env vars.

## 5. Set up Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location for your database
5. Click "Done"

## 6. Configure Security Rules (Optional)

For development, you can use these basic rules in Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Communities are readable by all authenticated users
    match /communities/{communityId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Posts are readable by all authenticated users
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## 7. Google OAuth for Expo (Native)

1. In Google Cloud Console → Credentials, create OAuth client IDs:
   - Expo client: type "Web application"; use default settings (proxy handles redirect URI)
   - iOS client: type "iOS"; use your bundle identifier (`app.json` → `ios.bundleIdentifier` if set)
   - Android client: type "Android"; use your package name and SHA-1 (for EAS builds)
2. Paste the client IDs into `.env.local`:
   - `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
3. Restart the dev server.
4. Tap "Continue with Google" on the auth screen; for Expo Go, the proxy flow opens a browser, then returns to the app.

## 8. Test the Setup

1. Start your Expo development server: `npm start`
2. Try creating a new account (Email/Password)
3. Try logging in with Google on native (Expo)
4. Check your Firestore database to see if user documents are created

## Troubleshooting

- Make sure your Firebase project has Authentication enabled
- Verify that Email/Password sign-in method is enabled
- Check that your Firebase configuration is correct
- Ensure your Firestore database is created and accessible
- Check the console for any error messages

## Next Steps

Once Firebase is set up, you can:
- Add more authentication methods (Google, Apple, etc.)
- Implement password reset functionality
- Add user profile management
- Set up push notifications
- Add real-time features with Firestore
