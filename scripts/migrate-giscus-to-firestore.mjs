import "dotenv/config";
import admin from "firebase-admin";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const {
	GITHUB_TOKEN,
	FIREBASE_PROJECT_ID,
	FIREBASE_SERVICE_ACCOUNT,
	FIREBASE_SERVICE_ACCOUNT_JSON,
	GOOGLE_APPLICATION_CREDENTIALS,
	GISCUS_REPO = "dranubhaparashar/projects",
	GISCUS_CATEGORY = "Blog Comments",
	GISCUS_CATEGORY_ID = "DIC_kwDOPHLMnM4C5-e0",
	GISCUS_MAPPING = "pathname",
} = process.env;

if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required.");

const [repoOwner, repoName] = GISCUS_REPO.split("/");
if (!repoOwner || !repoName) throw new Error("GISCUS_REPO must be in owner/name format.");

const reactionFieldByGithubContent = {
	THUMBS_UP: "thumbsUp",
	HEART: "heart",
	ROCKET: "rocket",
	HOORAY: "hooray",
	LAUGH: "laugh",
	CONFUSED: "confused",
	EYES: "eyes",
};

const emptyReactionCounts = () => ({
	thumbsUp: 0,
	heart: 0,
	rocket: 0,
	hooray: 0,
	laugh: 0,
	confused: 0,
	eyes: 0,
});

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

	admin.initializeApp({ credential: admin.credential.applicationDefault() });
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

function nodes(connection) {
	return Array.isArray(connection?.nodes) ? connection.nodes.filter(Boolean) : [];
}

function reactionCounts(reactionGroups) {
	const counts = emptyReactionCounts();
	for (const group of Array.isArray(reactionGroups) ? reactionGroups : []) {
		const key = reactionFieldByGithubContent[String(group?.content || "").toUpperCase()];
		const count = Number(group?.users?.totalCount || 0);
		if (key && Number.isFinite(count) && count > 0) counts[key] += count;
	}
	return counts;
}

function addReactionCounts(target, source) {
	for (const key of Object.keys(target)) target[key] += Number(source?.[key] || 0);
}

function totalCount(counts) {
	return Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
}

function importedLikesCount(counts) {
	return Number(counts.thumbsUp || 0) + Number(counts.heart || 0);
}

function frontmatterValue(markdown, key) {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
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

function loadPostIndex() {
	const postsDir = join(process.cwd(), "src", "content", "posts");
	const files = [];

	function walk(dir) {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) walk(fullPath);
			if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
		}
	}

	walk(postsDir);

	const byTitle = new Map();
	const byPostId = new Map();

	for (const file of files) {
		const markdown = readFileSync(file, "utf8");
		const relative = file.slice(postsDir.length + 1).replace(/\\/g, "/");
		const slug = relative.replace(/\/index\.md$/i, "").replace(/\.md$/i, "");
		const postId = normalizePostId(slug);
		const title = frontmatterValue(markdown, "title");
		if (postId) byPostId.set(postId, { postId, slug, title });
		if (title) byTitle.set(title.trim().toLowerCase(), { postId, slug, title });
	}

	return { byPostId, byTitle };
}

function mapDiscussionToPost(discussion, postIndex) {
	const title = String(discussion?.title || "").trim();
	const mapping = String(GISCUS_MAPPING || "").toLowerCase();

	if (mapping === "pathname") {
		const path = normalizePath(title);
		const postId = normalizePostId(path);
		if (postIndex.byPostId.has(postId)) return { postId, path, reason: "pathname" };
		return { postId, path, unmatched: true, reason: "pathname" };
	}

	if (mapping === "title") {
		const match = postIndex.byTitle.get(title.toLowerCase());
		if (match) return { postId: match.postId, path: `/posts/${match.slug}`, reason: "title" };
		return { postId: "", path: "", unmatched: true, reason: "title" };
	}

	return { postId: "", path: "", unmatched: true, reason: `unsupported mapping ${mapping || "(empty)"}` };
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
		{ owner: repoOwner, name: repoName },
	);

	const category = nodes(data?.repository?.discussionCategories).find(
		(item) => item?.name === GISCUS_CATEGORY,
	);
	if (!category) throw new Error(`Giscus discussion category not found: ${GISCUS_CATEGORY}`);
	return category.id;
}

async function fetchDiscussions(categoryId) {
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
								bodyText
								url
								createdAt
								updatedAt
								author {
									login
									avatarUrl
									url
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
			{ owner: repoOwner, name: repoName, categoryId, after },
		);

		const connection = data?.repository?.discussions;
		discussions.push(...nodes(connection));
		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return discussions;
}

async function fetchMoreReplies(commentId, parentSourceCommentId, after) {
	const replies = [];
	let cursor = after;

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
										url
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
			{ commentId, after: cursor },
		);

		const connection = data?.node?.replies;
		for (const reply of nodes(connection)) {
			replies.push({ ...reply, replyToSourceCommentId: parentSourceCommentId });
		}
		if (!connection?.pageInfo?.hasNextPage) break;
		cursor = connection.pageInfo.endCursor;
	}

	return replies;
}

