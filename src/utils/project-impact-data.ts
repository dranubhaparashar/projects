import type { CollectionEntry } from "astro:content";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ClusterMode } from "../config/project-cluster-groups";
import {
	buildGraphClusterModes,
	buildProjectClusterAssignments,
	type GraphClusterMode,
	type ProjectClusterAssignment,
} from "./project-cluster-data";
import { formatDateToYYYYMMDD } from "./date-utils";
import { explainProjectRelationship } from "./project-relationship-explanations";
import { getPostUrlBySlug } from "./url-utils";

type ImpactDomainConfig = {
	fallbackDomain: string;
	domainRules: Record<string, string[]>;
	genericTags: string[];
	domainIcons: Record<string, string>;
	domainColors: Record<string, string>;
};

export type ProjectImpactRecord = {
	id: string;
	title: string;
	url: string;
	date: string;
	year: string;
	category: string;
	description: string;
	tags: string[];
	meaningfulTags: string[];
	technologies: string[];
	problems: string[];
	industries: string[];
	primaryDomain: string;
	domains: string[];
	icon: string;
	relatedProjects: string[];
	deployment: string;
	links: Array<{
		label: string;
		url: string;
		kind: string;
	}>;
	clusterAssignments: Record<ClusterMode, ProjectClusterAssignment>;
};

export type ProjectImpactEdge = {
	source: string;
	target: string;
	score: number;
	sharedTags: string[];
	sharedDomains: string[];
	sharedCategory: boolean;
	sharedKeywords: string[];
	reasons: string[];
	relationshipTypes: string[];
	sharedTechnologies: string[];
	sharedIndustries: string[];
	explanation: string;
};

export type ProjectImpactDomain = {
	name: string;
	icon: string;
	color: string;
	count: number;
};

export type ProjectImpactGraphData = {
	projects: ProjectImpactRecord[];
	edges: ProjectImpactEdge[];
	domains: ProjectImpactDomain[];
	clusterModes: GraphClusterMode[];
	filters: {
		categories: string[];
		tags: string[];
		years: string[];
	};
};

type DomainInference = {
	primaryDomain: string;
	domains: string[];
};

const configPath = path.join(process.cwd(), "data", "impact-domain-rules.json");
const impactDomainConfig = JSON.parse(
	readFileSync(configPath, "utf8"),
) as ImpactDomainConfig;

const domainOrder = [
	...Object.keys(impactDomainConfig.domainRules),
	impactDomainConfig.fallbackDomain,
];
const genericTags = new Set(impactDomainConfig.genericTags.map(normalizeValue));
const domainRuleTerms = new Set(
	Object.values(impactDomainConfig.domainRules).flat().map(normalizeValue),
);

const STOP_WORDS = new Set([
	"about",
	"across",
	"adaptive",
	"after",
	"analysis",
	"and",
	"with",
	"from",
	"into",
	"that",
	"this",
	"using",
	"uses",
	"based",
	"built",
	"complete",
	"connects",
	"data",
	"end",
	"for",
	"full",
	"local",
	"platform",
	"project",
	"projects",
	"ready",
	"real",
	"system",
	"systems",
	"the",
]);

function normalizeValue(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function uniqueValues(values: string[]): string[] {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const value of values) {
		const normalized = normalizeValue(value);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		unique.push(value.trim());
	}

	return unique;
}

