import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
	GoogleAuthProvider,
	getAuth,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	increment,
	serverTimestamp,
	writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_EMAIL = "anubhaparashar1025@gmail.com";
const PAGE_SIZE = 50;
const KNOWN_POST_SLUGS = [
	"aegisflow-devsecops-pipeline-orchestrator-agent",
	"ashu-mentor-ai-studio",
	"dacr-q",
	"end-to-end-yolo-key-detection-system-training-api-deployment-and-azure-container-apps",
	"execution-aware-agentic-vrp",
	"lightdid-zkp--a-policy-and-resource-aware-framework-for-selecting-bbs-and-anoncreds-verifiable-presentations-in-decentralized-identity",
	"lightdid-zkp-a-policy-and-resource-aware-framework-for-selecting-bbs-and-anoncreds-verifiable-presentations-in-decentralized-identity",
	"llm-agents",
	"my-first-post",
	"pole-detection",
	"predictive-preventive-maintenance-generator",
	"vehicle-scale-llms",
];

const firebaseConfig = window.DRANUBHA_FIREBASE_CONFIG || {};
const missingConfig = window.DRANUBHA_FIREBASE_CONFIG_MISSING || [];

const state = {
	db: null,
	auth: null,
	isLoading: false,
	visibleCount: PAGE_SIZE,
	queueDocs: [],
	pending: new Map(),
	selected: new Set(),
};

const elements = {
	configError: document.getElementById("config-error"),
	loginView: document.getElementById("login-view"),
	deniedView: document.getElementById("denied-view"),
	dashboardView: document.getElementById("dashboard-view"),
	loginButton: document.getElementById("login-button"),
	deniedLogoutButton: document.getElementById("denied-logout-button"),
	logoutButton: document.getElementById("logout-button"),
	deniedEmail: document.getElementById("denied-email"),
	adminEmail: document.getElementById("admin-email"),
	pendingCount: document.getElementById("pending-count"),
	selectedCount: document.getElementById("selected-count"),
	approveSelectedButton: document.getElementById("approve-selected-button"),
	rejectSelectedButton: document.getElementById("reject-selected-button"),
	repairQueueButton: document.getElementById("repair-queue-button"),
	statusMessage: document.getElementById("status-message"),
	commentsList: document.getElementById("comments-list"),
	emptyState: document.getElementById("empty-state"),
	loadMoreButton: document.getElementById("load-more-button"),
};

function showOnly(view) {
	for (const key of ["configError", "loginView", "deniedView", "dashboardView"]) {
		elements[key].classList.toggle("hidden", key !== view);
	}
}

function setStatus(message, tone = "") {
	elements.statusMessage.textContent = message || "";
	elements.statusMessage.dataset.tone = tone;
}

function setLoading(isLoading) {
	state.isLoading = isLoading;
	elements.loadMoreButton.disabled = isLoading;
	elements.repairQueueButton.disabled = isLoading;
	elements.loadMoreButton.textContent = isLoading ? "Loading..." : "Load More";
}

function getCommentText(data) {
	return data.body || data.message || data.text || "";
}

function getAuthorName(data) {
	return data.authorName || data.name || "Anonymous";
}

function getPostSlug(data, docRef) {
	return data.postSlug || docRef.parent.parent?.id || "";
}

function getQueueId(postSlug, commentId) {
	return `${postSlug}__${commentId}`;
}

