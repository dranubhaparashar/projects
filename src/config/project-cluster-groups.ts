export type ClusterMode =
	| "impact-domain"
	| "technology"
	| "industry"
	| "project-type";

export type ClusterTaxonomyGroup = {
	id: string;
	label: string;
	description: string;
	icon: string;
	color: string;
	terms: string[];
};

export const CLUSTER_MODE_META: Record<
	ClusterMode,
	{
		label: string;
		legendHeading: string;
		rootLabel: string;
	}
> = {
	"impact-domain": {
		label: "Impact Domain",
		legendHeading: "Impact Domains",
		rootLabel: "Anubha's Projects",
	},
	technology: {
		label: "Technology",
		legendHeading: "Technologies",
		rootLabel: "Anubha's Projects",
	},
	industry: {
		label: "Industry",
		legendHeading: "Industries",
		rootLabel: "Anubha's Projects",
	},
	"project-type": {
		label: "Project Type",
		legendHeading: "Project Types",
		rootLabel: "Anubha's Projects",
	},
};

export const TECHNOLOGY_GROUPS: ClusterTaxonomyGroup[] = [
	{
		id: "computer-vision",
		label: "Computer Vision",
		description: "Visual detection, recognition, OCR and perception systems.",
		icon: "eye",
		color: "#7C3AED",
		terms: [
			"computer vision",
			"yolo",
			"opencv",
			"ocr",
			"object detection",
			"image recognition",
			"visual inspection",
			"multimodal vision",
		],
	},
	{
		id: "generative-ai-llm",
		label: "Generative AI / LLM",
		description: "Language models, retrieval, inference and generative systems.",
		icon: "sparkles",
		color: "#B45309",
		terms: [
			"llm",
			"large language model",
			"generative ai",
			"genai",
			"rag",
			"retrieval augmented",
			"ollama",
			"qwen",
			"gemini",
			"gpt",
			"quantization",
			"low-rank",
			"foundation model",
		],
	},
	{
		id: "agentic-ai",
		label: "Agentic AI",
		description: "Agents, orchestration and autonomous workflow composition.",
		icon: "bot",
		color: "#C2410C",
		terms: [
			"agentic ai",
			"ai agent",
			"agents",
			"llm agents",
			"multi-agent",
			"agent orchestration",
			"mcp",
			"control plane",
			"workflow automation",
		],
	},
	{
		id: "data-platforms",
		label: "Data Platforms",
		description: "Databases, warehouses, search and data-serving foundations.",
		icon: "database",
		color: "#0F766E",
		terms: [
			"snowflake",
			"sql",
			"postgresql",
			"postgres",
			"pgvector",
			"redis",
			"data platform",
			"data warehouse",
			"database",
			"data quality",
		],
	},
	{
		id: "mlops-devops",
		label: "MLOps / DevOps",
		description: "Deployment, delivery, monitoring and production AI operations.",
		icon: "server",
		color: "#0369A1",
		terms: [
			"mlops",
			"devops",
			"devsecops",
			"docker",
			"kubernetes",
			"ci/cd",
			"azure devops",
			"azure container apps",
			"hugging face",
			"deployment",
			"monitoring",
		],
	},
	{
		id: "optimization",
		label: "Optimization",
		description: "Solvers, routing and operations-research systems.",
		icon: "route",
		color: "#15803D",
		terms: [
			"optimization",
			"vrp",
			"vehicle routing",
			"solver",
			"or-tools",
			"pyvrp",
			"operations research",
			"routing",
		],
	},
	{
		id: "security-identity",
		label: "Security / Identity",
		description: "Security, privacy, trust and decentralized identity.",
		icon: "shield",
		color: "#BE123C",
		terms: [
			"security",
			"identity",
			"anoncreds",
			"bbs",
			"zkp",
			"zero-knowledge",
			"verifiable credential",
			"selective disclosure",
			"privacy-preserving",
			"fraud",
		],
	},
	{
		id: "analytics",
		label: "Analytics",
		description: "Forecasting, decision support and operational analytics.",
		icon: "chart",
		color: "#2563EB",
		terms: [
			"analytics",
			"business intelligence",
			"decision support",
			"forecasting",
			"predictive maintenance",
			"risk monitoring",
			"profit and loss",
			"data reconciliation",
		],
	},
	{
		id: "cloud-edge",
		label: "Cloud / Edge",
		description: "Cloud-native, distributed and edge deployment patterns.",
		icon: "cloud",
		color: "#475569",
		terms: [
			"cloud",
			"edge ai",
			"edge",
			"azure",
			"azure functions",
			"microservices",
			"grpc",
			"protobuf",
			"container apps",
		],
	},
	{
		id: "applied-systems",
		label: "Applied Systems",
		description: "Projects without a stronger documented technology family.",
		icon: "network",
		color: "#64748B",
		terms: [],
	},
];

