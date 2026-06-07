import { existsSync } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import { chromium } from "playwright";

const rootDir = process.cwd();
const postsRoot = path.join(rootDir, "src", "content", "posts");
const outputDir = path.join(rootDir, "public", "downloads");

const projects = [
	{
		slug: "aegisflow-devsecops-pipeline-orchestrator-agent",
		output: "aegisflow-project-details.pdf",
	},
	{
		slug: "predictive-preventive-maintenance-generator",
		output: "predictive-preventive-maintenance-generator-project-details.pdf",
	},
	{
		slug: "execution-aware-agentic-vrp",
		output: "execution-aware-agentic-vrp-project-details.pdf",
	},
];

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
});

function stripQuotes(value) {
	return String(value || "")
		.trim()
		.replace(/^["']|["']$/g, "");
}

function parseArray(value) {
	const raw = String(value || "").trim();
	if (!raw.startsWith("[") || !raw.endsWith("]")) return [];
	return raw
		.slice(1, -1)
		.split(",")
		.map((item) => stripQuotes(item))
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseFrontmatter(markdownText) {
	const match = markdownText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { frontmatter: {}, body: markdownText };
	}

	const frontmatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const colonIndex = trimmed.indexOf(":");
		if (colonIndex < 0) continue;
		const key = trimmed.slice(0, colonIndex).trim();
		const rawValue = trimmed.slice(colonIndex + 1).trim();
		if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
			frontmatter[key] = parseArray(rawValue);
		} else if (/^(true|false)$/i.test(rawValue)) {
			frontmatter[key] = rawValue.toLowerCase() === "true";
		} else {
			frontmatter[key] = stripQuotes(rawValue);
		}
	}

	return {
		frontmatter,
		body: markdownText.slice(match[0].length),
	};
}

async function walkMarkdownFiles(dir) {
	const files = [];

	async function visit(currentDir) {
		for (const entry of await readdir(currentDir, { withFileTypes: true })) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				await visit(fullPath);
			} else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
				files.push(fullPath);
			}
		}
	}

	await visit(dir);
	return files;
}

async function findPostFile(slug) {
	const files = await walkMarkdownFiles(postsRoot);
	const normalizedSlug = slug.toLowerCase();
	return files.find((file) => {
		const relative = path.relative(postsRoot, file).replace(/\\/g, "/").toLowerCase();
		const base = path.basename(file, path.extname(file)).toLowerCase();
		return relative.includes(`/${normalizedSlug}/`) || base === normalizedSlug;
	});
}

function extractImageRefs(markdownText) {
	const refs = new Set();
	for (const match of markdownText.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)) {
		const ref = String(match[1] || "").trim();
		if (ref) refs.add(ref);
	}
	return [...refs];
}

function extractInlineUrls(markdownText) {
	const urls = new Set();
	for (const match of markdownText.matchAll(/https?:\/\/[^\s<>)"]+/g)) {
		urls.add(match[0].replace(/[)\].,;]+$/g, ""));
	}
	return [...urls];
}

function normalizePathSegments(value) {
	return String(value || "")
		.replace(/\\/g, "/")
		.replace(/^\.\/+/, "")
		.replace(/^\/+/, "");
}

function mimeTypeFor(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".png") return "image/png";
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".webp") return "image/webp";
	if (ext === ".gif") return "image/gif";
	if (ext === ".svg") return "image/svg+xml";
	return "application/octet-stream";
}

async function loadDataUrl(filePath) {
	const fileBuffer = await readFile(filePath);
	return `data:${mimeTypeFor(filePath)};base64,${fileBuffer.toString("base64")}`;
}

async function buildAssetMap(postFile, body, frontmatter) {
	const assets = new Map();
	const postDir = path.dirname(postFile);
	const refs = new Set([
		...extractImageRefs(body),
		...(frontmatter.image ? [frontmatter.image] : []),
	]);

	for (const ref of refs) {
		const normalized = normalizePathSegments(ref);
		if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith("data:")) continue;
		const resolved = path.resolve(postDir, normalized);
		if (existsSync(resolved)) {
			assets.set(ref, await loadDataUrl(resolved));
		}
	}

	return assets;
}

