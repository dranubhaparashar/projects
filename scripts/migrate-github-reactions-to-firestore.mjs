import "dotenv/config";
import admin from "firebase-admin";

const {
	GITHUB_TOKEN,
	GITHUB_REPO_OWNER = "dranubhaparashar",
	GITHUB_REPO_NAME = "projects",
	GITHUB_DISCUSSION_CATEGORY = "Blog Comments",
	FIREBASE_SERVICE_ACCOUNT_JSON,
	FIREBASE_SERVICE_ACCOUNT,
} = process.env;

if (!GITHUB_TOKEN) {
	throw new Error("GITHUB_TOKEN is required.");
}

function initializeFirebaseAdmin() {
	if (admin.apps.length > 0) return;

	const serviceAccountJson = FIREBASE_SERVICE_ACCOUNT_JSON || FIREBASE_SERVICE_ACCOUNT;

	if (serviceAccountJson) {
		admin.initializeApp({
			credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
		});
		return;
	}

	admin.initializeApp({
		credential: admin.credential.applicationDefault(),
	});
}

function normalizePath(value) {
	const input = String(value || "").trim();
	if (!input) return "";

	try {
		if (/^https?:\/\//i.test(input)) {
			return new URL(input).pathname.replace(/\/+$/g, "") || "/";
		}
	} catch {
		// Fall through to plain-path normalization.
	}

	const withoutQuery = input.split("?")[0].split("#")[0];
	const path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
	return path.replace(/\/+$/g, "") || "/";
}

function getProjectPostId(slugOrPath) {
	const clean = String(slugOrPath || "")
		.split("?")[0]
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean)
		.at(-1);

	return (clean || slugOrPath)
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function safeDocId(value) {
	return String(value || "")
		.trim()
		.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function toTimestamp(value) {
	if (!value) return admin.firestore.Timestamp.now();
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) return admin.firestore.Timestamp.now();
	return admin.firestore.Timestamp.fromDate(date);
}

function unwrapNodeList(nodes) {
	return Array.isArray(nodes) ? nodes.filter(Boolean) : [];
}

