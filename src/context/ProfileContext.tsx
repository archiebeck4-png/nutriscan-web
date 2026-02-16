'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { UserProfile } from '../models/types';
import { getProfile, saveProfile } from '../lib/db';

interface ProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  setProfile: (profile: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isLoading: true,
  setProfile: async () => {},
});

export function ProfileContextProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getProfile().then((p) => {
      setProfileState(p ?? null);
      setIsLoading(false);
    });
  }, []);

  const updateProfile = async (p: UserProfile) => {
    await saveProfile(p);
    setProfileState(p);
  };

  return (
    <ProfileContext.Provider
      value={{ profile, isLoading, setProfile: updateProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
