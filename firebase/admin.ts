import { initializeApp, getApps } from "firebase-admin/app";

const app = getApps().length === 0 ? initializeApp() : getApps()[0];

export default app;