function reactionMeta(content) {
	const key = String(content || "").toUpperCase();
	const map = {
		THUMBS_UP: { key: "thumbsUp", emoji: "👍", label: "Thumbs up" },
		THUMBS_DOWN: { key: "thumbsDown", emoji: "👎", label: "Thumbs down" },
		LAUGH: { key: "laugh", emoji: "😄", label: "Laugh" },
		HOORAY: { key: "clap", emoji: "👏", label: "Hooray" },
		CONFUSED: { key: "confused", emoji: "😕", label: "Confused" },
		HEART: { key: "heart", emoji: "❤️", label: "Heart" },
		ROCKET: { key: "rocket", emoji: "🚀", label: "Rocket" },
		EYES: { key: "eyes", emoji: "👀", label: "Eyes" },
	};

	return map[key] || { key: key.toLowerCase(), emoji: "✨", label: key.toLowerCase() };
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
		const message = payload.errors ? JSON.stringify(payload.errors) : await response.text();
		throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText} ${message}`);
	}

	return payload.data;
}

async function fetchDiscussionCategoryId() {
	const query = /* GraphQL */ `
		query GetDiscussionCategories($owner: String!, $name: String!) {
			repository(owner: $owner, name: $name) {
				discussionCategories(first: 100) {
					nodes {
						id
						name
					}
				}
			}
		}
	`;

	const data = await githubGraphQL(query, {
		owner: GITHUB_REPO_OWNER,
		name: GITHUB_REPO_NAME,
	});

	const categories = unwrapNodeList(data?.repository?.discussionCategories?.nodes);
	const category = categories.find((item) => item?.name === GITHUB_DISCUSSION_CATEGORY);

	if (!category) {
		const names = categories.map((item) => item?.name).filter(Boolean).join(", ");
		throw new Error(
			`Discussion category "${GITHUB_DISCUSSION_CATEGORY}" was not found. Available categories: ${names || "none"}.`,
		);
	}

	return category.id;
}

async function fetchAllDiscussions(categoryId) {
	const query = /* GraphQL */ `
		query GetDiscussions($owner: String!, $name: String!, $categoryId: ID!, $after: String) {
			repository(owner: $owner, name: $name) {
				discussions(first: 100, after: $after, categoryId: $categoryId, orderBy: { field: CREATED_AT, direction: ASC }) {
					pageInfo {
						hasNextPage
						endCursor
					}
					nodes {
						number
						title
						url
						createdAt
						updatedAt
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
	`;

	const discussions = [];
	let after = null;

	for (;;) {
		const data = await githubGraphQL(query, {
			owner: GITHUB_REPO_OWNER,
			name: GITHUB_REPO_NAME,
			categoryId,
			after,
		});

		const connection = data?.repository?.discussions;
		const nodes = unwrapNodeList(connection?.nodes);
		discussions.push(...nodes);

		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return discussions;
}

async function fetchAllCommentsForDiscussion(number) {
	const query = /* GraphQL */ `
		query GetDiscussionComments($owner: String!, $name: String!, $number: Int!, $after: String) {
			repository(owner: $owner, name: $name) {
				discussion(number: $number) {
					number
					comments(first: 100, after: $after) {
						pageInfo {
							hasNextPage
							endCursor
						}
						nodes {
							id
							databaseId
							bodyText
							createdAt
							updatedAt
							author {
								__typename
								login
								url
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
						}
					}
				}
			}
		}
	`;

	const comments = [];
	let after = null;

	for (;;) {
		const data = await githubGraphQL(query, {
			owner: GITHUB_REPO_OWNER,
			name: GITHUB_REPO_NAME,
			number,
			after,
		});

		const discussion = data?.repository?.discussion;
		if (!discussion) break;

		const connection = discussion.comments;
		const nodes = unwrapNodeList(connection?.nodes);
		comments.push(...nodes);

		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return comments;
}

initializeFirebaseAdmin();
const db = admin.firestore();
const categoryId = await fetchDiscussionCategoryId();
const discussions = await fetchAllDiscussions(categoryId);

let totalGitHubReactionGroupsFound = 0;
let importedCount = 0;
let skippedDuplicateCount = 0;
let failedCount = 0;
let postsProcessed = 0;

for (const discussion of discussions) {
	const discussionPath = normalizePath(discussion?.title);
	if (!discussionPath.includes("/posts/")) {
		continue;
	}

	const postSlug = discussionPath.split("/").filter(Boolean).at(-1) || "";
	const postId = getProjectPostId(postSlug);
	if (!postId) {
		continue;
	}

	const postRef = db.collection("projectPosts").doc(postId);
	const reactionImportsRef = postRef.collection("reactionImports");
	let importedForPost = 0;
	const importedBaseReactions = new Map();

	const discussionGroups = unwrapNodeList(discussion?.reactionGroups);
	for (const group of discussionGroups) {
		const count = Number(group?.users?.totalCount || 0);
		if (!Number.isFinite(count) || count <= 0) continue;

		totalGitHubReactionGroupsFound += 1;
		const meta = reactionMeta(group?.content);
		const sourceReactionId = `discussion-${discussion.number}-${meta.key}`;
		const reactionDocId = `github-${safeDocId(sourceReactionId)}`;
		const reactionRef = reactionImportsRef.doc(reactionDocId);
		const snapshot = await reactionRef.get();
		if (snapshot.exists) {
			skippedDuplicateCount += 1;
			continue;
		}

		await reactionRef.set({
			id: sourceReactionId,
			postSlug,
			postPath: discussionPath,
			source: "github",
			sourceReactionId,
			sourceDiscussionNumber: discussion.number,
			sourceCommentId: null,
			sourceObjectType: "discussion",
			reactionKey: meta.key,
			reactionLabel: meta.label,
			emoji: meta.emoji,
			count,
			importedAt: admin.firestore.Timestamp.now(),
			createdAt: toTimestamp(discussion?.createdAt),
			updatedAt: toTimestamp(discussion?.updatedAt || discussion?.createdAt),
		});

		importedCount += count;
		importedForPost += count;
		importedBaseReactions.set(meta.key, (importedBaseReactions.get(meta.key) || 0) + count);
	}

	const comments = await fetchAllCommentsForDiscussion(discussion.number);
	for (const comment of comments) {
		const commentGroups = unwrapNodeList(comment?.reactionGroups);
		for (const group of commentGroups) {
			const count = Number(group?.users?.totalCount || 0);
			if (!Number.isFinite(count) || count <= 0) continue;

			totalGitHubReactionGroupsFound += 1;
			const meta = reactionMeta(group?.content);
			const sourceCommentId = String(comment?.databaseId ?? comment?.id ?? "").trim();
			if (!sourceCommentId) {
				failedCount += 1;
				continue;
			}

			const sourceReactionId = `comment-${sourceCommentId}-${meta.key}`;
			const reactionDocId = `github-${safeDocId(sourceReactionId)}`;
			const reactionRef = reactionImportsRef.doc(reactionDocId);
			const snapshot = await reactionRef.get();
			if (snapshot.exists) {
				skippedDuplicateCount += 1;
				continue;
			}

			await reactionRef.set({
				id: sourceReactionId,
				postSlug,
				postPath: discussionPath,
				source: "github",
				sourceReactionId,
				sourceDiscussionNumber: discussion.number,
				sourceCommentId,
				sourceObjectType: "comment",
				reactionKey: meta.key,
				reactionLabel: meta.label,
				emoji: meta.emoji,
				count,
				importedAt: admin.firestore.Timestamp.now(),
				createdAt: toTimestamp(comment?.createdAt),
				updatedAt: toTimestamp(comment?.updatedAt || comment?.createdAt),
			});

			importedCount += count;
			importedForPost += count;
			importedBaseReactions.set(meta.key, (importedBaseReactions.get(meta.key) || 0) + count);
		}
	}

	if (importedForPost > 0 || importedBaseReactions.size > 0) {
		postsProcessed += 1;
		const baseReactionsUpdate = {};
		for (const [key, count] of importedBaseReactions.entries()) {
			baseReactionsUpdate[`baseReactions.${key}`] = admin.firestore.FieldValue.increment(count);
		}

		const snapshot = await postRef.get();
		if (snapshot.exists) {
			await postRef.set(
				{
					baseLikes: admin.firestore.FieldValue.increment(importedForPost),
					...baseReactionsUpdate,
					updatedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
		} else {
			const baseReactions = {};
			for (const [key, count] of importedBaseReactions.entries()) {
				baseReactions[key] = count;
			}

			await postRef.set(
				{
					path: discussionPath,
					slug: postId,
					baseLikes: importedForPost,
					baseReactions,
					createdAt: admin.firestore.Timestamp.now(),
					updatedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
		}

		console.log(`Imported ${importedForPost} GitHub reactions for ${postId} (${discussionPath})`);
	}
}

console.log(
	[
		`Done.`,
		`Posts processed: ${postsProcessed}`,
		`GitHub reaction groups found: ${totalGitHubReactionGroupsFound}`,
		`Imported: ${importedCount}`,
		`Skipped duplicates: ${skippedDuplicateCount}`,
		`Failed: ${failedCount}`,
	].join(" "),
);
