import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
	authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

function hasFirebaseConfig(config: typeof firebaseConfig): boolean {
	return Object.values(config).every((value) => typeof value === "string" && value.trim() !== "");
}

export const app: FirebaseApp | null = hasFirebaseConfig(firebaseConfig)
	? getApps().length > 0
		? getApp()
		: initializeApp(firebaseConfig)
	: null;

export const db: Firestore | null = app ? getFirestore(app) : null;
