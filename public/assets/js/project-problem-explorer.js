class ProjectProblemExplorer {
	constructor(root) {
		this.root = root;
		this.tabs = [...root.querySelectorAll("[data-discovery-tab]")];
		this.panels = [...root.querySelectorAll("[data-discovery-panel]")];
		this.liveRegion = root.querySelector("[data-project-discovery-live]");
		this.searchTimers = new Map();
		this.abortController = new AbortController();
		this.state = {
			mode: "projects",
			problemId: "",
		};

		this.bindEvents();
		this.restoreFromUrl();
	}

	destroy() {
		this.abortController.abort();
		for (const timer of this.searchTimers.values()) {
			clearTimeout(timer);
		}
	}

	bindEvents() {
		const { signal } = this.abortController;

		for (const tab of this.tabs) {
			tab.addEventListener(
				"click",
				() => {
					this.setMode(tab.dataset.discoveryTab || "projects", {
						updateUrl: true,
					});
				},
				{ signal },
			);
			tab.addEventListener("keydown", (event) => this.handleTabKeydown(event), {
				signal,
			});
		}

		this.root.addEventListener(
			"click",
			(event) => {
				const target = event.target;
				if (!(target instanceof Element)) return;

				const problemButton = target.closest("[data-problem-option]");
				if (problemButton) {
					this.selectProblem(problemButton.dataset.problemId || "", {
						updateUrl: true,
						moveFocus: true,
					});
					return;
				}

				if (target.closest("[data-problem-back]")) {
					this.showProblemOverview({ updateUrl: true, moveFocus: true });
					return;
				}

				const technologyButton = target.closest("[data-technology-filter]");
				if (technologyButton) {
					this.toggleTechnologyFilter(technologyButton);
					return;
				}

				const useCaseButton = target.closest("[data-use-case-filter]");
				if (useCaseButton) {
					this.toggleUseCaseFilter(useCaseButton);
					return;
				}

				const detail = target.closest("[data-problem-detail]");
				if (target.closest("[data-clear-search]") && detail) {
					this.clearSearch(detail);
					return;
				}
				if (target.closest("[data-clear-technology]") && detail) {
					this.clearTechnologyFilter(detail);
					return;
				}
				if (target.closest("[data-clear-use-case]") && detail) {
					this.clearUseCaseFilter(detail);
					return;
				}
				if (target.closest("[data-view-projects]")) {
					this.setMode("projects", { updateUrl: true, moveFocus: true });
				}
			},
			{ signal },
		);

		for (const searchInput of this.root.querySelectorAll(
			"[data-problem-search]",
		)) {
			searchInput.addEventListener(
				"input",
				() => {
					clearTimeout(this.searchTimers.get(searchInput));
					const timer = setTimeout(() => {
						const detail = searchInput.closest("[data-problem-detail]");
						if (!detail) return;
						this.applyProblemFilters(detail, { updateUrl: true });
					}, 180);
					this.searchTimers.set(searchInput, timer);
				},
				{ signal },
			);
		}
	}

	handleTabKeydown(event) {
		const currentIndex = this.tabs.indexOf(event.currentTarget);
		if (currentIndex < 0) return;

		let nextIndex = currentIndex;
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			nextIndex = (currentIndex + 1) % this.tabs.length;
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
		} else if (event.key === "Home") {
			nextIndex = 0;
		} else if (event.key === "End") {
			nextIndex = this.tabs.length - 1;
		} else {
			return;
		}

		event.preventDefault();
		this.tabs[nextIndex]?.focus();
		this.setMode(this.tabs[nextIndex]?.dataset.discoveryTab || "projects", {
			updateUrl: true,
		});
	}

	restoreFromUrl() {
		const params = new URLSearchParams(window.location.search);
		const mode = params.get("view") === "problems" ? "problems" : "projects";
		const problemId = params.get("problem") || "";
		this.setMode(problemId ? "problems" : mode, { updateUrl: false });

		if (problemId) {
			this.selectProblem(problemId, { updateUrl: false, moveFocus: false });
			const detail = this.getActiveProblemDetail();
			if (detail) {
				const search = params.get("problemSearch") || "";
				const technology = params.get("technology") || "";
				const useCase = params.get("useCase") || "";
				const input = detail.querySelector("[data-problem-search]");
				if (input) input.value = search;
				if (technology) detail.dataset.activeTechnology = technology;
				if (useCase) detail.dataset.activeUseCase = useCase;
				this.syncFilterButtons(detail);
				this.applyProblemFilters(detail, { updateUrl: false });
			}
		}
	}

	setMode(mode, { updateUrl = true, moveFocus = false } = {}) {
		const nextMode = mode === "problems" ? "problems" : "projects";
		this.state.mode = nextMode;

		for (const tab of this.tabs) {
			const active = tab.dataset.discoveryTab === nextMode;
			tab.setAttribute("aria-selected", String(active));
			tab.setAttribute("tabindex", active ? "0" : "-1");
		}

		for (const panel of this.panels) {
			panel.hidden = panel.dataset.discoveryPanel !== nextMode;
		}

		if (moveFocus) {
			this.tabs
				.find((tab) => tab.dataset.discoveryTab === nextMode)
				?.focus({
					preventScroll: true,
				});
		}

		this.announce(
			nextMode === "problems"
				? "Choose a Problem mode selected."
				: "Browse Projects mode selected.",
		);
		if (updateUrl) this.updateUrl();
	}

	selectProblem(problemId, { updateUrl = true, moveFocus = true } = {}) {
		if (!problemId) {
			this.showProblemOverview({ updateUrl, moveFocus });
			return;
		}

		this.setMode("problems", { updateUrl: false });
		this.state.problemId = problemId;

		const overview = this.root.querySelector("[data-problem-overview]");
		if (overview) overview.hidden = true;

		for (const detail of this.root.querySelectorAll("[data-problem-detail]")) {
			const active = detail.dataset.problemDetail === problemId;
			detail.hidden = !active;
			if (active) {
				this.syncFilterButtons(detail);
				this.applyProblemFilters(detail, { updateUrl: false });
			}
		}

		for (const button of this.root.querySelectorAll("[data-problem-option]")) {
			const active = button.dataset.problemId === problemId;
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("is-active", active);
		}

		const activeDetail = this.getActiveProblemDetail();
		const heading =
			activeDetail?.querySelector("h2")?.textContent?.trim() || "problem";
		this.announce(`${heading} problem selected.`);

		if (moveFocus) {
			activeDetail?.querySelector("[data-problem-back]")?.focus({
				preventScroll: true,
			});
		}
		if (updateUrl) this.updateUrl();
	}

	showProblemOverview({ updateUrl = true, moveFocus = true } = {}) {
		this.setMode("problems", { updateUrl: false });
		this.state.problemId = "";

		const overview = this.root.querySelector("[data-problem-overview]");
		if (overview) overview.hidden = false;

		for (const detail of this.root.querySelectorAll("[data-problem-detail]")) {
			detail.hidden = true;
		}

		for (const button of this.root.querySelectorAll("[data-problem-option]")) {
			button.setAttribute("aria-pressed", "false");
			button.classList.remove("is-active");
		}

		this.announce("All problem areas shown.");
		if (moveFocus) {
			this.root.querySelector("[data-problem-option]")?.focus({
				preventScroll: true,
			});
		}
		if (updateUrl) this.updateUrl();
	}

	getActiveProblemDetail() {
		if (!this.state.problemId) return null;
		return this.root.querySelector(
			`[data-problem-detail="${this.state.problemId}"]`,
		);
	}

	toggleTechnologyFilter(button) {
		const detail = button.closest("[data-problem-detail]");
		if (!detail) return;
		const key = button.dataset.technologyFilter || "";
		detail.dataset.activeTechnology =
			detail.dataset.activeTechnology === key ? "" : key;
		this.syncFilterButtons(detail);
		this.applyProblemFilters(detail, { updateUrl: true });
	}

	toggleUseCaseFilter(button) {
		const detail = button.closest("[data-problem-detail]");
		if (!detail) return;
		const key = button.dataset.useCaseFilter || "";
		detail.dataset.activeUseCase =
			detail.dataset.activeUseCase === key ? "" : key;
		this.syncFilterButtons(detail);
		this.applyProblemFilters(detail, { updateUrl: true });
	}

	clearSearch(detail) {
		const input = detail.querySelector("[data-problem-search]");
		if (input) input.value = "";
		this.applyProblemFilters(detail, { updateUrl: true });
	}

	clearTechnologyFilter(detail) {
		detail.dataset.activeTechnology = "";
		this.syncFilterButtons(detail);
		this.applyProblemFilters(detail, { updateUrl: true });
	}

	clearUseCaseFilter(detail) {
		detail.dataset.activeUseCase = "";
		this.syncFilterButtons(detail);
		this.applyProblemFilters(detail, { updateUrl: true });
	}

	syncFilterButtons(detail) {
		const activeTechnology = detail.dataset.activeTechnology || "";
		const activeUseCase = detail.dataset.activeUseCase || "";

		for (const button of detail.querySelectorAll("[data-technology-filter]")) {
			const active = button.dataset.technologyFilter === activeTechnology;
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("is-active", active);
		}

		for (const button of detail.querySelectorAll("[data-use-case-filter]")) {
			const active = button.dataset.useCaseFilter === activeUseCase;
			button.setAttribute("aria-pressed", String(active));
			button.classList.toggle("is-active", active);
		}

		for (const button of detail.querySelectorAll("[data-clear-technology]")) {
			button.hidden = !activeTechnology;
		}
		for (const button of detail.querySelectorAll("[data-clear-use-case]")) {
			button.hidden = !activeUseCase;
		}
	}

	applyProblemFilters(detail, { updateUrl = true } = {}) {
		const query = (detail.querySelector("[data-problem-search]")?.value || "")
			.trim()
			.toLowerCase();
		const activeTechnology = detail.dataset.activeTechnology || "";
		const activeUseCase = detail.dataset.activeUseCase || "";
		let visibleCount = 0;

		for (const card of detail.querySelectorAll("[data-problem-card]")) {
			const searchText = card.dataset.search || "";
			const technologyKeys = (card.dataset.technologyKeys || "").split(" ");
			const useCaseKeys = (card.dataset.useCaseKeys || "").split(" ");
			const matchesSearch = !query || searchText.includes(query);
			const matchesTechnology =
				!activeTechnology || technologyKeys.includes(activeTechnology);
			const matchesUseCase =
				!activeUseCase || useCaseKeys.includes(activeUseCase);
			const visible = matchesSearch && matchesTechnology && matchesUseCase;
			card.hidden = !visible;
			if (visible) visibleCount += 1;
		}

		const count = detail.querySelector("[data-problem-result-count]");
		if (count) {
			count.textContent = `${visibleCount} ${
				visibleCount === 1 ? "project" : "projects"
			}`;
		}

		const empty = detail.querySelector("[data-problem-empty]");
		if (empty) empty.hidden = visibleCount !== 0;

		const clearSearchButtons = detail.querySelectorAll("[data-clear-search]");
		for (const button of clearSearchButtons) {
			button.hidden = !query;
		}

		this.syncFilterButtons(detail);
		const title = detail.querySelector("h2")?.textContent?.trim() || "problem";
		this.announce(`${visibleCount} projects shown for ${title}.`);
		if (updateUrl) this.updateUrl();
	}

	updateUrl() {
		const url = new URL(window.location.href);
		url.searchParams.set("view", this.state.mode);

		if (this.state.mode === "problems" && this.state.problemId) {
			const detail = this.getActiveProblemDetail();
			const search =
				detail?.querySelector("[data-problem-search]")?.value || "";
			url.searchParams.set("problem", this.state.problemId);
			this.setOptionalParam(
				url,
				"technology",
				detail?.dataset.activeTechnology || "",
			);
			this.setOptionalParam(
				url,
				"useCase",
				detail?.dataset.activeUseCase || "",
			);
			this.setOptionalParam(url, "problemSearch", search.trim());
		} else {
			url.searchParams.delete("problem");
			url.searchParams.delete("technology");
			url.searchParams.delete("useCase");
			url.searchParams.delete("problemSearch");
		}

		window.history.replaceState({}, "", url);
	}

	setOptionalParam(url, key, value) {
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
	}

	announce(message) {
		if (!this.liveRegion) return;
		this.liveRegion.textContent = message;
	}
}

function initProjectProblemExplorer() {
	const root = document.querySelector("[data-project-discovery]");
	if (!root) return;
	if (window.__projectProblemExplorer?.root === root) return;
	window.__projectProblemExplorer?.destroy?.();
	window.__projectProblemExplorer = new ProjectProblemExplorer(root);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initProjectProblemExplorer, {
		once: true,
	});
} else {
	initProjectProblemExplorer();
}

document.addEventListener("astro:page-load", initProjectProblemExplorer);
document.addEventListener("swup:page:view", initProjectProblemExplorer);
