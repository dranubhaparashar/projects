import type {
	ProjectDiscoveryData,
	ProjectSearchSuggestion,
} from "../utils/project-discovery-data";
import { canonicalTaxonomyFilterKey } from "../utils/project-taxonomy";

type ClientData = Pick<ProjectDiscoveryData, "suggestions"> & {
	projects: Array<{ id: string; slug: string; title: string; url: string }>;
};

type HistoryMode = "push" | "replace" | "none";

const MAX_COMPARE = 3;
const MIN_COMPARE = 2;
const RECENT_KEY = "project-recent-history-v1";

function normalize(value: string): string {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function words(value: string): string[] {
	return value.split(/\s+/).filter(Boolean);
}

function values(element: HTMLElement, key: string): string[] {
	return words(element.dataset[key] || "");
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.matches("input, textarea, select") ||
		target.isContentEditable ||
		Boolean(target.closest("[contenteditable='true']"))
	);
}

function actionButton(label: string, dataAttribute: string): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn-regular";
	button.textContent = label;
	button.setAttribute(dataAttribute, "");
	return button;
}

function createBrowseEmptyState(): HTMLElement {
	const empty = document.createElement("div");
	empty.className = "project-discovery-empty card-base";
	empty.setAttribute("data-project-empty", "");
	const title = document.createElement("h2");
	title.textContent = "No projects match this view";
	const message = document.createElement("p");
	message.textContent =
		"Try a broader search or clear one of the active filters.";
	empty.append(
		title,
		message,
		actionButton("Clear filters", "data-project-clear-all"),
	);
	return empty;
}

function createProblemEmptyState(): HTMLElement {
	const empty = document.createElement("div");
	empty.className = "problem-empty-state card-base";
	empty.setAttribute("data-problem-empty", "");
	const title = document.createElement("h3");
	title.textContent = "No matching projects found";
	const message = document.createElement("p");
	message.textContent =
		"Try clearing the technology filter or searching with a broader term.";
	const actions = document.createElement("div");
	actions.className = "problem-empty-actions";
	actions.append(
		actionButton("Clear search", "data-clear-search"),
		actionButton("Clear technology filter", "data-clear-technology"),
		actionButton("Clear use case filter", "data-clear-use-case"),
		actionButton("View all projects", "data-view-projects"),
	);
	empty.append(title, message, actions);
	return empty;
}

function parseClientData(): ClientData {
	const script = document.getElementById("project-discovery-data");
	try {
		return JSON.parse(script?.textContent || "{}") as ClientData;
	} catch {
		return { suggestions: [], projects: [] };
	}
}

class ProjectDiscoveryController {
	root: HTMLElement;
	data: ClientData;
	abort = new AbortController();
	tabs: HTMLButtonElement[];
	panels: HTMLElement[];
	live: HTMLElement | null;
	search: HTMLInputElement | null;
	suggestions: HTMLElement | null;
	cards: HTMLElement[];
	grid: HTMLElement | null;
	filters: Map<string, HTMLSelectElement>;
	sort: HTMLSelectElement | null;
	capabilityButtons: HTMLButtonElement[];
	compareChecks: HTMLInputElement[];
	activeSuggestion = -1;
	visibleSuggestions: ProjectSearchSuggestion[] = [];
	searchTimer = 0;
	state = {
		mode: "projects",
		problemId: "",
		query: "",
		industry: "",
		technology: "",
		category: "",
		status: "",
		sort: "featured",
		capabilities: new Set<string>(),
		compare: new Set<string>(),
	};

	constructor(root: HTMLElement) {
		this.root = root;
		this.data = parseClientData();
		this.tabs = [
			...root.querySelectorAll<HTMLButtonElement>("[data-discovery-tab]"),
		];
		this.panels = [
			...root.querySelectorAll<HTMLElement>("[data-discovery-panel]"),
		];
		this.live = root.querySelector("[data-project-discovery-live]");
		this.search = root.querySelector("[data-project-search-input]");
		this.suggestions = root.querySelector("[data-project-suggestions]");
		this.cards = [...root.querySelectorAll<HTMLElement>("[data-project-card]")];
		this.grid = root.querySelector(".project-listing-surface");
		this.filters = new Map(
			[
				...root.querySelectorAll<HTMLSelectElement>("[data-project-filter]"),
			].map((control) => [control.dataset.projectFilter || "", control]),
		);
		this.sort = root.querySelector("[data-project-sort]");
		this.capabilityButtons = [
			...root.querySelectorAll<HTMLButtonElement>("[data-project-capability]"),
		];
		this.compareChecks = [
			...root.querySelectorAll<HTMLInputElement>("[data-project-compare]"),
		];
		this.bind();
		this.restoreFromUrl("replace");
		this.renderRecent();
		this.observeStickyToolbar();
	}

