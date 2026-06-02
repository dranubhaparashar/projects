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

let totalGitHubCommentsFound = 0;
let importedCount = 0;
let skippedDuplicateCount = 0;
let failedCount = 0;

for (const discussion of discussions) {
	const discussionPath = normalizePath(discussion?.title);
	if (!discussionPath.includes("/posts/")) {
		console.log(`Skipping non-post discussion #${discussion?.number ?? "unknown"}: ${discussion?.title || "(untitled)"}`);
		continue;
	}

	const postSlug = discussionPath.split("/").filter(Boolean).at(-1) || "";
	const postId = getProjectPostId(postSlug);
	if (!postId) {
		console.warn(`Skipping discussion without a valid post slug: ${discussion?.title || "(untitled)"}`);
		continue;
	}

	const comments = await fetchAllCommentsForDiscussion(discussion.number);
	totalGitHubCommentsFound += comments.length;

	const postRef = db.collection("projectPosts").doc(postId);
	let importedForPost = 0;

	for (const comment of comments) {
		try {
			const sourceCommentId = String(comment?.databaseId ?? comment?.id ?? "").trim();
			if (!sourceCommentId) {
				failedCount += 1;
				continue;
			}

			const commentDocId = `github-${safeDocId(sourceCommentId)}`;
			const commentRef = postRef.collection("comments").doc(commentDocId);
			const snapshot = await commentRef.get();
			if (snapshot.exists) {
				skippedDuplicateCount += 1;
				continue;
			}

			const authorLogin = String(comment?.author?.login || "").trim() || "GitHub user";
			const authorAvatarUrl = String(comment?.author?.avatarUrl || "").trim();
			const body = String(comment?.bodyText || "").trim();
			const replyToSourceCommentId = String(
				comment?.replyTo?.databaseId ?? comment?.replyTo?.id ?? "",
			).trim();

			await commentRef.set({
				id: sourceCommentId,
				postSlug,
				postPath: discussionPath,
				name: authorLogin,
				authorName: authorLogin,
				authorAvatarUrl,
				message: body,
				body,
				source: "github",
				sourceCommentId,
				replyToSourceCommentId: replyToSourceCommentId || null,
				importedAt: admin.firestore.Timestamp.now(),
				createdAt: toTimestamp(comment?.createdAt),
				updatedAt: toTimestamp(comment?.updatedAt || comment?.createdAt),
			});

			importedCount += 1;
			importedForPost += 1;
		} catch (error) {
			failedCount += 1;
			console.warn(`Failed to import a comment for discussion #${discussion.number}`, error);
		}
	}

	if (importedForPost > 0) {
		const snapshot = await postRef.get();
		if (snapshot.exists) {
			await postRef.set(
				{
					baseCommentsCount: admin.firestore.FieldValue.increment(importedForPost),
					updatedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
		} else {
			await postRef.set(
				{
					path: discussionPath,
					slug: postId,
					baseCommentsCount: importedForPost,
					createdAt: admin.firestore.Timestamp.now(),
					updatedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
		}

		console.log(`Imported ${importedForPost} GitHub comments for ${postId} (${discussionPath})`);
	}
}

console.log(
	[
		`Done.`,
		`GitHub comments found: ${totalGitHubCommentsFound}`,
		`Imported: ${importedCount}`,
		`Skipped duplicates: ${skippedDuplicateCount}`,
		`Failed: ${failedCount}`,
	].join(" "),
);
