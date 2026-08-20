import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.PORTFOLIO_QA_URL || "http://127.0.0.1:4321/projects/";
const qaScope = process.argv[2] || "all";
const outputDir = path.join(os.tmpdir(), "portfolio-premium-ui-qa");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

function record(name, details = "pass") {
	results.push({ name, details });
}

async function createPage(viewport, theme = "light") {
	const context = await browser.newContext({ viewport });
	await context.addInitScript((selectedTheme) => {
		localStorage.setItem("theme", selectedTheme);
	}, theme);
	const page = await context.newPage();
	return { context, page };
}

async function assertNoPageOverflow(page, label) {
	const dimensions = await page.evaluate(() => ({
		clientWidth: document.documentElement.clientWidth,
		scrollWidth: document.documentElement.scrollWidth,
	}));
	assert.ok(
		dimensions.scrollWidth <= dimensions.clientWidth + 1,
		`${label} overflowed horizontally: ${JSON.stringify(dimensions)}`,
	);
	record(`${label}: no horizontal overflow`, dimensions);
}

async function openProjects(page) {
	await page.goto(`${baseUrl}?view=projects`, { waitUntil: "domcontentloaded" });
	await page.locator("[data-project-discovery]").waitFor();
	await page.locator("[data-project-card]").first().waitFor();
}