	destroy() {
		this.abort.abort();
		window.clearTimeout(this.searchTimer);
	}

	bind() {
		const { signal } = this.abort;
		for (const tab of this.tabs) {
			tab.addEventListener(
				"click",
				() => this.setMode(tab.dataset.discoveryTab || "projects", "push"),
				{ signal },
			);
			tab.addEventListener("keydown", (event) => this.handleTabKeys(event), {
				signal,
			});
		}

		this.search?.addEventListener(
			"input",
			() => {
				this.state.query = this.search?.value.trim() || "";
				this.applyBrowseFilters("replace");
				this.renderSuggestions();
			},
			{ signal },
		);
		this.search?.addEventListener("focus", () => this.renderSuggestions(), {
			signal,
		});
		this.search?.addEventListener(
			"keydown",
			(event) => this.handleSuggestionKeys(event),
			{ signal },
		);

		for (const control of this.filters.values()) {
			control.addEventListener(
				"change",
				() => {
					this.readBrowseControls();
					this.applyBrowseFilters("push");
				},
				{ signal },
			);
		}
		this.sort?.addEventListener(
			"change",
			() => {
				this.readBrowseControls();
				this.applyBrowseFilters("push");
			},
			{ signal },
		);

		this.root.addEventListener(
			"click",
			(event) => this.handleRootClick(event),
			{ signal },
		);
		this.root.addEventListener(
			"change",
			(event) => {
				const checkbox =
					event.target instanceof Element
						? event.target.closest<HTMLInputElement>("[data-project-compare]")
						: null;
				if (checkbox) this.toggleCompare(checkbox);
			},
			{ signal },
		);

		for (const input of this.root.querySelectorAll<HTMLInputElement>(
			"[data-problem-search]",
		)) {
			input.addEventListener(
				"input",
				() => {
					window.clearTimeout(this.searchTimer);
					this.searchTimer = window.setTimeout(() => {
						const detail = input.closest<HTMLElement>("[data-problem-detail]");
						if (detail) this.applyProblemFilters(detail, "replace");
					}, 140);
				},
				{ signal },
			);
		}

		document.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape") {
					this.closeSuggestions();
					this.setFilterDrawer(false, false);
				}
				if (
					event.key === "/" &&
					!event.ctrlKey &&
					!event.metaKey &&
					!event.altKey &&
					!isTypingTarget(event.target)
				) {
					event.preventDefault();
					this.search?.focus();
				}
			},
			{ signal },
		);
		document.addEventListener(
			"click",
			(event) => {
				const target = event.target instanceof Element ? event.target : null;
				if (!target?.closest(".project-main-search")) this.closeSuggestions();
			},
			{ signal },
		);
		window.addEventListener("popstate", () => this.restoreFromUrl("none"), {
			signal,
		});

		this.root.addEventListener(
			"error",
			(event) => {
				const image = event.target;
				if (!(image instanceof HTMLImageElement)) return;
				const preview = image.closest<HTMLElement>(
					".problem-architecture-preview",
				);
				if (!preview) return;
				const wrapper = image.closest<HTMLElement>(
					".problem-architecture-image",
				);
				if (wrapper) wrapper.hidden = true;
				preview.classList.remove("has-preview");
				const fallback = preview.querySelector<HTMLElement>(
					".problem-architecture-fallback",
				);
				if (fallback) fallback.hidden = false;
			},
			{ signal, capture: true },
		);
	}

	handleRootClick(event: MouseEvent) {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;

		const capability = target.closest<HTMLButtonElement>(
			"[data-project-capability]",
		);
		if (capability) {
			const id = capability.dataset.projectCapability || "";
			this.state.capabilities.has(id)
				? this.state.capabilities.delete(id)
				: this.state.capabilities.add(id);
			this.applyBrowseFilters("push");
			return;
		}
		if (target.closest("[data-project-clear-capabilities]")) {
			this.state.capabilities.clear();
			this.applyBrowseFilters("push");
			return;
		}
		if (target.closest("[data-project-clear-all]")) {
			this.clearBrowseFilters();
			return;
		}
		if (target.closest("[data-project-filter-toggle]")) {
			this.setFilterDrawer(true);
			return;
		}
		if (target.closest("[data-project-filter-close]")) {
			this.setFilterDrawer(false);
			return;
		}
		if (target.closest("[data-project-compare-clear]")) {
			this.state.compare.clear();
			this.syncCompare("push");
			return;
		}
		const compareSubmit = target.closest<HTMLAnchorElement>(
			"[data-project-compare-submit]",
		);
		if (compareSubmit?.getAttribute("aria-disabled") === "true") {
			event.preventDefault();
			this.announce("Select at least 2 projects to compare.");
			return;
		}
		if (target.closest("[data-project-recent-clear]")) {
			try {
				localStorage.removeItem(RECENT_KEY);
			} catch {
				// Storage can be unavailable in privacy-restricted browsing contexts.
			}
			this.renderRecent();
			return;
		}

		const assistant = target.closest<HTMLElement>(
			"[data-project-assistant-question]",
		);
		if (assistant) {
			document.dispatchEvent(
				new CustomEvent("project-intelligence:ask", {
					detail: {
						question: assistant.dataset.projectAssistantQuestion || "",
						slug: assistant.dataset.projectAssistantSlug || "",
					},
				}),
			);
			return;
		}

		const problem = target.closest<HTMLElement>("[data-problem-option]");
		if (problem) {
			this.selectProblem(problem.dataset.problemId || "", "push", true);
			return;
		}
		if (target.closest("[data-problem-back]")) {
			this.showProblemOverview("push", true);
			return;
		}
		const technology = target.closest<HTMLElement>("[data-technology-filter]");
		if (technology) {
			const detail = technology.closest<HTMLElement>("[data-problem-detail]");
			if (!detail) return;
			const key = technology.dataset.technologyFilter || "";
			detail.dataset.activeTechnology =
				detail.dataset.activeTechnology === key ? "" : key;
			this.applyProblemFilters(detail, "push");
			return;
		}
		const useCase = target.closest<HTMLElement>("[data-use-case-filter]");
		if (useCase) {
			const detail = useCase.closest<HTMLElement>("[data-problem-detail]");
			if (!detail) return;
			const key = useCase.dataset.useCaseFilter || "";
			detail.dataset.activeUseCase =
				detail.dataset.activeUseCase === key ? "" : key;
			this.applyProblemFilters(detail, "push");
			return;
		}
		const detail = target.closest<HTMLElement>("[data-problem-detail]");
		if (detail && target.closest("[data-clear-search]")) {
			const input = detail.querySelector<HTMLInputElement>(
				"[data-problem-search]",
			);
			if (input) input.value = "";
			this.applyProblemFilters(detail, "push");
			return;
		}
		if (detail && target.closest("[data-clear-technology]")) {
			detail.dataset.activeTechnology = "";
			this.applyProblemFilters(detail, "push");
			return;
		}
		if (detail && target.closest("[data-clear-use-case]")) {
			detail.dataset.activeUseCase = "";
			this.applyProblemFilters(detail, "push");
			return;
		}
		if (target.closest("[data-view-projects]"))
			this.setMode("projects", "push", true);
	}

	readBrowseControls() {
		this.state.industry = this.filters.get("industry")?.value || "";
		this.state.technology = this.filters.get("technology")?.value || "";
		this.state.category = this.filters.get("category")?.value || "";
		this.state.status = this.filters.get("status")?.value || "";
		this.state.sort = this.sort?.value || "featured";
	}

	cardMatches(
		card: HTMLElement,
		ignoreCapability = false,
		ignoreQuery = false,
	): boolean {
		const search = card.dataset.projectSearch || "";
		const industries = values(card, "projectIndustries");
		const capabilities = values(card, "projectCapabilities");
		const technologies = values(card, "projectTechnologies");
		const queryMatches =
			ignoreQuery ||
			!this.state.query ||
			search.includes(normalize(this.state.query));
		const industryMatches =
			!this.state.industry || industries.includes(this.state.industry);
		const technologyMatches =
			!this.state.technology || technologies.includes(this.state.technology);
		const categoryMatches =
			!this.state.category ||
			card.dataset.projectCategory === this.state.category;
		const statusMatches =
			!this.state.status || card.dataset.projectStatus === this.state.status;
		// AND across filter groups; selected capabilities use OR within their group.
		const capabilityMatches =
			ignoreCapability ||
			this.state.capabilities.size === 0 ||
			[...this.state.capabilities].some((id) => capabilities.includes(id));
		return (
			queryMatches &&
			industryMatches &&
			technologyMatches &&
			categoryMatches &&
			statusMatches &&
			capabilityMatches
		);
	}

	applyBrowseFilters(historyMode: HistoryMode) {
		let visible = 0;
		for (const card of this.cards) {
			const show = this.cardMatches(card);
			card.hidden = !show;
			if (show) visible += 1;
		}
		this.sortCards();
		const count = this.root.querySelector<HTMLElement>(
			"[data-project-result-count]",
		);
		if (count)
			count.textContent = `${visible} ${visible === 1 ? "project" : "projects"}`;
		const empty = this.root.querySelector<HTMLElement>("[data-project-empty]");
		if (visible === 0 && !empty) {
			this.grid?.insertAdjacentElement("afterend", createBrowseEmptyState());
		} else if (visible > 0) {
			empty?.remove();
		}
		for (const button of this.capabilityButtons) {
			const id = button.dataset.projectCapability || "";
			const countForCurrentContext = this.cards.filter(
				(card) =>
					this.cardMatches(card, true) &&
					values(card, "projectCapabilities").includes(id),
			).length;
			button.setAttribute(
				"aria-pressed",
				String(this.state.capabilities.has(id)),
			);
			button.disabled =
				countForCurrentContext === 0 && !this.state.capabilities.has(id);
			const small = button.querySelector("small");
			if (small) small.textContent = String(countForCurrentContext);
		}
		const clearCapabilities = this.root.querySelector<HTMLElement>(
			"[data-project-clear-capabilities]",
		);
		if (clearCapabilities)
			clearCapabilities.hidden = this.state.capabilities.size === 0;
		this.updateActiveFilterCount();
		this.announce(`${visible} projects shown.`);
		this.updateUrl(historyMode);
	}

	sortCards() {
		if (!this.grid) return;
		const sorted = [...this.cards].sort((left, right) => {
			if (this.state.sort === "title") {
				return normalize(left.dataset.projectTitle || "").localeCompare(
					normalize(right.dataset.projectTitle || ""),
				);
			}
			const leftDate = Number(left.dataset.projectPublished || 0);
			const rightDate = Number(right.dataset.projectPublished || 0);
			if (this.state.sort === "featured") {
				const leftFeatured = left.dataset.projectFeatured === "true" ? 1 : 0;
				const rightFeatured = right.dataset.projectFeatured === "true" ? 1 : 0;
				if (leftFeatured !== rightFeatured) return rightFeatured - leftFeatured;
			}
			return rightDate - leftDate;
		});
		this.grid.append(...sorted);
	}

	clearBrowseFilters() {
		this.state.query = "";
		this.state.industry = "";
		this.state.technology = "";
		this.state.category = "";
		this.state.status = "";
		this.state.sort = "featured";
		this.state.capabilities.clear();
		if (this.search) this.search.value = "";
		for (const control of this.filters.values()) control.value = "";
		if (this.sort) this.sort.value = "featured";
		this.closeSuggestions();
		this.applyBrowseFilters("push");
	}

	updateActiveFilterCount() {
		const count = [
			this.state.query,
			this.state.industry,
			this.state.technology,
			this.state.category,
			this.state.status,
			...this.state.capabilities,
		].filter(Boolean).length;
		const indicator = this.root.querySelector<HTMLElement>(
			"[data-project-active-filter-count]",
		);
		if (indicator) {
			indicator.hidden = count === 0;
			indicator.textContent = String(count);
		}
	}

	setFilterDrawer(open: boolean, restoreFocus = true) {
		const drawer = this.root.querySelector<HTMLElement>(
			"[data-project-filter-drawer]",
		);
		const toggle = this.root.querySelector<HTMLElement>(
			"[data-project-filter-toggle]",
		);
		const wasOpen = drawer?.classList.contains("is-open") || false;
		drawer?.classList.toggle("is-open", open);
		toggle?.setAttribute("aria-expanded", String(open));
		if (open) drawer?.querySelector<HTMLElement>("select, button")?.focus();
		else if (restoreFocus && wasOpen) toggle?.focus();
	}

	renderSuggestions() {
		if (!this.search || !this.suggestions) return;
		const query = normalize(this.search.value);
		if (!query) {
			this.closeSuggestions();
			return;
		}
		const scopedIds = new Set(
			this.cards
				.filter((card) => this.cardMatches(card, false, true))
				.map((card) => card.dataset.projectId || ""),
		);
		const cardById = new Map(
			this.cards.map((card) => [card.dataset.projectId || "", card]),
		);
		const caps: Record<ProjectSearchSuggestion["kind"], number> = {
			project: 3,
			technology: 2,
			capability: 2,
			industry: 2,
			problem: 2,
		};
		const counts = {
			project: 0,
			technology: 0,
			capability: 0,
			industry: 0,
			problem: 0,
		};
		this.visibleSuggestions = this.data.suggestions.filter((suggestion) => {
			if (counts[suggestion.kind] >= caps[suggestion.kind]) return false;
			if (!suggestion.projectIds.some((id) => scopedIds.has(id))) return false;
			const labelMatch = normalize(
				`${suggestion.label} ${suggestion.secondary || ""}`,
			).includes(query);
			const projectMetadataMatch =
				suggestion.kind === "project" &&
				suggestion.projectIds.some((id) =>
					(cardById.get(id)?.dataset.projectSearch || "").includes(query),
				);
			if (!labelMatch && !projectMetadataMatch) return false;
			counts[suggestion.kind] += 1;
			return true;
		});

		this.suggestions.replaceChildren();
		const labels: Record<ProjectSearchSuggestion["kind"], string> = {
			project: "Projects",
			technology: "Technologies",
			capability: "Capabilities",
			industry: "Industries",
			problem: "Problem areas",
		};
		for (const kind of [
			"project",
			"technology",
			"capability",
			"industry",
			"problem",
		] as const) {
			const items = this.visibleSuggestions.filter(
				(item) => item.kind === kind,
			);
			if (!items.length) continue;
			const group = document.createElement("section");
			group.className = "project-suggestion-group";
			const heading = document.createElement("h3");
			heading.textContent = labels[kind];
			group.append(heading);
			for (const item of items) {
				const button = document.createElement("button");
				button.type = "button";
				button.id = `project-suggestion-${this.visibleSuggestions.indexOf(item)}`;
				button.className = "project-suggestion-option";
				button.setAttribute("role", "option");
				button.setAttribute("aria-selected", "false");
				button.dataset.suggestionId = item.id;
				button.append(this.highlight(item.label, query));
				if (item.secondary) {
					const small = document.createElement("small");
					small.textContent = item.secondary;
					button.append(small);
				}
				button.addEventListener("click", () => this.selectSuggestion(item));
				group.append(button);
			}
			this.suggestions.append(group);
		}
		this.activeSuggestion = -1;
		this.suggestions.hidden = this.visibleSuggestions.length === 0;
		this.search.setAttribute(
			"aria-expanded",
			String(this.visibleSuggestions.length > 0),
		);
	}

	highlight(label: string, query: string): DocumentFragment {
		const fragment = document.createDocumentFragment();
		const index = normalize(label).indexOf(query);
		if (index < 0) {
			fragment.append(document.createTextNode(label));
			return fragment;
		}
		fragment.append(document.createTextNode(label.slice(0, index)));
		const mark = document.createElement("mark");
		mark.textContent = label.slice(index, index + query.length);
		fragment.append(
			mark,
			document.createTextNode(label.slice(index + query.length)),
		);
		return fragment;
	}

	handleSuggestionKeys(event: KeyboardEvent) {
		if (event.key === "Escape") {
			this.closeSuggestions();
			this.search?.blur();
			return;
		}
		if (
			!this.visibleSuggestions.length ||
			!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)
		)
			return;
		if (event.key === "Enter") {
			if (this.activeSuggestion >= 0) {
				event.preventDefault();
				this.selectSuggestion(this.visibleSuggestions[this.activeSuggestion]);
			}
			return;
		}
		event.preventDefault();
		const delta = event.key === "ArrowDown" ? 1 : -1;
		this.activeSuggestion =
			(this.activeSuggestion + delta + this.visibleSuggestions.length) %
			this.visibleSuggestions.length;
		const options =
			this.suggestions?.querySelectorAll<HTMLElement>("[role='option']");
		for (const [index, option] of [...(options || [])].entries()) {
			option.setAttribute(
				"aria-selected",
				String(index === this.activeSuggestion),
			);
		}
		this.search?.setAttribute(
			"aria-activedescendant",
			`project-suggestion-${this.activeSuggestion}`,
		);
	}

	selectSuggestion(item: ProjectSearchSuggestion) {
		if (item.kind === "project" && item.url) {
			window.location.href = item.url;
			return;
		}
		if (item.kind === "problem") {
			this.closeSuggestions();
			this.selectProblem(item.value || "", "push", true);
			return;
		}
		this.state.query = "";
		if (this.search) this.search.value = "";
		if (item.kind === "capability")
			this.state.capabilities.add(item.value || "");
		if (item.kind === "industry") this.state.industry = item.value || "";
		if (item.kind === "technology") this.state.technology = item.value || "";
		this.syncBrowseControls();
		this.closeSuggestions();
		this.setMode("projects", "none");
		this.applyBrowseFilters("push");
	}

	closeSuggestions() {
		if (!this.suggestions || !this.search) return;
		this.suggestions.hidden = true;
		this.search.setAttribute("aria-expanded", "false");
		this.search.removeAttribute("aria-activedescendant");
		this.activeSuggestion = -1;
		this.visibleSuggestions = [];
	}

	toggleCompare(checkbox: HTMLInputElement) {
		const id = checkbox.value;
		if (
			checkbox.checked &&
			!this.state.compare.has(id) &&
			this.state.compare.size >= MAX_COMPARE
		) {
			checkbox.checked = false;
			const limit = this.root.querySelector<HTMLElement>(
				"[data-project-comparison-limit]",
			);
			if (limit) limit.hidden = false;
			this.announce("You can compare up to 3 projects.");
			return;
		}
		checkbox.checked
			? this.state.compare.add(id)
			: this.state.compare.delete(id);
		this.syncCompare("push");
	}

	syncCompare(historyMode: HistoryMode) {
		for (const checkbox of this.compareChecks) {
			checkbox.checked = this.state.compare.has(checkbox.value);
			checkbox.disabled =
				!checkbox.checked && this.state.compare.size >= MAX_COMPARE;
		}
		const bar = this.root.querySelector<HTMLElement>(
			"[data-project-comparison-bar]",
		);
		const count = this.root.querySelector<HTMLElement>(
			"[data-project-comparison-count]",
		);
		const limit = this.root.querySelector<HTMLElement>(
			"[data-project-comparison-limit]",
		);
		const link = this.root.querySelector<HTMLAnchorElement>(
			"[data-project-compare-submit]",
		);
		const size = this.state.compare.size;
		if (bar) bar.hidden = size === 0;
		if (count)
			count.textContent = `${size} ${size === 1 ? "project" : "projects"} selected`;
		if (limit) limit.hidden = size < MAX_COMPARE;
		if (link) {
			const target = new URL(
				this.root.dataset.compareUrl || link.href,
				window.location.href,
			);
			if (size)
				target.searchParams.set("compare", [...this.state.compare].join(","));
			else target.searchParams.delete("compare");
			link.href = target.toString();
			link.setAttribute("aria-disabled", String(size < MIN_COMPARE));
			link.tabIndex = size < MIN_COMPARE ? -1 : 0;
		}
		this.updateUrl(historyMode);
	}

	renderRecent() {
		const section = this.root.querySelector<HTMLElement>(
			"[data-project-recently-viewed]",
		);
		const list = this.root.querySelector<HTMLElement>(
			"[data-project-recent-list]",
		);
		if (!section || !list) return;
		let stored: Array<{ slug: string; lastViewed: number }> = [];
		try {
			stored = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
		} catch {
			stored = [];
		}
		const bySlug = new Map(
			this.data.projects.map((project) => [project.slug, project]),
		);
		const recent = stored
			.filter((item) => item && typeof item.slug === "string")
			.sort((left, right) => Number(right.lastViewed) - Number(left.lastViewed))
			.map((item) => bySlug.get(item.slug))
			.filter((project): project is ClientData["projects"][number] =>
				Boolean(project),
			)
			.slice(0, 3);
		list.replaceChildren(
			...recent.map((project) => {
				const link = document.createElement("a");
				link.href = project.url;
				link.textContent = project.title;
				return link;
			}),
		);
		section.hidden = recent.length === 0;
	}

	restoreFromUrl(historyMode: HistoryMode) {
		const params = new URLSearchParams(window.location.search);
		this.state.mode =
			params.get("view") === "problems" ? "problems" : "projects";
		this.state.problemId = params.get("problem") || "";
		this.state.query = params.get("q") || "";
		this.state.industry = this.validSelectValue(
			"industry",
			params.get("industry"),
		);
		this.state.technology = this.validSelectValue(
			"technology",
			canonicalTaxonomyFilterKey(params.get("technology") || ""),
		);
		this.state.category = this.validSelectValue("category", params.get("type"));
		this.state.status = this.validSelectValue("status", params.get("status"));
		const requestedSort = params.get("sort") || "";
		this.state.sort = ["featured", "newest", "title"].includes(requestedSort)
			? requestedSort
			: "featured";
		const validCapabilities = new Set(
			this.capabilityButtons.map(
				(button) => button.dataset.projectCapability || "",
			),
		);
		this.state.capabilities = new Set(
			(params.get("capability") || "")
				.split(",")
				.filter((id) => validCapabilities.has(id)),
		);
		const validProjects = new Set(
			this.cards.map((card) => card.dataset.projectId || ""),
		);
		this.state.compare = new Set(
			(params.get("compare") || "")
				.split(",")
				.filter(
					(id, index, all) =>
						validProjects.has(id) && all.indexOf(id) === index,
				)
				.slice(0, MAX_COMPARE),
		);
		this.syncBrowseControls();
		this.setMode(this.state.problemId ? "problems" : this.state.mode, "none");
		if (this.state.problemId) {
			this.selectProblem(this.state.problemId, "none", false);
			const detail = this.activeProblemDetail();
			if (detail) {
				const input = detail.querySelector<HTMLInputElement>(
					"[data-problem-search]",
				);
				if (input) input.value = params.get("problemSearch") || "";
				detail.dataset.activeTechnology = canonicalTaxonomyFilterKey(
					params.get("problemTechnology") || "",
				);
				detail.dataset.activeUseCase = params.get("useCase") || "";
				this.applyProblemFilters(detail, "none");
			}
		}
		this.applyBrowseFilters("none");
		this.syncCompare("none");
		this.updateUrl(historyMode);
	}

	validSelectValue(key: string, value: string | null): string {
		if (!value) return "";
		return [...(this.filters.get(key)?.options || [])].some(
			(option) => option.value === value,
		)
			? value
			: "";
	}

	syncBrowseControls() {
		if (this.search) this.search.value = this.state.query;
		for (const [key, value] of [
			["industry", this.state.industry],
			["technology", this.state.technology],
			["category", this.state.category],
			["status", this.state.status],
		] as const) {
			const control = this.filters.get(key);
			if (control) control.value = value;
		}
		if (this.sort) this.sort.value = this.state.sort;
	}

	updateUrl(mode: HistoryMode) {
		if (mode === "none") return;
		const next = new URL(window.location.href);
		next.searchParams.set("view", this.state.mode);
		this.optionalParam(next, "q", this.state.query);
		this.optionalParam(next, "industry", this.state.industry);
		this.optionalParam(next, "technology", this.state.technology);
		this.optionalParam(next, "type", this.state.category);
		this.optionalParam(next, "status", this.state.status);
		this.optionalParam(
			next,
			"sort",
			this.state.sort === "featured" ? "" : this.state.sort,
		);
		this.optionalParam(
			next,
			"capability",
			[...this.state.capabilities].join(","),
		);
		this.optionalParam(next, "compare", [...this.state.compare].join(","));
		if (this.state.mode === "problems" && this.state.problemId) {
			const detail = this.activeProblemDetail();
			this.optionalParam(next, "problem", this.state.problemId);
			this.optionalParam(
				next,
				"problemSearch",
				detail
					?.querySelector<HTMLInputElement>("[data-problem-search]")
					?.value.trim() || "",
			);
			this.optionalParam(
				next,
				"problemTechnology",
				detail?.dataset.activeTechnology || "",
			);
			this.optionalParam(next, "useCase", detail?.dataset.activeUseCase || "");
		} else {
			for (const key of [
				"problem",
				"problemSearch",
				"problemTechnology",
				"useCase",
			]) {
				next.searchParams.delete(key);
			}
		}
		const href = `${next.pathname}${next.search}${next.hash}`;
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (href === current) return;
		if (mode === "push") window.history.pushState({}, "", href);
		else window.history.replaceState({}, "", href);
	}

	optionalParam(url: URL, key: string, value: string) {
		value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
	}

	setMode(mode: string, historyMode: HistoryMode, focus = false) {
		this.state.mode = mode === "problems" ? "problems" : "projects";
		this.root.classList.toggle(
			"is-problem-mode",
			this.state.mode === "problems",
		);
		for (const tab of this.tabs) {
			const selected = tab.dataset.discoveryTab === this.state.mode;
			tab.setAttribute("aria-selected", String(selected));
			tab.tabIndex = selected ? 0 : -1;
		}
		for (const panel of this.panels)
			panel.hidden = panel.dataset.discoveryPanel !== this.state.mode;
		if (focus)
			this.tabs
				.find((tab) => tab.dataset.discoveryTab === this.state.mode)
				?.focus();
		this.updateUrl(historyMode);
	}

	handleTabKeys(event: KeyboardEvent) {
		const index = this.tabs.indexOf(event.currentTarget as HTMLButtonElement);
		let next = index;
		if (["ArrowRight", "ArrowDown"].includes(event.key))
			next = (index + 1) % this.tabs.length;
		else if (["ArrowLeft", "ArrowUp"].includes(event.key))
			next = (index - 1 + this.tabs.length) % this.tabs.length;
		else if (event.key === "Home") next = 0;
		else if (event.key === "End") next = this.tabs.length - 1;
		else return;
		event.preventDefault();
		this.tabs[next]?.focus();
		this.setMode(this.tabs[next]?.dataset.discoveryTab || "projects", "push");
	}

	selectProblem(problemId: string, historyMode: HistoryMode, focus: boolean) {
		const detail = [
			...this.root.querySelectorAll<HTMLElement>("[data-problem-detail]"),
		].find((item) => item.dataset.problemDetail === problemId);
		if (!detail) {
			this.showProblemOverview(historyMode, focus);
			return;
		}
		this.setMode("problems", "none");
		this.state.problemId = problemId;
		const overview = this.root.querySelector<HTMLElement>(
			"[data-problem-overview]",
		);
		if (overview) overview.hidden = true;
		for (const candidate of this.root.querySelectorAll<HTMLElement>(
			"[data-problem-detail]",
		)) {
			candidate.hidden = candidate !== detail;
		}
		for (const button of this.root.querySelectorAll<HTMLElement>(
			"[data-problem-option]",
		)) {
			const active = button.dataset.problemId === problemId;
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("is-active", active);
		}
		this.applyProblemFilters(detail, "none");
		if (focus)
			detail.querySelector<HTMLElement>("[data-problem-back]")?.focus();
		this.updateUrl(historyMode);
	}

	showProblemOverview(historyMode: HistoryMode, focus: boolean) {
		this.setMode("problems", "none");
		this.state.problemId = "";
		const overview = this.root.querySelector<HTMLElement>(
			"[data-problem-overview]",
		);
		if (overview) overview.hidden = false;
		for (const detail of this.root.querySelectorAll<HTMLElement>(
			"[data-problem-detail]",
		)) {
			detail.hidden = true;
		}
		for (const button of this.root.querySelectorAll<HTMLElement>(
			"[data-problem-option]",
		)) {
			button.setAttribute("aria-pressed", "false");
			button.classList.remove("is-active");
		}
		if (focus)
			this.root.querySelector<HTMLElement>("[data-problem-option]")?.focus();
		this.updateUrl(historyMode);
	}

	activeProblemDetail(): HTMLElement | null {
		return this.state.problemId
			? this.root.querySelector(
					`[data-problem-detail="${CSS.escape(this.state.problemId)}"]`,
				)
			: null;
	}

	applyProblemFilters(detail: HTMLElement, historyMode: HistoryMode) {
		const query = normalize(
			detail.querySelector<HTMLInputElement>("[data-problem-search]")?.value ||
				"",
		);
		const technology = detail.dataset.activeTechnology || "";
		const useCase = detail.dataset.activeUseCase || "";
		let visible = 0;
		for (const card of detail.querySelectorAll<HTMLElement>(
			"[data-problem-card]",
		)) {
			const show =
				(!query || (card.dataset.search || "").includes(query)) &&
				(!technology ||
					words(card.dataset.technologyKeys || "").includes(technology)) &&
				(!useCase || words(card.dataset.useCaseKeys || "").includes(useCase));
			card.hidden = !show;
			if (show) visible += 1;
		}
		const count = detail.querySelector<HTMLElement>(
			"[data-problem-result-count]",
		);
		if (count)
			count.textContent = `${visible} ${visible === 1 ? "project" : "projects"}`;
		const empty = detail.querySelector<HTMLElement>("[data-problem-empty]");
		if (visible === 0 && !empty) {
			detail
				.querySelector<HTMLElement>("[data-problem-results]")
				?.insertAdjacentElement("afterend", createProblemEmptyState());
		} else if (visible > 0) {
			empty?.remove();
		}
		for (const button of detail.querySelectorAll<HTMLElement>(
			"[data-technology-filter]",
		)) {
			const active = button.dataset.technologyFilter === technology;
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("is-active", active);
		}
		for (const button of detail.querySelectorAll<HTMLElement>(
			"[data-use-case-filter]",
		)) {
			const active = button.dataset.useCaseFilter === useCase;
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("is-active", active);
		}
		for (const button of detail.querySelectorAll<HTMLElement>(
			"[data-clear-technology]",
		)) {
			button.hidden = !technology;
		}
		for (const button of detail.querySelectorAll<HTMLElement>(
			"[data-clear-use-case]",
		)) {
			button.hidden = !useCase;
		}
		for (const button of detail.querySelectorAll<HTMLElement>(
			"[data-clear-search]",
		)) {
			button.hidden = !query;
		}
		this.updateUrl(historyMode);
	}

	observeStickyToolbar() {
		const sentinel = this.root.querySelector<HTMLElement>(
			"[data-discovery-sticky-sentinel]",
		);
		const toolbar = this.root.querySelector<HTMLElement>(
			"[data-discovery-toolbar]",
		);
		if (!sentinel || !toolbar || !("IntersectionObserver" in window)) return;
		const observer = new IntersectionObserver(
			([entry]) => toolbar.classList.toggle("is-stuck", !entry.isIntersecting),
			{ rootMargin: "-72px 0px 0px" },
		);
		observer.observe(sentinel);
		this.abort.signal.addEventListener("abort", () => observer.disconnect(), {
			once: true,
		});
	}

	announce(message: string) {
		if (this.live) this.live.textContent = message;
	}
}

let mountedController: ProjectDiscoveryController | null = null;

export function mountProjectDiscovery(root: HTMLElement) {
	mountedController?.destroy();
	mountedController = new ProjectDiscoveryController(root);
	return mountedController;
}

function remountProjectDiscovery() {
	const root = document.querySelector<HTMLElement>("[data-project-discovery]");
	if (root) mountProjectDiscovery(root);
	else {
		mountedController?.destroy();
		mountedController = null;
	}
}

document.addEventListener("astro:page-load", remountProjectDiscovery);
document.addEventListener("swup:contentReplaced", remountProjectDiscovery);
document.addEventListener("swup:page:view", remountProjectDiscovery);
