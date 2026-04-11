/**
 * authStore — manages Firebase Auth state for passwordless login.
 *
 * Flow:
 *  1. User enters email → app calls POST /auth/start-login
 *  2. Backend returns custom token → app signs in with signInWithCustomToken()
 *  3. If emailVerified is false → app calls sendEmailVerification()
 *  4. User clicks verification link in email → emailVerified becomes true
 *  5. App detects verified → proceeds to main app
 */
import { create } from 'zustand';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthState {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: FirebaseAuthTypes.User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setInitialized: () => set({ initialized: true }),

  signOut: async () => {
    try {
      await auth().signOut();
    } catch (e) {
      console.warn('[authStore] signOut error:', e);
    }
    set({ user: null });
  },
}));