async function fetchDiscussionComments(number) {
	const comments = [];
	let after = null;

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
										url
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
												url
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
			{ owner: repoOwner, name: repoName, number, after },
		);

		const connection = data?.repository?.discussion?.comments;
		for (const comment of nodes(connection)) {
			comments.push(comment);
			const parentSourceCommentId = String(comment.databaseId ?? comment.id);
			for (const reply of nodes(comment?.replies)) {
				comments.push({ ...reply, replyToSourceCommentId: parentSourceCommentId });
			}
			if (comment?.replies?.pageInfo?.hasNextPage) {
				comments.push(
					...(await fetchMoreReplies(
						comment.id,
						parentSourceCommentId,
						comment.replies.pageInfo.endCursor,
					)),
				);
			}
		}
		if (!connection?.pageInfo?.hasNextPage) break;
		after = connection.pageInfo.endCursor;
	}

	return comments;
}

async function archiveUnmatched(db, discussion, reason) {
	await db.collection("giscusArchive").doc(safeDocId(discussion.id)).set(
		{
			source: "giscus",
			sourceDiscussionId: discussion.id,
			sourceDiscussionNumber: discussion.number,
			title: discussion.title || "",
			url: discussion.url || "",
			reason,
			updatedAt: admin.firestore.Timestamp.now(),
		},
		{ merge: true },
	);
}

async function run() {
	initializeFirebaseAdmin();
	const db = admin.firestore();
	const postIndex = loadPostIndex();
	const categoryId = await fetchCategoryId();
	const discussions = await fetchDiscussions(categoryId);

	const summary = {
		discussions: discussions.length,
		matchedDiscussions: 0,
		unmatchedDiscussions: 0,
		commentsWritten: 0,
		reactionsImported: 0,
		importedLikes: 0,
	};
	const unmatched = [];

	for (const discussion of discussions) {
		const mapped = mapDiscussionToPost(discussion, postIndex);
		if (!mapped.postId || mapped.unmatched) {
			summary.unmatchedDiscussions += 1;
			unmatched.push({
				number: discussion.number,
				title: discussion.title,
				url: discussion.url,
				reason: mapped.reason,
			});
			await archiveUnmatched(db, discussion, mapped.reason);
			continue;
		}

		summary.matchedDiscussions += 1;
		const comments = await fetchDiscussionComments(discussion.number);
		const postCommentsRef = db.collection("postComments").doc(mapped.postId).collection("comments");
		const importedReactionCounts = reactionCounts(discussion.reactionGroups);

		for (const comment of comments) {
			const sourceCommentId = String(comment.databaseId ?? comment.id ?? "").trim();
			if (!sourceCommentId) continue;

			const commentReactions = reactionCounts(comment.reactionGroups);
			addReactionCounts(importedReactionCounts, commentReactions);

			await postCommentsRef.doc(`giscus-${safeDocId(sourceCommentId)}`).set(
				{
					name: String(comment.author?.login || "GitHub user"),
					message: String(comment.bodyText || ""),
					authorAvatarUrl: String(comment.author?.avatarUrl || ""),
					githubUrl: String(comment.url || ""),
					createdAt: toTimestamp(comment.createdAt),
					updatedAt: toTimestamp(comment.updatedAt || comment.createdAt),
					source: "giscus",
					sourceDiscussionId: discussion.id,
					sourceDiscussionNumber: discussion.number,
					sourceCommentId,
					replyToSourceCommentId: comment.replyToSourceCommentId || null,
					importedAt: admin.firestore.Timestamp.now(),
				},
				{ merge: true },
			);
			summary.commentsWritten += 1;
		}

		const importedGiscusComments = comments.length;
		const importedGiscusLikes = importedLikesCount(importedReactionCounts);
		const importedGiscusReactions = totalCount(importedReactionCounts);

		const statsRef = db.collection("postStats").doc(mapped.postId);
		const statsSnapshot = await statsRef.get();
		await statsRef.set(
			{
				path: mapped.path,
				title: postIndex.byPostId.get(mapped.postId)?.title || "",
				...(statsSnapshot.exists ? {} : { views: 0, likes: 0, comments: 0 }),
				importedGiscusLikes,
				importedGiscusComments,
				sourceDiscussionId: discussion.id,
				sourceDiscussionNumber: discussion.number,
				updatedAt: admin.firestore.Timestamp.now(),
			},
			{ merge: true },
		);

		const reactionsRef = db.collection("postReactions").doc(mapped.postId);
		const reactionsSnapshot = await reactionsRef.get();
		await reactionsRef.set(
			{
				...(reactionsSnapshot.exists ? {} : emptyReactionCounts()),
				updatedAt: admin.firestore.Timestamp.now(),
				importedGiscusReactions: importedReactionCounts,
				importedGiscusReactionTotal: importedGiscusReactions,
			},
			{ merge: true },
		);

		summary.reactionsImported += importedGiscusReactions;
		summary.importedLikes += importedGiscusLikes;
		console.log(
			`Mapped discussion #${discussion.number} -> ${mapped.postId}: ${importedGiscusComments} comments, ${importedGiscusReactions} reactions.`,
		);
	}

	if (unmatched.length > 0) {
		console.warn("Unmatched Giscus discussions:");
		for (const item of unmatched) {
			console.warn(`#${item.number} ${item.title} (${item.reason}) ${item.url}`);
		}
	}

	console.log("Migration summary:");
	console.log(JSON.stringify(summary, null, 2));
}

await run();