try {
	if (qaScope !== "impact") {
	const { context: desktopContext, page: desktop } = await createPage(
		{ width: 1440, height: 1100 },
		"light",
	);
	await openProjects(desktop);

	assert.equal(await desktop.locator(".project-collection-intro").isVisible(), true);
	assert.equal(await desktop.getByRole("tab", { name: "Browse Projects" }).isVisible(), true);
	assert.equal(await desktop.getByRole("tab", { name: "Choose a Problem" }).isVisible(), true);
	assert.equal(await desktop.locator(".project-core-filters select").count(), 5);
	assert.equal(await desktop.locator(".project-capability-scroll button").count() > 0, true);
	assert.equal(await desktop.locator("#categories").isVisible(), true);
	assert.equal(await desktop.locator("#tags").isVisible(), true);
	assert.equal(await desktop.locator("[data-project-card]").count(), 17);
	assert.equal(await desktop.locator("[data-project-empty]").count(), 0);
	const browseTitles = await desktop
		.locator("[data-project-card]")
		.evaluateAll((cards) =>
			cards.map((card) => card.getAttribute("data-project-title") || ""),
		);
	for (const title of [
		"MedClaim Sentinel",
		"ASHU Mentor AI Studio",
		"LightDID-ZKP",
		"DACR-Q",
		"Vehicle-Scale LLMs",
		"AegisFlow",
		"MCP 2.0",
	]) {
		assert.equal(browseTitles.includes(title), true, `Missing concise title: ${title}`);
	}
	const semanticBlocks = await desktop
		.locator("[data-project-card]")
		.evaluateAll((cards) =>
			cards.map((card) => ({
				why: [...card.querySelectorAll("h3")].filter(
					(heading) => heading.textContent?.trim() === "Why it matters",
				).length,
				ask: card.querySelectorAll(".project-ask-menu").length,
			})),
		);
	assert.equal(
		semanticBlocks.every(({ why, ask }) => why === 1 && ask === 1),
		true,
		"Each project card must expose one why-it-matters block and one Ask control",
	);
	assert.equal(
		(await desktop.locator("body").textContent())?.includes(
			"Why this project matters",
		),
		false,
	);
	record("Projects discovery controls preserved");

	const careCard = desktop.locator('[data-project-card][data-project-slug*="care_siu"]');
	assert.equal(await careCard.count(), 1);
	const careImage = await careCard.locator(".project-card-image-element").getAttribute("src");
	assert.match(
		careImage || "",
		/\/cover(?:\.[a-z0-9_-]+)?\.(?:png|webp)(?:[?#]|$)/i,
	);
	assert.doesNotMatch(careImage || "", /hero-final/i);
	const careUrl = await careCard.locator(".project-card-title a").getAttribute("href");
	assert.ok(careUrl);
	record("CARE-SIU card retains its project cover", careImage);

	const deltaCard = desktop.locator('[data-project-card][data-project-slug*="deltacert"]');
	assert.equal(await deltaCard.count(), 1);
	const deltaUrl = await deltaCard.locator(".project-card-title a").getAttribute("href");
	assert.ok(deltaUrl);

	const initialCount = await desktop.locator("[data-project-result-count]").textContent();
	await desktop.locator("[data-project-search-input]").fill("no-such-portfolio-project-qa");
	await desktop.waitForFunction(() => {
		const empty = document.querySelector("[data-project-empty]");
		return empty && !empty.hasAttribute("hidden");
	});
	assert.match((await desktop.locator("[data-project-result-count]").textContent()) || "", /^0 projects/);
	await desktop.locator("[data-project-empty] [data-project-clear-all]").click();
	assert.equal(await desktop.locator("[data-project-empty]").count(), 0);
	assert.equal(await desktop.locator("[data-project-result-count]").textContent(), initialCount);
	record("Project search and canonical empty state");

	await desktop.getByRole("tab", { name: "Choose a Problem" }).click();
	assert.equal(await desktop.locator(".problem-option-card").first().isVisible(), true);
	const problemTitles = await desktop
		.locator("[data-problem-card] h3 a")
		.allTextContents();
	assert.equal(
		problemTitles.every((title) => browseTitles.includes(title.trim())),
		true,
		"Problem discovery titles must match Browse Projects titles",
	);
	const recommendationText = (
		await desktop.locator(".problem-match-summary").allTextContents()
	).join(" ");
	assert.doesNotMatch(
		recommendationText,
		/(^|[\s·:])(ocr|genai|llm inference|devsecops|computer_vision|multimodal|chat|detection|security)(?=[\s·.]|$)/,
	);
	await desktop.locator("[data-problem-option]").first().click();
	const activeProblem = desktop.locator("[data-problem-detail]:not([hidden])");
	assert.equal(await activeProblem.locator("[data-problem-empty]").count(), 0);
	await activeProblem
		.locator("[data-problem-search]")
		.fill("no-such-problem-project-qa");
	await activeProblem.locator("[data-problem-empty]").waitFor();
	assert.equal(await activeProblem.locator("[data-problem-empty]").count(), 1);
	await activeProblem.locator("[data-clear-search]").click();
	assert.equal(await activeProblem.locator("[data-problem-empty]").count(), 0);
	await desktop.getByRole("tab", { name: "Browse Projects" }).click();

	const compareControls = desktop.locator("[data-project-compare]");
	await compareControls.nth(0).check();
	await compareControls.nth(1).check();
	assert.equal(await desktop.locator("[data-project-comparison-bar]").isVisible(), true);
	await desktop.locator("[data-project-compare-clear]").click();
	record("Problem discovery and compare interactions");

	await assertNoPageOverflow(desktop, "Projects desktop light");
	await desktop.evaluate(() => window.scrollTo(0, 0));
	await desktop.screenshot({ path: path.join(outputDir, "projects-light-desktop.png"), fullPage: false });

	const { context: darkContext, page: darkPage } = await createPage(
		{ width: 1440, height: 1100 },
		"dark",
	);
	await openProjects(darkPage);
	assert.equal(await darkPage.evaluate(() => document.documentElement.classList.contains("dark")), true);
	await assertNoPageOverflow(darkPage, "Projects desktop dark");
	await darkPage.screenshot({ path: path.join(outputDir, "projects-dark-desktop.png"), fullPage: false });
	await darkContext.close();
	record("Light and dark project themes render");
	const resourceMatrix = await desktop.locator("[data-project-card]").evaluateAll((cards) =>
		cards.map((card) => {
			const links = Array.from(card.querySelectorAll("a"));
			const projectUrl = card.querySelector(".project-card-title a")?.href || "";
			const linkFor = (pattern) => links.find((link) => pattern.test(link.textContent?.trim() || ""))?.href || "";
			return {
				project: card.getAttribute("data-project-title") || "Untitled project",
				projectUrl,
				github: linkFor(/^GitHub$/i),
				architecture: linkFor(/^Architecture$/i),
				demo: linkFor(/^(?:Live )?Demo$/i),
				pdf: linkFor(/^PDF$/i),
			};
		}),
	);

	await desktopContext.close();

	for (const width of [320, 375, 430, 768]) {
		const { context, page } = await createPage({ width, height: 900 }, "light");
		await openProjects(page);
		await assertNoPageOverflow(page, `Projects ${width}px`);
		if (width < 768) {
			const filterButton = page.locator("[data-project-filter-toggle]");
			assert.equal(await filterButton.isVisible(), true);
			await filterButton.click();
			assert.equal(await page.locator("[data-project-filter-drawer]").isVisible(), true);
			await page.locator("[data-project-filter-close]").click();
		}
		await context.close();
	}
	record("Projects responsive viewports", "320, 375, 430, 768");

	const { context: detailContext, page: detail } = await createPage(
		{ width: 1720, height: 1050 },
		"light",
	);
	await detail.goto(`${new URL(careUrl, baseUrl).href}?view=technical`, {
		waitUntil: "domcontentloaded",
	});
	await detail.locator("#post-container").waitFor();
	const detailCover = await detail.locator("#post-cover img").getAttribute("src");
	assert.match(
		detailCover || "",
		/\/cover(?:\.[a-z0-9_-]+)?\.(?:png|webp)(?:[?#]|$)/i,
	);
	assert.doesNotMatch(detailCover || "", /hero-final/i);
	assert.equal(
		await detail.locator('a.card-github[href="https://github.com/dranubhaparashar/CARE-SIU"]').count(),
		1,
	);
	assert.equal(await detail.locator('[aria-label="On this page"]').isVisible(), true);
	await assertNoPageOverflow(detail, "CARE-SIU detail desktop");
	await detail.screenshot({ path: path.join(outputDir, "care-siu-detail.png"), fullPage: false });
	record("CARE-SIU technical page, repository card, and TOC");

	await detail.goto(`${new URL(deltaUrl, baseUrl).href}?view=technical`, {
		waitUntil: "domcontentloaded",
	});
	assert.equal(
		await detail.locator('a.card-github[href="https://github.com/dranubhaparashar/deltacert-agent"]').count(),
		1,
	);
	record("DeltaCert-Agent repository card");
	for (const resource of resourceMatrix) {
		if (!resource.github) continue;
		const target = new URL(resource.projectUrl);
		target.searchParams.set("view", "technical");
		await detail.goto(target.href, { waitUntil: "domcontentloaded" });
		const hasRepositoryCard = await detail.locator("a.card-github").evaluateAll(
			(cards, expectedHref) => {
				const normalize = (value) => String(value || "").replace(/\/$/, "").toLowerCase();
				return cards.some((card) => normalize(card.getAttribute("href")) === normalize(expectedHref));
			},
			resource.github,
		);
		assert.equal(hasRepositoryCard, true, `${resource.project} is missing its rich GitHub repository card`);
	}
	record("Published project resource matrix", resourceMatrix);
	await detailContext.close();
	}

	const { context: impactContext, page: impact } = await createPage(
		{ width: 1440, height: 1100 },
		"light",
	);
	await impact.goto(new URL("impact-domain/?layout=cluster&clusterBy=impact-domain", baseUrl).href, {
		waitUntil: "domcontentloaded",
	});
	await impact.locator("[data-impact-app]").waitFor();
	await impact.locator("[data-impact-svg] .impact-node").first().waitFor();

	for (const name of ["Graph", "Accessible List"]) {
		assert.equal(await impact.getByRole("tab", { name }).isVisible(), true);
	}
	for (const [name, selector] of [
		["Cluster", '[data-impact-layout="cluster"]'],
		["Tree", '[data-impact-layout="tree"]'],
		["Filters", '[data-impact-toggle="filters"]'],
		["Legend", '[data-impact-toggle="legend"]'],
		["Fit", "[data-impact-fit]"],
		["Reset", "[data-impact-reset]"],
	]) {
		assert.equal(await impact.locator(selector).isVisible(), true, `${name} control should remain visible`);
	}
	assert.equal(await impact.locator("[data-impact-cluster-by]").isVisible(), true);
	assert.equal(await impact.locator("[data-impact-zoom='out']").isVisible(), true);
	assert.equal(await impact.locator("[data-impact-zoom='in']").isVisible(), true);
	record("Impact Domain protected controls preserved");

	const lightSemanticColors = await impact.evaluate(() => {
		const data = JSON.parse(document.querySelector("#project-impact-data")?.textContent || "{}");
		const values = (selector, property) =>
			Array.from(document.querySelectorAll(selector))
				.map((element) => element.style.getPropertyValue(property).trim().toLowerCase())
				.filter(Boolean);
		return {
			domains: data.domains.map((domain) => domain.color.toLowerCase()),
			legend: values(".impact-legend-item[data-impact-group-id]:not([data-impact-group-id=''])", "--group-color"),
			clusters: values(".impact-cluster-region", "--cluster-color"),
			nodes: values(".impact-node", "--node-color"),
		};
	});
	const canonicalDomainColors = [...new Set(lightSemanticColors.domains)].sort();
	assert.ok(canonicalDomainColors.length >= 5);
	assert.deepEqual([...new Set(lightSemanticColors.legend)].sort(), canonicalDomainColors);
	assert.deepEqual([...new Set(lightSemanticColors.clusters)].sort(), canonicalDomainColors);
	assert.ok(new Set(lightSemanticColors.nodes).size >= 5);
	record("Impact light theme uses the canonical semantic domain palette", lightSemanticColors);

	await impact.locator('[data-impact-layout="tree"]').click();
	assert.equal(await impact.locator("[data-impact-tree='expand']").isVisible(), true);
	assert.equal(await impact.locator("[data-impact-tree='collapse']").isVisible(), true);
	await impact.locator('[data-impact-layout="cluster"]').click();
	await impact.getByRole("tab", { name: "Accessible List" }).click();
	assert.equal(await impact.locator("[data-impact-list]").isVisible(), true);
	await impact.getByRole("tab", { name: "Graph" }).click();
	record("Impact Graph, Accessible List, Cluster, and Tree interactions");

	await impact.locator('[data-impact-toggle="filters"]').click();
	const impactSearch = impact.locator("[data-impact-search]");
	await impactSearch.fill("no-such-impact-project-qa");
	await impact.waitForFunction(() => {
		const empty = document.querySelector("[data-impact-empty]");
		return empty && !empty.hasAttribute("hidden");
	});
	assert.match((await impact.locator("[data-impact-filter-results]").textContent()) || "", /^0 projects visible/);
	await impact.locator("[data-impact-filter-panel] [data-impact-clear-filters]").click();
	await impact.waitForFunction(() => document.querySelector("[data-impact-empty]")?.hasAttribute("hidden"));
	assert.doesNotMatch((await impact.locator("[data-impact-filter-results]").textContent()) || "", /^0 /);
	record("Impact canonical count and empty state");

	await assertNoPageOverflow(impact, "Impact Domain desktop");
	await impact.evaluate(() => window.scrollTo(0, 0));
	await impact.screenshot({ path: path.join(outputDir, "impact-domain-desktop.png"), fullPage: false });
	await impactContext.close();

	const { context: impactDarkContext, page: impactDark } = await createPage(
		{ width: 1440, height: 1100 },
		"dark",
	);
	await impactDark.goto(new URL("impact-domain/?layout=cluster&clusterBy=impact-domain", baseUrl).href, {
		waitUntil: "domcontentloaded",
	});
	await impactDark.locator("[data-impact-svg] .impact-node").first().waitFor();
	assert.equal(await impactDark.evaluate(() => document.documentElement.classList.contains("dark")), true);
	const darkSemanticColors = await impactDark.evaluate(() => {
		const computedValues = (selector, property) =>
			Array.from(document.querySelectorAll(selector))
				.map((element) => getComputedStyle(element)[property])
				.filter(Boolean);
		const rawValues = (selector, property) =>
			Array.from(document.querySelectorAll(selector))
				.map((element) => element.style.getPropertyValue(property).trim().toLowerCase())
				.filter(Boolean);
		return {
			legendRaw: rawValues(".impact-legend-item[data-impact-group-id]:not([data-impact-group-id=''])", "--group-color"),
			legendIcons: computedValues(".impact-legend-item[data-impact-group-id]:not([data-impact-group-id='']) .impact-legend-icon", "color"),
			clusterStrokes: computedValues(".impact-cluster-region ellipse", "stroke"),
			nodeStrokes: computedValues(".impact-node-disc", "stroke"),
		};
	});
	assert.deepEqual([...new Set(darkSemanticColors.legendRaw)].sort(), canonicalDomainColors);
	assert.ok(new Set(darkSemanticColors.legendIcons).size >= 5);
	assert.ok(new Set(darkSemanticColors.clusterStrokes).size >= 5);
	assert.ok(new Set(darkSemanticColors.nodeStrokes).size >= 5);
	record("Impact dark theme preserves distinct semantic hues", darkSemanticColors);

	const visibleNodesBeforeFocus = await impactDark.locator(".impact-node:not(.is-hidden)").count();
	const firstDomainRow = impactDark.locator(".impact-legend-item[data-impact-group-id]:not([data-impact-group-id=''])").first();
	await firstDomainRow.focus();
	await impactDark.keyboard.press("Enter");
	assert.equal(await firstDomainRow.evaluate((element) => element.classList.contains("is-active")), true);
	assert.equal(await impactDark.locator(".impact-node:not(.is-hidden)").count(), visibleNodesBeforeFocus);
	assert.equal(await impactDark.locator(".impact-cluster-region.is-highlighted").count(), 1);
	assert.ok(await impactDark.locator(".impact-cluster-region.is-dimmed").count() > 0);
	assert.ok(await impactDark.locator(".impact-node.is-dimmed").count() > 0);
	record("Domain focus emphasizes without filtering other domains");

	await impactDark.locator(".impact-legend-item[data-impact-group-id='']").click();
	const firstNode = impactDark.locator(".impact-node:not(.is-hidden)").first();
	await firstNode.dispatchEvent("pointerenter", { clientX: 620, clientY: 520 });
	await impactDark.locator("[data-impact-hover-card]").waitFor({ state: "visible" });
	assert.equal(await impactDark.locator(".impact-legend-item.is-context-active").count(), 1);
	const nodeAndPreviewAccent = await impactDark.evaluate(() => ({
		node: getComputedStyle(document.querySelector(".impact-node.is-hovered .impact-node-disc")).stroke,
		preview: getComputedStyle(document.querySelector("[data-impact-hover-card]")).borderTopColor,
	}));
	assert.equal(nodeAndPreviewAccent.preview, nodeAndPreviewAccent.node);
	record("Node hover synchronizes graph, grouping row, and preview accent", nodeAndPreviewAccent);

	await firstNode.dispatchEvent("pointerleave");
	await firstNode.dispatchEvent("click");
	assert.equal(await impactDark.locator("[data-impact-details]").isVisible(), true);
	assert.equal(await impactDark.locator(".impact-node.is-selected").count(), 1);
	await impactDark.locator("[data-impact-clear-selection]").click();
	record("Keyboard domain focus and node selection remain available");

	await impactDark.locator('[data-impact-layout="tree"]').click();
	await impactDark.locator(".impact-tree-group").first().waitFor();
	const treeStrokes = await impactDark.locator(".impact-tree-group rect").evaluateAll((elements) =>
		elements.map((element) => getComputedStyle(element).stroke),
	);
	assert.ok(new Set(treeStrokes).size >= 5);
	await impactDark.getByRole("tab", { name: "Accessible List" }).click();
	const listIconColors = await impactDark.locator(".impact-list-domain-icon").evaluateAll((elements) =>
		elements.map((element) => getComputedStyle(element).color),
	);
	assert.ok(new Set(listIconColors).size >= 5);
	record("Tree and Accessible List retain semantic colors in dark mode");

	await impactDark.getByRole("tab", { name: "Graph" }).click();
	await impactDark.locator('[data-impact-layout="cluster"]').click();
	for (const [mode, heading] of [
		["technology", "Technologies"],
		["industry", "Industries"],
		["project-type", "Project Types"],
		["impact-domain", "Impact Domains"],
	]) {
		await impactDark.locator("[data-impact-cluster-by]").selectOption(mode);
		assert.equal(await impactDark.locator("[data-impact-legend-title]").textContent(), heading);
	}
	record("Cluster By modes remain interactive");
	await assertNoPageOverflow(impactDark, "Impact Domain desktop dark");
	await impactDark.evaluate(() => window.scrollTo(0, 0));
	await impactDark.screenshot({ path: path.join(outputDir, "impact-domain-dark-desktop.png"), fullPage: false });
	await impactDarkContext.close();

	for (const width of [320, 375, 430, 768]) {
		const { context, page } = await createPage({ width, height: 900 }, "dark");
		await page.goto(new URL("impact-domain/?layout=cluster&clusterBy=impact-domain", baseUrl).href, {
			waitUntil: "domcontentloaded",
		});
		await page.locator("[data-impact-app]").waitFor();
		await assertNoPageOverflow(page, `Impact Domain ${width}px`);
		await context.close();
	}
	record("Impact responsive viewports", "320, 375, 430, 768");
} finally {
	await browser.close();
}

console.log(JSON.stringify({ outputDir, results }, null, 2));
