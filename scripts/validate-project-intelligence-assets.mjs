import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve("public/project-intelligence");
const chunksPath = resolve(root, "project-chunks.json");
const metadataPath = resolve(root, "project-vector-metadata.json");
const vectorsPath = resolve(root, "project-vectors.bin");
const postsRoot = resolve("src/content/posts");

const [chunks, metadata, vectorStats] = await Promise.all([
	readFile(chunksPath, "utf8").then(JSON.parse),
	readFile(metadataPath, "utf8").then(JSON.parse),
	stat(vectorsPath),
]);

const fail = (message) => {
	throw new Error(`Invalid browser RAG assets: ${message}`);
};

const unquote = (value) =>
	String(value || "")
		.trim()
		.replace(/^(["'])(.*)\1$/, "$2");

const normalizeIndexedText = (value) =>
	String(value || "")
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.replace(/\s+/g, " ")
		.trim();

function isTechnologyLabel(value) {
	const label = String(value || "").trim();
	return (
		label.length > 0 &&
		label.length <= 64 &&
		label.split(/\s+/).length <= 8 &&
		!/[\r\n]/.test(label)
	);
}

function parseAuditFrontmatter(raw, file) {
	const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
	if (!match) throw new Error(`Missing frontmatter: ${file}`);
	const metadata = {};
	const intelligence = {};
	const fieldStatuses = {};
	let section = "";
	let subsection = "";

	for (const line of match[1].split(/\r?\n/)) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		const parsed = line.match(/^(\s*)([A-Za-z0-9_]+):(?:\s*(.*))?$/);
		if (!parsed) continue;
		const indent = parsed[1].length;
		const key = parsed[2];
		const value = unquote(parsed[3]);
		if (indent === 0) {
			section = value ? "" : key;
			subsection = "";
			metadata[key] = value;
		} else if (indent === 2 && section === "project_intelligence") {
			subsection = value ? "" : key;
			intelligence[key] = value;
		} else if (
			indent === 4 &&
			section === "project_intelligence" &&
			subsection === "field_statuses"
		) {
			fieldStatuses[key] = value;
		}
	}

	return {
		file,
		raw,
		body: raw.slice(match[0].length),
		metadata,
		intelligence,
		fieldStatuses,
	};
}

async function walkMarkdown(directory) {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await walkMarkdown(path)));
		else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) files.push(path);
	}
	return files;
}

function isPublishedProject(project) {
	if (project.metadata.draft === "true") return false;
	const published = new Date(project.metadata.published);
	return (
		Number.isFinite(published.getTime()) && published.getTime() <= Date.now()
	);
}