function preprocessMarkdown(body, frontmatter) {
	let content = String(body || "");

	content = content.replace(/::github\{repo="([^"]+)"\}/g, (_match, repo) => {
		const repoUrl = `https://github.com/${repo}`;
		return `\n\n**GitHub Repository:** [${repo}](${repoUrl})\n\n`;
	});

	content = content.replace(
		/<iframe[\s\S]*?src="([^"]+)"[\s\S]*?<\/iframe>/gi,
		(_match, src) => `\n\n**Embedded media:** [Open video](${src})\n\n`,
	);

	const lines = content.split(/\r?\n/);
	const output = [];

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		const openMatch = line.trim().match(/^:::(note|important|tip|warning|caution)\s*$/i);
		if (!openMatch) {
			output.push(line);
			continue;
		}

		const label = openMatch[1].charAt(0).toUpperCase() + openMatch[1].slice(1);
		const blockLines = [];
		i += 1;
		while (i < lines.length && lines[i].trim() !== ":::") {
			blockLines.push(lines[i]);
			i += 1;
		}

		output.push(`> **${label}**`);
		for (const blockLine of blockLines) {
			output.push(blockLine.trim() ? `> ${blockLine}` : ">");
		}
		output.push("");
	}

	return output.join("\n");
}

function collectProjectLinks(markdownText, frontmatter) {
	const links = new Map();

	const addLink = (label, href) => {
		const url = String(href || "").trim();
		if (!url || links.has(url)) return;
		links.set(url, { label, href: url });
	};

	addLink("GitHub Repository", frontmatter.github || frontmatter.repo || "");

	if (frontmatter.title) {
		const slug = String(frontmatter.title).toLowerCase();
		void slug;
	}

	for (const url of extractInlineUrls(markdownText)) {
		if (/huggingface\.co\/spaces/i.test(url)) addLink("Hugging Face Space", url);
		else if (/youtube\.com|youtu\.be/i.test(url)) addLink("Demo Video", url);
		else if (/github\.com/i.test(url)) addLink("GitHub Link", url);
		else addLink("Project Link", url);
	}

	for (const match of markdownText.matchAll(/::github\{repo="([^"]+)"\}/g)) {
		const repo = String(match[1] || "").trim();
		if (repo) addLink("GitHub Repository", `https://github.com/${repo}`);
	}

	if (typeof frontmatter.repo === "string" && frontmatter.repo) {
		addLink("GitHub Repository", `https://github.com/${frontmatter.repo}`);
	}

	return [...links.values()];
}