function timestampToMillis(value) {
	if (!value) return 0;
	if (typeof value.toMillis === "function") return value.toMillis();
	if (value.seconds) return value.seconds * 1000;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value) {
	if (!value) return "Unknown";
	const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat("en", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function escapeHtml(value) {
	return String(value || "").replace(/[&<>"']/g, (char) => {
		const entities = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		};
		return entities[char] || char;
	});
}

function updateCounts() {
	elements.pendingCount.textContent = String(state.queueDocs.length);
	elements.selectedCount.textContent = String(state.selected.size);
	elements.approveSelectedButton.disabled = state.selected.size === 0;
	elements.rejectSelectedButton.disabled = state.selected.size === 0;
	elements.emptyState.classList.toggle("hidden", state.queueDocs.length > 0 || state.isLoading);
}

function clearRenderedComments() {
	state.pending.clear();
	state.selected.clear();
	elements.commentsList.innerHTML = "";
}

function removeCard(key) {
	const item = state.pending.get(key);
	if (!item) return;
	item.element.remove();
	state.pending.delete(key);
	state.selected.delete(key);
	state.queueDocs = state.queueDocs.filter((docSnap) => docSnap.ref.path !== key);
	updateCounts();
}

function setCardBusy(key, isBusy) {
	const item = state.pending.get(key);
	if (!item) return;
	item.element.classList.toggle("is-busy", isBusy);
	item.element.querySelectorAll("button,input").forEach((control) => {
		control.disabled = isBusy;
	});
}

function renderComment(docSnap) {
	const data = docSnap.data();
	if (data.status !== "pending") return;
	const postSlug = getPostSlug(data, docSnap.ref);
	const commentId = data.commentId || data.id;
	if (!postSlug || !commentId) return;

	const key = docSnap.ref.path;
	if (state.pending.has(key)) return;

	const article = document.createElement("article");
	article.className = "comment-card";
	article.dataset.docPath = key;
	article.innerHTML = `
		<div class="comment-card-header">
			<div class="comment-title-group">
				<input type="checkbox" aria-label="Select comment" data-select-comment />
				<div>
					<div class="comment-author">${escapeHtml(getAuthorName(data))}</div>
					<div class="muted">${escapeHtml(formatDate(data.createdAt || data.updatedAt))}</div>
				</div>
			</div>
			<div class="comment-card-actions">
				<button type="button" class="button button-approve" data-approve>Approve</button>
				<button type="button" class="button button-reject" data-reject>Reject</button>
			</div>
		</div>
		<p class="comment-body">${escapeHtml(getCommentText(data))}</p>
		<div class="comment-meta">
			<div class="meta-item"><span class="meta-label">Post slug</span><span class="meta-value">${escapeHtml(postSlug)}</span></div>
			<div class="meta-item"><span class="meta-label">Comment ID</span><span class="meta-value">${escapeHtml(commentId)}</span></div>
			<div class="meta-item"><span class="meta-label">Source</span><span class="meta-value">${escapeHtml(data.source || "firebase")}</span></div>
			<div class="meta-item"><span class="meta-label">Queue path</span><span class="meta-value">${escapeHtml(docSnap.ref.path)}</span></div>
			<div class="meta-item"><span class="meta-label">Pending path</span><span class="meta-value">${escapeHtml(data.pendingPath || `pendingComments/${postSlug}/comments/${commentId}`)}</span></div>
		</div>
	`;

	article.querySelector("[data-select-comment]").addEventListener("change", (event) => {
		if (event.currentTarget.checked) state.selected.add(key);
		else state.selected.delete(key);
		updateCounts();
	});
	article.querySelector("[data-approve]").addEventListener("click", () => approveOne(key));
	article.querySelector("[data-reject]").addEventListener("click", () => rejectOne(key));

	state.pending.set(key, { docSnap, element: article });
	elements.commentsList.append(article);
	updateCounts();
}

function sortPendingDocs(docs) {
	return docs
		.filter((docSnap) => docSnap.data().status === "pending")
		.sort((a, b) => {
			const aData = a.data();
			const bData = b.data();
			const aTime = timestampToMillis(aData.createdAt || aData.updatedAt);
			const bTime = timestampToMillis(bData.createdAt || bData.updatedAt);
			return bTime - aTime;
		});
}

function renderVisibleQueueDocs() {
	clearRenderedComments();
	state.queueDocs.slice(0, state.visibleCount).forEach(renderComment);
	elements.loadMoreButton.classList.toggle("hidden", state.visibleCount >= state.queueDocs.length);
	updateCounts();
}

async function loadPendingComments({ reset = false } = {}) {
	if (state.isLoading) return;
	setLoading(true);
	setStatus("");

	try {
		if (reset) state.visibleCount = PAGE_SIZE;
		const snapshot = await getDocs(collection(state.db, "pendingCommentQueue"));
		state.queueDocs = sortPendingDocs(snapshot.docs);
		renderVisibleQueueDocs();
	} catch (error) {
		console.error("Failed to load pending comment queue", error);
		if (error?.code === "permission-denied") {
			setStatus("Permission denied. Check Firebase login and Firestore rules.", "error");
		} else {
			setStatus(error?.message || "Could not load pending comments. Check console for details.", "error");
		}
	} finally {
		setLoading(false);
	}
}

function commentPayloadFromQueue(data, fallback, postSlug, commentId) {
	return {
		...fallback,
		...data,
		id: data.id || fallback.id || commentId,
		commentId: data.commentId || fallback.commentId || commentId,
		postSlug,
	};
}

async function approveComment(item) {
	const queueSnap = await getDoc(item.docSnap.ref);
	if (!queueSnap.exists()) throw new Error("Pending queue item no longer exists.");

	const queueData = queueSnap.data();
	const postSlug = queueData.postSlug;
	const commentId = queueData.commentId || queueData.id;
	if (!postSlug || !commentId) throw new Error("Missing postSlug or commentId.");

	const pendingRef = doc(state.db, "pendingComments", postSlug, "comments", commentId);
	const pendingSnap = await getDoc(pendingRef);
	const pendingData = pendingSnap.exists() ? pendingSnap.data() : {};
	const targetRef = doc(state.db, "postComments", postSlug, "comments", commentId);
	const statsRef = doc(state.db, "postStats", postSlug);
	const batch = writeBatch(state.db);

	batch.set(targetRef, {
		...commentPayloadFromQueue(queueData, pendingData, postSlug, commentId),
		status: "approved",
		approved: true,
		approvedAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	batch.delete(pendingRef);
	batch.delete(queueSnap.ref);
	batch.set(statsRef, {
		comments: increment(1),
		updatedAt: serverTimestamp(),
	}, { merge: true });
	await batch.commit();
}

async function rejectComment(item) {
	const queueSnap = await getDoc(item.docSnap.ref);
	if (!queueSnap.exists()) return;

	const data = queueSnap.data();
	const postSlug = data.postSlug;
	const commentId = data.commentId || data.id;
	if (!postSlug || !commentId) throw new Error("Missing postSlug or commentId.");

	const batch = writeBatch(state.db);
	batch.delete(doc(state.db, "pendingComments", postSlug, "comments", commentId));
	batch.delete(queueSnap.ref);
	await batch.commit();
}

async function approveOne(key) {
	const item = state.pending.get(key);
	if (!item) return;
	setCardBusy(key, true);
	setStatus("");
	try {
		await approveComment(item);
		removeCard(key);
		setStatus("Comment approved.", "success");
	} catch (error) {
		console.error("Approve failed", error);
		setCardBusy(key, false);
		setStatus("Could not approve comment. Check console for details.", "error");
	}
}

async function rejectOne(key) {
	const item = state.pending.get(key);
	if (!item) return;
	if (!confirm("Reject this pending comment?")) return;
	setCardBusy(key, true);
	setStatus("");
	try {
		await rejectComment(item);
		removeCard(key);
		setStatus("Comment rejected.", "success");
	} catch (error) {
		console.error("Reject failed", error);
		setCardBusy(key, false);
		setStatus("Could not reject comment. Check console for details.", "error");
	}
}

async function approveSelected() {
	const keys = [...state.selected];
	if (keys.length === 0) return;
	let success = 0;
	let failed = 0;
	for (const key of keys) {
		const item = state.pending.get(key);
		if (!item) continue;
		setCardBusy(key, true);
		try {
			await approveComment(item);
			removeCard(key);
			success += 1;
		} catch (error) {
			console.error("Bulk approve failed", error);
			setCardBusy(key, false);
			failed += 1;
		}
	}
	setStatus(`Bulk approve complete: ${success} approved, ${failed} failed.`, failed ? "error" : "success");
}

async function rejectSelected() {
	const keys = [...state.selected];
	if (keys.length === 0) return;
	if (!confirm(`Reject ${keys.length} selected pending comment(s)?`)) return;
	let success = 0;
	let failed = 0;
	for (const key of keys) {
		const item = state.pending.get(key);
		if (!item) continue;
		setCardBusy(key, true);
		try {
			await rejectComment(item);
			removeCard(key);
			success += 1;
		} catch (error) {
			console.error("Bulk reject failed", error);
			setCardBusy(key, false);
			failed += 1;
		}
	}
	setStatus(`Bulk reject complete: ${success} rejected, ${failed} failed.`, failed ? "error" : "success");
}

async function repairPendingQueue() {
	if (state.isLoading) return;
	setLoading(true);
	setStatus("Repairing pending queue...");
	let repaired = 0;
	let scanned = 0;

	try {
		for (const postSlug of KNOWN_POST_SLUGS) {
			const commentsRef = collection(state.db, "pendingComments", postSlug, "comments");
			const snapshot = await getDocs(commentsRef);
			if (snapshot.empty) continue;

			const batch = writeBatch(state.db);
			let batchWrites = 0;
			snapshot.docs.forEach((docSnap) => {
				const data = docSnap.data();
				if (data.status && data.status !== "pending") return;
				const commentId = data.commentId || data.id || docSnap.id;
				const queueRef = doc(state.db, "pendingCommentQueue", getQueueId(postSlug, commentId));
				batch.set(queueRef, {
					...data,
					id: data.id || commentId,
					commentId,
					postSlug,
					status: "pending",
					source: data.source || "firebase",
					pendingPath: docSnap.ref.path,
					updatedAt: data.updatedAt || serverTimestamp(),
				}, { merge: true });
				batch.set(doc(state.db, "pendingComments", postSlug), {
					postSlug,
					updatedAt: serverTimestamp(),
					hasPendingComments: true,
				}, { merge: true });
				repaired += 1;
				batchWrites += 2;
			});
			scanned += snapshot.size;
			if (batchWrites > 0) await batch.commit();
		}

		setStatus(`Repair complete: scanned ${scanned}, queued ${repaired}.`, "success");
		await loadPendingComments({ reset: true });
	} catch (error) {
		console.error("Repair pending queue failed", error);
		if (error?.code === "permission-denied") {
			setStatus("Permission denied. Check Firebase login and Firestore rules.", "error");
		} else {
			setStatus(error?.message || "Could not repair pending queue. Check console for details.", "error");
		}
	} finally {
		setLoading(false);
	}
}

function initFirebase() {
	if (missingConfig.length > 0 || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
		console.error("Firebase config missing", missingConfig);
		showOnly("configError");
		return false;
	}

	const app = initializeApp(firebaseConfig);
	state.auth = getAuth(app);
	state.db = getFirestore(app);
	return true;
}

function initAuth() {
	onAuthStateChanged(state.auth, (user) => {
		clearRenderedComments();
		state.queueDocs = [];
		state.visibleCount = PAGE_SIZE;
		updateCounts();

		if (!user) {
			showOnly("loginView");
			return;
		}

		if (user.email !== ADMIN_EMAIL) {
			elements.deniedEmail.textContent = user.email || "unknown email";
			showOnly("deniedView");
			return;
		}

		elements.adminEmail.textContent = user.email;
		showOnly("dashboardView");
		void loadPendingComments({ reset: true });
	});
}

function bindEvents() {
	elements.loginButton.addEventListener("click", async () => {
		try {
			await signInWithPopup(state.auth, new GoogleAuthProvider());
		} catch (error) {
			console.error("Google login failed", error);
		}
	});
	elements.logoutButton.addEventListener("click", () => signOut(state.auth));
	elements.deniedLogoutButton.addEventListener("click", () => signOut(state.auth));
	elements.loadMoreButton.addEventListener("click", () => {
		state.visibleCount += PAGE_SIZE;
		renderVisibleQueueDocs();
	});
	elements.repairQueueButton.addEventListener("click", repairPendingQueue);
	elements.approveSelectedButton.addEventListener("click", approveSelected);
	elements.rejectSelectedButton.addEventListener("click", rejectSelected);
}

if (initFirebase()) {
	bindEvents();
	initAuth();
}