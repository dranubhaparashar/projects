export interface ProjectProblemUseCase {
	label: string;
	keywords: string[];
}

export interface ProjectProblemDefinition {
	id: string;
	label: string;
	description: string;
	icon: string;
	keywords: string[];
	tags: string[];
	categories?: string[];
	relatedProblems?: string[];
	useCases?: ProjectProblemUseCase[];
}

export const GENERIC_PROJECT_PROBLEM_TAGS = new Set([
	"AI",
	"Application",
	"Demo",
	"Machine Learning",
	"Project",
	"Python",
	"Research Prototype",
]);

export const projectProblems: ProjectProblemDefinition[] = [
	{
		id: "computer-vision",
		label: "Computer Vision",
		description:
			"Inspection, detection, tracking and video-intelligence systems.",
		icon: "material-symbols:photo-camera-outline-rounded",
		tags: [
			"Computer Vision",
			"YOLO",
			"Object Detection",
			"Object Tracking",
			"Image Processing",
			"Video Analytics",
			"OCR",
			"Pole Validation",
		],
		keywords: [
			"camera",
			"video",
			"image",
			"inspection",
			"detection",
			"tracking",
			"vision",
			"ocr",
			"pole",
			"vehicle",
		],
		relatedProblems: ["logistics", "healthcare", "predictive-maintenance"],
		useCases: [
			{
				label: "Infrastructure validation",
				keywords: ["pole", "gis", "infrastructure", "validation"],
			},
			{
				label: "Key and object detection",
				keywords: ["key", "object", "detection", "yolo"],
			},
			{
				label: "Document-image analysis",
				keywords: ["ocr", "document", "claim", "image"],
			},
			{
				label: "Vehicle inspection",
				keywords: ["vehicle", "automotive", "inspection"],
			},
			{
				label: "Video intelligence",
				keywords: ["video", "camera", "tracking"],
			},
		],
	},
	{
		id: "predictive-maintenance",
		label: "Predictive Maintenance",
		description:
			"Asset health, failure-risk forecasting and maintenance planning.",
		icon: "material-symbols:precision-manufacturing-outline-rounded",
		tags: [
			"Predictive Maintenance",
			"Preventive Maintenance",
			"Generator Reliability",
			"Maintenance",
			"Failure Prediction",
			"Asset Health",
		],
		keywords: [
			"maintenance",
			"generator",
			"failure",
			"forecast",
			"risk",
			"asset",
			"reliability",
			"telemetry",
			"prioritized",
		],
		relatedProblems: ["logistics", "computer-vision", "generative-ai"],
		useCases: [
			{
				label: "Generator failure prediction",
				keywords: ["generator", "failure", "risk"],
			},
			{
				label: "Maintenance prioritisation",
				keywords: ["maintenance", "prioritized", "recommend"],
			},
			{
				label: "Asset health scoring",
				keywords: ["asset", "health", "reliability"],
			},
			{
				label: "Repeat-repair risk",
				keywords: ["repeat", "repair", "risk"],
			},
		],
	},
	{
		id: "generative-ai",
		label: "Generative AI",
		description:
			"LLM, multimodal and agentic systems for content and decisions.",
		icon: "material-symbols:auto-awesome-outline-rounded",
		tags: [
			"GenAI",
			"Generative AI",
			"LLM",
			"LLM Agents",
			"LLM Inference",
			"Agentic AI",
			"MCP",
			"Gemini",
			"Digital Human",
			"Voice AI",
			"XTTS",
			"Wav2Lip",
			"SadTalker",
			"Quantization",
			"Low-Rank Adaptation",
		],
		keywords: [
			"llm",
			"agent",
			"agents",
			"generative",
			"multimodal",
			"inference",
			"chat",
			"retrieval",
			"voice",
			"digital human",
		],
		relatedProblems: ["research-automation", "healthcare", "security"],
		useCases: [
			{
				label: "Document intelligence",
				keywords: ["document", "ocr", "claim", "review"],
			},
			{
				label: "Research assistants",
				keywords: ["research", "assistant", "mentor"],
			},
			{
				label: "Multi-agent systems",
				keywords: ["agent", "agents", "mcp", "orchestration"],
			},
			{
				label: "Voice and digital humans",
				keywords: ["voice", "digital human", "xtts", "wav2lip", "sadtalker"],
			},
			{
				label: "Foundation model efficiency",
				keywords: ["llm inference", "quantization", "memory efficiency"],
			},
		],
	},
	{
		id: "logistics",
		label: "Logistics",
		description: "Routing, field operations and resource allocation workflows.",
		icon: "material-symbols:local-shipping-outline-rounded",
		tags: [
			"Logistics",
			"Optimization",
			"VRP",
			"Vehicle Routing",
			"OR-Tools",
			"PyVRP",
			"Route Optimization",
		],
		keywords: [
			"logistics",
			"routing",
			"route",
			"warehouse",
			"vehicle",
			"fleet",
			"dispatch",
			"field",
			"resource allocation",
		],
		relatedProblems: [
			"predictive-maintenance",
			"computer-vision",
			"generative-ai",
		],
		useCases: [
			{
				label: "Vehicle routing",
				keywords: ["vehicle routing", "vrp", "route"],
			},
			{
				label: "Route optimization",
				keywords: ["optimization", "route", "or-tools", "pyvrp"],
			},
			{
				label: "Field operations planning",
				keywords: ["field", "operations", "dispatch", "gis"],
			},
			{
				label: "Warehouse inventory counting",
				keywords: ["warehouse", "inventory", "counting"],
			},
		],
	},
	{
		id: "healthcare",
		label: "Healthcare",
		description: "Clinical, insurance and medical-document intelligence.",
		icon: "material-symbols:medical-services-outline-rounded",
		tags: [
			"Healthcare",
			"Medical AI",
			"Medical Insurance",
			"Claim Review",
			"Clinical Consistency",
		],
		keywords: [
			"medical",
			"healthcare",
			"clinical",
			"claim",
			"insurance",
			"patient",
			"diagnosis",
			"review",
		],
		relatedProblems: ["generative-ai", "computer-vision", "security"],
		useCases: [
			{
				label: "Medical claim review",
				keywords: ["medical", "claim", "insurance", "review"],
			},
			{
				label: "Clinical consistency checks",
				keywords: ["clinical", "consistency", "medical"],
			},
			{
				label: "Document OCR triage",
				keywords: ["ocr", "document", "claim"],
			},
			{
				label: "Duplicate detection",
				keywords: ["duplicate", "detection", "claim"],
			},
		],
	},
	{
		id: "security",
		label: "Security",
		description:
			"Security automation, identity, trust and privacy-preserving systems.",
		icon: "material-symbols:shield-outline-rounded",
		tags: [
			"Security",
			"DevSecOps",
			"Decentralized Identity",
			"Verifiable Credentials",
			"Zero-Knowledge Proofs",
			"Privacy-Preserving Identity",
			"Selective Disclosure",
			"BBS",
			"AnonCreds",
			"CAPS-ZK",
		],
		keywords: [
			"security",
			"identity",
			"credential",
			"credentials",
			"privacy",
			"proof",
			"devsecops",
			"policy",
			"trust",
			"disclosure",
		],
		relatedProblems: ["research-automation", "generative-ai", "healthcare"],
		useCases: [
			{
				label: "DevSecOps pipeline governance",
				keywords: ["devsecops", "pipeline", "security"],
			},
			{
				label: "Privacy-preserving identity",
				keywords: ["privacy", "identity", "credential"],
			},
			{
				label: "Credential disclosure decisions",
				keywords: ["disclosure", "bbs", "anoncreds", "credential"],
			},
			{
				label: "Policy-safe verification",
				keywords: ["policy", "verifier", "proof"],
			},
		],
	},
	{
		id: "research-automation",
		label: "Research Automation",
		description:
			"Research prototypes, benchmark workflows and reproducible studies.",
		icon: "material-symbols:biotech-outline-rounded",
		tags: [
			"Research Automation",
			"Research Prototype",
			"LLM Inference",
			"Quantization",
			"Low-Rank Adaptation",
			"Memory Efficiency",
			"Benchmarking",
			"Evaluation",
		],
		keywords: [
			"research",
			"benchmark",
			"experiment",
			"evaluation",
			"prototype",
			"reproducible",
			"framework",
			"paper",
			"study",
			"automation",
		],
		relatedProblems: ["generative-ai", "security", "logistics"],
		useCases: [
			{
				label: "Reproducible experiments",
				keywords: ["experiment", "benchmark", "reproducible"],
			},
			{
				label: "Research prototype review",
				keywords: ["research", "prototype", "framework"],
			},
			{
				label: "Model efficiency studies",
				keywords: ["quantization", "inference", "memory efficiency"],
			},
			{
				label: "Multi-agent orchestration",
				keywords: ["agent", "orchestration", "mcp"],
			},
		],
	},
];
