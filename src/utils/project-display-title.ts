const DISPLAY_TITLE_ALIASES: Array<{ pattern: RegExp; title: string }> = [
	{ pattern: /^DACR-Q\b/i, title: "DACR-Q" },
	{ pattern: /^Vehicle-Scale LLMs\b/i, title: "Vehicle-Scale LLMs" },
	{
		pattern: /^Autonomous Microservice Composition\b/i,
		title: "Autonomous Microservice Composition",
	},
	{ pattern: /^MCP 2\.0\b/i, title: "MCP 2.0" },
];

function compactDisplayTitle(value: string): string {
	const explicitAlias = DISPLAY_TITLE_ALIASES.find(({ pattern }) =>
		pattern.test(value.trim()),
	)?.title;
	if (explicitAlias) return explicitAlias;
	let compact = value
		.replace(/\bProfit and Loss\b/gi, "P&L")
		.replace(/\bArtificial Intelligence\b/gi, "AI")
		.replace(/\bLarge Language Models?\b/gi, "LLMs")
		.trim();
	const aiPowered = compact.match(/^AI[- ]Powered\s+(.+)$/i)?.[1]?.trim();
	if (aiPowered) compact = `${aiPowered} AI`;
	return compact;
}

export function resolveProjectDisplayTitle(
	fullTitle: string,
	explicitCardTitle = "",
): { displayTitle: string; hasDisplayTitle: boolean } {
	const title = fullTitle.trim();
	const explicit = explicitCardTitle.trim();
	const titledProjectName = title.match(/^([^:]{2,80}):\s+/)?.[1]?.trim();
	const displayTitle = compactDisplayTitle(
		explicit || titledProjectName || title,
	);
	return {
		displayTitle,
		hasDisplayTitle: Boolean(
			explicit || titledProjectName || displayTitle !== title,
		),
	};
}
