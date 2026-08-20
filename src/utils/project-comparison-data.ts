import type { CollectionEntry } from "astro:content";
import type { ProjectCapabilityMatrixData } from "./project-capability-matching";
import type {
	PortfolioAction,
	PortfolioKnowledgeIndex,
	PortfolioKnowledgeProject,
} from "./project-intelligence-index";
import { toFilterKey } from "./project-problem-matching";

export type ComparisonValueKind = "text" | "tags" | "link";

export interface ProjectComparisonValue {
	text: string;
	tags?: string[];
	link?: {
		label: string;
		url: string;
	};
}

export interface ProjectComparisonRow {
	id: string;
	label: string;
	kind: ComparisonValueKind;
}

export interface ProjectComparisonProject {
	id: string;
	title: string;
	url: string;
	description: string;
	category: string;
	actions: PortfolioAction[];
	values: Record<string, ProjectComparisonValue | null>;
}

export interface ProjectComparisonData {
	rows: ProjectComparisonRow[];
	projects: ProjectComparisonProject[];
}

type ExplicitComparisonMetadata = {
	project_type?: string;
	industry?: string;
	business_problem?: string;
	input?: string;
	output?: string;
	primary_capability?: string;
	technologies?: string[];
	model_or_algorithm?: string;
	dataset?: string;
	scale?: string;
	deployment_status?: string;
	deployment_environment?: string;
	infrastructure?: string;
	evaluation_metrics?: string;
	explainability?: string;
	human_in_the_loop?: string;
	limitations?: string;
	my_contribution?: string;
};

type ComparisonMetadata = CollectionEntry<"posts">["data"] & {
	comparison?: ExplicitComparisonMetadata;
};

export const projectComparisonRows: ProjectComparisonRow[] = [
	{ id: "project-type", label: "Project type", kind: "text" },
	{ id: "industry", label: "Industry", kind: "text" },
	{ id: "business-problem", label: "Business problem", kind: "text" },
	{ id: "input", label: "Input", kind: "text" },
	{ id: "output", label: "Output", kind: "text" },
	{ id: "primary-capability", label: "Primary capability", kind: "text" },
	{ id: "technologies", label: "Technologies", kind: "tags" },
	{ id: "model-algorithm", label: "Model or algorithm", kind: "text" },
	{ id: "dataset", label: "Dataset / Data Basis", kind: "text" },
	{ id: "scale", label: "Scale", kind: "text" },
	{ id: "deployment-status", label: "Deployment status", kind: "text" },
	{
		id: "deployment-environment",
		label: "Deployment environment",
		kind: "text",
	},
	{ id: "infrastructure", label: "Infrastructure", kind: "text" },
	{ id: "evaluation-metrics", label: "Evaluation metrics", kind: "text" },
	{ id: "explainability", label: "Explainability", kind: "text" },
	{ id: "human-in-loop", label: "Human-in-the-loop", kind: "text" },
	{ id: "architecture", label: "Architecture", kind: "link" },
	{ id: "github", label: "GitHub availability", kind: "link" },
	{ id: "demo", label: "Demo availability", kind: "link" },
	{ id: "paper", label: "Paper availability", kind: "link" },
	{ id: "documentation", label: "Documentation availability", kind: "link" },
	{ id: "limitations", label: "Limitations", kind: "text" },
	{ id: "my-contribution", label: "My contribution", kind: "text" },
];

function normalizeValue(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function uniqueValues(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const rawValue of values) {
		const value = String(rawValue || "").trim();
		const key = normalizeValue(value);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}
	return result;
}

