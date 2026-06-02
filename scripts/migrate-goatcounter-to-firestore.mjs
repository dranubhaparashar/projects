import "dotenv/config";
import admin from "firebase-admin";

const {
	GOATCOUNTER_SITE_CODE,
	GOATCOUNTER_API_TOKEN,
	FIREBASE_SERVICE_ACCOUNT_JSON,
} = process.env;

if (!GOATCOUNTER_SITE_CODE) {
	throw new Error("GOATCOUNTER_SITE_CODE is required.");
}

if (!GOATCOUNTER_API_TOKEN) {
	throw new Error("GOATCOUNTER_API_TOKEN is required.");
}

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

function normalizePath(path) {
	const clean = String(path || "").split("?")[0];
	if (!clean.startsWith("/")) return `/${clean}`;
	return clean;
}

function postIdFromPath(path) {
	const lastSegment = normalizePath(path).replace(/^\/+|\/+$/g, "").split("/").filter(Boolean).at(-1);
	if (!lastSegment) return "";

	return lastSegment
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function isProjectPostPath(path) {
	return normalizePath(path).includes("/posts/");
}

async function goatcounterGet(pathname, searchParams = {}) {
	const url = new URL(`https://${GOATCOUNTER_SITE_CODE}.goatcounter.com${pathname}`);
	for (const [key, value] of Object.entries(searchParams)) {
		if (Array.isArray(value)) {
			for (const item of value) url.searchParams.append(key, item);
		} else if (value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, String(value));
		}
	}

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${GOATCOUNTER_API_TOKEN}`,
			Accept: "application/json",
		},
	});

	if (!res.ok) {
		throw new Error(`GoatCounter request failed: ${res.status} ${res.statusText} ${await res.text()}`);
	}

	return res.json();
}

async function fetchAllGoatCounterHits() {
	const hits = [];
	const excludedPathIds = [];
	const start = "2000-01-01T00:00:00Z";
	const end = new Date().toISOString();

	for (;;) {
		const data = await goatcounterGet("/api/v0/stats/hits", {
			start,
			end,
			limit: 100,
			exclude_paths: excludedPathIds,
		});

		const pageHits = Array.isArray(data.hits) ? data.hits : [];
		hits.push(...pageHits);

		for (const hit of pageHits) {
			if (hit.path_id !== undefined && hit.path_id !== null) {
				excludedPathIds.push(String(hit.path_id));
			}
		}

		if (!data.more || pageHits.length === 0) break;
	}

	return hits;
}

initializeFirebaseAdmin();
const db = admin.firestore();
const hits = await fetchAllGoatCounterHits();

let migrated = 0;
let skipped = 0;

for (const hit of hits) {
	const path = normalizePath(hit.path);
	if (!isProjectPostPath(path)) {
		skipped += 1;
		continue;
	}

	const postId = postIdFromPath(path);
	const baseViews = Number(hit.count || 0);

	if (!postId || !Number.isFinite(baseViews)) {
		skipped += 1;
		continue;
	}

	await db.collection("projectPosts").doc(postId).set(
		{
			baseViews,
		},
		{ merge: true },
	);

	migrated += 1;
	console.log(`Migrated ${baseViews} baseViews for ${postId} (${path})`);
}

console.log(`Done. Migrated ${migrated} project posts. Skipped ${skipped} non-project paths.`);
