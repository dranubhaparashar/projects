import {
	CLUSTER_MODE_META,
	GENERIC_PRIMARY_TECHNOLOGY_TERMS,
	INDUSTRY_FALLBACK_ID,
	INDUSTRY_GROUPS,
	TECHNOLOGY_FALLBACK_ID,
	TECHNOLOGY_GROUPS,
	type ClusterMode,
	type ClusterTaxonomyGroup,
} from "../config/project-cluster-groups";

export type ProjectClusterAssignment = {
	primaryClusterId: string;
	primaryCluster: string;
	secondaryClusterIds: string[];
	secondaryClusters: string[];
	evidence: string[];
};

export type ProjectClusterSource = {
	id: string;
	title: string;
	description: string;
	category: string;
	tags: string[];
	technologies: string[];
	problems: string[];
	primaryDomain: string;
	domains: string[];
	explicitIndustries: string[];
	comparisonIndustry: string;
	explicitTechnologyGroup: string;
	explicitTechnologyGroups: string[];
};

export type GraphCluster = {
	id: string;
	label: string;
	description: string;
	icon: string;
	color: string;
	projectIds: string[];
	count: number;
};

export type GraphClusterMode = {
	id: ClusterMode;
	label: string;
	legendHeading: string;
	rootLabel: string;
	groups: GraphCluster[];
};

function normalizeValue(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9+/#.-]+/g, " ")
		.trim();
}

function slugify(value: string): string {
	return normalizeValue(value)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function uniqueValues(values: string[]): string[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const normalized = normalizeValue(value);
		if (!normalized || seen.has(normalized)) return false;
		seen.add(normalized);
		return true;
	});
}

function matchesTerm(value: string, term: string): boolean {
	const normalizedValue = ` ${normalizeValue(value)} `;
	const normalizedTerm = normalizeValue(term);
	if (!normalizedTerm) return false;
	return normalizedValue.includes(` ${normalizedTerm} `);
}

function findExplicitGroup(
	value: string,
	groups: ClusterTaxonomyGroup[],
): ClusterTaxonomyGroup | undefined {
	const normalized = normalizeValue(value);
	if (!normalized) return undefined;
	return groups.find(
		(group) =>
			normalizeValue(group.id) === normalized ||
			normalizeValue(group.label) === normalized ||
			group.terms.some((term) => normalizeValue(term) === normalized),
	);
}

function inferTaxonomyAssignment(
	groups: ClusterTaxonomyGroup[],
	fallbackId: string,
	sources: Array<{ values: string[]; weight: number; label: string }>,
	explicitValues: string[],
): ProjectClusterAssignment {
	const scores = new Map<string, number>();
	const evidenceByGroup = new Map<string, string[]>();
	const explicitGroups = uniqueValues(explicitValues)
		.map((value) => ({ value, group: findExplicitGroup(value, groups) }))
		.filter(
			(item): item is { value: string; group: ClusterTaxonomyGroup } =>
				Boolean(item.group),
		);

	for (const { value, group } of explicitGroups) {
		scores.set(group.id, (scores.get(group.id) || 0) + 100);
		evidenceByGroup.set(group.id, [
			...(evidenceByGroup.get(group.id) || []),
			`Explicit metadata: ${value}`,
		]);
	}

	for (const source of sources) {
		const matchedValuesByGroup = new Map<string, Set<string>>();
		for (const value of uniqueValues(source.values)) {
			const normalized = normalizeValue(value);
			if (
				groups === TECHNOLOGY_GROUPS &&
				GENERIC_PRIMARY_TECHNOLOGY_TERMS.has(normalized)
			) {
				continue;
			}
			for (const group of groups) {
				if (group.id === fallbackId) continue;
				const matchedTerm = group.terms.find((term) =>
					matchesTerm(value, term),
				);
				if (!matchedTerm) continue;
				const matchedValues =
					matchedValuesByGroup.get(group.id) || new Set<string>();
				matchedValues.add(normalized);
				matchedValuesByGroup.set(group.id, matchedValues);
				const evidence = evidenceByGroup.get(group.id) || [];
				const item = `${source.label}: ${value}`;
				if (!evidence.includes(item)) evidence.push(item);
				evidenceByGroup.set(group.id, evidence);
			}
		}
		for (const [groupId, matchedValues] of matchedValuesByGroup) {
			// Cap repeated evidence from one metadata source so a long list of
			// deployment tags cannot overwhelm the project's core technology.
			const sourceScore = source.weight * Math.min(2, matchedValues.size);
			scores.set(groupId, (scores.get(groupId) || 0) + sourceScore);
		}
	}

	const rankedGroups = groups
		.filter((group) => (scores.get(group.id) || 0) > 0)
		.sort((left, right) => {
			const scoreDifference =
				(scores.get(right.id) || 0) - (scores.get(left.id) || 0);
			if (scoreDifference !== 0) return scoreDifference;
			return groups.indexOf(left) - groups.indexOf(right);
		});
	const primary =
		rankedGroups[0] ||
		groups.find((group) => group.id === fallbackId) ||
		groups[0];
	const secondary = rankedGroups.filter((group) => group.id !== primary.id);
	const evidence = evidenceByGroup.get(primary.id) || [
		"No stronger documented taxonomy signal; using the fallback group.",
	];

	return {
		primaryClusterId: primary.id,
		primaryCluster: primary.label,
		secondaryClusterIds: secondary.map((group) => group.id),
		secondaryClusters: secondary.map((group) => group.label),
		evidence: evidence.slice(0, 6),
	};
}

