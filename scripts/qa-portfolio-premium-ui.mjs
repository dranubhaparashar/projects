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
	record("Projects discovery controls preserved");

	const careCard = desktop.locator('[data-project-card][data-project-slug*="care_siu"]');
	assert.equal(await careCard.count(), 1);
	const careImage = await careCard.locator(".project-card-image-element").getAttribute("src");
	assert.match(careImage || "", /cover(?:\.[a-z0-9]+)?\.png|cover\.png/i);
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
	assert.equal(await desktop.locator("[data-project-empty]").isHidden(), true);
	assert.equal(await desktop.locator("[data-project-result-count]").textContent(), initialCount);
	record("Project search and canonical empty state");

	await desktop.getByRole("tab", { name: "Choose a Problem" }).click();
	assert.equal(await desktop.locator(".problem-option-card").first().isVisible(), true);
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
	assert.match(detailCover || "", /cover\.png/i);
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
