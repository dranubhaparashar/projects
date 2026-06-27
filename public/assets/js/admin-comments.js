import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
	GoogleAuthProvider,
	getAuth,
	onAuthStateChanged,
	signInWithPopup,
	signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
	collectionGroup,
	doc,
	getDoc,
	getFirestore,
	increment,
	limit,
	query,
	serverTimestamp,
	startAfter,
	where,
	writeBatch,
	getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_EMAIL = "anubhaparashar1025@gmail.com";
const PAGE_SIZE = 50;

const firebaseConfig = window.DRANUBHA_FIREBASE_CONFIG || {};
const missingConfig = window.DRANUBHA_FIREBASE_CONFIG_MISSING || [];

const state = {
	db: null,
	auth: null,
	lastVisibleDoc: null,
	isLoading: false,
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

function isPendingCommentPath(docRef) {
	return docRef.path.startsWith("pendingComments/");
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
	elements.pendingCount.textContent = String(state.pending.size);
	elements.selectedCount.textContent = String(state.selected.size);
	elements.approveSelectedButton.disabled = state.selected.size === 0;
	elements.rejectSelectedButton.disabled = state.selected.size === 0;
	elements.emptyState.classList.toggle("hidden", state.pending.size > 0 || state.isLoading);
}

function removeCard(key) {
	const item = state.pending.get(key);
	if (!item) return;
	item.element.remove();
	state.pending.delete(key);
	state.selected.delete(key);
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
	if (!isPendingCommentPath(docSnap.ref)) return;
	const data = docSnap.data();
	const postSlug = getPostSlug(data, docSnap.ref);
	if (!postSlug) return;

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
					<div class="muted">${escapeHtml(formatDate(data.createdAt))}</div>
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
			<div class="meta-item"><span class="meta-label">Comment ID</span><span class="meta-value">${escapeHtml(docSnap.id)}</span></div>
			<div class="meta-item"><span class="meta-label">Source</span><span class="meta-value">${escapeHtml(data.source || "firebase")}</span></div>
			<div class="meta-item"><span class="meta-label">Path</span><span class="meta-value">${escapeHtml(docSnap.ref.path)}</span></div>
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

function createPendingQuery() {
	const base = query(
		collectionGroup(state.db, "comments"),
		where("status", "==", "pending"),
		limit(PAGE_SIZE),
	);

	if (!state.lastVisibleDoc) return base;
	return query(
		collectionGroup(state.db, "comments"),
		where("status", "==", "pending"),
		startAfter(state.lastVisibleDoc),
		limit(PAGE_SIZE),
	);
}

function sortPendingDocs(docs) {
	return docs
		.filter((docSnap) => isPendingCommentPath(docSnap.ref))
		.sort((a, b) => {
			const aData = a.data();
			const bData = b.data();
			const aTime = timestampToMillis(aData.createdAt || aData.updatedAt);
			const bTime = timestampToMillis(bData.createdAt || bData.updatedAt);
			return bTime - aTime;
		});
}

async function loadPendingComments({ reset = false } = {}) {
	if (state.isLoading) return;
	setLoading(true);
	setStatus("");

	try {
		if (reset) {
			state.lastVisibleDoc = null;
			state.pending.clear();
			state.selected.clear();
			elements.commentsList.innerHTML = "";
		}

		const snapshot = await getDocs(createPendingQuery());
		state.lastVisibleDoc = snapshot.docs.at(-1) || state.lastVisibleDoc;
		sortPendingDocs(snapshot.docs).forEach(renderComment);
		elements.loadMoreButton.classList.toggle("hidden", snapshot.docs.length < PAGE_SIZE);
		updateCounts();
	} catch (error) {
		console.error("Failed to load pending comments", error);
		if (error?.code === "permission-denied") {
			setStatus("Permission denied. Check Firebase login and Firestore rules.", "error");
		} else {
			setStatus(error?.message || "Could not load pending comments. Check console for details.", "error");
		}
	} finally {
		setLoading(false);
	}
}

async function approveComment(item) {
	const latest = await getDoc(item.docSnap.ref);
	if (!latest.exists()) throw new Error("Pending comment no longer exists.");
	if (!isPendingCommentPath(latest.ref)) throw new Error("Refusing to approve a non-pending comment path.");

	const data = latest.data();
	const commentId = latest.id;
	const postSlug = getPostSlug(data, latest.ref);
	if (!postSlug) throw new Error("Missing postSlug.");

	const targetRef = doc(state.db, "postComments", postSlug, "comments", commentId);
	const statsRef = doc(state.db, "postStats", postSlug);
	const batch = writeBatch(state.db);
	batch.set(targetRef, {
		...data,
		id: data.id || commentId,
		postSlug,
		status: "approved",
		approved: true,
		approvedAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	batch.delete(latest.ref);
	batch.set(statsRef, {
		comments: increment(1),
		updatedAt: serverTimestamp(),
	}, { merge: true });
	await batch.commit();
}

async function rejectComment(item) {
	const latest = await getDoc(item.docSnap.ref);
	if (!latest.exists()) return;
	if (!isPendingCommentPath(latest.ref)) throw new Error("Refusing to reject a non-pending comment path.");
	const batch = writeBatch(state.db);
	batch.delete(latest.ref);
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
		state.pending.clear();
		state.selected.clear();
		state.lastVisibleDoc = null;
		elements.commentsList.innerHTML = "";
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
	elements.loadMoreButton.addEventListener("click", () => loadPendingComments());
	elements.approveSelectedButton.addEventListener("click", approveSelected);
	elements.rejectSelectedButton.addEventListener("click", rejectSelected);
}

if (initFirebase()) {
	bindEvents();
	initAuth();
}