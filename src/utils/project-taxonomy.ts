const CANONICAL_TAXONOMY_LABELS: Record<string, string> = {
	genai: "Generative AI",
	"gen ai": "Generative AI",
	"low rank adapters": "Low-Rank Adaptation",
	"low rank adapter": "Low-Rank Adaptation",
	vrp: "Vehicle Routing",
	agents: "Agentic AI",
	"ai agent": "Agentic AI",
};

function taxonomyLookupKey(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ");
}

function filterKey(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Canonical labels remove display-only aliases without erasing meaningful
 * specializations. In particular, LLM Agents remains distinct from the
 * broader Agentic AI category.
 */
export function canonicalizeTaxonomyLabel(value: string): string {
	const raw = String(value || "").trim();
	if (!raw) return "";
	return CANONICAL_TAXONOMY_LABELS[taxonomyLookupKey(raw)] || raw;
}

export function canonicalizeTaxonomyValues(values: string[]): string[] {
	const seen = new Set<string>();
	const canonical: string[] = [];
	for (const value of values) {
		const label = canonicalizeTaxonomyLabel(value);
		const key = filterKey(label);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		canonical.push(label);
	}
	return canonical;
}

/** Keeps old alias-bearing filter URLs working while emitting canonical keys. */
export function canonicalTaxonomyFilterKey(value: string): string {
	return filterKey(canonicalizeTaxonomyLabel(value));
}
