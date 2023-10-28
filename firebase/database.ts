import firebaseApp from "./config";
import { getFirestore } from "firebase/firestore";

export const db = getFirestore(firebaseApp);
