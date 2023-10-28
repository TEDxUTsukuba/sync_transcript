"use client";

import firebaseApp from "./config";
import {
  signInWithPopup,
  GoogleAuthProvider,
  getAuth,
  OAuthProvider,
  signInWithRedirect,
} from "firebase/auth";

const auth = getAuth(firebaseApp);

export const loginAsGoogle = () => {
  signInWithPopup(auth, new GoogleAuthProvider());
};

export const yataiProvider = new OAuthProvider("oidc.yatai");

export const loginAsYatai = () => {
  signInWithRedirect(auth, yataiProvider);
};

export const logout = () => {
  auth.signOut();
};
