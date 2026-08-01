type RelationshipProject = {
	title: string;
	technologies: string[];
	clusterAssignments: {
		industry: {
			primaryCluster: string;
			secondaryClusters: string[];
		};
	};
};

type RelationshipEvidence = {
	sharedTags: string[];
	sharedDomains: string[];
	sharedCategory: boolean;
	sharedKeywords: string[];
};

export type ExplainedRelationship = {
	relationshipTypes: string[];
	sharedTechnologies: string[];
	sharedIndustries: string[];
	explanation: string;
};

function normalizeValue(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function intersection(left: string[], right: string[]): string[] {
	const rightValues = new Set(right.map(normalizeValue));
	const seen = new Set<string>();
	return left.filter((value) => {
		const normalized = normalizeValue(value);
		if (!normalized || seen.has(normalized) || !rightValues.has(normalized)) {
			return false;
		}
		seen.add(normalized);
		return true;
	});
}

function formatList(values: string[]): string {
	if (values.length === 0) return "";
	if (values.length === 1) return values[0];
	if (values.length === 2) return `${values[0]} and ${values[1]}`;
	return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function explainProjectRelationship(
	edge: RelationshipEvidence,
	source: RelationshipProject,
	target: RelationshipProject,
): ExplainedRelationship {
	const sharedTechnologies = intersection(
		source.technologies,
		target.technologies,
	);
	const sourceIndustries = [
		source.clusterAssignments.industry.primaryCluster,
		...source.clusterAssignments.industry.secondaryClusters,
	];
	const targetIndustries = [
		target.clusterAssignments.industry.primaryCluster,
		...target.clusterAssignments.industry.secondaryClusters,
	];
	const sharedIndustries = intersection(sourceIndustries, targetIndustries);
	const relationshipTypes: string[] = [];

	if (sharedTechnologies.length > 0) {
		relationshipTypes.push("Shared technology");
	}
	if (edge.sharedTags.length > 0) {
		relationshipTypes.push(
			sharedTechnologies.length > 0
				? "Shared capability"
				: "Shared tag or capability",
		);
	}
	if (sharedIndustries.length > 0) relationshipTypes.push("Shared industry");
	if (edge.sharedDomains.length > 0) {
		relationshipTypes.push("Shared impact domain");
	}
	if (edge.sharedKeywords.length > 0) relationshipTypes.push("Shared problem");
	if (edge.sharedCategory) relationshipTypes.push("Shared project type");

	const statements: string[] = [];
	if (sharedTechnologies.length > 0) {
		statements.push(
			`Both projects document ${formatList(sharedTechnologies.slice(0, 3))}.`,
		);
	} else if (edge.sharedTags.length > 0) {
		statements.push(
			`Both projects share the documented tags ${formatList(edge.sharedTags.slice(0, 3))}.`,
		);
	}
	if (sharedIndustries.length > 0) {
		statements.push(
			`Their documented application context overlaps in ${formatList(sharedIndustries.slice(0, 2))}.`,
		);
	} else if (edge.sharedDomains.length > 0) {
		statements.push(
			`They also share the ${formatList(edge.sharedDomains.slice(0, 2))} impact domain${edge.sharedDomains.length > 1 ? "s" : ""}.`,
		);
	} else if (edge.sharedKeywords.length > 0) {
		statements.push(
			`Their project descriptions overlap around ${formatList(edge.sharedKeywords.slice(0, 3))}.`,
		);
	}

	return {
		relationshipTypes: [...new Set(relationshipTypes)],
		sharedTechnologies,
		sharedIndustries,
		explanation:
			statements.slice(0, 2).join(" ") ||
			`${source.title} and ${target.title} are connected by their published project metadata.`,
	};
}
