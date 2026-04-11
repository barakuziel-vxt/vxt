/**
 * useUserProfile — manages user profile settings (name, userId, email, phone)
 * 
 * Settings are persisted in AsyncStorage and reloaded on mount.
 * Email defaults to the Firebase auth user's email if not set in AsyncStorage.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

export interface UserProfile {
  fullName: string;
  userId: string;
  email: string;
  phone: string;
  loaded: boolean;
}

const KEY_FULL_NAME = '@vxt_user_fullName';
const KEY_USER_ID = '@vxt_user_userId';
const KEY_EMAIL = '@vxt_user_email';
const KEY_PHONE = '@vxt_user_phone';

const DEFAULTS = {
  fullName: '',
  userId: '',
  email: '',
  phone: '',
};

export async function loadUserProfile(): Promise<UserProfile> {
  const [fullName, userId, email, phone] = await Promise.all([
    AsyncStorage.getItem(KEY_FULL_NAME),
    AsyncStorage.getItem(KEY_USER_ID),
    AsyncStorage.getItem(KEY_EMAIL),
    AsyncStorage.getItem(KEY_PHONE),
  ]);
  
  // Use Firebase auth email as canonical source
  const firebaseEmail = auth().currentUser?.email || '';
  
  return {
    fullName: fullName || DEFAULTS.fullName,
    userId: userId || DEFAULTS.userId,
    email: firebaseEmail || email || DEFAULTS.email,
    phone: phone || DEFAULTS.phone,
    loaded: true,
  };
}

export async function saveUserProfile(
  fullName: string,
  userId: string,
  email: string,
  phone: string,
): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(KEY_FULL_NAME, fullName),
      AsyncStorage.setItem(KEY_USER_ID, userId),
      AsyncStorage.setItem(KEY_EMAIL, email),
      AsyncStorage.setItem(KEY_PHONE, phone),
    ]);
    console.log('[useUserProfile] Saved to AsyncStorage:', { userId, email, fullName });
  } catch (err) {
    console.error('[useUserProfile] Failed to save to AsyncStorage:', err);
    throw err;
  }
}

export function useUserProfile(): [UserProfile, (profile: UserProfile) => void] {
  const [profile, setProfile] = useState<UserProfile>({
    fullName: DEFAULTS.fullName,
    userId: DEFAULTS.userId,
    email: DEFAULTS.email,
    phone: DEFAULTS.phone,
    loaded: false,
  });

  useEffect(() => {
    loadUserProfile().then(p => {
      console.log('[useUserProfile] Loaded from AsyncStorage:', { userId: p.userId, email: p.email });
      setProfile(p);
    });
  }, []);

  // IMPORTANT: The returned updateProfile function must be called with await
  // to ensure async save completes before state updates
  const updateProfile = async (newProfile: UserProfile) => {
    await saveUserProfile(newProfile.fullName, newProfile.userId, newProfile.email, newProfile.phone);
    setProfile(newProfile);
  };

  return [profile, updateProfile as any];
}
