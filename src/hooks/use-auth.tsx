
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
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, limit, writeBatch } from "firebase/firestore";
import { useRouter } from 'next/navigation';

export type AppUser = User & {
  role: string;
  firstName: string;
  lastName: string;
  position: string;
  entity: string;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: typeof signInWithEmailAndPassword;
  signOut: () => Promise<void>;
  updateUserProfile?: (data: { displayName: string; firstName: string; lastName: string }) => Promise<void>;
  updateUserPassword?: (oldPass: string, newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- START: Data for seeding ---
const zonesDeTravailData = ["Laminoir", "Aciérie", "Atelier mécanique", "Magasin", "Logistique", "Maintenance", "Bureaux"];
const postesDeTravailData = ["Conducteur de train de laminoir", "Pontier cabine", "Opérateur de grue", "Technicien maintenance", "Cariste", "Soudeur", "Magasinier"];
const activitesObserveesData = ["Manutention de charges lourdes", "Opération de soudure", "Travail en hauteur", "Conduite de pont roulant", "Entretien mécanique", "Opération de nettoyage industriel"];
const famillesDeRisqueData = ["Chute de plain-pied", "Risque chimique", "Risque électrique", "Manutention manuelle", "Risque routier", "Bruit", "Travaux en hauteur"];
// --- END: Data for seeding ---


// Function to seed initial data if collections are empty
const seedInitialData = async () => {
    // This flag in localStorage prevents re-seeding on every login
    if (localStorage.getItem('db_seeded_v2')) {
        return;
    }

    const checkAndSeed = async (collectionName: string, data: string[]) => {
        const collectionRef = collection(db, collectionName);
        const q = query(collectionRef, limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            const batch = writeBatch(db);
            data.forEach(name => {
                const docRef = doc(collectionRef); // Auto-generate ID
                batch.set(docRef, { nom: name, actif: true });
            });
            await batch.commit();
        }
    };

    try {
        await Promise.all([
            checkAndSeed('zonesDeTravail', zonesDeTravailData),
            checkAndSeed('postesDeTravail', postesDeTravailData),
            checkAndSeed('activitesObservees', activitesObserveesData),
            checkAndSeed('famillesDeRisque', famillesDeRisqueData),
        ]);
        
        localStorage.setItem('db_seeded_v2', 'true');
    } catch (error) {
        console.error("Error during database seeding:", error);
    }
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // Seed database on first login of a session if needed
        await seedInitialData();

        const userDocRef = doc(db, 'users', authUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let appUserData: Omit<AppUser, keyof User> = {
            role: 'niveau1',
            firstName: '',
            lastName: '',
            position: '',
            entity: '',
            displayName: authUser.displayName || authUser.email || '',
        };

        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            appUserData = {
                role: data.role || 'niveau1',
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                displayName: data.displayName || appUserData.displayName,
                position: data.position || '',
                entity: data.entity || '',
            }
        } else {
          // If user doc doesn't exist, create it for them with default role
          try {
              await setDoc(userDocRef, {
                  email: authUser.email,
                  displayName: authUser.displayName || authUser.email,
                  firstName: '',
                  lastName: '',
                  position: '',
                  entity: '',
                  role: 'niveau1',
                  createdAt: serverTimestamp(),
              });
          } catch (e) {
              console.error("Error creating user document", e);
          }
        }
        setUser({ ...authUser, ...appUserData });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserProfile = async (data: { displayName: string; firstName: string; lastName: string }) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: data.displayName });
      // Update the user document in Firestore as well
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { 
          displayName: data.displayName,
          firstName: data.firstName,
          lastName: data.lastName,
       }, { merge: true });
      // Create a new object from auth.currentUser to force a state update.
      setUser(prevUser => {
        if (!prevUser) return null;
        return {
            ...prevUser,
            displayName: data.displayName,
            firstName: data.firstName,
            lastName: data.lastName,
        };
      });
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