function hasArchitectureSource(project) {
	return (
		/^architecture:\s*$/m.test(project.raw) ||
		/!\[[^\]]*(?:architecture|diagram|flow|pipeline|system)[^\]]*\]\([^)]+\)/i.test(
			project.body,
		) ||
		/```mermaid|\bflowchart\s+(?:TD|LR|TB|RL)|^##\s+.*architecture/im.test(
			project.body,
		)
	);
}

function hasEvaluationSource(project) {
	return /^#{2,3}\s+.*(?:results?|evaluation|performance|experiment protocol|training setup|testing strategy|benchmark)/im.test(
		project.body,
	);
}

function auditStatus(value) {
	if (value === "present") return "OK";
	if (value === "not_applicable") return "N/A";
	if (value === "documented") return "DOCUMENTED";
	return "UNKNOWN";
}

function compactTitle(title) {
	const value = String(title || "Untitled")
		.split(":")[0]
		.trim();
	return value.length <= 28 ? value : `${value.slice(0, 27)}…`;
}

const sourceFiles = (await walkMarkdown(postsRoot)).sort((left, right) => {
	const leftKey = left.replaceAll("\\", "/").toLowerCase();
	const rightKey = right.replaceAll("\\", "/").toLowerCase();
	return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
});
const allProjects = await Promise.all(
	sourceFiles.map(async (file) =>
		parseAuditFrontmatter(await readFile(file, "utf8"), file),
	),
);
const projects = allProjects.filter(isPublishedProject);
const auditErrors = [];
const notApplicable = [];
const genuinelyUnknown = [];

for (const project of projects) {
	const { metadata, intelligence, fieldStatuses, body } = project;
	const label = metadata.title || relative(postsRoot, project.file);
	for (const key of [
		"data_basis",
		"models_methods",
		"architecture_summary",
		"evaluation",
		"key_results",
		"deployment_summary",
		"why_it_matters",
	]) {
		if (!intelligence[key])
			auditErrors.push(`${label}: missing project_intelligence.${key}`);
	}
	for (const key of [
		"dataset_size",
		"evaluation",
		"live_demo",
		"video",
		"documentation",
		"architecture_preview",
	]) {
		const status = fieldStatuses[key];
		if (!status) auditErrors.push(`${label}: missing field status ${key}`);
		const allowedStatuses =
			key === "architecture_preview"
				? ["present", "documented", "not_applicable", "unknown"]
				: ["present", "not_applicable", "unknown"];
		if (status && !allowedStatuses.includes(status)) {
			auditErrors.push(`${label}: invalid field status ${key}=${status}`);
		}
		if (status === "not_applicable") notApplicable.push(`${label} — ${key}`);
		if (status === "unknown") genuinelyUnknown.push(`${label} — ${key}`);
	}
	if (fieldStatuses.dataset_size === "present" && !intelligence.dataset_size) {
		auditErrors.push(
			`${label}: dataset_size is present but its value is empty`,
		);
	}
	if (
		["not_applicable", "unknown"].includes(fieldStatuses.dataset_size) &&
		intelligence.dataset_size
	) {
		auditErrors.push(
			`${label}: dataset_size must be empty when its status is ${fieldStatuses.dataset_size}`,
		);
	}
	if (
		hasArchitectureSource(project) &&
		fieldStatuses.architecture_preview === "unknown"
	) {
		auditErrors.push(
			`${label}: architecture exists in source but preview status is unknown`,
		);
	}
	if (
		fieldStatuses.architecture_preview === "present" &&
		!hasArchitectureSource(project)
	) {
		auditErrors.push(
			`${label}: architecture preview is present but no source asset/diagram was found`,
		);
	}
	if (hasEvaluationSource(project) && fieldStatuses.evaluation === "unknown") {
		auditErrors.push(
			`${label}: evaluation evidence exists in source but metadata says unknown`,
		);
	}
	for (const [statusKey, urlKey] of [
		["live_demo", "demo_url"],
		["video", "video_url"],
		["documentation", "documentation_url"],
	]) {
		const hasUrl = Boolean(metadata[urlKey]);
		if (fieldStatuses[statusKey] === "present" && !hasUrl) {
			auditErrors.push(
				`${label}: ${statusKey} is present but ${urlKey} is empty`,
			);
		}
		if (hasUrl && fieldStatuses[statusKey] !== "present") {
			auditErrors.push(
				`${label}: ${urlKey} exists but ${statusKey} is not present`,
			);
		}
	}
	if (!metadata.github_url) auditErrors.push(`${label}: github_url is empty`);
	if (
		/Architecture preview not added|Dataset details are not published/i.test(
			body,
		)
	) {
		auditErrors.push(
			`${label}: source contains a false-missing fallback phrase`,
		);
	}
}

console.log("Project | Data | Architecture | Metrics | Demo | GitHub | Docs");
console.log("--- | --- | --- | --- | --- | --- | ---");
for (const project of projects) {
	const { metadata, intelligence, fieldStatuses } = project;
	console.log(
		[
			compactTitle(metadata.title),
			intelligence.data_basis ? "OK" : "MISSING",
			auditStatus(fieldStatuses.architecture_preview),
			auditStatus(fieldStatuses.evaluation),
			auditStatus(fieldStatuses.live_demo),
			metadata.github_url ? "OK" : "MISSING",
			auditStatus(fieldStatuses.documentation),
		].join(" | "),
	);
}
console.log(
	`Structured coverage: ${projects.filter((project) => project.intelligence.data_basis).length} data-basis, ${projects.filter((project) => ["present", "documented"].includes(project.fieldStatuses.architecture_preview)).length} architecture, ${projects.filter((project) => project.fieldStatuses.evaluation === "present").length} evaluation fields.`,
);
console.log(
	`NOT_APPLICABLE (${notApplicable.length}): ${notApplicable.join("; ") || "none"}`,
);
console.log(
	`GENUINELY_UNKNOWN (${genuinelyUnknown.length}): ${genuinelyUnknown.join("; ") || "none"}`,
);
if (auditErrors.length) {
	throw new Error(
		`Project-intelligence metadata audit failed:\n- ${auditErrors.join("\n- ")}`,
	);
}

const indexedProjects = Array.isArray(chunks.projects) ? chunks.projects : [];
if (indexedProjects.length !== projects.length) {
	fail(
		`project count mismatch between sources (${projects.length}) and browser assets (${indexedProjects.length})`,
	);
}
const indexedProjectsByTitle = new Map(
	indexedProjects.map((project) => [String(project.title || ""), project]),
);
for (const project of projects) {
	const title = project.metadata.title;
	const indexed = indexedProjectsByTitle.get(title);
	if (!indexed) fail(`missing indexed project: ${title}`);

	for (const key of [
		"data_basis",
		"dataset_size",
		"models_methods",
		"architecture_summary",
		"evaluation",
		"key_results",
		"why_it_matters",
	]) {
		if (
			normalizeIndexedText(indexed[key]) !==
			normalizeIndexedText(project.intelligence[key])
		) {
			fail(`${title}: indexed ${key} does not match project frontmatter`);
		}
	}

	for (const [key, status] of Object.entries(project.fieldStatuses)) {
		if (indexed.field_statuses?.[key] !== status) {
			fail(`${title}: indexed field status ${key} does not match ${status}`);
		}
	}

	if (!Array.isArray(indexed.technologies)) {
		fail(`${title}: indexed technologies must be an array`);
	}
	for (const technology of indexed.technologies) {
		if (!isTechnologyLabel(technology)) {
			fail(
				`${title}: technology value is prose rather than a label: ${technology}`,
			);
		}
		if (
			normalizeIndexedText(technology) ===
			normalizeIndexedText(project.intelligence.models_methods)
		) {
			fail(`${title}: models_methods leaked into technologies`);
		}
	}
}

if (metadata.model !== "BAAI/bge-small-en-v1.5")
	fail("unexpected source model");
if (metadata.browser_model !== "Xenova/bge-small-en-v1.5") {
	fail("unexpected browser model");
}
if (metadata.dimensions !== 384 || metadata.dtype !== "float32-le") {
	fail("unexpected vector format");
}
if (!metadata.normalized || metadata.pooling !== "cls") {
	fail("embedding normalization or pooling mismatch");
}
if (chunks.chunks.length !== metadata.count) fail("chunk count mismatch");
if (metadata.chunks.length !== metadata.count) fail("position count mismatch");
if (vectorStats.size !== metadata.count * metadata.dimensions * 4) {
	fail("binary vector byte size mismatch");
}
if (chunks.index.content_hash !== metadata.content_hash)
	fail("content hash mismatch");

const sourceHash = createHash("sha256");
for (const project of projects) {
	sourceHash.update(relative(postsRoot, project.file).replace(/\\/g, "/"));
	sourceHash.update("\0");
	// Path.read_text(), used by the Python indexer, applies universal-newline
	// normalization before hashing. Mirror that behavior on Windows.
	sourceHash.update(project.raw.replace(/\r\n?/g, "\n"));
	sourceHash.update("\0");
}
const currentSourceHash = sourceHash.digest("hex");
if (chunks.index.content_hash !== currentSourceHash) {
	fail(
		`browser RAG assets are stale relative to published project sources (asset ${chunks.index.content_hash}, source ${currentSourceHash})`,
	);
}

for (let index = 0; index < metadata.count; index += 1) {
	const chunk = chunks.chunks[index];
	const position = metadata.chunks[index];
	if (position.index !== index || position.chunk_id !== chunk.chunk_id) {
		fail(`chunk order mismatch at row ${index}`);
	}
	if (!String(chunk.url || "").startsWith("/projects/posts/")) {
		fail(`untrusted project URL at row ${index}`);
	}
}

const serialized = JSON.stringify({ chunks, metadata });
for (const forbidden of [
	"PUBLIC_PROJECT_AI_API_URL",
	"PROJECT_AI_OLLAMA_URL",
	"C:\\\\Users\\",
	"/home/",
	"/mnt/",
]) {
	if (serialized.includes(forbidden))
		fail(`private value ${forbidden} is exposed`);
}

console.log(
	`Validated browser RAG assets: ${chunks.index.project_count} projects, ${metadata.count} chunks, ${metadata.dimensions} dimensions, ${vectorStats.size} vector bytes.`,
);