export const INDUSTRY_GROUPS: ClusterTaxonomyGroup[] = [
	{
		id: "manufacturing",
		label: "Manufacturing",
		description: "Industrial operations, quality, maintenance and production.",
		icon: "factory",
		color: "#2563EB",
		terms: [
			"manufacturing",
			"industrial",
			"factory",
			"work order",
			"maintenance",
			"production",
			"quality inspection",
			"automotive",
		],
	},
	{
		id: "telecom",
		label: "Telecom",
		description: "Networks, field infrastructure and telecommunications operations.",
		icon: "radio-tower",
		color: "#0F766E",
		terms: [
			"telecom",
			"telecommunications",
			"copper reclamation",
			"network automation",
			"pole validation",
			"field infrastructure",
		],
	},
	{
		id: "logistics-supply-chain",
		label: "Logistics and Supply Chain",
		description: "Routing, fleet, logistics and supply-chain decisions.",
		icon: "route",
		color: "#15803D",
		terms: [
			"logistics",
			"supply chain",
			"vehicle routing",
			"vrp",
			"fleet",
			"delivery",
			"route optimization",
		],
	},
	{
		id: "healthcare-insurance",
		label: "Healthcare and Insurance",
		description: "Clinical, claims, insurance and healthcare review systems.",
		icon: "heart",
		color: "#BE123C",
		terms: [
			"healthcare",
			"medical",
			"clinical",
			"insurance",
			"claim",
			"diagnosis",
			"medicine",
		],
	},
	{
		id: "energy-utilities",
		label: "Energy and Utilities",
		description: "Energy assets, generators and utility operations.",
		icon: "energy",
		color: "#B45309",
		terms: [
			"energy",
			"utilities",
			"generator",
			"power",
			"asset reliability",
		],
	},
	{
		id: "research-education",
		label: "Research and Education",
		description: "Research, teaching, learning and human-AI interaction.",
		icon: "graduation-cap",
		color: "#9333EA",
		terms: [
			"research",
			"education",
			"learning",
			"training",
			"mentor",
			"interview",
			"digital human",
			"evaluation",
		],
	},
	{
		id: "cybersecurity-identity",
		label: "Cybersecurity and Identity",
		description: "Security engineering, privacy, trust and identity.",
		icon: "shield",
		color: "#9F1239",
		terms: [
			"cybersecurity",
			"security",
			"identity",
			"devsecops",
			"zero-knowledge",
			"verifiable credential",
			"privacy",
			"fraud",
		],
	},
	{
		id: "cross-industry-platforms",
		label: "Cross-Industry Platforms",
		description: "Reusable platforms and work that spans application sectors.",
		icon: "network",
		color: "#475569",
		terms: ["cross-industry", "platform", "infrastructure"],
	},
];

export const TECHNOLOGY_FALLBACK_ID = "applied-systems";
export const INDUSTRY_FALLBACK_ID = "cross-industry-platforms";

export const GENERIC_PRIMARY_TECHNOLOGY_TERMS = new Set([
	"ai",
	"artificial intelligence",
	"python",
	"demo",
	"machine learning",
	"ml",
	"project",
]);
