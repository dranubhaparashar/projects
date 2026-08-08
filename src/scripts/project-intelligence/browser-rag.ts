import type {
	BrowserAiProgress,
	BrowserAssetUrls,
	BrowserHybridHit,
	BrowserLexicalHint,
	BrowserProjectChunk,
	BrowserRagAnswer,
	BrowserRagSource,
} from "./browser-ai-types";
import { embedBrowserQuery } from "./browser-embeddings";
import {
	loadBrowserVectorStore,
	searchNormalizedVectors,
	type BrowserVectorStore,
} from "./browser-vector-store";

const SEMANTIC_WEIGHT = 0.65;
const LEXICAL_WEIGHT = 0.35;
const MAX_PROJECTS = 5;
const MAX_CONTEXT_CHUNKS = 8;
const SEMANTIC_TOP_K = 12;
const INSUFFICIENT_INFORMATION =
	"The published portfolio does not provide enough information to confirm that.";

const STOP_WORDS = new Set([
	"a",
	"about",
	"all",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"built",
	"do",
	"does",
	"for",
	"from",
	"have",
	"how",
	"i",
	"in",
	"is",
	"me",
	"my",
	"of",
	"on",
	"project",
	"projects",
	"show",
	"that",
	"the",
	"this",
	"to",
	"use",
	"used",
	"uses",
	"what",
	"which",
	"with",
	"you",
]);

const QUERY_EXPANSIONS: Array<[RegExp, string[]]> = [
	[
		/\bcomputer vision\b/i,
		["computer vision", "object detection", "yolo", "ocr"],
	],
	[
		/\bgenerative ai\b|\bgenai\b/i,
		["generative ai", "llm", "rag", "language model"],
	],
	[
		/\bprivacy[- ]preserving credentials?\b|\bidentity\b/i,
		[
			"decentralized identity",
			"verifiable presentation",
			"zero knowledge",
			"bbs+",
			"anoncreds",
		],
	],
	[
		/\bpredictive (?:industrial )?failures?\b|\bfailure prediction\b/i,
		[
			"predictive maintenance",
			"generator reliability",
			"asset risk",
			"failure prediction",
		],
	],
	[
		/\bagent(?:ic)? orchestration\b|\bautonomous agent orchestration\b/i,
		["mcp", "agents", "tool orchestration", "microservice composition"],
	],
	[
		/\bvehicle perception\b/i,
		[
			"vehicle",
			"automotive",
			"computer vision",
			"object detection",
			"sensors",
			"perception",
		],
	],
];

const SPECIALIST_TERMS = [
	"snowflake",
	"yolo",
	"mcp",
	"bbs+",
	"bbs",
	"anoncreds",
	"fastapi",
	"faiss",
	"webgpu",
];

