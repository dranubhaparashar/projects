import type { CollectionEntry } from "astro:content";

export type ProjectViewAction = {
	label: string;
	url: string;
	kind:
		| "demo"
		| "github"
		| "paper"
		| "documentation"
		| "dataset"
		| "report"
		| "video";
	external: boolean;
};

export type RelatedProject = {
	title: string;
	url: string;
	description?: string;
};
export type StructuredMetric = {
	label: string;
	value: string;
	context?: string;
};
export type StructuredAlgorithm =
	| string
	| {
			name: string;
			role?: string;
			rationale?: string;
			input?: string;
			output?: string;
	  };

type TextOrList = string | string[];
type MarkdownSection = {
	heading: string;
	normalizedHeading: string;
	markdown: string;
};

const executiveAliases = {
	business: [
		"business problem",
		"problem statement",
		"why this matters",
		"why this project matters",
		"why this project exists",
	],
	solution: [
		"proposed solution",
		"solution",
		"what this system does",
		"what this starter does",
		"what the platform does",
		"one-line idea",
	],
	outcome: [
		"outcome",
		"outcomes",
		"results",
		"performance snapshot",
		"engineering value",
		"current strengths",
	],
	deployment: [
		"deployment context",
		"deployment path",
		"current implementation status",
		"public demo surface",
		"public demo surfaces",
	],
	capabilities: [
		"key capabilities",
		"core capabilities",
		"core capability map",
		"what the starter gives",
	],
	contribution: ["my contribution", "my role", "contribution"],
} as const;

const technicalAliases = {
	architecture: [
		"system architecture",
		"platform architecture",
		"proposed architecture",
	],
	pipeline: [
		"processing pipeline",
		"machine learning pipeline",
		"end-to-end workflow",
		"runtime request flow",
		"agentic workflow",
	],
	algorithms: [
		"algorithms and models",
		"core linking algorithm",
		"decision logic",
		"model architecture",
	],
	dataset: ["dataset", "dataset structure", "synthetic dataset", "data model"],
	evaluation: [
		"training and evaluation",
		"evaluation and metrics",
		"metrics and results",
		"performance snapshot",
		"testing and validation strategy",
	],
	infrastructure: [
		"infrastructure",
		"technology stack",
		"dependency stack",
		"containerization",
		"containerization layer",
	],
	deployment: ["deployment architecture", "deployment path"],
	limitations: [
		"limitations",
		"current limitations",
		"known limitations",
		"current challenges",
		"research scope and claim boundary",
	],
	future: [
		"future improvements",
		"next improvements",
		"what i would add next",
		"roadmap",
	],
} as const;

