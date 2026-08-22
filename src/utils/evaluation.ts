import type { CollectionEntry } from "astro:content";

export type ProjectEvaluation = NonNullable<
	CollectionEntry<"posts">["data"]["evaluation"]
>;

const SCOPE_LABELS: Record<ProjectEvaluation["scope"], string> = {
	benchmark: "Benchmark",
	"held-out-test": "Held-out Test Set",
	"synthetic-evaluation": "Synthetic Evaluation",
	"controlled-evaluation": "Controlled Evaluation",
	"internal-benchmark": "Internal Benchmark",
	"validation-set": "Validation Set",
	production: "Production",
};

export function formatEvaluationScope(
	scope: ProjectEvaluation["scope"],
): string {
	return SCOPE_LABELS[scope];
}

export function resolveEvaluationSource(
	source: string | undefined,
	projectUrl: string,
): string {
	if (!source) return "";
	return source.startsWith("#") ? `${projectUrl}${source}` : source;
}
