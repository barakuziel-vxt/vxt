/**
 * useUserProfile — manages user profile settings (name, userId, email, phone)
 * 
 * Settings are persisted in AsyncStorage and reloaded on mount.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  fullName: 'Shula Uziel',
  userId: '033114870',
  email: 'shula.uziel@gmail.com',
  phone: '0526122302',
};

export async function loadUserProfile(): Promise<UserProfile> {
  const [fullName, userId, email, phone] = await Promise.all([
    AsyncStorage.getItem(KEY_FULL_NAME),
    AsyncStorage.getItem(KEY_USER_ID),
    AsyncStorage.getItem(KEY_EMAIL),
    AsyncStorage.getItem(KEY_PHONE),
  ]);
  
  return {
    fullName: fullName || DEFAULTS.fullName,
    userId: userId || DEFAULTS.userId,
    email: email || DEFAULTS.email,
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
  await Promise.all([
    AsyncStorage.setItem(KEY_FULL_NAME, fullName),
    AsyncStorage.setItem(KEY_USER_ID, userId),
    AsyncStorage.setItem(KEY_EMAIL, email),
    AsyncStorage.setItem(KEY_PHONE, phone),
  ]);
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
    loadUserProfile().then(setProfile);
  }, []);

  const updateProfile = (newProfile: UserProfile) => {
    saveUserProfile(newProfile.fullName, newProfile.userId, newProfile.email, newProfile.phone);
    setProfile(newProfile);
  };

  return [profile, updateProfile];
}
