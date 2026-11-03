import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  clearAuthUnavailable,
  describeForLogs,
  isCapabilityError,
  noteAuthUnavailable,
  type AuthMethod
} from '../lib/authErrors';
import { FirestoreService } from '../services/firestoreService';

interface AuthContextType {
  user: User | null; // Compatibility
  currentUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  

  logout: () => Promise<void>;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  
  // New actions
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  currentUser: null,
  loading: true, 
  isAuthenticated: false,
  isEmailVerified: false,

  logout: async () => {},
  showLoginModal: false,
  setShowLoginModal: () => {},
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  resendVerificationEmail: async () => {}
});

export const useAuth = () => useContext(AuthContext);

/**
 * One place decides what a failed sign-in means for the rest of the session:
 * a capability code (the deployment has not opened that path) is remembered so the
 * screen can say so plainly, and a success clears that memory again. The original
 * error is rethrown untouched for the caller to translate — only the SDK code is
 * logged, never the address or password that was typed.
 */
async function attempt<T>(method: AuthMethod, action: () => Promise<T>): Promise<T> {
  try {
    const result = await action();
    clearAuthUnavailable(method);
    return result;
  } catch (error) {
    if (isCapabilityError(error)) noteAuthUnavailable(method, error);
    console.warn('Insaaf AI sign-in:', describeForLogs(error));
    throw error;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    // Clean up legacy localStorage key from earlier auth implementation
    if (localStorage.getItem('insaaf_user')) {
      localStorage.removeItem('insaaf_user');
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        FirestoreService.createOrUpdateUser(user.uid, {
          displayName: user.displayName || 'Citizen User',
          email: user.email,
          photoURL: user.photoURL,
          provider: user.providerData[0]?.providerId || 'email',
          emailVerified: user.emailVerified
        }).catch(console.error);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);



  const signUp = async (email: string, password: string, name: string) => {
    await attempt('password', async () => {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, {
        displayName: name
      });
      await sendEmailVerification(userCredential.user);
      // Force refresh the user object to get the updated profile
      await userCredential.user.reload();
      const updatedUser = auth.currentUser;
      setCurrentUser(updatedUser);
      if (updatedUser) {
        await FirestoreService.createOrUpdateUser(updatedUser.uid, {
          displayName: name,
          email: updatedUser.email,
          photoURL: updatedUser.photoURL,
          provider: 'password',
          emailVerified: updatedUser.emailVerified
        });
      }
    });
  };

  const signIn = async (email: string, password: string) => {
    await attempt('password', async () => {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await FirestoreService.createOrUpdateUser(userCredential.user.uid, {
          displayName: userCredential.user.displayName,
          email: userCredential.user.email,
          photoURL: userCredential.user.photoURL,
          provider: 'password',
          emailVerified: userCredential.user.emailVerified
        });
      }
    });
  };

  const signInWithGoogle = async () => {
    await attempt('google', async () => {
      const userCredential = await signInWithPopup(auth, googleProvider);
      if (userCredential.user) {
        await FirestoreService.createOrUpdateUser(userCredential.user.uid, {
          displayName: userCredential.user.displayName,
          email: userCredential.user.email,
          photoURL: userCredential.user.photoURL,
          provider: 'google.com',
          emailVerified: userCredential.user.emailVerified
        });
      }
    });
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const resetPassword = async (email: string) => {
    await attempt('password', () => sendPasswordResetEmail(auth, email));
  };

  const resendVerificationEmail = async () => {
    if (currentUser && !currentUser.emailVerified) {
      await sendEmailVerification(currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user: currentUser, // compatibility
      currentUser,
      loading, 
      isAuthenticated: !!currentUser,
      isEmailVerified: currentUser?.emailVerified ?? false,

      logout: signOut, // compatibility
      showLoginModal, 
      setShowLoginModal,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      resendVerificationEmail
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
