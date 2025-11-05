import { initializeApp } from 'firebase/app';
import { initializeAuth, GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
// Initialize web auth with explicit persistence and popup redirect resolver
const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  // Provide resolver to stabilize redirect/popup operations in Expo web/Vercel
  popupRedirectResolver: browserPopupRedirectResolver,
});
const googleProvider = new GoogleAuthProvider();
// Ensure account selection prompt to reduce silent failures due to cached sessions
googleProvider.setCustomParameters({ prompt: 'select_account' });
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, googleProvider };
export default app;