function normalizeProjectId(slug: string): string {
	return normalizeValue(slug)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function getMeaningfulTags(tags: string[]): string[] {
	return uniqueValues(tags).filter(
		(tag) => !genericTags.has(normalizeValue(tag)),
	);
}

function countDomainMatches(values: string[]): Map<string, number> {
	const normalizedValues = new Set(values.map(normalizeValue));
	const counts = new Map<string, number>();

	for (const [domain, rules] of Object.entries(
		impactDomainConfig.domainRules,
	)) {
		let count = 0;
		for (const rule of rules) {
			if (normalizedValues.has(normalizeValue(rule))) {
				count += 1;
			}
		}
		if (count > 0) counts.set(domain, count);
	}

	return counts;
}

function countTextDomainMatches(text: string): Map<string, number> {
	const normalizedText = ` ${normalizeValue(text).replace(/[^a-z0-9]+/g, " ")} `;
	const counts = new Map<string, number>();

	for (const [domain, rules] of Object.entries(
		impactDomainConfig.domainRules,
	)) {
		let count = 0;
		for (const rule of rules) {
			const normalizedRule = ` ${normalizeValue(rule).replace(/[^a-z0-9]+/g, " ")} `;
			if (normalizedRule.trim() && normalizedText.includes(normalizedRule)) {
				count += 1;
			}
		}
		if (count > 0) counts.set(domain, count);
	}

	return counts;
}

function selectPrimaryDomain(counts: Map<string, number>): string {
	let selected = "";
	let selectedCount = 0;

	for (const domain of domainOrder) {
		const count = counts.get(domain) || 0;
		if (count > selectedCount) {
			selected = domain;
			selectedCount = count;
		}
	}

	return selected || impactDomainConfig.fallbackDomain;
}

function getDomainsFromCounts(counts: Map<string, number>): string[] {
	return domainOrder.filter((domain) => (counts.get(domain) || 0) > 0);
}

function inferDomains(entry: CollectionEntry<"posts">): DomainInference {
	const explicitPrimary = entry.data.impact_domain?.trim();
	const explicitDomains = uniqueValues(entry.data.impact_domains || []);

	if (explicitPrimary || explicitDomains.length > 0) {
		const domains = uniqueValues([
			explicitPrimary || explicitDomains[0],
			...explicitDomains,
		]).filter(Boolean);

		return {
			primaryDomain:
				explicitPrimary || domains[0] || impactDomainConfig.fallbackDomain,
			domains:
				domains.length > 0 ? domains : [impactDomainConfig.fallbackDomain],
		};
	}

	const meaningfulTags = getMeaningfulTags(entry.data.tags || []);
	const tagCounts = countDomainMatches(meaningfulTags);
	const tagDomains = getDomainsFromCounts(tagCounts);

	if (tagDomains.length > 0) {
		return {
			primaryDomain: selectPrimaryDomain(tagCounts),
			domains: tagDomains,
		};
	}

	const textCounts = countTextDomainMatches(
		`${entry.data.title} ${entry.data.description || ""}`,
	);
	const textDomains = getDomainsFromCounts(textCounts);

	if (textDomains.length > 0) {
		return {
			primaryDomain: selectPrimaryDomain(textCounts),
			domains: textDomains,
		};
	}

	return {
		primaryDomain: impactDomainConfig.fallbackDomain,
		domains: [impactDomainConfig.fallbackDomain],
	};
}

function extractKeywords(
	project: Pick<ProjectImpactRecord, "title" | "description">,
): Set<string> {
	const normalized = normalizeValue(
		`${project.title} ${project.description}`,
	).replace(/[^a-z0-9]+/g, " ");
	const words = normalized
		.split(/\s+/)
		.map((word) => word.replace(/s$/, ""))
		.filter((word) => word.length >= 4 && !STOP_WORDS.has(word));

	return new Set(words);
}

function intersection<T>(left: T[], right: T[]): T[] {
	const rightSet = new Set(right);
	return left.filter((item) => rightSet.has(item));
}

function scoreTagOverlap(
	sharedTags: string[],
	left: string[],
	right: string[],
): number {
	const denominator = Math.max(1, Math.min(left.length, right.length, 6));
	return Math.min(1, sharedTags.length / denominator);
}

function scoreDomainOverlap(
	sharedDomains: string[],
	left: string[],
	right: string[],
): number {
	const denominator = Math.max(1, Math.min(left.length, right.length));
	return Math.min(1, sharedDomains.length / denominator);
}

function scoreKeywordOverlap(
	sharedKeywords: string[],
	left: Set<string>,
	right: Set<string>,
): number {
	const union = new Set([...left, ...right]);
	if (union.size === 0) return 0;
	return Math.min(1, sharedKeywords.length / union.size);
}

function hasStrongSharedTag(sharedTags: string[]): boolean {
	return sharedTags.some((tag) => domainRuleTerms.has(normalizeValue(tag)));
}

function formatReasonList(values: string[]): string {
	if (values.length === 0) return "";
	if (values.length === 1) return values[0];
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function buildCandidateEdge(
	source: ProjectImpactRecord,
	target: ProjectImpactRecord,
): ProjectImpactEdge | null {
	const sharedTags = intersection(source.meaningfulTags, target.meaningfulTags);
	const sharedDomains = intersection(source.domains, target.domains);
	const sameCategory =
		!!source.category &&
		normalizeValue(source.category) === normalizeValue(target.category);
	const sourceKeywords = extractKeywords(source);
	const targetKeywords = extractKeywords(target);
	const sharedKeywords = [...sourceKeywords].filter((keyword) =>
		targetKeywords.has(keyword),
	);

	const tagScore = scoreTagOverlap(
		sharedTags,
		source.meaningfulTags,
		target.meaningfulTags,
	);
	const domainScore = scoreDomainOverlap(
		sharedDomains,
		source.domains,
		target.domains,
	);
	const categoryScore = sameCategory ? 1 : 0;
	const keywordScore = scoreKeywordOverlap(
		sharedKeywords,
		sourceKeywords,
		targetKeywords,
	);
	const score = Number(
		(
			0.5 * tagScore +
			0.25 * domainScore +
			0.15 * categoryScore +
			0.1 * keywordScore
		).toFixed(2),
	);

	const samePrimaryDomain = source.primaryDomain === target.primaryDomain;
	const meaningfulSimilarity =
		sharedTags.length >= 2 ||
		hasStrongSharedTag(sharedTags) ||
		(samePrimaryDomain &&
			(sharedTags.length >= 1 || sharedKeywords.length >= 2)) ||
		score >= 0.48;

	if (!meaningfulSimilarity || score < 0.2) return null;

	const reasons = [
		sharedTags.length
			? `Tags: ${formatReasonList(sharedTags.slice(0, 5))}`
			: "",
		sharedDomains.length
			? `Domains: ${formatReasonList(sharedDomains.slice(0, 3))}`
			: "",
		sameCategory ? `Project type: ${source.category}` : "",
		sharedKeywords.length
			? `Language overlap: ${formatReasonList(sharedKeywords.slice(0, 3))}`
			: "",
	].filter(Boolean);

	return {
		source: source.id,
		target: target.id,
		score,
		sharedTags,
		sharedDomains,
		sharedCategory: sameCategory,
		sharedKeywords: sharedKeywords.slice(0, 5),
		reasons,
		relationshipTypes: [],
		sharedTechnologies: [],
		sharedIndustries: [],
		explanation: "",
	};
}

function buildEdges(projects: ProjectImpactRecord[]): ProjectImpactEdge[] {
	const candidates: ProjectImpactEdge[] = [];

	for (let i = 0; i < projects.length; i += 1) {
		for (let j = i + 1; j < projects.length; j += 1) {
			const edge = buildCandidateEdge(projects[i], projects[j]);
			if (edge) candidates.push(edge);
		}
	}

	const relationCounts = new Map(projects.map((project) => [project.id, 0]));
	const selectedEdges: ProjectImpactEdge[] = [];

	for (const edge of candidates.sort((a, b) => b.score - a.score)) {
		const sourceCount = relationCounts.get(edge.source) || 0;
		const targetCount = relationCounts.get(edge.target) || 0;
		if (sourceCount >= 5 || targetCount >= 5) continue;

		selectedEdges.push(edge);
		relationCounts.set(edge.source, sourceCount + 1);
		relationCounts.set(edge.target, targetCount + 1);
	}

	return selectedEdges.sort((a, b) => {
		if (a.source === b.source) return a.target.localeCompare(b.target);
		return a.source.localeCompare(b.source);
	});
}

function getDomainMeta(name: string): Omit<ProjectImpactDomain, "count"> {
	return {
		name,
		icon:
			impactDomainConfig.domainIcons[name] ||
			impactDomainConfig.domainIcons[impactDomainConfig.fallbackDomain],
		color:
			impactDomainConfig.domainColors[name] ||
			impactDomainConfig.domainColors[impactDomainConfig.fallbackDomain],
	};
}

export function getProjectDomainPresentation(
	entry: CollectionEntry<"posts">,
): Omit<ProjectImpactDomain, "count"> {
	return getDomainMeta(inferDomains(entry).primaryDomain);
}

export function buildProjectImpactGraphData(
	entries: CollectionEntry<"posts">[],
): ProjectImpactGraphData {
	const projects: ProjectImpactRecord[] = entries
		.filter((entry) => entry.data.draft !== true)
		.map((entry) => {
			const inference = inferDomains(entry);
			const category = entry.data.category?.trim() || "Uncategorized";
			const meaningfulTags = getMeaningfulTags(entry.data.tags || []);
			const explicitTechnologies = uniqueValues([
				...(entry.data.technologies || []),
				...(entry.data.comparison?.technologies || []),
			]);
			const technologies =
				explicitTechnologies.length > 0
					? explicitTechnologies
					: meaningfulTags;
			const rawIndustries = Array.isArray(entry.data.industry)
				? entry.data.industry
				: [entry.data.industry || ""];
			const industries = uniqueValues([
				...rawIndustries,
				entry.data.comparison?.industry || "",
			]);
			const problems = uniqueValues([
				...(entry.data.problems || []),
				entry.data.comparison?.business_problem || "",
			]);
			const directLinks = [
				{ label: "GitHub", url: entry.data.github_url, kind: "github" },
				{ label: "Live demo", url: entry.data.demo_url, kind: "demo" },
				{ label: "Paper", url: entry.data.paper_url, kind: "paper" },
				{
					label: "Documentation",
					url: entry.data.documentation_url,
					kind: "documentation",
				},
			];
			const linkUrls = new Set<string>();
			const links = [
				...(entry.data.project_links || []).map((link) => ({
					label: link.label,
					url: link.url,
					kind: link.kind || "link",
				})),
				...directLinks,
			].filter((link) => {
				if (!link.url || linkUrls.has(link.url)) return false;
				linkUrls.add(link.url);
				return true;
			});
			const id = normalizeProjectId(entry.slug);
			const baseProject = {
				id,
				title: entry.data.title,
				url: getPostUrlBySlug(entry.slug),
				date: formatDateToYYYYMMDD(entry.data.published),
				year: String(entry.data.published.getFullYear()),
				category,
				description: entry.data.description || "",
				tags: uniqueValues(entry.data.tags || []),
				meaningfulTags,
				technologies,
				problems,
				industries,
				primaryDomain: inference.primaryDomain,
				domains: inference.domains,
				icon: getDomainMeta(inference.primaryDomain).icon,
				relatedProjects: [],
				deployment: entry.data.deployment || "",
				links,
			};
			const clusterAssignments = buildProjectClusterAssignments({
				id,
				title: baseProject.title,
				description: baseProject.description,
				category,
				tags: baseProject.tags,
				technologies: explicitTechnologies,
				problems,
				primaryDomain: inference.primaryDomain,
				domains: inference.domains,
				explicitIndustries: rawIndustries,
				comparisonIndustry: entry.data.comparison?.industry || "",
				explicitTechnologyGroup: entry.data.technology_group || "",
				explicitTechnologyGroups: entry.data.technology_groups || [],
			});

			return { ...baseProject, clusterAssignments };
		});

	const projectById = new Map(
		projects.map((project) => [project.id, project]),
	);
	const edges = buildEdges(projects).map((edge) => {
		const source = projectById.get(edge.source);
		const target = projectById.get(edge.target);
		if (!source || !target) return edge;
		return {
			...edge,
			...explainProjectRelationship(edge, source, target),
		};
	});
	const relatedByProject = new Map(
		projects.map((project) => [project.id, [] as string[]]),
	);

	for (const edge of edges) {
		relatedByProject.get(edge.source)?.push(edge.target);
		relatedByProject.get(edge.target)?.push(edge.source);
	}

	for (const project of projects) {
		project.relatedProjects = relatedByProject.get(project.id) || [];
	}

	const domainCounts = new Map<string, number>();
	for (const project of projects) {
		domainCounts.set(
			project.primaryDomain,
			(domainCounts.get(project.primaryDomain) || 0) + 1,
		);
	}

	const activeDomainNames = [
		...domainOrder.filter((domain) => domainCounts.has(domain)),
		...[...domainCounts.keys()]
			.filter((domain) => !domainOrder.includes(domain))
			.sort(),
	];
	const domains = activeDomainNames.map((domain) => ({
		...getDomainMeta(domain),
		count: domainCounts.get(domain) || 0,
	}));
	const clusterModes = buildGraphClusterModes(
		projects,
		new Map(
			domains.map((domain) => [
				domain.name,
				{ icon: domain.icon, color: domain.color },
			]),
		),
	);

	return {
		projects,
		edges,
		domains,
		clusterModes,
		filters: {
			categories: uniqueValues(
				projects.map((project) => project.category),
			).sort((a, b) => a.localeCompare(b)),
			tags: uniqueValues(projects.flatMap((project) => project.tags)).sort(
				(a, b) => a.localeCompare(b),
			),
			years: uniqueValues(projects.map((project) => project.year)).sort(
				(a, b) => b.localeCompare(a),
			),
		},
	};
}
