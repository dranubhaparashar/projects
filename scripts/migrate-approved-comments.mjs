import "dotenv/config";
import admin from "firebase-admin";

const {
	FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_PROJECT_ID,
	FIREBASE_SERVICE_ACCOUNT,
	FIREBASE_SERVICE_ACCOUNT_JSON,
	GOOGLE_APPLICATION_CREDENTIALS,
} = process.env;

const firebaseProjectId = FIREBASE_PROJECT_ID || PUBLIC_FIREBASE_PROJECT_ID;

function initializeFirebaseAdmin() {
	if (admin.apps.length > 0) return;

	const serviceAccountJson = FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT;
	if (serviceAccountJson) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
			projectId: firebaseProjectId,
		});
		return;
	}

	if (GOOGLE_APPLICATION_CREDENTIALS || firebaseProjectId) {
		admin.initializeApp({
			credential: admin.credential.applicationDefault(),
			projectId: firebaseProjectId,
		});
		return;
	}

	admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
function normalizeApprovedComment(data, postId, commentId) {
	const name = data.authorName || data.name || "Anonymous";
	const text = data.body || data.message || data.text || "";

	return {
		...data,
		id: data.id || commentId,
		postSlug: data.postSlug || postId,
		status: "approved",
		name,
		authorName: data.authorName || name,
		text,
		message: data.message || text,
		body: data.body || text,
		approvedAt: data.approvedAt || admin.firestore.FieldValue.serverTimestamp(),
		updatedAt: admin.firestore.FieldValue.serverTimestamp(),
	};
}

async function main() {
	initializeFirebaseAdmin();
	const db = admin.firestore();
	const postRefs = await db.collection("postComments").listDocuments();

	let postsScanned = 0;
	let commentsScanned = 0;
	let commentsCopied = 0;
	let commentsSkipped = 0;

	for (const postRef of postRefs) {
		postsScanned += 1;
		const postId = postRef.id;
		const commentsSnapshot = await postRef.collection("comments").get();

		for (const commentDoc of commentsSnapshot.docs) {
			commentsScanned += 1;
			const targetRef = db
				.collection("approvedComments")
				.doc(postId)
				.collection("comments")
				.doc(commentDoc.id);
			const targetSnapshot = await targetRef.get();

			if (targetSnapshot.exists) {
				commentsSkipped += 1;
				continue;
			}

			await targetRef.set(normalizeApprovedComment(commentDoc.data(), postId, commentDoc.id));
			commentsCopied += 1;
		}
	}

	console.log(`Posts scanned: ${postsScanned}`);
	console.log(`Comments scanned: ${commentsScanned}`);
	console.log(`Comments copied to approvedComments: ${commentsCopied}`);
	console.log(`Comments skipped because already approved: ${commentsSkipped}`);
}

await main();