function normalize(value: string) {
	return value
		.replace(/[*_`#]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.toLowerCase();
}

function textToMarkdown(value?: TextOrList) {
	if (!value) return "";
	return Array.isArray(value)
		? value
				.filter(Boolean)
				.map((item) => `- ${item}`)
				.join("\n")
		: value.trim();
}

function limitMarkdown(value: string, limit = 1800) {
	const cleaned = value
		.replace(/^:::\w+(?:\[[^\]]*\])?(?:\{[^}]*\})?\s*$/gm, "")
		.replace(/^:::\s*$/gm, "")
		.trim();
	if (cleaned.length <= limit) return cleaned;
	const selected: string[] = [];
	let length = 0;
	for (const block of cleaned.split(/\n{2,}/)) {
		if (selected.length && length + block.length > limit) break;
		selected.push(block);
		length += block.length;
	}
	return selected.join("\n\n").trim();
}

function splitSections(body: string): MarkdownSection[] {
	const matches = [...body.matchAll(/^##\s+(.+?)\s*#*\s*$/gm)];
	return matches.map((match, index) => {
		const start = (match.index ?? 0) + match[0].length;
		const end = matches[index + 1]?.index ?? body.length;
		const heading = match[1].trim();
		return {
			heading,
			normalizedHeading: normalize(heading),
			markdown: body.slice(start, end).trim(),
		};
	});
}

function findSection(sections: MarkdownSection[], aliases: readonly string[]) {
	const keys = aliases.map(normalize);
	return sections.find((section) => keys.includes(section.normalizedHeading));
}

function sectionValue(sections: MarkdownSection[], aliases: readonly string[]) {
	const section = findSection(sections, aliases);
	return section
		? { markdown: limitMarkdown(section.markdown), source: section.heading }
		: undefined;
}

function parseAttributes(sections: MarkdownSection[]) {
	const attributes = new Map<string, string>();
	const section = findSection(sections, ["project attributes"]);
	if (!section) return attributes;
	for (const line of section.markdown.split(/\r?\n/)) {
		const cells = line
			.split("|")
			.slice(1, -1)
			.map((cell) => cell.trim());
		if (
			cells.length < 2 ||
			/^(?:-|:|\s)+$/.test(cells[0]) ||
			normalize(cells[0]) === "attribute"
		)
			continue;
		const key = normalize(cells[0]);
		const value = cells.slice(1).join(" | ").trim();
		if (key && value) attributes.set(key, value);
	}
	return attributes;
}

function attribute(attributes: Map<string, string>, key: string) {
	return attributes.get(normalize(key)) || "";
}

function normalizeStatus(value?: string) {
	const status = normalize(value || "");
	if (!status) return "";
	if (status.includes("production deployment")) return "Production Deployment";
	if (status.includes("pilot")) return "Pilot";
	if (status.includes("internal operational"))
		return "Internal Operational Tool";
	if (status.includes("working prototype")) return "Working Prototype";
	if (status.includes("research prototype")) return "Research Prototype";
	if (status.includes("prototype")) return "Prototype";
	if (status.includes("experimental study")) return "Experimental Study";
	if (status.includes("concept")) return "Concept Design";
	if (status.includes("demonstration") || status === "demo")
		return "Demonstration";
	return value?.trim() || "";
}

function detectStatus(body: string) {
	const plain = body.replace(/[`*_#]/g, " ");
	const candidates: Array<[RegExp, string]> = [
		[/\bresearch prototype\b/i, "Research Prototype"],
		[/\bworking prototype\b/i, "Working Prototype"],
		[/\bpilot deployment\b/i, "Pilot"],
		[/\binternal operational tool\b/i, "Internal Operational Tool"],
		[/\bexperimental study\b/i, "Experimental Study"],
		[/\bconcept design\b/i, "Concept Design"],
		[/\bdemonstration\b/i, "Demonstration"],
	];
	for (const [pattern, label] of candidates)
		if (pattern.test(plain)) return label;
	const match = plain.match(/\bproduction deployment\b/i);
	if (match) {
		const context = plain.slice(
			Math.max(0, (match.index ?? 0) - 45),
			(match.index ?? 0) + 30,
		);
		if (!/\b(?:not|isn['’]?t|without|before)\b/i.test(context))
			return "Production Deployment";
	}
	return "";
}

export type DocumentedProjectMaturity =
	| "production"
	| "pilot"
	| "operational"
	| "prototype"
	| "research"
	| "concept";

/**
 * Returns only maturity language that is explicitly documented in structured
 * metadata, Project Attributes, or an unambiguous body phrase. In particular,
 * generic deployment links and inferred production readiness do not qualify.
 */
export function getDocumentedProjectMaturity(
	entry: CollectionEntry<"posts">,
): DocumentedProjectMaturity | undefined {
	const sections = splitSections(entry.body);
	const attributes = parseAttributes(sections);
	const executive = entry.data.views?.executive;
	const outcome = executive?.outcome;
	const outcomeStatus =
		outcome && !Array.isArray(outcome) && typeof outcome === "object"
			? outcome.status
			: undefined;
	const structured = normalizeStatus(
		executive?.deployment_context?.status ||
			attribute(attributes, "deployment-status") ||
			attribute(attributes, "project-status") ||
			(outcomeStatus === "prototype" ? "Prototype" : "") ||
			entry.data.deployment,
	);
	const bodyStatus = detectStatus(entry.body);
	const bodyStatusPattern = bodyStatus
		? new RegExp(`\\b${bodyStatus.replace(/\s+/g, "\\s+")}\\b`, "i")
		: null;
	const bodyStatusMatch = bodyStatusPattern?.exec(entry.body);
	const bodyStatusContext = bodyStatusMatch
		? entry.body.slice(
				Math.max(0, bodyStatusMatch.index - 48),
				bodyStatusMatch.index + bodyStatusMatch[0].length,
			)
		: "";
	const bodyStatusIsNegated = /\b(?:not|isn['’]?t|without|before)\b/i.test(
		bodyStatusContext,
	);
	const documented =
		structured ||
		(bodyStatusIsNegated ||
		["Production Deployment", "Demonstration"].includes(bodyStatus)
			? ""
			: bodyStatus);
	const key = normalize(documented);
	if (key.includes("production deployment")) return "production";
	if (key.includes("pilot")) return "pilot";
	if (key.includes("internal operational")) return "operational";
	if (key.includes("research prototype") || key.includes("experimental study"))
		return "research";
	if (key.includes("prototype")) return "prototype";
	if (key.includes("concept")) return "concept";
	return undefined;
}

function extractUrls(body: string) {
	const urls: Array<{ label: string; url: string }> = [];
	for (const match of body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g))
		urls.push({ label: match[1], url: match[2] });
	const github = body.match(/::github\{repo=["']([^"']+)["']\}/);
	if (github?.[1]?.includes("/"))
		urls.push({ label: "GitHub", url: `https://github.com/${github[1]}` });
	return urls;
}

function isHttpUrl(value: string) {
	try {
		return ["http:", "https:"].includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

function classifyLink(
	label: string,
	href: string,
): ProjectViewAction["kind"] | "" {
	const text = normalize(label);
	const url = href.toLowerCase();
	if (url.includes("youtube.com/") || url.includes("youtu.be/")) return "video";
	if (url.includes("github.com/")) return "github";
	if (
		text.includes("paper") ||
		text.includes("publication") ||
		url.includes("arxiv.org") ||
		url.includes("doi.org")
	)
		return "paper";
	if (
		text.includes("dataset") ||
		url.includes("kaggle.com/") ||
		url.includes("huggingface.co/datasets")
	)
		return "dataset";
	if (
		text.includes("documentation") ||
		text.includes("wiki") ||
		text === "docs" ||
		url.includes("/wiki")
	)
		return "documentation";
	if (text.includes("report") || url.endsWith(".pdf")) return "report";
	if (
		text.includes("live app") ||
		text.includes("live demo") ||
		text === "demo" ||
		url.includes("huggingface.co/spaces/") ||
		url.includes("streamlit.app")
	)
		return "demo";
	return "";
}

export function extractYoutubeId(rawUrl: string) {
	try {
		const parsed = new URL(rawUrl.trim());
		const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
		const parts = parsed.pathname.split("/").filter(Boolean);
		let id = "";
		if (host === "youtu.be") id = parts[0] || "";
		else if (
			["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
		) {
			if (parsed.pathname === "/watch") id = parsed.searchParams.get("v") || "";
			else if (["embed", "shorts"].includes(parts[0])) id = parts[1] || "";
		}
		return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
	} catch {
		return "";
	}
}

function findYoutube(entry: CollectionEntry<"posts">) {
	const configured = entry.data.youtube;
	const configuredUrl =
		typeof configured === "string" ? configured : configured?.url || "";
	const configuredTitle =
		typeof configured === "object" ? configured.title?.trim() : "";
	const matches = [
		...entry.body.matchAll(
			/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s)"']*v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}[^\s)"']*/gi,
		),
	].map((match) => match[0]);
	for (const candidate of [
		configuredUrl,
		entry.data.video_url,
		...matches,
	].filter(Boolean)) {
		const id = extractYoutubeId(candidate);
		if (id)
			return {
				id,
				embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
				watchUrl: `https://www.youtube.com/watch?v=${id}`,
				title: configuredTitle || `${entry.data.title} project demonstration`,
			};
	}
	return undefined;
}

function normalizeInfrastructure(value: unknown) {
	const empty = {
		compute: [],
		data: [],
		application: [],
		deployment: [],
		monitoring: [],
	} as Record<string, string[]>;
	if (!value) return empty;
	if (Array.isArray(value))
		return {
			...empty,
			application: value.filter(
				(item): item is string => typeof item === "string",
			),
		};
	if (typeof value !== "object") return empty;
	const source = value as Record<string, unknown>;
	for (const key of Object.keys(empty)) {
		if (Array.isArray(source[key]))
			empty[key] = (source[key] as unknown[]).filter(
				(item): item is string => typeof item === "string",
			);
	}
	return empty;
}

function capabilityList(
	attributes: Map<string, string>,
	sections: MarkdownSection[],
	configured: string[],
) {
	if (configured.length) return configured;
	const attributeValue = attribute(attributes, "key-capabilities");
	if (attributeValue) {
		return attributeValue
			.replace(/[*_`]/g, "")
			.split(/\s*(?:,|;|·|\band\b)\s*/i)
			.flatMap((item) => item.split("\u00b7"))
			.map((item) => item.trim().replace(/\.$/, ""))
			.filter((item) => item.length > 2 && item.length < 100)
			.slice(0, 12);
	}
	const section = findSection(sections, executiveAliases.capabilities);
	if (!section) return [];
	return section.markdown
		.split(/\r?\n/)
		.filter((line) => /^\s*[-*]\s+/.test(line))
		.map((line) =>
			line
				.replace(/^\s*[-*]\s+/, "")
				.replace(/[*_`]/g, "")
				.trim(),
		)
		.filter(Boolean)
		.slice(0, 12);
}

function technicalSignals(sections: MarkdownSection[]) {
	const headings = new Set(
		sections.map((section) => section.normalizedHeading),
	);
	const has = (aliases: readonly string[]) =>
		aliases.some((alias) => headings.has(normalize(alias)));
	return {
		architecture: has(technicalAliases.architecture),
		pipeline: has(technicalAliases.pipeline),
		algorithms: has(technicalAliases.algorithms),
		dataset: has(technicalAliases.dataset),
		evaluation: has(technicalAliases.evaluation),
		infrastructure: has(technicalAliases.infrastructure),
		deployment: has(technicalAliases.deployment),
		limitations: has(technicalAliases.limitations),
		future: has(technicalAliases.future),
	};
}

export function isEnhancedProject(entry: CollectionEntry<"posts">) {
	const category = normalize(entry.data.category || "");
	if (["examples", "example", "guides", "guide"].includes(category))
		return false;
	if (entry.data.views || category.includes("project")) return true;
	const sectionCount = (entry.body.match(/^##\s+/gm) || []).length;
	return Boolean(
		entry.data.description.trim() &&
			entry.body.length >= 900 &&
			sectionCount >= 3,
	);
}

export function buildProjectViewData(
	entry: CollectionEntry<"posts">,
	pdfUrl: string,
	relatedProjects: RelatedProject[],
) {
	const sections = splitSections(entry.body);
	const attributes = parseAttributes(sections);
	const executive = entry.data.views?.executive;
	const technical = entry.data.views?.technical;

	const derivedBusiness = sectionValue(sections, executiveAliases.business);
	const businessFromAttributes = attribute(attributes, "problem-statement");
	const businessMarkdown =
		textToMarkdown(executive?.business_problem) ||
		businessFromAttributes ||
		derivedBusiness?.markdown ||
		"";
	const derivedSolution = sectionValue(sections, executiveAliases.solution);
	const solutionFromAttributes = attribute(attributes, "primary-objective");
	const solutionMarkdown =
		textToMarkdown(executive?.solution || executive?.proposed_solution) ||
		solutionFromAttributes ||
		derivedSolution?.markdown ||
		"";

	const derivedOutcome = sectionValue(sections, executiveAliases.outcome);
	const structuredOutcome = executive?.outcome;
	const outcomeIsObject = Boolean(
		structuredOutcome &&
			typeof structuredOutcome === "object" &&
			!Array.isArray(structuredOutcome) &&
			"summary" in structuredOutcome,
	);
	const outcomeMarkdown = outcomeIsObject
		? textToMarkdown((structuredOutcome as { summary: TextOrList }).summary)
		: textToMarkdown(structuredOutcome as TextOrList | undefined) ||
			entry.data.results;
	const outcomeStatus = outcomeIsObject
		? (structuredOutcome as { status?: "achieved" | "prototype" | "expected" })
				.status
		: undefined;
	const outcomeMetrics = outcomeIsObject
		? (structuredOutcome as { metrics?: StructuredMetric[] }).metrics || []
		: [];

	const deploymentSection = sectionValue(sections, executiveAliases.deployment);
	const deploymentAttributeDetails = [
		attribute(attributes, "deployment-target"),
		attribute(attributes, "runtime-interface"),
		attribute(attributes, "demo-surface"),
	].filter(Boolean);
	const deploymentMarkdown =
		textToMarkdown(executive?.deployment_context?.details) ||
		(deploymentAttributeDetails.length
			? deploymentAttributeDetails.map((item) => `- ${item}`).join("\n")
			: deploymentSection?.markdown || "");
	const inferredDeploymentStatus = detectStatus(entry.body);
	const conservativeBodyStatus = [
		"Production Deployment",
		"Demonstration",
	].includes(inferredDeploymentStatus)
		? ""
		: inferredDeploymentStatus;
	const deploymentStatus =
		normalizeStatus(
			executive?.deployment_context?.status ||
				attribute(attributes, "deployment-status") ||
				attribute(attributes, "project-status") ||
				entry.data.deployment,
		) ||
		conservativeBodyStatus ||
		(attribute(attributes, "demo-surface") ? "Demonstration" : "");

	const contributionSection = sectionValue(
		sections,
		executiveAliases.contribution,
	);
	const contributionItems = entry.data.contribution?.items || [];
	const contributionMarkdown = contributionItems.length
		? contributionItems.map((item) => `- ${item}`).join("\n")
		: contributionSection?.markdown || "";

	const youtube = findYoutube(entry);
	const candidates = [
		{ label: "GitHub", url: entry.data.github_url, kind: "github" },
		{ label: "Live Demo", url: entry.data.demo_url, kind: "demo" },
		{ label: "Paper", url: entry.data.paper_url, kind: "paper" },
		{
			label: "Documentation",
			url: entry.data.documentation_url,
			kind: "documentation",
		},
		...entry.data.project_links.map((link) => ({
			...link,
			kind: link.kind || classifyLink(link.label, link.url),
		})),
		...extractUrls(entry.body).map((link) => ({
			...link,
			kind: classifyLink(link.label, link.url),
		})),
	].filter((candidate) => candidate.kind && isHttpUrl(candidate.url)) as Array<{
		label: string;
		url: string;
		kind: ProjectViewAction["kind"];
	}>;
	if (pdfUrl)
		candidates.push({ label: "Download Report", url: pdfUrl, kind: "report" });
	if (youtube)
		candidates.push({
			label: "Watch Video",
			url: youtube.watchUrl,
			kind: "video",
		});

	const labels: Record<ProjectViewAction["kind"], string> = {
		demo: "Live Demo",
		github: "GitHub",
		paper: "Paper",
		documentation: "Documentation",
		dataset: "Dataset",
		report: "Download Report",
		video: "Watch Video",
	};
	const actions = new Map<ProjectViewAction["kind"], ProjectViewAction>();
	for (const candidate of candidates) {
		if (!actions.has(candidate.kind))
			actions.set(candidate.kind, {
				label: labels[candidate.kind],
				url: candidate.url,
				kind: candidate.kind,
				external: /^https?:\/\//i.test(candidate.url),
			});
	}

	const explicitRelated = entry.data.related_projects
		.filter(
			(
				project,
			): project is { title: string; url: string; description?: string } =>
				typeof project !== "string",
		)
		.map((project) => ({
			title: project.title,
			url: project.url,
			description: project.description,
		}));
	const signals = technicalSignals(sections);

	return {
		overviewMarkdown:
			textToMarkdown(executive?.overview) || entry.data.description.trim(),
		businessProblem: businessMarkdown
			? {
					markdown: limitMarkdown(businessMarkdown),
					source: executive?.business_problem
						? undefined
						: businessFromAttributes
							? "Project Attributes"
							: derivedBusiness?.source,
				}
			: undefined,
		solution: solutionMarkdown
			? {
					markdown: limitMarkdown(solutionMarkdown),
					source:
						executive?.solution || executive?.proposed_solution
							? undefined
							: solutionFromAttributes
								? "Project Attributes"
								: derivedSolution?.source,
				}
			: undefined,
		outcome:
			outcomeMarkdown || derivedOutcome?.markdown || outcomeMetrics.length
				? {
						markdown: outcomeMarkdown || derivedOutcome?.markdown || "",
						status: outcomeStatus,
						metrics: outcomeMetrics,
						source: outcomeMarkdown ? undefined : derivedOutcome?.source,
					}
				: undefined,
		costRiskMarkdown:
			textToMarkdown(executive?.cost_risk_reduction) ||
			"Quantified financial impact has not yet been documented.",
		hasDocumentedCostRisk: Boolean(executive?.cost_risk_reduction),
		deployment:
			deploymentMarkdown || deploymentStatus
				? {
						markdown: deploymentMarkdown,
						status: deploymentStatus,
						source:
							executive?.deployment_context || deploymentAttributeDetails.length
								? undefined
								: deploymentSection?.source,
					}
				: undefined,
		capabilities: capabilityList(
			attributes,
			sections,
			executive?.key_capabilities?.length
				? executive.key_capabilities
				: entry.data.capabilities,
		),
		youtube,
		actions: [...actions.values()],
		contribution:
			contributionMarkdown || entry.data.contribution?.role
				? {
						role: entry.data.contribution?.role || "",
						markdown: contributionMarkdown,
						source: contributionItems.length
							? undefined
							: contributionSection?.source,
					}
				: undefined,
		relatedProjects: (explicitRelated.length
			? explicitRelated
			: relatedProjects
		).slice(0, 3),
		technical: {
			summaryMarkdown:
				textToMarkdown(technical?.summary) || entry.data.description.trim(),
			processingPipeline: technical?.processing_pipeline || [],
			algorithms: (technical?.algorithms || []) as StructuredAlgorithm[],
			dataset:
				technical?.dataset ||
				(entry.data.dataset ? { source: entry.data.dataset } : undefined),
			trainingEvaluationMarkdown: textToMarkdown(
				technical?.training_evaluation,
			),
			metrics: (technical?.metrics || []) as StructuredMetric[],
			infrastructure: normalizeInfrastructure(technical?.infrastructure),
			deploymentArchitectureMarkdown: textToMarkdown(
				technical?.deployment_architecture,
			),
			limitations: technical?.limitations || [],
			futureImprovements: technical?.future_improvements || [],
			reproducibilityLinks: technical?.reproducibility_links || [],
			signals,
		},
	};
}

export function getRelatedProjects(
	entry: CollectionEntry<"posts">,
	entries: CollectionEntry<"posts">[],
	getUrl: (slug: string) => string,
) {
	const sourceTags = new Set(entry.data.tags.map(normalize));
	const sourceCategory = normalize(entry.data.category || "");
	return entries
		.filter(
			(candidate) =>
				candidate.slug !== entry.slug && isEnhancedProject(candidate),
		)
		.map((candidate) => {
			const sharedTags = candidate.data.tags.filter((tag) =>
				sourceTags.has(normalize(tag)),
			).length;
			const categoryMatch =
				sourceCategory &&
				normalize(candidate.data.category || "") === sourceCategory
					? 1
					: 0;
			return { candidate, score: sharedTags * 2 + categoryMatch };
		})
		.filter(({ score }) => score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.candidate.data.published.getTime() -
					a.candidate.data.published.getTime(),
		)
		.slice(0, 3)
		.map(({ candidate }) => ({
			title: candidate.data.title,
			url: getUrl(candidate.slug),
			description: candidate.data.description,
		}));
}
