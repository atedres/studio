
"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as firebaseUpdatePassword,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from 'next/navigation';

export type AppUser = User & {
  role: string;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: typeof signInWithEmailAndPassword;
  signOut: () => Promise<void>;
  updateUserProfile?: (data: { displayName: string }) => Promise<void>;
  updateUserPassword?: (oldPass: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        let role = 'niveau1'; // Default role
        if (userDocSnap.exists()) {
          role = userDocSnap.data().role || 'niveau1';
        } else {
          // If user doc doesn't exist, create it for them with default role
          try {
              await setDoc(userDocRef, {
                  email: authUser.email,
                  displayName: authUser.displayName || authUser.email,
                  role: 'niveau1',
                  createdAt: serverTimestamp(),
              });
          } catch (e) {
              console.error("Error creating user document", e);
          }
        }
        setUser({ ...authUser, role });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = async (data: { displayName: string }) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, data);
      // Update the user document in Firestore as well
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { displayName: data.displayName }, { merge: true });
      // Create a new object from auth.currentUser to force a state update.
      setUser(prevUser => prevUser ? { ...prevUser, ...auth.currentUser, displayName: data.displayName } as AppUser : null);
    } else {
      throw new Error("User not authenticated");
    }
  };

  const updateUserPassword = async (oldPass: string, newPass: string) => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email) {
        const credential = EmailAuthProvider.credential(currentUser.email, oldPass);
        await reauthenticateWithCredential(currentUser, credential);
        await firebaseUpdatePassword(currentUser, newPass);
    } else {
        throw new Error("User not authenticated or email not available.");
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    router.push('/');
  };

  const value = {
    user,
    loading,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signOut,
    updateUserProfile,
    updateUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