function shortText(markdownText, maxChars = 260) {
	return String(markdownText || "")
		.replace(/^---[\s\S]*?---/m, "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/::[\w-]+(?:\{[^}]*\})?/g, " ")
		.replace(/[*_`>#|-]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxChars)
		.replace(/\s+\S*$/, "");
}

function renderMarkdownWithAssets(body, assetMap) {
	const html = markdown.render(body);
	return html.replace(/<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, before, src, after) => {
		const mapped = assetMap.get(src) || assetMap.get(normalizePathSegments(src));
		if (!mapped) return match;
		return `<img ${before}src="${mapped}"${after}>`;
	});
}

function pageHtml({
	title,
	published,
	category,
	description,
	coverImage,
	tags,
	projectLinks,
	bodyHtml,
	summaryText,
	sourcePath,
}) {
	const tagMarkup = tags.length
		? tags
				.map(
					(tag) =>
						`<span class="tag">${escapeHtml(tag)}</span>`,
				)
				.join("")
		: `<span class="muted">No tags</span>`;

	const linksMarkup = projectLinks.length
		? projectLinks
				.map(
					(link) =>
						`<a class="link-chip" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`,
				)
				.join("")
		: `<span class="muted">No external links listed.</span>`;

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${escapeHtml(title)} PDF</title>
	<style>
		:root {
			color-scheme: light;
			--bg: #f7fafc;
			--panel: rgba(255, 255, 255, 0.94);
			--panel-border: rgba(148, 163, 184, 0.22);
			--text: #0f172a;
			--muted: #475569;
			--accent: #2563eb;
			--accent-soft: rgba(37, 99, 235, 0.1);
			--shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			background:
				radial-gradient(circle at top left, rgba(191, 219, 254, 0.45), transparent 34%),
				radial-gradient(circle at top right, rgba(224, 231, 255, 0.5), transparent 28%),
				linear-gradient(180deg, #fbfdff 0%, #f3f7fb 100%);
			color: var(--text);
		}
		main {
			max-width: 980px;
			margin: 0 auto;
			padding: 28px;
		}
		.hero, .section {
			background: var(--panel);
			border: 1px solid var(--panel-border);
			border-radius: 24px;
			box-shadow: var(--shadow);
			backdrop-filter: blur(16px);
		}
		.hero {
			padding: 26px;
			display: grid;
			grid-template-columns: minmax(0, 1.18fr) minmax(260px, 0.82fr);
			gap: 22px;
			align-items: start;
			overflow: hidden;
		}
		.hero-copy h1 {
			margin: 0 0 12px;
			font-size: 30px;
			line-height: 1.15;
			letter-spacing: -0.02em;
		}
		.meta-row {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			margin-bottom: 16px;
		}
		.chip, .tag, .link-chip {
			display: inline-flex;
			align-items: center;
			border-radius: 999px;
			padding: 7px 11px;
			font-size: 12px;
			line-height: 1;
			font-weight: 600;
		}
		.chip {
			background: var(--accent-soft);
			color: #1d4ed8;
			border: 1px solid rgba(37, 99, 235, 0.14);
		}
		.cover {
			border-radius: 18px;
			overflow: hidden;
			border: 1px solid rgba(148, 163, 184, 0.18);
			background: #fff;
		}
		.cover img {
			display: block;
			width: 100%;
			height: auto;
		}
		.lead {
			font-size: 15px;
			line-height: 1.75;
			color: var(--muted);
			margin: 0;
		}
		.section {
			margin-top: 18px;
			padding: 22px 26px;
		}
		.section h2 {
			margin: 0 0 12px;
			font-size: 18px;
		}
		.content {
			font-size: 14px;
			line-height: 1.72;
			color: #0f172a;
		}
		.content h2, .content h3, .content h4 {
			margin: 1.4em 0 0.55em;
			line-height: 1.2;
		}
		.content p { margin: 0 0 1em; }
		.content blockquote {
			margin: 1em 0;
			padding: 14px 16px;
			border-left: 4px solid rgba(37, 99, 235, 0.4);
			background: rgba(37, 99, 235, 0.05);
			border-radius: 12px;
		}
		.content table {
			width: 100%;
			border-collapse: collapse;
			margin: 1em 0;
			font-size: 13px;
		}
		.content th, .content td {
			border: 1px solid rgba(148, 163, 184, 0.24);
			padding: 8px 10px;
			vertical-align: top;
		}
		.content th {
			background: rgba(15, 23, 42, 0.03);
			text-align: left;
		}
		.content pre {
			white-space: pre-wrap;
			word-break: break-word;
			background: #0f172a;
			color: #e2e8f0;
			padding: 14px 16px;
			border-radius: 14px;
			overflow: hidden;
			font-size: 12px;
		}
		.content code {
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
			font-size: 0.92em;
		}
		.content img {
			max-width: 100%;
			border-radius: 14px;
			margin: 10px 0;
		}
		.tag-list, .link-list {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}
		.tag {
			background: rgba(15, 23, 42, 0.05);
			border: 1px solid rgba(148, 163, 184, 0.18);
			color: #334155;
		}
		.link-chip {
			background: rgba(37, 99, 235, 0.08);
			border: 1px solid rgba(37, 99, 235, 0.16);
			color: #1d4ed8;
			text-decoration: none;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 18px;
		}
		.kv {
			padding: 16px 18px;
			background: rgba(15, 23, 42, 0.03);
			border: 1px solid rgba(148, 163, 184, 0.18);
			border-radius: 16px;
		}
		.kv .label {
			font-size: 12px;
			color: var(--muted);
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			margin-bottom: 6px;
		}
		.kv .value {
			font-size: 14px;
			color: var(--text);
			line-height: 1.6;
		}
		.muted {
			color: var(--muted);
			font-size: 13px;
		}
		.footer {
			margin-top: 18px;
			color: var(--muted);
			font-size: 11px;
			text-align: right;
		}
		@media print {
			body { background: white; }
			main { padding: 0; max-width: none; }
			.hero, .section {
				box-shadow: none;
				backdrop-filter: none;
			}
		}
		@page {
			size: A4;
			margin: 16mm;
		}
	</style>
</head>
<body>
	<main>
		<section class="hero">
			<div class="hero-copy">
				<div class="meta-row">
					<span class="chip">${escapeHtml(category || "Project")}</span>
					<span class="chip">${escapeHtml(published)}</span>
				</div>
				<h1>${escapeHtml(title)}</h1>
				<p class="lead">${escapeHtml(description || "Project details and supporting material.")}</p>
			</div>
			<div class="cover">
				${coverImage ? `<img src="${escapeHtml(coverImage)}" alt="${escapeHtml(title)} cover image" />` : `<div style="padding:24px 18px; color:#64748b;">No cover image available.</div>`}
			</div>
		</section>

		<section class="section">
			<h2>Project Snapshot</h2>
			<div class="grid">
				<div class="kv">
					<div class="label">Date</div>
					<div class="value">${escapeHtml(published)}</div>
				</div>
				<div class="kv">
					<div class="label">Category</div>
					<div class="value">${escapeHtml(category || "Uncategorized")}</div>
				</div>
				<div class="kv" style="grid-column: 1 / -1;">
					<div class="label">Short Description</div>
					<div class="value">${escapeHtml(description || shortText(summaryText, 260) || "No description available.")}</div>
				</div>
				<div class="kv" style="grid-column: 1 / -1;">
					<div class="label">Tags / Tech Stack</div>
					<div class="tag-list">${tagMarkup}</div>
				</div>
			</div>
		</section>

		<section class="section">
			<h2>Project Links</h2>
			<div class="link-list">${linksMarkup}</div>
		</section>

		<section class="section">
			<h2>Full Project Content</h2>
			<div class="content">
				${bodyHtml}
			</div>
		</section>

		<div class="footer">Source: ${escapeHtml(sourcePath)}</div>
	</main>
</body>
</html>`;
}

function escapeHtml(value) {
	return String(value || "").replace(/[&<>"']/g, (char) => {
		const entities = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		};
		return entities[char] || char;
	});
}

async function renderProjectPdf(project) {
	const postFile = await findPostFile(project.slug);
	if (!postFile) {
		throw new Error(`Could not locate markdown source for ${project.slug}`);
	}

	const rawMarkdown = await readFile(postFile, "utf8");
	const { frontmatter, body } = parseFrontmatter(rawMarkdown);
	const published = frontmatter.published ? String(frontmatter.published) : "";
	const title = frontmatter.title || project.slug;
	const category = frontmatter.category || "";
	const description = frontmatter.description || "";
	const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
	const assetMap = await buildAssetMap(postFile, body, frontmatter);
	const processedBody = preprocessMarkdown(body, frontmatter);
	const bodyHtml = renderMarkdownWithAssets(processedBody, assetMap);
	const coverCandidates = [
		frontmatter.image,
		"cover.png",
		"cover.jpg",
		"cover.jpeg",
		"cover.webp",
		...extractImageRefs(body),
	].filter(Boolean);

	let coverImage = "";
	for (const candidate of coverCandidates) {
		const normalized = normalizePathSegments(candidate);
		if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith("data:")) continue;
		const resolved = path.resolve(path.dirname(postFile), normalized);
		if (existsSync(resolved)) {
			coverImage = await loadDataUrl(resolved);
			break;
		}
	}

	const projectLinks = collectProjectLinks(body, frontmatter);
	const html = pageHtml({
		title,
		published,
		category,
		description,
		coverImage,
		tags,
		projectLinks,
		bodyHtml,
		summaryText: processedBody,
		sourcePath: path.relative(rootDir, postFile).replace(/\\/g, "/"),
	});

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({
		deviceScaleFactor: 1,
		viewport: { width: 1400, height: 2400 },
	});

	await page.setContent(html, { waitUntil: "load" });
	await page.evaluate(async () => {
		if (document.fonts?.ready) {
			await document.fonts.ready;
		}
	});

	const outputPath = path.join(outputDir, project.output);
	await page.pdf({
		path: outputPath,
		format: "A4",
		printBackground: true,
		preferCSSPageSize: true,
		margin: {
			top: "0",
			right: "0",
			bottom: "0",
			left: "0",
		},
	});

	await browser.close();
	console.log(`Wrote ${path.relative(rootDir, outputPath).replace(/\\/g, "/")}`);
}

async function main() {
	await mkdir(outputDir, { recursive: true });
	for (const project of projects) {
		await renderProjectPdf(project);
	}
	console.log(`Generated ${projects.length} project PDFs.`);
}

await main();
