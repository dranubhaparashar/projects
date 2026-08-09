import { chromium } from "playwright";

const baseUrl =
	process.argv[2] || "http://127.0.0.1:4321/projects/?view=projects";
const viewports = [
	{ width: 1536, height: 864 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
	{ width: 390, height: 844 },
];
const browser = await chromium.launch({ headless: true });
const requestUrls = [];
const report = { baseUrl, fresh: null, viewports: [], swup: null };

function observe(page) {
	page.on("request", (request) => requestUrls.push(request.url()));
}

async function drawerSnapshot(page) {
	return page.evaluate(() => {
		const layer = document.querySelector("[data-project-intelligence-layer]");
		const backdrop = document.querySelector(".project-intelligence-backdrop");
		const dialog = document.querySelector("[data-project-intelligence-dialog]");
		const root = document.querySelector("project-intelligence");
		const style = (element) => {
			if (!(element instanceof HTMLElement)) return null;
			const computed = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return {
				display: computed.display,
				visibility: computed.visibility,
				opacity: computed.opacity,
				transform: computed.transform,
				right: computed.right,
				position: computed.position,
				zIndex: computed.zIndex,
				boundingClientRect: {
					x: rect.x,
					y: rect.y,
					top: rect.top,
					right: rect.right,
					bottom: rect.bottom,
					left: rect.left,
					width: rect.width,
					height: rect.height,
				},
			};
		};
		return {
			viewport: { width: innerWidth, height: innerHeight },
			counts: {
				root: document.querySelectorAll("project-intelligence").length,
				layer: document.querySelectorAll("[data-project-intelligence-layer]")
					.length,
				backdrop: document.querySelectorAll(".project-intelligence-backdrop")
					.length,
				dialog: document.querySelectorAll("[data-project-intelligence-dialog]")
					.length,
			},
			state: {
				rootConstructor: root?.constructor.name || null,
				rootController: Boolean(root?.controller),
				rootControllerPending: Boolean(root?.controllerPromise),
				rootIsBound: root?.isBound ?? null,
				rootOpen: root?.getAttribute("data-open"),
				layerOpen: layer?.getAttribute("data-open"),
				layerHidden: layer instanceof HTMLElement ? layer.hidden : null,
				layerAriaHidden: layer?.getAttribute("aria-hidden"),
				layerInert: layer instanceof HTMLElement ? layer.inert : null,
				dialogAriaHidden: dialog?.getAttribute("aria-hidden"),
				scrollLocked: document.documentElement.classList.contains(
					"project-intelligence-open",
				),
				activeElement:
					document.activeElement instanceof HTMLElement &&
					document.activeElement.hasAttribute(
						"data-project-intelligence-input",
					),
				layerParent: layer?.parentElement?.tagName || null,
			},
			layer: style(layer),
			backdrop: style(backdrop),
			dialog: style(dialog),
		};
	});
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function assertSingle(snapshot) {
	for (const [name, count] of Object.entries(snapshot.counts)) {
		assert(count === 1, `Expected one ${name}; found ${count}`);
	}
}

function assertOpen(snapshot) {
	assertSingle(snapshot);
	assert(snapshot.state.rootOpen === "true", "Root did not enter open state");
	assert(snapshot.state.layerOpen === "true", "Layer did not enter open state");
	assert(snapshot.state.layerHidden === false, "Open layer retained hidden");
	assert(
		snapshot.state.layerAriaHidden === "false",
		"Open layer is aria-hidden",
	);
	assert(snapshot.state.layerInert === false, "Open layer remained inert");
	assert(snapshot.state.dialogAriaHidden === "false", "Dialog is aria-hidden");
	assert(snapshot.state.scrollLocked, "Body scroll lock was not applied");
	assert(snapshot.state.activeElement, "Question input did not receive focus");
	assert(
		snapshot.state.layerParent === "BODY",
		"Layer was not portaled to body",
	);
	assert(
		snapshot.layer?.display !== "none",
		"Layer is display:none while open",
	);
	assert(snapshot.dialog?.display === "flex", "Dialog is not display:flex");
	assert(snapshot.dialog?.visibility === "visible", "Dialog is not visible");
	assert(snapshot.dialog?.opacity === "1", "Dialog opacity is not 1");
	assert(
		snapshot.dialog?.transform === "none" ||
			snapshot.dialog?.transform === "matrix(1, 0, 0, 1, 0, 0)",
		`Dialog retained a closed transform: ${snapshot.dialog?.transform}`,
	);
	assert(snapshot.layer?.position === "fixed", "Layer is not fixed");
	assert(
		snapshot.dialog?.right === "0px",
		"Dialog is not anchored at right: 0",
	);
	assert(snapshot.layer?.zIndex === "120", "Unexpected layer z-index");
	assert(snapshot.backdrop?.zIndex === "0", "Unexpected backdrop z-index");
	assert(snapshot.dialog?.zIndex === "1", "Dialog is not above backdrop");
	const rect = snapshot.dialog?.boundingClientRect;
	assert(rect && rect.width > 0 && rect.height > 0, "Dialog has an empty rect");
	assert(rect.left >= 0, `Dialog is left of viewport: ${rect.left}`);
	assert(
		rect.right <= snapshot.viewport.width,
		`Dialog is right of viewport: ${rect.right}`,
	);
	assert(rect.top >= 0, `Dialog is above viewport: ${rect.top}`);
	assert(
		rect.bottom <= snapshot.viewport.height,
		`Dialog is below viewport: ${rect.bottom}`,
	);
}

async function waitClosed(page) {
	await page.waitForFunction(
		() =>
			document.querySelector("[data-project-intelligence-layer]")?.hidden ===
			true,
	);
	const snapshot = await drawerSnapshot(page);
	assert(snapshot.state.rootOpen === "false", "Root remained open after close");
	assert(
		snapshot.state.layerOpen === "false",
		"Layer remained open after close",
	);
	assert(!snapshot.state.scrollLocked, "Scroll lock remained after close");
	return snapshot;
}

async function clickOpen(page) {
	await page.getByRole("button", { name: "Ask about my projects" }).click();
	try {
		await page.waitForFunction(
			() =>
				document
					.querySelector("[data-project-intelligence-layer]")
					?.getAttribute("data-open") === "true",
		);
		await page.waitForFunction(() => {
			const dialog = document.querySelector(
				"[data-project-intelligence-dialog]",
			);
			if (!(dialog instanceof HTMLElement)) return false;
			const computed = getComputedStyle(dialog);
			return (
				computed.visibility === "visible" &&
				computed.opacity === "1" &&
				(computed.transform === "none" ||
					computed.transform === "matrix(1, 0, 0, 1, 0, 0)")
			);
		});
	} catch (error) {
		throw new Error(
			`Drawer did not become visible: ${JSON.stringify(await drawerSnapshot(page))}`,
			{ cause: error },
		);
	}
	const snapshot = await drawerSnapshot(page);
	assertOpen(snapshot);
	return snapshot;
}

async function waitForSwupReady(page) {
	await page.waitForFunction(
		() => {
			const html = document.documentElement;
			const main = document.querySelector("main");
			return (
				!html.classList.contains("is-changing") &&
				!html.classList.contains("is-animating") &&
				!(main instanceof HTMLElement && main.inert)
			);
		},
		undefined,
		{ timeout: 30_000 },
	);
}

const context = await browser.newContext({ viewport: viewports[0] });
const page = await context.newPage();
observe(page);
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
const before = await drawerSnapshot(page);
assertSingle(before);
const after = await clickOpen(page);
const requestsAfterOpen = [...requestUrls];
const forbiddenOpenRequests = requestsAfterOpen.filter((url) =>
	/Qwen2\.5|huggingface|onnx|project-vectors|ort-wasm|project-chunks/i.test(
		url,
	),
);
assert(
	forbiddenOpenRequests.length === 0,
	`AI assets loaded merely by opening: ${forbiddenOpenRequests.join(", ")}`,
);

await page
	.getByRole("button", { name: "Close Project Intelligence" })
	.last()
	.click();
const afterCloseButton = await waitClosed(page);
await clickOpen(page);
await page.keyboard.press("Escape");
const afterEscape = await waitClosed(page);
await clickOpen(page);
await page
	.locator(".project-intelligence-backdrop")
	.click({ position: { x: 8, y: 8 } });
const afterBackdrop = await waitClosed(page);
await clickOpen(page);
await page.keyboard.press("Escape");
await waitClosed(page);
report.fresh = { before, after, afterCloseButton, afterEscape, afterBackdrop };

for (const viewport of viewports) {
	await page.setViewportSize(viewport);
	const open = await clickOpen(page);
	report.viewports.push(open);
	await page.keyboard.press("Escape");
	await waitClosed(page);
}

await page.setViewportSize(viewports[1]);
await page.getByRole("link", { name: "Archive" }).first().click();
await page.waitForURL(/\/archive\//, { timeout: 30_000 });
await page
	.getByRole("link", { name: /Anubha Parashar/i })
	.first()
	.click();
await page.waitForURL((url) => url.pathname.endsWith("/projects/"), {
	timeout: 30_000,
});
await waitForSwupReady(page);
const afterReturn = await clickOpen(page);
report.swup = afterReturn;
await page.keyboard.press("Escape");
await waitClosed(page);

console.log(JSON.stringify(report, null, 2));
await context.close();
await browser.close();
