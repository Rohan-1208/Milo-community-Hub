import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  signInWithPopup,
  signInWithCredential,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import type { User } from '@/types';

WebBrowser.maybeCompleteAuthSession();

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Set up Google auth request for native Expo
  const [googleRequest, , promptGoogle] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    // Provide webClientId to avoid invariant error when running in web mode
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    responseType: 'id_token',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const appUser: User = {
              id: firebaseUser.uid,
              name: userData.name || firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              avatar: userData.avatar || firebaseUser.photoURL || '',
              bio: userData.bio || '',
              joinedCommunities: userData.joinedCommunities || [],
              createdAt: userData.createdAt || firebaseUser.metadata.creationTime || new Date().toISOString(),
            };
            setUser(appUser);
            await AsyncStorage.setItem('user', JSON.stringify(appUser));
          } else {
            // Create user document if it doesn't exist
            const newUser: User = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              avatar: firebaseUser.photoURL || '',
              bio: '',
              joinedCommunities: [],
              createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
            await AsyncStorage.setItem('user', JSON.stringify(newUser));
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          // Fallback to basic user data if Firestore fails
          const fallbackUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || '',
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || '',
            bio: '',
            joinedCommunities: [],
            createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
          };
          setUser(fallbackUser);
          await AsyncStorage.setItem('user', JSON.stringify(fallbackUser));
        }
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // On web, process redirect results to surface any errors and ensure state settles
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (async () => {
      try {
        await getRedirectResult(auth);
        // User state will be handled by onAuthStateChanged
      } catch (err) {
        console.warn('Google redirect result error:', err);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      console.log('Firebase login attempt:', { email });
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase login successful:', userCredential.user.uid);
      // The user state will be updated automatically by the onAuthStateChanged listener
      return userCredential.user;
    } catch (error: any) {
      console.error('Firebase login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      await updateFirebaseProfile(userCredential.user, {
        displayName: name,
      });

      // Create user document in Firestore
      const newUser: User = {
        id: userCredential.user.uid,
        name,
        email,
        avatar: '',
        bio: '',
        joinedCommunities: [],
        createdAt: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      // The user state will be updated automatically by the onAuthStateChanged listener
      return userCredential.user;
    } catch (error: any) {
      throw new Error(error.message || 'Signup failed');
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      console.log('Google sign-in attempt');
      
      if (Platform.OS === 'web') {
        // Try popup first; if blocked/closed, fallback to redirect
        try {
          const userCred = await signInWithPopup(auth, googleProvider);
          console.log('Google sign-in successful (web popup):', userCred.user.uid);
          return userCred.user;
        } catch (popupErr: any) {
          const code = popupErr?.code || '';
          const knownPopupIssues = [
            'auth/popup-closed-by-user',
            'auth/popup-blocked',
            'auth/cancelled-popup-request',
          ];
          if (knownPopupIssues.includes(code)) {
            console.warn('Popup failed, falling back to redirect:', code);
            await signInWithRedirect(auth, googleProvider);
            return; // onAuthStateChanged will handle user after redirect
          }
          // Unknown popup error: rethrow for visibility
          throw popupErr;
        }
      }

      if (!googleRequest) {
        throw new Error('Google auth not ready. Please try again.');
      }

      const res = await promptGoogle({ useProxy: true });

      if (res?.type === 'success') {
        const idToken = (res.params as any)?.id_token;
        if (!idToken) throw new Error('Google did not return id_token');
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        console.log('Google sign-in successful (native):', userCred.user.uid);
        return userCred.user;
      }

      if (res?.type === 'dismiss') {
        throw new Error('popup-closed-by-user');
      }

      throw new Error('Google sign-in failed');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw new Error(error.message || 'Google sign-in failed');
    }
  }, [googleRequest, promptGoogle]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      // The user state will be updated automatically by the onAuthStateChanged listener
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed');
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      const updatedUser = { ...user, ...updates };
      
      // Update Firestore
      await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
      
      // Update local state
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error: any) {
      throw new Error(error.message || 'Profile update failed');
    }
  }, [user]);

  return useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    signInWithGoogle,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  }), [user, isLoading, login, signup, signInWithGoogle, logout, updateProfile]);
});