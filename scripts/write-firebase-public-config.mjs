const requiredVariables = [
	"PUBLIC_FIREBASE_API_KEY",
	"PUBLIC_FIREBASE_AUTH_DOMAIN",
	"PUBLIC_FIREBASE_PROJECT_ID",
	"PUBLIC_FIREBASE_STORAGE_BUCKET",
	"PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
	"PUBLIC_FIREBASE_APP_ID",
];

const config = {
	apiKey: process.env.PUBLIC_FIREBASE_API_KEY || "",
	authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "",
	projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || "",
	storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "",
	messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
	appId: process.env.PUBLIC_FIREBASE_APP_ID || "",
};

const missing = requiredVariables.filter((name) => !process.env[name]?.trim());
const output = `window.DRANUBHA_FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\nwindow.DRANUBHA_FIREBASE_CONFIG_MISSING = ${JSON.stringify(missing)};\n`;

await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
	await mkdir("public/assets/js", { recursive: true });
	await writeFile("public/assets/js/firebase-config.js", output, "utf8");
});

if (missing.length > 0) {
	console.warn(`Firebase public config incomplete for admin page: ${missing.join(", ")}`);
} else {
	console.log("Firebase public config written for admin page.");
}