function stripMarkdown(value: string): string {
	return value
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/:::[\w-]+(?:\{[^}]*\})?/g, " ")
		.replace(/::github\{[^}]*\}/g, " ")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/^#{1,6}\s+/gm, " ")
		.replace(/[\t|>*_`~{}[\]]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function compact(value: string, maxLength = 440): string {
	const normalized = stripMarkdown(value);
	if (normalized.length <= maxLength) return normalized;
	const truncated = normalized.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${truncated.slice(0, Math.max(lastSpace, maxLength - 70)).trim()}…`;
}

function normalizeKey(value: string): string {
	return normalizeValue(stripMarkdown(value))
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function parseTableMetadata(body: string): Map<string, string> {
	const metadata = new Map<string, string>();
	const lines = body.split(/\r?\n/);
	let activeKey = "";

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (line.startsWith("|")) {
			const cells = line
				.slice(1, line.endsWith("|") ? -1 : undefined)
				.split("|")
				.map((cell) => cell.trim());
			if (cells.length < 2) {
				activeKey = "";
				continue;
			}
			const key = normalizeKey(cells[0]);
			const value = compact(cells.slice(1).join(" | "));
			if (
				!key ||
				/^(attribute|area|property|field|item)$/.test(key) ||
				/^[-: ]+$/.test(cells[0]) ||
				/^[-: ]+$/.test(cells[1])
			) {
				activeKey = "";
				continue;
			}
			if (value) {
				metadata.set(
					key,
					uniqueValues([metadata.get(key) || "", value]).join("; "),
				);
				activeKey = key;
			}
			continue;
		}

		if (activeKey && line && !line.startsWith("#") && !line.startsWith("```")) {
			const previous = metadata.get(activeKey) || "";
			metadata.set(activeKey, compact(`${previous} ${line}`));
		} else if (!line || line.startsWith("#")) {
			activeKey = "";
		}
	}

	return metadata;
}

function getTableValue(metadata: Map<string, string>, keys: string[]): string {
	for (const key of keys) {
		const value = metadata.get(normalizeKey(key));
		if (value) return value;
	}
	return "";
}

function getTableValues(metadata: Map<string, string>, keys: string[]): string {
	return uniqueValues(
		keys.map((key) => metadata.get(normalizeKey(key)) || "").filter(Boolean),
	).join("; ");
}

function extractSection(body: string, headingPattern: RegExp): string {
	const lines = body.split(/\r?\n/);
	let collecting = false;
	const selected: string[] = [];

	for (const line of lines) {
		const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (heading) {
			if (collecting) break;
			if (headingPattern.test(stripMarkdown(heading[2]))) {
				collecting = true;
			}
			continue;
		}
		if (collecting) selected.push(line);
	}

	return compact(selected.join("\n"));
}

function extractSentence(body: string, pattern: RegExp): string {
	const plain = stripMarkdown(body);
	for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
		if (sentence.length >= 24 && pattern.test(sentence)) {
			return compact(sentence, 360);
		}
	}
	return "";
}

function textValue(value: string): ProjectComparisonValue | null {
	const text = compact(value);
	return text ? { text } : null;
}

function tagsValue(values: string[]): ProjectComparisonValue | null {
	const tags = uniqueValues(values);
	return tags.length > 0 ? { text: tags.join(", "), tags } : null;
}

function linkValue(label: string, url: string): ProjectComparisonValue | null {
	return url ? { text: "Available", link: { label, url } } : null;
}

function actionValue(
	actions: PortfolioAction[],
	kind: PortfolioAction["kind"],
): ProjectComparisonValue | null {
	const action = actions.find((item) => item.kind === kind);
	return action ? linkValue(action.label, action.url) : null;
}

