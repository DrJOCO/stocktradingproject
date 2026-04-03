const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];

export const firebaseEnabled = requiredKeys.every((key) => Boolean(firebaseConfig[key]));
export const firebaseConfigError = firebaseEnabled
  ? null
  : "Firebase is not configured yet. Add the VITE_FIREBASE_* variables locally and in Vercel to enable account sync.";

let firebaseRuntimePromise = null;

function shouldFallbackToRedirect(error) {
  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].includes(error?.code);
}

export function formatFirebaseError(error) {
  if (!error) return "Unknown Firebase error.";
  if (error.code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase Auth yet. Add your local and Vercel domains in Firebase Authentication settings.";
  }
  if (error.code === "auth/popup-blocked") {
    return "Popup blocked. The sign-in flow will retry with a full-page redirect.";
  }
  return error.message || "Firebase request failed.";
}

export async function getFirebaseRuntime() {
  if (!firebaseEnabled) {
    throw new Error(firebaseConfigError || "Firebase is unavailable.");
  }

  if (!firebaseRuntimePromise) {
    firebaseRuntimePromise = Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]).then(([appMod, authMod, firestoreMod]) => {
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      auth.useDeviceLanguage();

      const googleProvider = new authMod.GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: "select_account" });

      return {
        app,
        auth,
        db: firestoreMod.getFirestore(app),
        authMod,
        firestoreMod,
        googleProvider,
      };
    }).catch((error) => {
      firebaseRuntimePromise = null;
      throw error;
    });
  }

  return firebaseRuntimePromise;
}

export async function getFirestoreRuntime() {
  const { db, firestoreMod } = await getFirebaseRuntime();
  return { db, firestoreMod };
}

export async function signInWithGoogle() {
  const { auth, authMod, googleProvider } = await getFirebaseRuntime();

  try {
    return await authMod.signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      await authMod.signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

export async function consumeRedirectResult() {
  const { auth, authMod } = await getFirebaseRuntime();
  return authMod.getRedirectResult(auth);
}

export async function subscribeToAuth(callback) {
  const { auth, authMod } = await getFirebaseRuntime();
  return authMod.onAuthStateChanged(auth, callback);
}

export async function signOutUser() {
  const { auth, authMod } = await getFirebaseRuntime();
  await authMod.signOut(auth);
}
