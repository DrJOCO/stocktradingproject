/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  consumeRedirectResult,
  firebaseConfigError,
  firebaseEnabled,
  formatFirebaseError,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
} from "../lib/firebase.js";
import { attachCloudSync, detachCloudSync } from "../utils/storage.js";

const AuthContext = createContext({
  user: null,
  loading: false,
  enabled: false,
  syncState: "LOCAL ONLY",
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  dismissError: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [syncState, setSyncState] = useState(firebaseEnabled ? "CONNECTING" : "LOCAL ONLY");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseEnabled) {
      setLoading(false);
      setError(null);
      setSyncState("LOCAL ONLY");
      return () => {};
    }

    let active = true;
    let unsubscribe = () => {};

    (async () => {
      try {
        await consumeRedirectResult();
      } catch (authError) {
        if (active) setError(formatFirebaseError(authError));
      }

      try {
        unsubscribe = await subscribeToAuth(async (nextUser) => {
          if (!active) return;

          setUser(nextUser);

          if (!nextUser) {
            detachCloudSync();
            setSyncState("LOCAL ONLY");
            setLoading(false);
            return;
          }

          setSyncState("SYNCING");
          try {
            const result = await attachCloudSync(nextUser);
            if (!active) return;

            if (result.source === "cloud") setSyncState("SYNCED");
            else if (result.source === "local") setSyncState("UPLOADED");
            else setSyncState("READY");
          } catch (syncError) {
            if (active) {
              setError(formatFirebaseError(syncError));
              setSyncState("LOCAL ONLY");
            }
          } finally {
            if (active) setLoading(false);
          }
        });
      } catch (authError) {
        if (active) {
          setError(formatFirebaseError(authError));
          setSyncState("LOCAL ONLY");
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      unsubscribe();
      detachCloudSync();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    enabled: firebaseEnabled,
    syncState,
    error,
    dismissError: () => setError(null),
    signIn: async () => {
      if (!firebaseEnabled) {
        setError(firebaseConfigError);
        return;
      }

      setError(null);
      setSyncState("AUTH");
      try {
        await signInWithGoogle();
      } catch (authError) {
        setError(formatFirebaseError(authError));
        setSyncState(user ? "SYNCED" : "LOCAL ONLY");
      }
    },
    signOut: async () => {
      try {
        await signOutUser();
        setSyncState("LOCAL ONLY");
      } catch (authError) {
        setError(formatFirebaseError(authError));
      }
    },
  }), [error, loading, syncState, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
