import "dotenv/config";
import admin from "firebase-admin";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const {
	GITHUB_TOKEN,
	GISCUS_REPO = "dranubhaparashar/projects",
	GISCUS_CATEGORY = "Blog Comments",
	GISCUS_CATEGORY_ID = "DIC_kwDOPHLMnM4C5-e0",
	GISCUS_MAPPING = "pathname",
	FIREBASE_PROJECT_ID,
	FIREBASE_SERVICE_ACCOUNT,
	FIREBASE_SERVICE_ACCOUNT_JSON,
	GOOGLE_APPLICATION_CREDENTIALS,
} = process.env;

const rootDir = process.cwd();
const legacyBaseViewsPath = join(rootDir, "data", "legacy-base-views.json");
const legacyCommentsPath = join(rootDir, "data", "legacy-comments.json");
const fallbackBaseViewsPath = join(rootDir, "scripts", "base-views.json");

function initializeFirebaseAdmin() {
	if (admin.apps.length > 0) return;

	const serviceAccountJson = FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT;
	if (serviceAccountJson) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
			projectId: FIREBASE_PROJECT_ID,
		});
		return;
	}

	if (GOOGLE_APPLICATION_CREDENTIALS || FIREBASE_PROJECT_ID) {
		admin.initializeApp({
			credential: admin.credential.applicationDefault(),
			projectId: FIREBASE_PROJECT_ID,
		});
		return;
	}

	admin.initializeApp({
		credential: admin.credential.applicationDefault(),
	});
}

function normalizePostId(pathname) {
	const clean = String(pathname || "")
		.split("?")[0]
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean)
		.at(-1);

	return (clean || pathname)
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizePath(value) {
	const input = String(value || "").trim();
	if (!input) return "";

	try {
		if (/^https?:\/\//i.test(input)) {
			return new URL(input).pathname.replace(/\/+$/g, "") || "/";
		}
	} catch {
		// Continue with plain path handling.
	}

	const withoutQuery = input.split("?")[0].split("#")[0];
	const path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
	return path.replace(/\/+$/g, "") || "/";
}

