const requiredVariables = [
	"PUBLIC_FIREBASE_API_KEY",
	"PUBLIC_FIREBASE_AUTH_DOMAIN",
	"PUBLIC_FIREBASE_PROJECT_ID",
	"PUBLIC_FIREBASE_STORAGE_BUCKET",
	"PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
	"PUBLIC_FIREBASE_APP_ID",
];

const missing = requiredVariables.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
	console.error(
		[
			"Firebase public config is missing.",
			"Set these GitHub repository variables before deploying:",
			...missing.map((name) => `- ${name}`),
		].join("\n"),
	);
	process.exit(1);
}

console.log("Firebase public config is present.");
