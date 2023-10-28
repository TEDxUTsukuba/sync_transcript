import firebaseApp from "./config";
import { getStorage } from "firebase/storage";

const storage = getStorage(firebaseApp);

export default storage;