function safeDocId(value) {
	return String(value || "")
		.trim()
		.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function toTimestamp(value) {
	if (!value) return admin.firestore.Timestamp.now();
	const date = new Date(String(value));
	if (Number.isNaN(date.getTime())) return admin.firestore.Timestamp.now();
	return admin.firestore.Timestamp.fromDate(date);
}

function unwrapNodes(connection) {
	return Array.isArray(connection?.nodes) ? connection.nodes.filter(Boolean) : [];
}

function reactionCounts(reactionGroups) {
	const counts = {
		thumbsUp: 0,
		heart: 0,
		rocket: 0,
		hooray: 0,
		laugh: 0,
		confused: 0,
		eyes: 0,
	};

	for (const group of Array.isArray(reactionGroups) ? reactionGroups : []) {
		const content = String(group?.content || "").toUpperCase();
		const count = Number(group?.users?.totalCount || 0);
		if (!Number.isFinite(count) || count <= 0) continue;
		if (content === "THUMBS_UP") counts.thumbsUp += count;
		if (content === "HEART") counts.heart += count;
		if (content === "ROCKET") counts.rocket += count;
		if (content === "HOORAY") counts.hooray += count;
		if (content === "LAUGH") counts.laugh += count;
		if (content === "CONFUSED") counts.confused += count;
		if (content === "EYES") counts.eyes += count;
	}

	return counts;
}

function addReactionCounts(target, source) {
	for (const key of Object.keys(target)) {
		target[key] += Number(source?.[key] || 0);
	}
}

function totalReactionCount(counts) {
	return Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
}

function importedLikesCount(counts) {
	return Number(counts.thumbsUp || 0) + Number(counts.heart || 0);
}

function frontmatterValue(markdown, key) {
	const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return "";
	const line = match[1]
		.split(/\r?\n/)
		.find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
	if (!line) return "";
	return line
		.slice(line.indexOf(":") + 1)
		.trim()
		.replace(/^["']|["']$/g, "");
}

async function loadPosts() {
	const postsDir = join(rootDir, "src", "content", "posts");
	const filePaths = [];

	async function walk(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				filePaths.push(fullPath);
			}
		}
	}

	await walk(postsDir);

	const byPostId = new Map();
	const byTitle = new Map();
	const byPath = new Map();

	for (const filePath of filePaths) {
		const markdown = await readFile(filePath, "utf8");
		const relative = filePath.slice(postsDir.length + 1).replace(/\\/g, "/");
		const slug = relative.replace(/\/index\.md$/i, "").replace(/\.md$/i, "");
		const postId = normalizePostId(slug);
		const title = frontmatterValue(markdown, "title");
		const path = `/projects/posts/${slug}/`;
		const info = { postId, slug, title, path };
		if (postId) byPostId.set(postId, info);
		if (title) byTitle.set(title.trim().toLowerCase(), info);
		if (path) byPath.set(path, info);
	}

	return { byPostId, byTitle, byPath };
}

async function readJsonIfExists(filePath) {
	if (!existsSync(filePath)) return null;
	return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadLegacyBaseViews() {
	return (await readJsonIfExists(legacyBaseViewsPath))
		|| (await readJsonIfExists(fallbackBaseViewsPath))
		|| {};
}

async function loadManualComments() {
	const raw = await readJsonIfExists(legacyCommentsPath);
	return Array.isArray(raw) ? raw : [];
}

function mapDiscussionToPost(discussion, postIndex) {
	const title = String(discussion?.title || "").trim();
	const mapping = String(GISCUS_MAPPING || "").toLowerCase();

	if (mapping === "title") {
		const match = postIndex.byTitle.get(title.toLowerCase());
		if (match) return { postId: match.postId, path: match.path, slug: match.slug, matched: true };
		return { postId: "", path: "", slug: "", matched: false };
	}

	const normalizedPath = normalizePath(title);
	const postId = normalizePostId(normalizedPath);
	if (postIndex.byPostId.has(postId)) {
		const match = postIndex.byPostId.get(postId);
		return {
			postId,
			path: match?.path || normalizedPath,
			slug: match?.slug || "",
			matched: true,
		};
	}

	const byPath = postIndex.byPath.get(normalizedPath);
	if (byPath) {
		return {
			postId: byPath.postId,
			path: byPath.path,
			slug: byPath.slug,
			matched: true,
		};
	}

	return { postId, path: normalizedPath, slug: "", matched: false };
}

async function githubGraphQL(query, variables = {}) {
	const response = await fetch("https://api.github.com/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${GITHUB_TOKEN}`,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({ query, variables }),
	});

	const payload = await response.json().catch(() => ({}));
	if (!response.ok || payload.errors) {
		const message = payload.errors ? JSON.stringify(payload.errors) : JSON.stringify(payload);
		throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText} ${message}`);
	}

	return payload.data;
}

async function fetchCategoryId() {
	if (GISCUS_CATEGORY_ID) return GISCUS_CATEGORY_ID;

	const data = await githubGraphQL(
		/* GraphQL */ `
			query DiscussionCategories($owner: String!, $name: String!) {
				repository(owner: $owner, name: $name) {
					discussionCategories(first: 100) {
						nodes {
							id
							name
						}
					}
				}
			}
		`,
		{
			owner: GISCUS_REPO.split("/")[0],
			name: GISCUS_REPO.split("/")[1],
		},
	);

	const categories = unwrapNodes(data?.repository?.discussionCategories);
	const category = categories.find((item) => item?.name === GISCUS_CATEGORY);
	if (!category) {
		throw new Error(`Giscus discussion category not found: ${GISCUS_CATEGORY}`);
	}

	return category.id;
}

async function fetchDiscussions(categoryId) {
	const [owner, name] = GISCUS_REPO.split("/");
	const discussions = [];
	let after = null;

	for (;;) {
		const data = await githubGraphQL(
			/* GraphQL */ `
				query Discussions($owner: String!, $name: String!, $categoryId: ID!, $after: String) {
					repository(owner: $owner, name: $name) {
						discussions(
							first: 100
							after: $after
							categoryId: $categoryId
							orderBy: { field: CREATED_AT, direction: ASC }
						) {
							pageInfo {
								hasNextPage
								endCursor
							}
							nodes {
								id
								number
								title
								url
								createdAt
								updatedAt
								author {
									login
									avatarUrl
								}
								reactionGroups {
									content
									users {
										totalCount
									}
								}
							}
						}
					}
				}
			`,
			{ owner, name, categoryId, after },
		);

		const connection = data?.repository?.discussions;
		discussions.push(...unwrapNodes(connection));
		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return discussions;
}

async function fetchAllReplies(commentId, parentSourceCommentId) {
	const replies = [];
	let after = null;
	const [owner, name] = GISCUS_REPO.split("/");

	for (;;) {
		const data = await githubGraphQL(
			/* GraphQL */ `
				query DiscussionCommentReplies($commentId: ID!, $after: String) {
					node(id: $commentId) {
						... on DiscussionComment {
							replies(first: 100, after: $after) {
								pageInfo {
									hasNextPage
									endCursor
								}
								nodes {
									id
									databaseId
									bodyText
									url
									createdAt
									updatedAt
									author {
										login
										avatarUrl
									}
									reactionGroups {
										content
										users {
											totalCount
										}
									}
								}
							}
						}
					}
				}
			`,
			{ commentId, after },
		);

		const connection = data?.node?.replies;
		for (const reply of unwrapNodes(connection)) {
			replies.push({ ...reply, replyToSourceCommentId: parentSourceCommentId, _owner: owner, _name: name });
		}
		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return replies;
}

async function fetchDiscussionComments(number) {
	const comments = [];
	let after = null;
	const [owner, name] = GISCUS_REPO.split("/");

	for (;;) {
		const data = await githubGraphQL(
			/* GraphQL */ `
				query DiscussionComments($owner: String!, $name: String!, $number: Int!, $after: String) {
					repository(owner: $owner, name: $name) {
						discussion(number: $number) {
							comments(first: 100, after: $after) {
								pageInfo {
									hasNextPage
									endCursor
								}
								nodes {
									id
									databaseId
									bodyText
									url
									createdAt
									updatedAt
									author {
										login
										avatarUrl
									}
									replyTo {
										id
										databaseId
									}
									reactionGroups {
										content
										users {
											totalCount
										}
									}
									replies(first: 100) {
										pageInfo {
											hasNextPage
											endCursor
										}
										nodes {
											id
											databaseId
											bodyText
											url
											createdAt
											updatedAt
											author {
												login
												avatarUrl
											}
											reactionGroups {
												content
												users {
													totalCount
												}
											}
										}
									}
								}
							}
						}
					}
				}
			`,
			{ owner, name, number, after },
		);

		const discussion = data?.repository?.discussion;
		if (!discussion) break;

		const connection = discussion.comments;
		for (const comment of unwrapNodes(connection)) {
			comments.push(comment);
			const sourceCommentId = String(comment.databaseId ?? comment.id ?? "").trim();
			for (const reply of await fetchAllReplies(comment.id, sourceCommentId)) {
				comments.push({ ...reply, replyToSourceCommentId: sourceCommentId });
			}
		}

		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return comments;
}

function commentDocId(sourceCommentId) {
	return `giscus-${safeDocId(sourceCommentId)}`;
}

async function upsertLegacyViews(db, postIndex, legacyBaseViews) {
	let imported = 0;
	let skippedNewer = 0;
	let skippedInvalid = 0;

	for (const [postPath, count] of Object.entries(legacyBaseViews || {})) {
		const legacyViews = Number(count);
		const normalizedPath = normalizePath(postPath);
		const postId = normalizePostId(normalizedPath);
		const match = postIndex.byPostId.get(postId) || postIndex.byPath.get(normalizedPath);

		if (!match || !Number.isFinite(legacyViews)) {
			skippedInvalid += 1;
			continue;
		}

		const statsRef = db.collection("postStats").doc(match.postId);
		const snapshot = await statsRef.get();
		const existingImported = Number(snapshot.data()?.importedLegacyViews || 0);
		const nextImported = Math.max(existingImported, legacyViews);

		if (existingImported >= legacyViews && snapshot.exists) {
			skippedNewer += 1;
			continue;
		}

		await statsRef.set(
			{
				title: match.title || "",
				path: match.path || normalizedPath,
				slug: match.slug || match.postId,
				importedLegacyViews: nextImported,
				views: Number(snapshot.data()?.views || 0),
				likes: Number(snapshot.data()?.likes || 0),
				comments: Number(snapshot.data()?.comments || 0),
				importedGiscusLikes: Number(snapshot.data()?.importedGiscusLikes || 0),
				importedGiscusComments: Number(snapshot.data()?.importedGiscusComments || 0),
				updatedAt: admin.firestore.Timestamp.now(),
				createdAt: snapshot.exists ? snapshot.data()?.createdAt || admin.firestore.Timestamp.now() : admin.firestore.Timestamp.now(),
			},
			{ merge: true },
		);

		imported += 1;
		console.log(`Imported legacy views for ${match.postId}: ${legacyViews}`);
	}

	return { imported, skippedNewer, skippedInvalid };
}

async function upsertGiscusData(db, postIndex) {
	if (!GITHUB_TOKEN) {
		console.log("GITHUB_TOKEN is not set. Skipping automatic Giscus import.");
		return { postsImported: 0, commentsImported: 0, statsSkipped: 0, unmatched: 0 };
	}

	const categoryId = await fetchCategoryId();
	const discussions = await fetchDiscussions(categoryId);

	let postsImported = 0;
	let commentsImported = 0;
	let statsSkipped = 0;
	let unmatched = 0;

	for (const discussion of discussions) {
		const mapped = mapDiscussionToPost(discussion, postIndex);
		if (!mapped.matched || !mapped.postId) {
			unmatched += 1;
			console.log(`Unmatched Giscus discussion #${discussion.number}: ${discussion.title || "(untitled)"}`);
			continue;
		}

		const comments = await fetchDiscussionComments(discussion.number);
		const reactionTotals = reactionCounts(discussion.reactionGroups);
		const statsRef = db.collection("postStats").doc(mapped.postId);
		const reactionsRef = db.collection("postReactions").doc(mapped.postId);
		const commentsRef = db.collection("postComments").doc(mapped.postId).collection("comments");
		const statsSnapshot = await statsRef.get();
		const reactionsSnapshot = await reactionsRef.get();

		for (const comment of comments) {
			const sourceCommentId = String(comment.databaseId ?? comment.id ?? "").trim();
			if (!sourceCommentId) continue;

			addReactionCounts(reactionTotals, reactionCounts(comment.reactionGroups));
			const commentDocRef = commentsRef.doc(commentDocId(sourceCommentId));
			await commentDocRef.set(
				{
					id: sourceCommentId,
					postSlug: mapped.postId,
					name: String(comment.author?.login || "GitHub user"),
					authorName: String(comment.author?.login || "GitHub user"),
					authorAvatarUrl: String(comment.author?.avatarUrl || ""),
					message: String(comment.bodyText || ""),
					body: String(comment.bodyText || ""),
					githubUrl: String(comment.url || ""),
					source: "giscus",
					sourceDiscussionId: discussion.id,
					sourceDiscussionNumber: discussion.number,
					sourceCommentId,
					replyToSourceCommentId: String(comment.replyToSourceCommentId || ""),
					createdAt: toTimestamp(comment.createdAt),
					updatedAt: toTimestamp(comment.updatedAt || comment.createdAt),
					importedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
			commentsImported += 1;
		}

		const importedGiscusLikes = importedLikesCount(reactionTotals);
		const importedGiscusReactions = totalReactionCount(reactionTotals);

		await statsRef.set(
			{
				title: mapped.title || "",
				path: mapped.path || "",
				slug: mapped.slug || mapped.postId,
				importedGiscusLikes,
				importedGiscusComments: comments.length,
				importedLegacyViews: Number(statsSnapshot.data()?.importedLegacyViews || 0),
				views: Number(statsSnapshot.data()?.views || 0),
				likes: Number(statsSnapshot.data()?.likes || 0),
				comments: Number(statsSnapshot.data()?.comments || 0),
				updatedAt: admin.firestore.Timestamp.now(),
				createdAt: statsSnapshot.exists ? statsSnapshot.data()?.createdAt || admin.firestore.Timestamp.now() : admin.firestore.Timestamp.now(),
			},
			{ merge: true },
		);

		await reactionsRef.set(
			{
				thumbsUp: Number(reactionsSnapshot.data()?.thumbsUp || 0),
				heart: Number(reactionsSnapshot.data()?.heart || 0),
				rocket: Number(reactionsSnapshot.data()?.rocket || 0),
				hooray: Number(reactionsSnapshot.data()?.hooray || 0),
				laugh: Number(reactionsSnapshot.data()?.laugh || 0),
				confused: Number(reactionsSnapshot.data()?.confused || 0),
				eyes: Number(reactionsSnapshot.data()?.eyes || 0),
				importedGiscusReactions: reactionTotals,
				importedGiscusReactionTotal: importedGiscusReactions,
				updatedAt: admin.firestore.Timestamp.now(),
				createdAt: reactionsSnapshot.exists
					? reactionsSnapshot.data()?.createdAt || admin.firestore.Timestamp.now()
					: admin.firestore.Timestamp.now(),
			},
			{ merge: true },
		);

		postsImported += 1;
		console.log(
			`Seeded ${mapped.postId}: ${comments.length} comments, ${importedGiscusLikes} likes, ${importedGiscusReactions} reactions.`,
		);
	}

	return { postsImported, commentsImported, statsSkipped, unmatched };
}

initializeFirebaseAdmin();
const db = admin.firestore();
const postIndex = await loadPosts();
const legacyBaseViews = await loadLegacyBaseViews();
const manualComments = await loadManualComments();

const viewResult = await upsertLegacyViews(db, postIndex, legacyBaseViews);
const giscusResult = await upsertGiscusData(db, postIndex);

if (manualComments.length > 0) {
	let manualImported = 0;

	for (const entry of manualComments) {
		const postPath = normalizePath(entry.postPath || entry.path || "");
		const match =
			postIndex.byPath.get(postPath) ||
			postIndex.byPostId.get(normalizePostId(postPath)) ||
			postIndex.byTitle.get(String(entry.title || "").trim().toLowerCase());

		if (!match) continue;
		const sourceCommentId = String(entry.sourceCommentId || entry.id || "").trim();
		if (!sourceCommentId) continue;

		await db
			.collection("postComments")
			.doc(match.postId)
			.collection("comments")
			.doc(commentDocId(sourceCommentId))
			.set(
				{
					id: sourceCommentId,
					postSlug: match.postId,
					name: String(entry.name || entry.authorName || "Anonymous"),
					authorName: String(entry.authorName || entry.name || "Anonymous"),
					authorAvatarUrl: String(entry.authorAvatarUrl || ""),
					message: String(entry.message || entry.body || ""),
					body: String(entry.body || entry.message || ""),
					githubUrl: String(entry.githubUrl || ""),
					source: "giscus",
					sourceDiscussionId: String(entry.sourceDiscussionId || entry.discussionId || ""),
					sourceDiscussionNumber: Number(entry.sourceDiscussionNumber || entry.discussionNumber || 0) || 0,
					sourceCommentId,
					replyToSourceCommentId: String(entry.replyToSourceCommentId || ""),
					createdAt: toTimestamp(entry.createdAt),
					updatedAt: toTimestamp(entry.updatedAt || entry.createdAt),
					importedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
		manualImported += 1;
	}

	if (manualImported > 0) {
		console.log(`Imported ${manualImported} comments from manual legacy JSON.`);
	}
}

console.log(
	[
		`Legacy stats seed complete.`,
		`Posts imported: ${giscusResult.postsImported}`,
		`Comments imported: ${giscusResult.commentsImported}`,
		`Views imported: ${viewResult.imported}`,
		`Stats skipped because already newer: ${viewResult.skippedNewer}`,
		`Unmatched Giscus discussions: ${giscusResult.unmatched}`,
	].join(" "),
);
