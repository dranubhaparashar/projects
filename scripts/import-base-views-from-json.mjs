import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import admin from "firebase-admin";

const { FIREBASE_SERVICE_ACCOUNT_JSON } = process.env;

function initializeFirebaseAdmin() {
	if (admin.apps.length > 0) return;

	if (FIREBASE_SERVICE_ACCOUNT_JSON) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)),
		});
		return;
	}

	admin.initializeApp({
		credential: admin.credential.applicationDefault(),
	});
}

function postIdFromPath(pathValue) {
	const lastSegment = String(pathValue || "")
		.split("?")[0]
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean)
		.at(-1);

	if (!lastSegment) return "";

	return lastSegment
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

initializeFirebaseAdmin();
const db = admin.firestore();
const inputPath = path.join(process.cwd(), "scripts", "base-views.json");
const raw = await fs.readFile(inputPath, "utf8");
const baseViewsByPath = JSON.parse(raw);

let imported = 0;

for (const [postPath, count] of Object.entries(baseViewsByPath)) {
	const postId = postIdFromPath(postPath);
	const baseViews = Number(count);

	if (!postId || !Number.isFinite(baseViews)) {
		console.warn(`Skipping invalid entry: ${postPath}`);
		continue;
	}

	await db.collection("projectPosts").doc(postId).set(
		{
			baseViews,
		},
		{ merge: true },
	);

	imported += 1;
	console.log(`Imported ${baseViews} baseViews for ${postId}`);
}

console.log(`Done. Imported ${imported} base view counts.`);
