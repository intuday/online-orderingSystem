// src/contexts/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { ConfirmationResult } from "firebase/auth";

// ✅ Sirf Auth imports - db, doc, getDoc kuch nahi
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  type User,
  type UserProfile,
} from "@/lib/firebase";

interface AuthContextType {
  user:             User | null;
  profile:          UserProfile | null;
  loading:          boolean;
  error:            string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithPhone:  (phone: string, containerId: string) => Promise<ConfirmationResult>;
  verifyOtp:        (confirmation: ConfirmationResult, otp: string) => Promise<void>;
  logout:           () => Promise<void>;
  clearError:       () => void;
}

const AuthContext = createContext<AuthContextType>({
  user:             null,
  profile:          null,
  loading:          true,
  error:            null,
  signInWithGoogle: async () => {},
  signInWithPhone:  async () => { throw new Error("Not initialized"); },
  verifyOtp:        async () => {},
  logout:           async () => {},
  clearError:       () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const isMounted    = useRef(true);

  // ✅ API route se profile sync - direct Firestore nahi
  const syncProfile = useCallback(async (firebaseUser: User) => {
    try {
      const token = await firebaseUser.getIdToken();

      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL:    firebaseUser.photoURL,
          phone:       firebaseUser.phoneNumber,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (isMounted.current) setProfile(data.profile);
      }
    } catch (err) {
      console.error("Profile sync error:", err);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    isMounted.current = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted.current) return;
      setUser(firebaseUser);

      if (firebaseUser) {
        await syncProfile(firebaseUser);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted.current = false;
      unsub();
    };
  }, [syncProfile]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign in failed";
      if (isMounted.current) setError(msg);
      throw err;
    }
  }, []);

  const signInWithPhone = useCallback(
    async (phone: string, containerId: string): Promise<ConfirmationResult> => {
      setError(null);
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
      try {
        recaptchaRef.current = new RecaptchaVerifier(auth, containerId, {
          size: "invisible",
        });
        return await signInWithPhoneNumber(auth, phone, recaptchaRef.current);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Phone sign in failed";
        if (isMounted.current) setError(msg);
        recaptchaRef.current?.clear();
        recaptchaRef.current = null;
        throw err;
      }
    }, []
  );

  const verifyOtp = useCallback(
    async (confirmation: ConfirmationResult, otp: string) => {
      setError(null);
      try {
        await confirmation.confirm(otp);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "OTP verification failed";
        if (isMounted.current) setError(msg);
        throw err;
      }
    }, []
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut(auth);
      if (isMounted.current) {
        setUser(null);
        setProfile(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Logout failed";
      if (isMounted.current) setError(msg);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user, profile, loading, error,
      signInWithGoogle, signInWithPhone,
      verifyOtp, logout, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);