function statusLabel(
	status: PortfolioKnowledgeProject["deployment"]["status"],
) {
	if (status === "unspecified") return "";
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function fieldStatusValue(
	status: "present" | "not_applicable" | "unknown" | undefined,
): ProjectComparisonValue | null {
	if (status === "not_applicable") return textValue("Not applicable");
	if (status === "unknown") return textValue("Genuinely unknown");
	return null;
}

function buildValues(
	entry: CollectionEntry<"posts">,
	project: PortfolioKnowledgeProject,
	capabilityData: ProjectCapabilityMatrixData,
): Record<string, ProjectComparisonValue | null> {
	const metadata = entry.data as ComparisonMetadata;
	const explicit: ExplicitComparisonMetadata = metadata.comparison || {};
	const body = entry.body || "";
	const table = parseTableMetadata(body);
	const matrixProject = capabilityData.projects.find(
		(item) => item.id === project.id,
	);
	const capabilityById = new Map(
		capabilityData.capabilities.map((capability) => [
			capability.id,
			capability,
		]),
	);
	const primaryCapability =
		explicit.primary_capability ||
		(matrixProject?.capabilityIds[0]
			? capabilityById.get(matrixProject.capabilityIds[0])?.label || ""
			: "");
	const businessProblem =
		explicit.business_problem ||
		getTableValue(table, ["problem-statement", "business problem"]) ||
		extractSection(body, /\bwhy this project exists\b/i);
	const input =
		explicit.input ||
		getTableValues(table, [
			"input",
			"primary inputs",
			"validation sources",
			"adaptive inputs",
		]);
	const output =
		explicit.output ||
		getTableValues(table, [
			"output",
			"main output",
			"document-processing output",
			"workflow output",
			"decision engine",
		]);
	const modelOrAlgorithm =
		explicit.model_or_algorithm ||
		entry.data.project_intelligence?.models_methods ||
		getTableValues(table, [
			"model",
			"model or algorithm",
			"key mechanism",
			"main mechanisms",
			"core selector",
			"decision engine",
			"planning layer",
			"execution layer",
		]);
	const dataset =
		explicit.dataset ||
		entry.data.project_intelligence?.data_basis ||
		getTableValues(table, [
			"dataset",
			"dataset structure",
			"data mode",
			"training data",
			"evaluation data",
		]) ||
		project.dataBasis;
	const deploymentEnvironment =
		explicit.deployment_environment ||
		getTableValues(table, [
			"deployment target",
			"deployment mode",
			"target setting",
		]) ||
		project.deployment.details;
	const infrastructure =
		explicit.infrastructure ||
		getTableValues(table, [
			"infrastructure",
			"backend",
			"frontend",
			"containerization layer",
			"data warehouse path",
		]);
	const explainability =
		explicit.explainability ||
		getTableValue(table, ["explainability", "explanation", "audit trail"]) ||
		extractSentence(
			body,
			/\b(explainab|evidence-grounded|reason code|audit trail|traceable decision|policy-safety explanation)\b/i,
		);
	const humanInLoop =
		explicit.human_in_the_loop ||
		getTableValues(table, ["human-in-the-loop", "safety boundary"]) ||
		extractSentence(
			body,
			/\b(human[- ]in[- ]the[- ]loop|human review|reviewer-supported|human approval|human validation)\b/i,
		);
	const limitations =
		explicit.limitations ||
		getTableValues(table, ["current limitations", "known limitations"]) ||
		extractSection(body, /\b(known|current)?\s*limitations?\b/i);
	const myContribution =
		explicit.my_contribution ||
		getTableValue(table, ["my contribution", "contribution"]) ||
		extractSection(body, /\bmy contribution\b/i);
	const metrics =
		explicit.evaluation_metrics ||
		entry.data.project_intelligence?.evaluation ||
		getTableValues(table, [
			"evaluation metrics",
			"performance",
			"performance snapshot",
			"benchmark results",
		]) ||
		project.resultsAndMetrics;
	const github = actionValue(project.actions, "github");
	const demo = actionValue(project.actions, "demo");
	const paper = actionValue(project.actions, "paper");
	const documentation = actionValue(project.actions, "docs");
	const fieldStatuses = entry.data.project_intelligence?.field_statuses;
	const architectureValue = project.architecture.available
		? linkValue("View architecture", project.architecture.url)
		: fieldStatuses?.architecture_preview === "documented"
			? textValue(entry.data.project_intelligence?.architecture_summary || "Architecture documented")
			: fieldStatusValue(fieldStatuses?.architecture_preview);

	return {
		"project-type": textValue(
			explicit.project_type ||
				getTableValue(table, ["project type"]) ||
				project.category,
		),
		industry: textValue(
			explicit.industry ||
				getTableValues(table, ["industry", "domain", "target setting"]),
		),
		"business-problem": textValue(businessProblem),
		input: textValue(input),
		output: textValue(output),
		"primary-capability": textValue(primaryCapability),
		technologies: tagsValue(
			explicit.technologies?.length
				? explicit.technologies
				: project.technologies,
		),
		"model-algorithm": textValue(modelOrAlgorithm),
		dataset: textValue(dataset),
		scale: textValue(
			explicit.scale ||
				entry.data.project_intelligence?.dataset_size ||
				getTableValues(table, ["scale", "repository scope", "dataset size"]),
		) || fieldStatusValue(fieldStatuses?.dataset_size),
		"deployment-status": textValue(
			explicit.deployment_status || statusLabel(project.deployment.status),
		),
		"deployment-environment": textValue(deploymentEnvironment),
		infrastructure: textValue(infrastructure),
		"evaluation-metrics":
			textValue(metrics) || fieldStatusValue(fieldStatuses?.evaluation),
		explainability: textValue(explainability),
		"human-in-loop": textValue(humanInLoop),
		architecture: architectureValue,
		github,
		demo: demo || fieldStatusValue(fieldStatuses?.live_demo),
		paper,
		documentation:
			documentation || fieldStatusValue(fieldStatuses?.documentation),
		limitations: textValue(limitations),
		"my-contribution": textValue(myContribution),
	};
}

export function buildProjectComparisonData(
	entries: CollectionEntry<"posts">[],
	knowledgeIndex: PortfolioKnowledgeIndex,
	capabilityData: ProjectCapabilityMatrixData,
): ProjectComparisonData {
	const entryById = new Map(
		entries
			.filter((entry) => entry.data.draft !== true)
			.map((entry) => [toFilterKey(entry.slug), entry]),
	);

	const projects = knowledgeIndex.projects
		.map((project) => {
			const entry = entryById.get(project.id);
			if (!entry) return null;
			return {
				id: project.id,
				title: project.title,
				url: project.url,
				description: project.description,
				category: project.category,
				actions: project.actions,
				values: buildValues(entry, project, capabilityData),
			} satisfies ProjectComparisonProject;
		})
		.filter((project): project is ProjectComparisonProject => project !== null);

	return {
		rows: projectComparisonRows,
		projects,
	};
}
