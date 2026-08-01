export function normalizeText(value) {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

export function escapeHTML(value) {
	return String(value || "").replace(/[&<>"']/g, (character) => {
		const entities = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		};
		return entities[character] || character;
	});
}

export function formatList(values) {
	const cleaned = values.filter(Boolean);
	if (cleaned.length === 0) return "shared project metadata";
	if (cleaned.length === 1) return cleaned[0];
	if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
	return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned.at(-1)}`;
}

export function clamp(value, minimum, maximum) {
	return Math.max(minimum, Math.min(maximum, value));
}

export function hashString(value) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function createDisplayTitle(title) {
	const compact = String(title || "")
		.replace(/\s+/g, " ")
		.replace(/\s*:\s*.*/, "")
		.replace(/\s+-\s+.*/, "")
		.trim();
	const words = compact.split(" ").filter(Boolean);
	return words.length <= 5 ? compact : words.slice(0, 5).join(" ");
}

export function splitLabelText(label, maximumLength = 19) {
	const words = String(label || "").split(" ").filter(Boolean);
	const lines = [];
	let current = "";
	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > maximumLength && current && lines.length < 1) {
			lines.push(current);
			current = word;
		} else {
			current = next;
		}
	}
	if (current) lines.push(current);
	return lines.slice(0, 2);
}

export function readExplorerUrlState() {
	const parameters = new URLSearchParams(window.location.search);
	const layout = parameters.get("layout");
	const clusterBy = parameters.get("clusterBy");
	return {
		layout: layout === "tree" ? "tree" : "cluster",
		clusterBy: [
			"impact-domain",
			"technology",
			"industry",
			"project-type",
		].includes(clusterBy)
			? clusterBy
			: "impact-domain",
		group: parameters.get("group") || "",
	};
}

export function updateExplorerUrl(state, push = false) {
	const url = new URL(window.location.href);
	url.searchParams.set("layout", state.layout);
	url.searchParams.set("clusterBy", state.clusterBy);
	if (state.selectedGroup) {
		url.searchParams.set("group", state.selectedGroup);
	} else {
		url.searchParams.delete("group");
	}
	const method = push ? "pushState" : "replaceState";
	window.history[method](
		{
			...(window.history.state || {}),
			impactExplorer: true,
		},
		"",
		url,
	);
}