export function buildProjectClusterAssignments(
	project: ProjectClusterSource,
): Record<ClusterMode, ProjectClusterAssignment> {
	const explicitTechnologyGroups = uniqueValues([
		project.explicitTechnologyGroup,
		...project.explicitTechnologyGroups,
	]);
	const explicitIndustries = uniqueValues([
		...project.explicitIndustries,
		project.comparisonIndustry,
	]);
	const technology = inferTaxonomyAssignment(
		TECHNOLOGY_GROUPS,
		TECHNOLOGY_FALLBACK_ID,
		[
			{ values: project.technologies, weight: 7, label: "Technology" },
			{ values: project.tags, weight: 5, label: "Tag" },
			{ values: project.problems, weight: 3, label: "Problem" },
			{
				values: [project.title, project.description],
				weight: 1,
				label: "Project text",
			},
		],
		explicitTechnologyGroups,
	);
	const industry = inferTaxonomyAssignment(
		INDUSTRY_GROUPS,
		INDUSTRY_FALLBACK_ID,
		[
			{ values: project.tags, weight: 5, label: "Tag" },
			{ values: project.problems, weight: 4, label: "Problem" },
			{ values: project.domains, weight: 3, label: "Impact domain" },
			{
				values: [project.title, project.description],
				weight: 1,
				label: "Project text",
			},
		],
		explicitIndustries,
	);

	return {
		"impact-domain": {
			primaryClusterId: slugify(project.primaryDomain),
			primaryCluster: project.primaryDomain,
			secondaryClusterIds: project.domains
				.filter((domain) => domain !== project.primaryDomain)
				.map(slugify),
			secondaryClusters: project.domains.filter(
				(domain) => domain !== project.primaryDomain,
			),
			evidence: [`Impact-domain assignment: ${project.primaryDomain}`],
		},
		technology,
		industry,
		"project-type": {
			primaryClusterId: slugify(project.category),
			primaryCluster: project.category,
			secondaryClusterIds: [],
			secondaryClusters: [],
			evidence: [`Published project type: ${project.category}`],
		},
	};
}

function taxonomyGroupMeta(
	mode: ClusterMode,
	groupId: string,
	groupLabel: string,
	impactDomainMeta: Map<
		string,
		{ icon: string; color: string; description?: string }
	>,
): Omit<GraphCluster, "projectIds" | "count"> {
	if (mode === "impact-domain") {
		const domain = impactDomainMeta.get(groupLabel);
		return {
			id: groupId,
			label: groupLabel,
			description:
				domain?.description ||
				`Projects whose primary impact domain is ${groupLabel}.`,
			icon: domain?.icon || "network",
			color: domain?.color || "#475569",
		};
	}
	const taxonomy =
		mode === "technology"
			? TECHNOLOGY_GROUPS
			: mode === "industry"
				? INDUSTRY_GROUPS
				: [];
	const configured = taxonomy.find((group) => group.id === groupId);
	if (configured) {
		return {
			id: configured.id,
			label: configured.label,
			description: configured.description,
			icon: configured.icon,
			color: configured.color,
		};
	}
	return {
		id: groupId,
		label: groupLabel,
		description: `Published projects in ${groupLabel}.`,
		icon: mode === "project-type" ? "briefcase" : "network",
		color: "#475569",
	};
}

export function buildGraphClusterModes(
	projects: Array<{
		id: string;
		clusterAssignments: Record<ClusterMode, ProjectClusterAssignment>;
	}>,
	impactDomainMeta: Map<
		string,
		{ icon: string; color: string; description?: string }
	>,
): GraphClusterMode[] {
	return (
		Object.keys(CLUSTER_MODE_META) as ClusterMode[]
	).map((mode): GraphClusterMode => {
		const projectIdsByGroup = new Map<
			string,
			{ label: string; projectIds: string[] }
		>();
		for (const project of projects) {
			const assignment = project.clusterAssignments[mode];
			const current = projectIdsByGroup.get(assignment.primaryClusterId) || {
				label: assignment.primaryCluster,
				projectIds: [],
			};
			current.projectIds.push(project.id);
			projectIdsByGroup.set(assignment.primaryClusterId, current);
		}

		const configuredOrder =
			mode === "impact-domain"
				? [...impactDomainMeta.keys()].map(slugify)
				: mode === "technology"
				? TECHNOLOGY_GROUPS.map((group) => group.id)
				: mode === "industry"
					? INDUSTRY_GROUPS.map((group) => group.id)
					: [];
		const orderedEntries = [...projectIdsByGroup.entries()].sort(
			([leftId, left], [rightId, right]) => {
				const leftIndex = configuredOrder.indexOf(leftId);
				const rightIndex = configuredOrder.indexOf(rightId);
				if (leftIndex >= 0 || rightIndex >= 0) {
					if (leftIndex < 0) return 1;
					if (rightIndex < 0) return -1;
					if (leftIndex !== rightIndex) return leftIndex - rightIndex;
				}
				return left.label.localeCompare(right.label);
			},
		);
		const groups = orderedEntries.map(([groupId, entry]) => ({
			...taxonomyGroupMeta(
				mode,
				groupId,
				entry.label,
				impactDomainMeta,
			),
			projectIds: entry.projectIds.sort(),
			count: entry.projectIds.length,
		}));
		const meta = CLUSTER_MODE_META[mode];
		return {
			id: mode,
			label: meta.label,
			legendHeading: meta.legendHeading,
			rootLabel: meta.rootLabel,
			groups,
		};
	});
}
