export interface ProjectIndustry {
	id: string;
	label: string;
	tags: string[];
	keywords: string[];
	relatedImpactDomains?: string[];
	aliases?: string[];
	relatedProblems?: string[];
}

/**
 * Portfolio industry taxonomy. Terms are intentionally specific: broad words
 * such as "data", "platform" and "AI" do not qualify a project for an industry.
 */
export const projectIndustries: ProjectIndustry[] = [
	{
		id: "healthcare",
		label: "Healthcare",
		tags: [
			"Healthcare",
			"Healthcare AI",
			"HealthTech",
			"Medical",
			"Medical Insurance",
			"Insurance AI",
			"Clinical AI",
			"Insurance Claims",
		],
		keywords: [
			"healthcare",
			"medical claim",
			"clinical consistency",
			"clinical review",
			"hospital",
			"patient record",
		],
		relatedImpactDomains: ["Healthcare and Clinical Intelligence"],
		relatedProblems: ["healthcare"],
	},
	{
		id: "telecom",
		label: "Telecom",
		tags: [
			"Telecom",
			"Telecommunications",
			"Network Infrastructure",
			"Pole Inspection",
		],
		keywords: [
			"telecom",
			"telecommunications",
			"copper reclamation",
			"pole validation",
			"network tower",
			"outside plant",
		],
		aliases: ["telecommunications", "infrastructure"],
		relatedImpactDomains: ["Telecommunications and Network Intelligence"],
		relatedProblems: ["telecom"],
	},
	{
		id: "logistics",
		label: "Logistics",
		tags: [
			"Logistics",
			"Vehicle Routing",
			"VRP",
			"Route Optimization",
			"Fleet Optimization",
		],
		keywords: [
			"vehicle routing problem",
			"route optimization",
			"fleet routing",
			"delivery route",
			"dispatch planning",
		],
		relatedImpactDomains: ["Optimization and Logistics"],
		relatedProblems: ["logistics"],
	},
	{
		id: "manufacturing",
		label: "Manufacturing",
		tags: [
			"Manufacturing",
			"Industrial AI",
			"Industrial Inspection",
			"Work Orders",
			"Work Order Management",
		],
		keywords: [
			"manufacturing",
			"industrial inspection",
			"engineering work order",
			"factory operations",
			"production equipment",
		],
		relatedImpactDomains: ["Industrial Intelligence"],
	},
	{
		id: "energy",
		label: "Energy",
		tags: [
			"Energy",
			"Utilities",
			"Generator Maintenance",
			"Generator Reliability",
			"Power Generation",
		],
		keywords: [
			"generator maintenance",
			"generator failure",
			"power generation",
			"energy asset",
			"utility asset",
		],
		relatedImpactDomains: ["Industrial Intelligence"],
	},
	{
		id: "security",
		label: "Security",
		tags: [
			"Security",
			"DevSecOps",
			"Zero-Knowledge Proofs",
			"Decentralized Identity",
			"Privacy-Preserving Identity",
		],
		keywords: [
			"devsecops",
			"zero-knowledge proof",
			"decentralized identity",
			"security gate",
			"selective disclosure",
			"credential verification",
		],
		relatedImpactDomains: ["Security, Identity and Trust"],
		relatedProblems: ["security"],
	},
	{
		id: "research",
		label: "Research",
		tags: ["Research", "Research Prototype", "Benchmark", "Technical Paper"],
		keywords: [
			"research prototype",
			"research framework",
			"research study",
			"benchmark experiment",
			"technical paper",
		],
		aliases: ["academic"],
		relatedProblems: ["research-automation"],
	},
	{
		id: "cross-industry",
		label: "Cross-Industry",
		tags: ["Cross-Industry", "Industry-Agnostic", "Domain-Agnostic"],
		keywords: ["cross-industry", "industry-agnostic", "domain-agnostic"],
		aliases: ["cross industry", "multi-industry"],
	},
];

export const projectIndustryById = new Map(
	projectIndustries.map((industry) => [industry.id, industry]),
);
