import type { Auth, GoogleAuthProvider } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

declare module '@/config/firebase' {
  export const auth: Auth;
  export const db: Firestore;
  export const storage: FirebaseStorage;
  export const googleProvider: GoogleAuthProvider;
  const _default: unknown;
  export default _default;
}