function normalize(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9+#.]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

function queryTerms(query: string): string[] {
	const normalized = normalize(query);
	const expanded: string[] = [];
	for (const [pattern, terms] of QUERY_EXPANSIONS) {
		if (pattern.test(query)) expanded.push(...terms);
	}
	expanded.push(
		...normalized
			.split(" ")
			.filter((term) => term.length >= 2 && !STOP_WORDS.has(term)),
	);
	return unique(expanded.map(normalize));
}

function chunkCorpus(chunk: BrowserProjectChunk): string {
	return normalize(
		[
			chunk.project_title,
			chunk.section,
			chunk.text,
			...(chunk.tags || []),
			...(chunk.technologies || []),
			...(chunk.capabilities || []),
			...(chunk.impact_domains || []),
		].join(" "),
	);
}

function termOccurrences(corpus: string, term: string): number {
	let count = 0;
	let offset = 0;
	while (count < 6) {
		const found = corpus.indexOf(term, offset);
		if (found < 0) break;
		count += 1;
		offset = found + term.length;
	}
	return count;
}

function lexicalScore(
	chunk: BrowserProjectChunk,
	terms: string[],
	query: string,
): number {
	const corpus = chunkCorpus(chunk);
	const title = normalize(chunk.project_title);
	const section = normalize(chunk.section);
	const normalizedQuery = normalize(query);
	let score = 0;
	for (const term of terms) {
		const occurrences = termOccurrences(corpus, term);
		if (!occurrences) continue;
		score += Math.min(occurrences, 4) * (term.includes(" ") ? 2.3 : 1);
		if (title.includes(term)) score += 3.5;
		if (section.includes(term)) score += 1.8;
	}
	if (normalizedQuery.length > 3 && corpus.includes(normalizedQuery))
		score += 6;
	return score;
}

function projectAliases(title: string): string[] {
	const normalized = normalize(title);
	const beforeSeparator = normalize(title.split(/[:—]/, 1)[0]);
	return unique([normalized, beforeSeparator]).filter(
		(alias) => alias.length >= 3,
	);
}

function namedProjectIds(store: BrowserVectorStore, query: string): string[] {
	const normalizedQuery = normalize(query);
	return store.projects
		.filter((project) =>
			projectAliases(project.title).some((alias) =>
				normalizedQuery.includes(alias),
			),
		)
		.map((project) => project.id);
}

function unsupportedClaim(query: string, store: BrowserVectorStore): boolean {
	if (
		/\bgenerated\s+\$\s*\d/i.test(query) ||
		/\bwhat\s+(?:h100|a100|tpu)\s+cluster\b/i.test(query) ||
		/\bdeployed\s+at\s+google\b/i.test(query)
	) {
		return true;
	}
	const normalizedQuery = normalize(query);
	const allText = store.chunks.map(chunkCorpus).join(" ");
	const suspicious = [
		/\$\s*\d|\b\d+(?:\.\d+)?\s*(?:million|billion)\b/i,
		/\b(?:h100|a100|tpu)\b/i,
		/\bdeployed\s+(?:at|by|for)\s+[a-z0-9]/i,
	];
	if (!suspicious.some((pattern) => pattern.test(query))) return false;
	const claimTokens = normalizedQuery
		.split(" ")
		.filter(
			(term) =>
				/\d/.test(term) || ["h100", "a100", "tpu", "google"].includes(term),
		);
	return claimTokens.some((term) => !allText.includes(term));
}

function minMax(value: number, minimum: number, maximum: number): number {
	if (maximum <= minimum) return value > 0 ? 1 : 0;
	return (value - minimum) / (maximum - minimum);
}

function excerpt(value: string, maximum = 280): string {
	const clean = value.replace(/\s+/g, " ").trim();
	if (clean.length <= maximum) return clean;
	const clipped = clean.slice(0, maximum);
	const boundary = clipped.lastIndexOf(" ");
	return `${clipped.slice(0, Math.max(boundary, maximum - 60)).trim()}…`;
}

function buildDeterministicAnswer(
	context: BrowserHybridHit[],
	comparison: boolean,
): string {
	if (!context.length) return INSUFFICIENT_INFORMATION;
	const byProject = new Map<string, BrowserHybridHit>();
	for (const hit of context) {
		if (!byProject.has(hit.chunk.project_id))
			byProject.set(hit.chunk.project_id, hit);
	}
	const lead = comparison
		? "The published portfolio supports this comparison:"
		: "The most relevant published project evidence is:";
	const evidence = [...byProject.values()].map(
		(hit) =>
			`• ${hit.chunk.project_title} (${hit.chunk.section}): ${excerpt(hit.chunk.text)}`,
	);
	return [lead, ...evidence].join("\n");
}

export async function retrieveBrowserRag(options: {
	question: string;
	assetUrls: BrowserAssetUrls;
	lexicalHints: BrowserLexicalHint[];
	currentProjectId?: string;
	onProgress?: (progress: BrowserAiProgress) => void;
	signal?: AbortSignal;
}): Promise<BrowserRagAnswer> {
	const started = performance.now();
	const assetsStarted = performance.now();
	const store = await loadBrowserVectorStore(options.assetUrls);
	const assets = performance.now() - assetsStarted;
	if (unsupportedClaim(options.question, store)) {
		return {
			answer: INSUFFICIENT_INFORMATION,
			sources: [],
			related_projects: [],
			retrieval: {
				mode: "hybrid",
				semantic_matches: 0,
				context_chunks: 0,
				project_ids: [],
				timings_ms: {
					assets,
					embedding: 0,
					vector_search: 0,
					hybrid_ranking: 0,
					total: performance.now() - started,
				},
			},
			context: [],
		};
	}

	const embeddingStarted = performance.now();
	const queryVector = await embedBrowserQuery(
		options.question,
		options.onProgress,
		options.signal,
	);
	const embedding = performance.now() - embeddingStarted;
	const vectorStarted = performance.now();
	const semanticHits = searchNormalizedVectors(
		store,
		queryVector,
		SEMANTIC_TOP_K,
	);
	const vectorSearch = performance.now() - vectorStarted;
	const rankingStarted = performance.now();
	const terms = queryTerms(options.question);
	const lexicalScores = store.chunks.map((chunk) =>
		lexicalScore(chunk, terms, options.question),
	);
	const hintScores = new Map(
		options.lexicalHints.map((hint) => [
			hint.project_id,
			Math.max(0, hint.score),
		]),
	);
	const maximumHint = Math.max(0, ...hintScores.values());
	for (let index = 0; index < lexicalScores.length; index += 1) {
		const hint = hintScores.get(store.chunks[index].project_id) || 0;
		if (hint > 0 && maximumHint > 0)
			lexicalScores[index] += (hint / maximumHint) * 4;
	}

	const semanticByIndex = new Map(
		semanticHits.map((hit) => [hit.index, hit.score]),
	);
	const candidateIndexes = new Set(semanticHits.map((hit) => hit.index));
	const lexicalIndexes = lexicalScores
		.map((score, index) => ({ score, index }))
		.filter((item) => item.score > 0)
		.sort((left, right) => right.score - left.score)
		.slice(0, 40);
	for (const item of lexicalIndexes) candidateIndexes.add(item.index);
	for (const projectId of hintScores.keys()) {
		store.chunks.forEach((chunk, index) => {
			if (chunk.project_id === projectId && lexicalScores[index] > 0)
				candidateIndexes.add(index);
		});
	}

	const semanticValues = [...candidateIndexes].map(
		(index) => semanticByIndex.get(index) ?? -1,
	);
	const lexicalValues = [...candidateIndexes].map(
		(index) => lexicalScores[index],
	);
	const semanticMin = Math.min(...semanticValues);
	const semanticMax = Math.max(...semanticValues);
	const lexicalMin = Math.min(...lexicalValues);
	const lexicalMax = Math.max(...lexicalValues);
	const explicitTerms = SPECIALIST_TERMS.filter((term) =>
		normalize(options.question).includes(normalize(term)),
	);
	const namedIds = namedProjectIds(store, options.question);
	if (
		options.currentProjectId &&
		/\b(?:this|current) project\b/i.test(options.question)
	) {
		namedIds.push(options.currentProjectId);
	}
	const hits: BrowserHybridHit[] = [...candidateIndexes]
		.map((index) => {
			const chunk = store.chunks[index];
			const semanticScore = semanticByIndex.get(index) ?? semanticMin;
			const lexicalScoreValue = lexicalScores[index];
			let hybridScore =
				SEMANTIC_WEIGHT * minMax(semanticScore, semanticMin, semanticMax) +
				LEXICAL_WEIGHT * minMax(lexicalScoreValue, lexicalMin, lexicalMax);
			const corpus = chunkCorpus(chunk);
			if (explicitTerms.some((term) => corpus.includes(normalize(term))))
				hybridScore += 0.45;
			if (namedIds.includes(chunk.project_id)) hybridScore += 0.6;
			return {
				chunk,
				semanticScore,
				lexicalScore: lexicalScoreValue,
				hybridScore,
			};
		})
		.sort((left, right) => right.hybridScore - left.hybridScore);

	const comparison = /\bcompare|comparison|versus|\bvs\.?\b/i.test(
		options.question,
	);
	const selectedProjectIds: string[] = unique(namedIds);
	for (const term of explicitTerms) {
		for (const hit of hits) {
			if (chunkCorpus(hit.chunk).includes(normalize(term)))
				selectedProjectIds.push(hit.chunk.project_id);
		}
	}
	for (const hit of hits) {
		if (selectedProjectIds.length >= MAX_PROJECTS) break;
		if (!selectedProjectIds.includes(hit.chunk.project_id))
			selectedProjectIds.push(hit.chunk.project_id);
	}
	const finalProjectIds = unique(selectedProjectIds).slice(0, MAX_PROJECTS);
	const context: BrowserHybridHit[] = [];
	const perProject = new Map<string, number>();
	for (const projectId of unique(namedIds)) {
		for (const hit of hits
			.filter((item) => item.chunk.project_id === projectId)
			.slice(0, 2)) {
			if (!context.includes(hit)) context.push(hit);
		}
	}
	for (const hit of hits) {
		if (context.length >= MAX_CONTEXT_CHUNKS) break;
		if (
			!finalProjectIds.includes(hit.chunk.project_id) ||
			context.includes(hit)
		)
			continue;
		const count = perProject.get(hit.chunk.project_id) || 0;
		const limit = comparison && namedIds.includes(hit.chunk.project_id) ? 3 : 2;
		if (count >= limit) continue;
		context.push(hit);
		perProject.set(hit.chunk.project_id, count + 1);
	}
	context.sort((left, right) => right.hybridScore - left.hybridScore);

	const sources: BrowserRagSource[] = context.map((hit, index) => ({
		source_id: `S${index + 1}`,
		project_id: hit.chunk.project_id,
		project_title: hit.chunk.project_title,
		section: hit.chunk.section,
		url: hit.chunk.url,
	}));
	const projectMap = new Map(
		store.projects.map((project) => [project.id, project]),
	);
	const relatedProjects = finalProjectIds
		.map((projectId) => projectMap.get(projectId))
		.filter((project): project is NonNullable<typeof project> =>
			Boolean(project),
		)
		.map((project) => ({
			id: project.id,
			title: project.title,
			url: project.url,
		}));
	const hybridRanking = performance.now() - rankingStarted;
	return {
		answer: buildDeterministicAnswer(context, comparison),
		sources,
		related_projects: relatedProjects,
		retrieval: {
			mode: "hybrid",
			semantic_matches: semanticHits.length,
			context_chunks: context.length,
			project_ids: finalProjectIds,
			timings_ms: {
				assets,
				embedding,
				vector_search: vectorSearch,
				hybrid_ranking: hybridRanking,
				total: performance.now() - started,
			},
		},
		context,
	};
}

export { INSUFFICIENT_INFORMATION };
