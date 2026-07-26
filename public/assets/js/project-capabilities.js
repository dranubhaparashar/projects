const MAX_COMPARISON_PROJECTS = 3;
const MIN_COMPARISON_PROJECTS = 2;

function normalizeText(value) {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function parseJsonScript(id) {
	const script = document.getElementById(id);
	if (!script) return null;
	try {
		return JSON.parse(script.textContent || "{}");
	} catch (error) {
		console.error(`Unable to read ${id}.`, error);
		return null;
	}
}

function isExternalUrl(href) {
	try {
		return (
			new URL(href, window.location.href).origin !== window.location.origin
		);
	} catch {
		return false;
	}
}

function createLink(label, href, className = "") {
	const link = document.createElement("a");
	link.href = href;
	link.textContent = label;
	if (className) link.className = className;
	if (isExternalUrl(href)) {
		link.target = "_blank";
		link.rel = "noopener noreferrer";
	}
	return link;
}

function compactText(value, length = 130) {
	const text = String(value || "")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= length) return text;
	const truncated = text.slice(0, length);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${truncated.slice(0, Math.max(lastSpace, length - 25)).trim()}…`;
}

class ProjectCapabilitiesExplorer {
	constructor(app, capabilityData, comparisonData) {
		this.app = app;
		this.capabilityData = capabilityData;
		this.comparisonData = comparisonData;
		this.abortController = new AbortController();
		this.selectedProjects = new Set();
		this.comparisonMode = "all";
		this.lastCapabilityTrigger = null;
		this.projectById = new Map(
			comparisonData.projects.map((project) => [project.id, project]),
		);
		this.matrixProjectById = new Map(
			capabilityData.projects.map((project) => [project.id, project]),
		);
		this.capabilityById = new Map(
			capabilityData.capabilities.map((capability) => [
				capability.id,
				capability,
			]),
		);
		this.cacheElements();
		this.bindEvents();
		this.filterMatrix();
		this.restoreComparisonFromUrl({ normalizeUrl: true });
	}

	cacheElements() {
		this.matrix = this.app.querySelector("[data-capability-matrix]");
		this.capabilitySearch = this.app.querySelector("[data-capability-search]");
		this.projectSearch = this.app.querySelector(
			"[data-capability-project-search]",
		);
		this.domainFilter = this.app.querySelector("[data-capability-domain]");
		this.categoryFilter = this.app.querySelector("[data-capability-category]");
		this.capabilityMode = this.app.querySelector("[data-capability-mode]");
		this.matrixStatus = this.app.querySelector(
			"[data-capability-filter-status]",
		);
		this.matrixNoResults = this.app.querySelector(
			"[data-capability-no-results]",
		);
		this.visibleProjectCount = this.app.querySelector(
			"[data-capability-visible-count]",
		);
		this.capabilityDetail = this.app.querySelector("[data-capability-detail]");

		this.comparison = this.app.querySelector("[data-project-comparison]");
		this.comparisonSearch = this.app.querySelector("[data-comparison-search]");
		this.comparisonCount = this.app.querySelector("[data-comparison-count]");
		this.comparisonLimit = this.app.querySelector("[data-comparison-limit]");
		this.comparisonSelected = this.app.querySelector(
			"[data-comparison-selected]",
		);
		this.comparisonClear = this.app.querySelector("[data-comparison-clear]");
		this.comparisonSubmit = this.app.querySelector("[data-comparison-submit]");
		this.comparisonResults = this.app.querySelector(
			"[data-comparison-results]",
		);
		this.comparisonHead = this.app.querySelector("[data-comparison-head]");
		this.comparisonBody = this.app.querySelector("[data-comparison-body]");
		this.comparisonMobile = this.app.querySelector("[data-comparison-mobile]");
		this.comparisonSummary = this.app.querySelector(
			"[data-comparison-summary]",
		);
		this.comparisonModeEmpty = this.app.querySelector(
			"[data-comparison-mode-empty]",
		);
	}

	bindEvents() {
		const signal = this.abortController.signal;
		for (const control of [
			this.capabilitySearch,
			this.projectSearch,
			this.domainFilter,
			this.categoryFilter,
			this.capabilityMode,
		]) {
			control?.addEventListener("input", () => this.filterMatrix(), {
				signal,
			});
			control?.addEventListener("change", () => this.filterMatrix(), {
				signal,
			});
		}

		this.app
			.querySelector("[data-capability-clear]")
			?.addEventListener("click", () => this.clearMatrixFilters(), {
				signal,
			});

		this.app.addEventListener(
			"click",
			(event) => {
				const trigger = event.target.closest("[data-capability-cell]");
				if (trigger) {
					this.openCapabilityDetail(
						trigger.dataset.capabilityId,
						trigger.dataset.projectId,
						trigger,
					);
					return;
				}

				if (event.target.closest("[data-capability-detail-close]")) {
					this.closeCapabilityDetail();
					return;
				}

				const removeButton = event.target.closest("[data-comparison-remove]");
				if (removeButton) {
					this.setProjectSelected(removeButton.dataset.comparisonRemove, false);
					return;
				}

				const modeButton = event.target.closest("[data-comparison-mode]");
				if (modeButton) {
					this.setComparisonMode(modeButton.dataset.comparisonMode);
				}
			},
			{ signal },
		);

		this.app.addEventListener(
			"change",
			(event) => {
				const checkbox = event.target.closest("[data-comparison-select]");
				if (!checkbox) return;
				this.setProjectSelected(checkbox.value, checkbox.checked, {
					source: checkbox,
				});
			},
			{ signal },
		);

		this.comparisonSearch?.addEventListener(
			"input",
			() => this.filterComparisonProjects(),
			{ signal },
		);
		this.comparisonClear?.addEventListener(
			"click",
			() => {
				this.selectedProjects.clear();
				this.commitSelectionToUrl();
				this.syncComparisonSelection();
			},
			{ signal },
		);
		this.comparisonSubmit?.addEventListener(
			"click",
			() => {
				if (this.selectedProjects.size < MIN_COMPARISON_PROJECTS) return;
				this.renderComparison();
				this.comparisonResults?.scrollIntoView({
					behavior: "smooth",
					block: "start",
				});
			},
			{ signal },
		);
		window.addEventListener(
			"popstate",
			() => this.restoreComparisonFromUrl({ normalizeUrl: false }),
			{ signal },
		);
	}

	clearMatrixFilters() {
		this.capabilitySearch.value = "";
		this.projectSearch.value = "";
		this.domainFilter.value = "";
		this.categoryFilter.value = "";
		this.capabilityMode.value = "all";
		this.filterMatrix();
	}

	filterMatrix() {
		const capabilityQuery = normalizeText(this.capabilitySearch?.value);
		const projectQuery = normalizeText(this.projectSearch?.value);
		const domain = normalizeText(this.domainFilter?.value);
		const category = normalizeText(this.categoryFilter?.value);
		const demonstratedOnly = this.capabilityMode?.value === "demonstrated";
		const visibleProjectIds = new Set(
			this.capabilityData.projects
				.filter((project) => {
					const titleMatches =
						!projectQuery ||
						normalizeText(
							`${project.title} ${project.description} ${project.tags.join(" ")}`,
						).includes(projectQuery);
					const domainMatches =
						!domain ||
						project.impactDomains.some(
							(value) => normalizeText(value) === domain,
						);
					const categoryMatches =
						!category || normalizeText(project.category) === category;
					return titleMatches && domainMatches && categoryMatches;
				})
				.map((project) => project.id),
		);

		for (const column of this.app.querySelectorAll(
			"[data-capability-project-column]",
		)) {
			column.hidden = !visibleProjectIds.has(
				column.dataset.capabilityProjectColumn,
			);
		}

		let visibleRows = 0;
		for (const capability of this.capabilityData.capabilities) {
			const matchingVisibleProjects = this.capabilityData.projects.filter(
				(project) =>
					visibleProjectIds.has(project.id) &&
					Boolean(this.capabilityData.matches[project.id]?.[capability.id]),
			);
			const labelMatches =
				!capabilityQuery ||
				normalizeText(`${capability.label} ${capability.description}`).includes(
					capabilityQuery,
				);
			const rowVisible =
				labelMatches &&
				(!demonstratedOnly || matchingVisibleProjects.length > 0);

			for (const row of this.app.querySelectorAll(
				`[data-capability-row="${CSS.escape(capability.id)}"], [data-capability-mobile-row="${CSS.escape(capability.id)}"]`,
			)) {
				row.hidden = !rowVisible;
			}
			if (rowVisible) visibleRows += 1;

			const mobileRow = this.app.querySelector(
				`[data-capability-mobile-row="${CSS.escape(capability.id)}"]`,
			);
			if (mobileRow) {
				for (const projectCard of mobileRow.querySelectorAll(
					"[data-capability-mobile-project]",
				)) {
					projectCard.hidden = !visibleProjectIds.has(
						projectCard.dataset.capabilityMobileProject,
					);
				}
				const count = mobileRow.querySelector("[data-capability-mobile-count]");
				if (count) count.textContent = matchingVisibleProjects.length;
				this.syncMobileEmptyState(
					mobileRow,
					matchingVisibleProjects.length === 0,
				);
			}
		}

		if (this.visibleProjectCount) {
			this.visibleProjectCount.textContent = visibleProjectIds.size;
		}
		const projectLabel = visibleProjectIds.size === 1 ? "project" : "projects";
		const capabilityLabel = visibleRows === 1 ? "capability" : "capabilities";
		if (this.matrixStatus) {
			this.matrixStatus.textContent = `Showing ${visibleRows} ${capabilityLabel} across ${visibleProjectIds.size} ${projectLabel}.`;
		}
		if (this.matrixNoResults) {
			this.matrixNoResults.hidden =
				visibleProjectIds.size > 0 && visibleRows > 0;
		}
	}

	syncMobileEmptyState(row, isEmpty) {
		let empty = row.querySelector("[data-capability-mobile-filter-empty]");
		if (!empty) {
			empty = document.createElement("p");
			empty.dataset.capabilityMobileFilterEmpty = "";
			empty.className = "capability-mobile-empty";
			empty.textContent =
				"No documented projects match the current project filters.";
			row.querySelector(".capability-mobile-projects")?.appendChild(empty);
		}
		const permanentEmpty = row.querySelector(
			".capability-mobile-empty:not([data-capability-mobile-filter-empty])",
		);
		if (permanentEmpty) permanentEmpty.hidden = !isEmpty;
		empty.hidden = !isEmpty || Boolean(permanentEmpty);
	}

	openCapabilityDetail(capabilityId, projectId, trigger) {
		const match = this.capabilityData.matches[projectId]?.[capabilityId];
		const capability = this.capabilityById.get(capabilityId);
		const project = this.matrixProjectById.get(projectId);
		if (!match || !capability || !project || !this.capabilityDetail) return;

		this.lastCapabilityTrigger = trigger;
		this.capabilityDetail.querySelector(
			"[data-capability-detail-title]",
		).textContent = `${capability.label} in ${project.title}`;
		this.capabilityDetail.querySelector(
			"[data-capability-detail-explanation]",
		).textContent = match.explanation;

		const evidenceList = this.capabilityDetail.querySelector(
			"[data-capability-detail-evidence]",
		);
		evidenceList.replaceChildren(
			...match.evidence.map((item) => {
				const listItem = document.createElement("li");
				listItem.textContent = item;
				return listItem;
			}),
		);

		this.setOptionalDetail(
			"[data-capability-excerpt-section]",
			"[data-capability-detail-excerpt]",
			match.excerpt,
		);
		this.setOptionalDetail(
			"[data-capability-deployment-section]",
			"[data-capability-detail-deployment]",
			match.deploymentContext,
		);

		const technologySection = this.capabilityDetail.querySelector(
			"[data-capability-technologies-section]",
		);
		const technologyList = this.capabilityDetail.querySelector(
			"[data-capability-detail-technologies]",
		);
		technologySection.hidden = match.technologies.length === 0;
		technologyList.replaceChildren(
			...match.technologies.map((technology) => {
				const tag = document.createElement("span");
				tag.textContent = technology;
				return tag;
			}),
		);

		const actions = this.capabilityDetail.querySelector(
			"[data-capability-detail-actions]",
		);
		const actionLinks = [
			createLink("View Project", project.url, "btn-regular"),
			...match.actions.map((action) =>
				createLink(action.label, action.url, "btn-plain"),
			),
		];
		actions.replaceChildren(...actionLinks);
		this.capabilityDetail.hidden = false;
		this.capabilityDetail.focus({ preventScroll: true });
		this.capabilityDetail.scrollIntoView({
			behavior: "smooth",
			block: "nearest",
		});
	}

	setOptionalDetail(sectionSelector, valueSelector, value) {
		const section = this.capabilityDetail.querySelector(sectionSelector);
		const element = this.capabilityDetail.querySelector(valueSelector);
		section.hidden = !value;
		element.textContent = value || "";
	}

	closeCapabilityDetail() {
		if (!this.capabilityDetail) return;
		this.capabilityDetail.hidden = true;
		this.lastCapabilityTrigger?.focus();
		this.lastCapabilityTrigger = null;
	}

	filterComparisonProjects() {
		const query = normalizeText(this.comparisonSearch?.value);
		let visible = 0;
		for (const option of this.app.querySelectorAll(
			"[data-comparison-project-option]",
		)) {
			const projectId = option.dataset.comparisonProjectOption;
			const matrixProject = this.matrixProjectById.get(projectId);
			const capabilities = (matrixProject?.capabilityIds || [])
				.map((id) => this.capabilityById.get(id)?.label || "")
				.join(" ");
			const haystack = normalizeText(
				`${option.dataset.projectSearch || ""} ${capabilities} ${(matrixProject?.impactDomains || []).join(" ")}`,
			);
			option.hidden = Boolean(query && !haystack.includes(query));
			if (!option.hidden) visible += 1;
		}
		const empty = this.app.querySelector("[data-comparison-search-empty]");
		if (empty) empty.hidden = visible > 0;
	}

	setProjectSelected(projectId, selected, options = {}) {
		if (!this.projectById.has(projectId)) return;
		if (
			selected &&
			!this.selectedProjects.has(projectId) &&
			this.selectedProjects.size >= MAX_COMPARISON_PROJECTS
		) {
			if (options.source) options.source.checked = false;
			if (this.comparisonLimit) this.comparisonLimit.hidden = false;
			return;
		}

		if (selected) {
			this.selectedProjects.add(projectId);
		} else {
			this.selectedProjects.delete(projectId);
		}
		this.commitSelectionToUrl();
		this.syncComparisonSelection();
	}

	commitSelectionToUrl() {
		const nextUrl = new URL(window.location.href);
		const selected = [...this.selectedProjects].slice(
			0,
			MAX_COMPARISON_PROJECTS,
		);
		if (selected.length > 0) {
			nextUrl.searchParams.set("compare", selected.join(","));
		} else {
			nextUrl.searchParams.delete("compare");
		}
		const nextRelative = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
		const currentRelative = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		if (nextRelative !== currentRelative) {
			window.history.pushState({ compare: selected }, "", nextRelative);
		}
	}

	restoreComparisonFromUrl({ normalizeUrl }) {
		const url = new URL(window.location.href);
		const requested = (url.searchParams.get("compare") || "")
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);
		const valid = [];
		for (const projectId of requested) {
			if (
				this.projectById.has(projectId) &&
				!valid.includes(projectId) &&
				valid.length < MAX_COMPARISON_PROJECTS
			) {
				valid.push(projectId);
			}
		}
		this.selectedProjects = new Set(valid);

		if (normalizeUrl && requested.join(",") !== valid.join(",")) {
			if (valid.length > 0) {
				url.searchParams.set("compare", valid.join(","));
			} else {
				url.searchParams.delete("compare");
			}
			window.history.replaceState(
				{ compare: valid },
				"",
				`${url.pathname}${url.search}${url.hash}`,
			);
		}
		this.syncComparisonSelection();
	}

	syncComparisonSelection() {
		const size = this.selectedProjects.size;
		for (const checkbox of this.app.querySelectorAll(
			"[data-comparison-select]",
		)) {
			const isSelected = this.selectedProjects.has(checkbox.value);
			checkbox.checked = isSelected;
			checkbox.disabled = !isSelected && size >= MAX_COMPARISON_PROJECTS;
		}

		if (this.comparisonCount) {
			this.comparisonCount.textContent = `${size} of ${MAX_COMPARISON_PROJECTS} projects selected`;
		}
		if (this.comparisonLimit) {
			this.comparisonLimit.hidden = size < MAX_COMPARISON_PROJECTS;
		}
		if (this.comparisonClear) this.comparisonClear.disabled = size === 0;
		if (this.comparisonSubmit) {
			this.comparisonSubmit.disabled = size < MIN_COMPARISON_PROJECTS;
		}

		this.renderSelectedChips();
		if (size >= MIN_COMPARISON_PROJECTS) {
			this.renderComparison();
		} else if (this.comparisonResults) {
			this.comparisonResults.hidden = true;
		}
	}

	renderSelectedChips() {
		if (!this.comparisonSelected) return;
		const chips = [...this.selectedProjects]
			.map((projectId) => this.projectById.get(projectId))
			.filter(Boolean)
			.map((project) => {
				const chip = document.createElement("span");
				chip.className = "comparison-selected-chip";
				const label = document.createElement("span");
				label.textContent = project.title;
				const remove = document.createElement("button");
				remove.type = "button";
				remove.dataset.comparisonRemove = project.id;
				remove.setAttribute(
					"aria-label",
					`Remove ${project.title} from comparison`,
				);
				remove.textContent = "×";
				chip.append(label, remove);
				return chip;
			});
		this.comparisonSelected.replaceChildren(...chips);
	}

	renderComparison() {
		const projects = [...this.selectedProjects]
			.map((projectId) => this.projectById.get(projectId))
			.filter(Boolean);
		if (projects.length < MIN_COMPARISON_PROJECTS || !this.comparisonResults) {
			return;
		}

		const rows = this.comparisonData.rows
			.map((row) => ({
				...row,
				values: projects.map((project) => project.values[row.id] || null),
			}))
			.filter((row) => row.values.some(Boolean))
			.map((row) => ({
				...row,
				classification: this.classifyComparisonRow(row),
			}));

		this.renderComparisonHead(projects);
		this.renderComparisonRows(projects, rows);
		this.renderComparisonSummary(projects, rows);
		this.comparisonResults.hidden = false;
		this.setComparisonMode(this.comparisonMode, { focus: false });
	}

	classifyComparisonRow(row) {
		if (row.values.some((value) => !value)) return "unknown";
		if (row.kind === "tags") {
			const normalizedTagSets = row.values.map(
				(value) => new Set((value.tags || []).map((tag) => normalizeText(tag))),
			);
			const common = [...normalizedTagSets[0]].filter((tag) =>
				normalizedTagSets.slice(1).every((set) => set.has(tag)),
			);
			return common.length > 0 ? "similarity" : "difference";
		}
		const normalized = row.values.map((value) => normalizeText(value.text));
		return normalized.every((value) => value === normalized[0])
			? "similarity"
			: "difference";
	}

	renderComparisonHead(projects) {
		const row = document.createElement("tr");
		const property = document.createElement("th");
		property.scope = "col";
		property.className = "comparison-property-column";
		property.textContent = "Property";
		row.appendChild(property);

		for (const project of projects) {
			const header = document.createElement("th");
			header.scope = "col";
			header.className = "comparison-project-heading";
			header.appendChild(createLink(project.title, project.url));
			const actions = document.createElement("nav");
			actions.className = "comparison-project-actions";
			actions.setAttribute("aria-label", `${project.title} actions`);
			actions.append(
				createLink("View Project", project.url),
				...project.actions.map((action) =>
					createLink(action.label, action.url),
				),
			);
			header.appendChild(actions);
			row.appendChild(header);
		}
		this.comparisonHead.replaceChildren(row);
	}

	renderComparisonRows(projects, rows) {
		const desktopRows = [];
		const mobileRows = [];

		for (const rowData of rows) {
			const row = document.createElement("tr");
			row.dataset.comparisonRow = rowData.classification;
			row.className =
				rowData.classification === "similarity"
					? "comparison-row-similarity"
					: rowData.classification === "difference"
						? "comparison-row-difference"
						: "";
			const heading = document.createElement("th");
			heading.scope = "row";
			heading.className = "comparison-property-column";
			heading.textContent = rowData.label;
			row.appendChild(heading);
			for (const value of rowData.values) {
				const cell = document.createElement("td");
				cell.appendChild(this.renderComparisonValue(value));
				row.appendChild(cell);
			}
			desktopRows.push(row);

			const mobile = document.createElement("section");
			mobile.className = "comparison-mobile-row";
			mobile.dataset.comparisonMobileRow = rowData.classification;
			const mobileHeading = document.createElement("h6");
			mobileHeading.textContent = rowData.label;
			mobile.appendChild(mobileHeading);
			projects.forEach((project, index) => {
				const projectValue = document.createElement("div");
				projectValue.className = "comparison-mobile-project-value";
				const projectTitle = document.createElement("strong");
				projectTitle.textContent = project.title;
				projectValue.append(
					projectTitle,
					this.renderComparisonValue(rowData.values[index], true),
				);
				mobile.appendChild(projectValue);
			});
			mobileRows.push(mobile);
		}

		this.comparisonBody.replaceChildren(...desktopRows);
		this.comparisonMobile.replaceChildren(...mobileRows);
	}

	renderComparisonValue(value, wrapText = false) {
		if (!value) {
			const missing = document.createElement(wrapText ? "p" : "span");
			missing.className = "comparison-missing";
			missing.textContent = "Not documented";
			return missing;
		}
		if (value.tags?.length) {
			const tags = document.createElement("div");
			tags.className = "comparison-value-tags";
			for (const item of value.tags) {
				const tag = document.createElement("span");
				tag.className = "comparison-tag";
				tag.textContent = item;
				tags.appendChild(tag);
			}
			return tags;
		}
		if (value.link?.url) {
			return createLink(value.link.label, value.link.url, "link-underline");
		}
		const text = document.createElement(wrapText ? "p" : "span");
		text.textContent = value.text;
		return text;
	}

	renderComparisonSummary(projects, rows) {
		const differences = rows.filter(
			(row) => row.classification === "difference",
		);
		const similarities = rows.filter(
			(row) => row.classification === "similarity",
		);
		const selectedRows = [
			...differences.slice(0, 4),
			...(differences.length === 0 ? similarities.slice(0, 2) : []),
		];
		const bullets = selectedRows.map((row) => {
			const item = document.createElement("li");
			if (row.classification === "similarity") {
				if (row.kind === "tags") {
					const firstTags = row.values[0].tags || [];
					const common = firstTags.filter((tag) =>
						row.values
							.slice(1)
							.every((value) =>
								(value.tags || []).some(
									(candidate) =>
										normalizeText(candidate) === normalizeText(tag),
								),
							),
					);
					item.textContent = `All selected projects document ${compactText(common.join(", "), 100)} under ${row.label.toLowerCase()}.`;
				} else {
					item.textContent = `All selected projects document the same ${row.label.toLowerCase()}: ${compactText(row.values[0].text)}.`;
				}
				return item;
			}

			const statements = projects.map(
				(project, index) =>
					`${project.title} documents ${compactText(row.values[index]?.text || "Not documented", 105)}`,
			);
			if (statements.length === 2) {
				item.textContent = `${statements[0]}, while ${statements[1]}, for ${row.label.toLowerCase()}.`;
			} else {
				item.textContent = `For ${row.label.toLowerCase()}: ${statements.join("; ")}.`;
			}
			return item;
		});

		if (bullets.length === 0) {
			const item = document.createElement("li");
			item.textContent =
				"The selected projects do not have enough equivalent documented fields for a concise difference summary.";
			bullets.push(item);
		}
		this.comparisonSummary.replaceChildren(...bullets);
	}

	setComparisonMode(mode, options = {}) {
		if (!["all", "difference", "similarity"].includes(mode)) return;
		this.comparisonMode = mode;
		for (const button of this.app.querySelectorAll("[data-comparison-mode]")) {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.comparisonMode === mode),
			);
		}

		let visible = 0;
		for (const row of this.app.querySelectorAll(
			"[data-comparison-row], [data-comparison-mobile-row]",
		)) {
			const classification =
				row.dataset.comparisonRow || row.dataset.comparisonMobileRow;
			const show = mode === "all" || classification === mode;
			row.hidden = !show;
			if (show && row.hasAttribute("data-comparison-row")) {
				visible += 1;
			}
		}
		if (this.comparisonModeEmpty) {
			this.comparisonModeEmpty.hidden = visible > 0;
		}
		if (options.focus !== false) {
			this.app
				.querySelector(`[data-comparison-mode="${CSS.escape(mode)}"]`)
				?.focus();
		}
	}

	destroy() {
		this.abortController.abort();
	}
}

function initProjectCapabilities() {
	const app = document.querySelector("[data-capabilities-app]");
	if (!app) return;
	if (window.__projectCapabilitiesExplorer?.app === app) return;
	const capabilityData = parseJsonScript("project-capability-data");
	const comparisonData = parseJsonScript("project-comparison-data");
	if (!capabilityData || !comparisonData) return;
	window.__projectCapabilitiesExplorer?.destroy?.();
	window.__projectCapabilitiesExplorer = new ProjectCapabilitiesExplorer(
		app,
		capabilityData,
		comparisonData,
	);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initProjectCapabilities, {
		once: true,
	});
} else {
	initProjectCapabilities();
}

document.addEventListener("astro:page-load", initProjectCapabilities);
document.addEventListener("swup:page:view", initProjectCapabilities);
