const SVG_NS = "http://www.w3.org/2000/svg";
const STORAGE_KEY = "project-impact-view";

const ICON_PATHS = {
	factory: [
		"M3 21h18",
		"M5 21V9l5 3V9l5 3V6h4v15",
		"M8 17h1",
		"M12 17h1",
		"M16 17h1",
	],
	"radio-tower": [
		"M12 21l3-11",
		"M12 21L9 10",
		"M8.5 10.5a5 5 0 0 1 7 0",
		"M6 8a8.5 8.5 0 0 1 12 0",
		"M4 5.5a12 12 0 0 1 16 0",
	],
	eye: [
		"M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z",
		"M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
	],
	bot: [
		"M12 8V4",
		"M8 4h8",
		"M5 10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6Z",
		"M9 13h.01",
		"M15 13h.01",
		"M9 17h6",
	],
	shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "M9 12l2 2 4-5"],
	"graduation-cap": [
		"M22 10L12 5 2 10l10 5 10-5Z",
		"M6 12v4c3.5 2 8.5 2 12 0v-4",
		"M22 10v6",
	],
	route: [
		"M5 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
		"M19 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
		"M8 16h5a4 4 0 0 0 0-8h-1",
	],
	server: [
		"M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z",
		"M4 15a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3Z",
		"M8 8h.01",
		"M8 17h.01",
	],
	sparkles: [
		"M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7L12 3Z",
		"M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z",
		"M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z",
	],
	network: [
		"M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
		"M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
		"M12 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
		"M8.5 7l2.2 9",
		"M15.5 7l-2.2 9",
		"M9 5h6",
	],
};

function svgElement(name, attributes = {}) {
	const element = document.createElementNS(SVG_NS, name);
	for (const [key, value] of Object.entries(attributes)) {
		if (value !== undefined && value !== null)
			element.setAttribute(key, String(value));
	}
	return element;
}

function normalizeText(value) {
	return String(value || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function escapeHTML(value) {
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

function formatList(values) {
	const cleaned = values.filter(Boolean);
	if (cleaned.length === 0) return "shared project metadata";
	if (cleaned.length === 1) return cleaned[0];
	if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
	return `${cleaned.slice(0, -1).join(", ")} and ${cleaned[cleaned.length - 1]}`;
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function hashString(value) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function createIconSvg(iconName) {
	const svg = svgElement("svg", {
		viewBox: "0 0 24 24",
		width: "20",
		height: "20",
		"aria-hidden": "true",
		focusable: "false",
	});
	for (const pathData of ICON_PATHS[iconName] || ICON_PATHS.network) {
		svg.append(
			svgElement("path", {
				d: pathData,
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "2",
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
			}),
		);
	}
	return svg;
}

function injectInlineIcons(root) {
	root.querySelectorAll("[data-impact-icon]").forEach((target) => {
		if (target.childElementCount > 0) return;
		target.append(createIconSvg(target.dataset.impactIcon || "network"));
	});
}

function loadStoredMode() {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === "list" ? "list" : "graph";
	} catch {
		return "graph";
	}
}

function storeMode(mode) {
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		// Storage is optional.
	}
}

class ProjectImpactGraph {
	constructor(app) {
		this.app = app;
		this.data = JSON.parse(
			app.querySelector("#project-impact-data")?.textContent || "{}",
		);
		this.svg = app.querySelector("[data-impact-svg]");
		this.tooltip = app.querySelector("[data-impact-tooltip]");
		this.details = app.querySelector("[data-impact-details]");
		this.status = app.querySelector("[data-impact-status]");
		this.emptyState = app.querySelector("[data-impact-empty]");
		this.srSummary = app.querySelector("[data-impact-sr-summary]");
		this.list = app.querySelector("[data-impact-list]");
		this.width = 800;
		this.height = 520;
		this.alpha = 0;
		this.frame = 0;
		this.resizeFrame = 0;
		this.reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		this.transform = { x: 0, y: 0, k: 1 };
		this.state = {
			mode: loadStoredMode(),
			query: "",
			domain: "",
			category: "",
			tag: "",
			year: "",
			selectedId: "",
			selectedDomain: "",
		};
		this.domainMeta = new Map(
			this.data.domains.map((domain) => [domain.name, domain]),
		);
		this.projects = new Map(
			this.data.projects.map((project) => [project.id, project]),
		);
		this.nodes = this.data.projects.map((project, index) => ({
			...project,
			index,
			radius: 18 + Math.min(7, project.relatedProjects.length * 1.5),
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			visible: true,
			searchText: normalizeText(
				[
					project.title,
					project.description,
					project.category,
					project.primaryDomain,
					...project.domains,
					...project.tags,
				].join(" "),
			),
		}));
		this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
		this.edges = this.data.edges.map((edge) => ({
			...edge,
			sourceNode: null,
			targetNode: null,
			visible: true,
		}));
		for (const edge of this.edges) {
			edge.sourceNode = this.nodeById.get(edge.source);
			edge.targetNode = this.nodeById.get(edge.target);
		}
		this.edgeByPair = new Map(
			this.edges.map((edge) => [
				[edge.source, edge.target].sort().join("::"),
				edge,
			]),
		);
		this.nodeElements = new Map();
		this.edgeElements = new Map();
		this.clusterCenters = {};
		this.dragNode = null;
		this.dragStart = null;
		this.lastNodePress = null;
		this.panStart = null;
		this.searchTimer = 0;

		this.setupSvg();
		this.bindControls();
		this.resetNodePositions();
		injectInlineIcons(this.app);
		this.app.classList.add("impact-enhanced");
		this.setMode(this.state.mode, false);
		this.applyFilters(false);
		this.handleResize();
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		cancelAnimationFrame(this.resizeFrame);
		this.resizeObserver?.disconnect();
		window.removeEventListener("resize", this.boundResize);
	}

	setupSvg() {
		this.svg.textContent = "";
		this.viewport = svgElement("g", { class: "impact-graph-viewport" });
		this.edgeLayer = svgElement("g", { class: "impact-edge-layer" });
		this.nodeLayer = svgElement("g", { class: "impact-node-layer" });
		this.viewport.append(this.edgeLayer, this.nodeLayer);
		this.svg.append(this.viewport);

		for (const edge of this.edges) {
			const edgeElement = svgElement("path", {
				class: "impact-edge",
				"data-edge-id": `${edge.source}::${edge.target}`,
			});
			edgeElement.addEventListener("pointerenter", (event) =>
				this.showEdgeTooltip(edge, event),
			);
			edgeElement.addEventListener("pointermove", (event) =>
				this.moveTooltip(event),
			);
			edgeElement.addEventListener("pointerleave", () => this.hideTooltip());
			this.edgeLayer.append(edgeElement);
			this.edgeElements.set(`${edge.source}::${edge.target}`, edgeElement);
		}

		for (const node of this.nodes) {
			const domain = this.domainMeta.get(node.primaryDomain) || {};
			const nodeElement = svgElement("g", {
				class: "impact-node",
				role: "button",
				tabindex: "0",
				"data-node-id": node.id,
				"aria-label": `${node.title}, ${node.primaryDomain}, ${node.relatedProjects.length} related projects`,
			});
			nodeElement.style.setProperty(
				"--node-stroke",
				domain.color || "var(--accent-color)",
			);
			nodeElement.style.setProperty(
				"--node-fill",
				`color-mix(in srgb, ${domain.color || "var(--accent-color)"} 14%, white)`,
			);
			nodeElement.style.setProperty(
				"--node-fill-dark",
				`color-mix(in srgb, ${domain.color || "var(--accent-color)"} 24%, #101418)`,
			);
			const circle = svgElement("circle", { r: node.radius });
			const iconGroup = svgElement("g", { transform: "translate(-12 -12)" });
			for (const pathData of ICON_PATHS[node.icon] || ICON_PATHS.network) {
				iconGroup.append(svgElement("path", { d: pathData }));
			}
			nodeElement.append(circle, iconGroup, svgElement("title"));
			nodeElement.querySelector("title").textContent = node.title;
			nodeElement.addEventListener("click", () => this.selectProject(node.id));
			nodeElement.addEventListener("dblclick", () => this.openProject(node.id));
			nodeElement.addEventListener("pointerenter", (event) =>
				this.showNodeTooltip(node, event),
			);
			nodeElement.addEventListener("pointermove", (event) =>
				this.moveTooltip(event),
			);
			nodeElement.addEventListener("pointerleave", () => this.hideTooltip());
			nodeElement.addEventListener("focus", (event) =>
				this.showNodeTooltip(node, event),
			);
			nodeElement.addEventListener("blur", () => this.hideTooltip());
			nodeElement.addEventListener("keydown", (event) =>
				this.handleNodeKeydown(event, node),
			);
			nodeElement.addEventListener("pointerdown", (event) =>
				this.startNodeDrag(event, node),
			);
			this.nodeLayer.append(nodeElement);
			this.nodeElements.set(node.id, nodeElement);
		}

		this.svg.addEventListener("pointerdown", (event) => this.startPan(event));
		this.svg.addEventListener("pointermove", (event) =>
			this.handlePointerMove(event),
		);
		this.svg.addEventListener("pointerup", (event) =>
			this.endPointerGesture(event),
		);
		this.svg.addEventListener("pointercancel", (event) =>
			this.endPointerGesture(event),
		);
		this.svg.addEventListener(
			"wheel",
			(event) => {
				event.preventDefault();
				const scale = event.deltaY < 0 ? 1.12 : 0.88;
				this.zoomAt(scale, event.clientX, event.clientY);
			},
			{ passive: false },
		);

		this.boundResize = () => {
			cancelAnimationFrame(this.resizeFrame);
			this.resizeFrame = requestAnimationFrame(() => this.handleResize());
		};
		if ("ResizeObserver" in window) {
			this.resizeObserver = new ResizeObserver(this.boundResize);
			this.resizeObserver.observe(this.svg.parentElement);
		} else {
			window.addEventListener("resize", this.boundResize);
		}
	}

	bindControls() {
		const search = this.app.querySelector("[data-impact-search]");
		search?.addEventListener("input", (event) => {
			clearTimeout(this.searchTimer);
			this.searchTimer = window.setTimeout(() => {
				this.state.query = event.target.value;
				this.applyFilters();
			}, 160);
		});

		this.app.querySelectorAll("[data-impact-filter]").forEach((control) => {
			control.addEventListener("change", (event) => {
				this.state[event.target.dataset.impactFilter] = event.target.value;
				this.applyFilters();
			});
		});

		this.app
			.querySelectorAll("[data-impact-clear-filters]")
			.forEach((button) => {
				button.addEventListener("click", () => this.clearFilters());
			});

		this.app.querySelectorAll("[data-impact-view]").forEach((button) => {
			button.addEventListener("click", () =>
				this.setMode(button.dataset.impactView),
			);
		});

		this.app
			.querySelector("[data-impact-zoom='in']")
			?.addEventListener("click", () => this.zoomAt(1.22));
		this.app
			.querySelector("[data-impact-zoom='out']")
			?.addEventListener("click", () => this.zoomAt(0.82));
		this.app
			.querySelector("[data-impact-fit]")
			?.addEventListener("click", () => this.fitCurrentView());
		this.app
			.querySelector("[data-impact-reset]")
			?.addEventListener("click", () => this.resetView());

		this.app.querySelectorAll("[data-impact-domain]").forEach((button) => {
			button.addEventListener("click", () => {
				this.state.selectedDomain = button.dataset.impactDomain || "";
				this.updateLegend();
				this.updateStatus();
				this.updateHighlighting();
				const nodes = this.getVisibleNodes().filter((node) =>
					this.state.selectedDomain
						? node.primaryDomain === this.state.selectedDomain
						: true,
				);
				this.fitNodes(nodes.length ? nodes : this.getVisibleNodes());
			});
		});

		this.app.addEventListener("click", (event) => {
			const selectTarget = event.target.closest("[data-impact-select]");
			if (selectTarget) {
				event.preventDefault();
				this.setMode("graph");
				this.selectProject(selectTarget.dataset.impactSelect);
				return;
			}

			const clearSelection = event.target.closest(
				"[data-impact-clear-selection]",
			);
			if (clearSelection) {
				this.clearSelection();
			}
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && document.contains(this.app)) {
				this.clearSelection();
			}
		});
	}

	setMode(mode, shouldStore = true) {
		this.state.mode = mode === "list" ? "list" : "graph";
		this.app.querySelectorAll("[data-impact-view]").forEach((button) => {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.impactView === this.state.mode),
			);
		});
		this.app.querySelectorAll("[data-impact-panel]").forEach((panel) => {
			panel.hidden = panel.dataset.impactPanel !== this.state.mode;
		});
		if (shouldStore) storeMode(this.state.mode);
		if (this.state.mode === "graph") this.fitCurrentView();
	}

	applyFilters(shouldFit = true) {
		const query = normalizeText(this.state.query);
		const visibleIds = new Set();

		for (const node of this.nodes) {
			const matchesQuery = !query || node.searchText.includes(query);
			const matchesDomain =
				!this.state.domain || node.domains.includes(this.state.domain);
			const matchesCategory =
				!this.state.category || node.category === this.state.category;
			const matchesTag = !this.state.tag || node.tags.includes(this.state.tag);
			const matchesYear = !this.state.year || node.year === this.state.year;
			node.visible =
				matchesQuery &&
				matchesDomain &&
				matchesCategory &&
				matchesTag &&
				matchesYear;
			if (node.visible) visibleIds.add(node.id);
		}

		for (const edge of this.edges) {
			edge.visible = visibleIds.has(edge.source) && visibleIds.has(edge.target);
		}

		if (this.state.selectedId && !visibleIds.has(this.state.selectedId)) {
			this.state.selectedId = "";
			this.renderDetails(null);
		}

		this.emptyState.hidden = visibleIds.size !== 0;
		this.updateListVisibility(visibleIds);
		this.updateLegend();
		this.updateStatus();
		this.updateHighlighting();
		this.restartSimulation();
		if (shouldFit) window.setTimeout(() => this.fitCurrentView(), 80);
	}

	clearFilters() {
		this.state.query = "";
		this.state.domain = "";
		this.state.category = "";
		this.state.tag = "";
		this.state.year = "";
		this.app.querySelector("[data-impact-search]").value = "";
		this.app.querySelectorAll("[data-impact-filter]").forEach((control) => {
			control.value = "";
		});
		this.applyFilters();
	}

	updateListVisibility(visibleIds) {
		this.list
			?.querySelectorAll("[data-list-project]")
			.forEach((projectElement) => {
				projectElement.hidden = !visibleIds.has(
					projectElement.dataset.listProject,
				);
			});
		this.list
			?.querySelectorAll("[data-list-domain]")
			.forEach((domainElement) => {
				const visibleProjects = domainElement.querySelectorAll(
					"[data-list-project]:not([hidden])",
				);
				domainElement.hidden = visibleProjects.length === 0;
			});
	}

	updateLegend() {
		const counts = new Map();
		for (const node of this.nodes) {
			if (!node.visible) continue;
			counts.set(node.primaryDomain, (counts.get(node.primaryDomain) || 0) + 1);
		}

		this.app.querySelectorAll("[data-impact-domain]").forEach((button) => {
			const domain = button.dataset.impactDomain || "";
			const count = domain
				? counts.get(domain) || 0
				: this.getVisibleNodes().length;
			const countElement = button.querySelector("strong");
			if (countElement) countElement.textContent = String(count);
			const active = domain === this.state.selectedDomain;
			button.classList.toggle("is-active", active);
			button.setAttribute("aria-pressed", String(active));
		});
	}

	updateStatus() {
		const visibleNodes = this.getVisibleNodes();
		if (visibleNodes.length === 0) {
			this.status.textContent = "No projects match these filters.";
			return;
		}
		if (this.state.selectedDomain) {
			const count = visibleNodes.filter(
				(node) => node.primaryDomain === this.state.selectedDomain,
			).length;
			this.status.textContent = `${count} ${count === 1 ? "project" : "projects"} in "${this.state.selectedDomain}"`;
			return;
		}
		const domainCount = new Set(visibleNodes.map((node) => node.primaryDomain))
			.size;
		this.status.textContent = `${visibleNodes.length} ${visibleNodes.length === 1 ? "project" : "projects"} shown across ${domainCount} ${domainCount === 1 ? "domain" : "domains"}.`;
	}

	selectProject(projectId) {
		if (!projectId || !this.nodeById.has(projectId)) return;
		const node = this.nodeById.get(projectId);
		if (!node.visible) return;
		this.state.selectedId = projectId;
		this.renderDetails(node);
		this.updateHighlighting();
		this.fitNodes([
			node,
			...this.getRelatedNodes(projectId).filter((related) => related.visible),
		]);
	}

	clearSelection() {
		this.state.selectedId = "";
		this.renderDetails(null);
		this.updateHighlighting();
		this.fitCurrentView();
	}

	openProject(projectId) {
		const project = this.projects.get(projectId);
		if (project?.url) window.location.href = project.url;
	}

	renderDetails(project) {
		if (!project) {
			this.details.innerHTML =
				'<div class="impact-details-empty"><h2>Project Details</h2><p>No project selected.</p></div>';
			this.srSummary.textContent = "No project selected.";
			return;
		}

		const related = this.getRelatedProjectDetails(project.id);
		const additionalDomains = project.domains.filter(
			(domain) => domain !== project.primaryDomain,
		);
		const relatedMarkup = related.length
			? `<ul class="impact-detail-related-list">${related
					.map(({ project: relatedProject, edge }) => {
						const through = formatList(
							[...edge.sharedTags, ...edge.sharedDomains].slice(0, 4),
						);
						return `<li><button type="button" class="impact-related-button" data-impact-select="${escapeHTML(relatedProject.id)}">${escapeHTML(relatedProject.title)}</button><div class="impact-detail-related-note">Related through: ${escapeHTML(through)}</div></li>`;
					})
					.join("")}</ul>`
			: '<p class="impact-detail-related-note">No strong related projects in the current graph.</p>';

		this.details.innerHTML = `
			<div class="impact-detail-kicker">${escapeHTML(project.category)} / ${escapeHTML(project.date)}</div>
			<h2>${escapeHTML(project.title)}</h2>
			<p class="impact-detail-description">${escapeHTML(project.description)}</p>
			<div class="impact-detail-section">
				<h3>Primary impact domain</h3>
				<span class="impact-domain-chip">${escapeHTML(project.primaryDomain)}</span>
			</div>
			${additionalDomains.length ? `<div class="impact-detail-section"><h3>Additional impact domains</h3><div class="impact-chip-row">${additionalDomains.map((domain) => `<span>${escapeHTML(domain)}</span>`).join("")}</div></div>` : ""}
			<div class="impact-detail-section">
				<h3>Project tags</h3>
				<div class="impact-chip-row">${project.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div>
			</div>
			<div class="impact-detail-section">
				<h3>${related.length} ${related.length === 1 ? "related project" : "related projects"}</h3>
				${relatedMarkup}
			</div>
			<div class="impact-detail-actions">
				<a class="impact-project-link btn-regular" href="${escapeHTML(project.url)}">View full project</a>
				<button type="button" class="impact-clear-selection" data-impact-clear-selection>Clear selection</button>
			</div>`;
		this.srSummary.textContent = `${project.title} selected. Primary impact domain: ${project.primaryDomain}. ${related.length} related projects.`;
	}

	getRelatedProjectDetails(projectId) {
		return this.edges
			.filter((edge) => edge.source === projectId || edge.target === projectId)
			.sort((left, right) => right.score - left.score)
			.map((edge) => {
				const relatedId = edge.source === projectId ? edge.target : edge.source;
				return { project: this.projects.get(relatedId), edge };
			})
			.filter((item) => item.project);
	}

	getRelatedNodes(projectId) {
		return this.getRelatedProjectDetails(projectId)
			.map((item) => this.nodeById.get(item.project.id))
			.filter(Boolean);
	}

	getVisibleNodes() {
		return this.nodes.filter((node) => node.visible);
	}

	getVisibleEdges() {
		return this.edges.filter(
			(edge) => edge.visible && edge.sourceNode && edge.targetNode,
		);
	}

	updateHighlighting() {
		const selectedId = this.state.selectedId;
		const connectedIds = new Set();
		if (selectedId) {
			for (const edge of this.edges) {
				if (edge.source === selectedId) connectedIds.add(edge.target);
				if (edge.target === selectedId) connectedIds.add(edge.source);
			}
		}

		for (const node of this.nodes) {
			const element = this.nodeElements.get(node.id);
			if (!element) continue;
			const selected = node.id === selectedId;
			const connected = connectedIds.has(node.id);
			const outsideDomain =
				this.state.selectedDomain &&
				node.primaryDomain !== this.state.selectedDomain;
			element.classList.toggle("is-hidden", !node.visible);
			element.classList.toggle("is-selected", selected);
			element.classList.toggle("is-connected", connected);
			element.classList.toggle(
				"is-dimmed",
				node.visible &&
					((selectedId && !selected && !connected) ||
						(!selectedId && outsideDomain)),
			);
		}

		for (const edge of this.edges) {
			const element = this.edgeElements.get(`${edge.source}::${edge.target}`);
			if (!element) continue;
			const active =
				selectedId &&
				(edge.source === selectedId || edge.target === selectedId);
			const outsideDomain =
				this.state.selectedDomain &&
				edge.sourceNode?.primaryDomain !== this.state.selectedDomain &&
				edge.targetNode?.primaryDomain !== this.state.selectedDomain;
			element.classList.toggle("is-hidden", !edge.visible);
			element.classList.toggle("is-active", !!active);
			element.classList.toggle(
				"is-dimmed",
				edge.visible && !active && (!!selectedId || !!outsideDomain),
			);
		}
	}

	resetNodePositions() {
		this.computeClusterCenters();
		const domainOffsets = new Map();
		for (const node of this.nodes) {
			const center = this.clusterCenters[node.primaryDomain] || {
				x: this.width / 2,
				y: this.height / 2,
			};
			const ordinal = domainOffsets.get(node.primaryDomain) || 0;
			domainOffsets.set(node.primaryDomain, ordinal + 1);
			const hash = hashString(node.id);
			const angle = ((hash % 360) / 180) * Math.PI + ordinal * 0.62;
			const distance = 34 + (hash % 90);
			node.x = center.x + Math.cos(angle) * distance;
			node.y = center.y + Math.sin(angle) * distance;
			node.vx = 0;
			node.vy = 0;
		}
	}

	computeClusterCenters() {
		const visibleDomains = [
			...new Set(this.getVisibleNodes().map((node) => node.primaryDomain)),
		];
		const orderedDomains = this.data.domains
			.map((domain) => domain.name)
			.filter((domain) => visibleDomains.includes(domain));
		const domains = orderedDomains.length ? orderedDomains : visibleDomains;
		const centerX = this.width / 2;
		const centerY = this.height / 2;
		const radiusX = Math.max(90, this.width * 0.32);
		const radiusY = Math.max(80, this.height * 0.28);
		this.clusterCenters = {};

		if (domains.length <= 1) {
			this.clusterCenters[domains[0] || "default"] = { x: centerX, y: centerY };
			return;
		}

		domains.forEach((domain, index) => {
			const angle = -Math.PI / 2 + (index / domains.length) * Math.PI * 2;
			this.clusterCenters[domain] = {
				x: centerX + Math.cos(angle) * radiusX,
				y: centerY + Math.sin(angle) * radiusY,
			};
		});
	}

	handleResize() {
		const bounds = this.svg.parentElement.getBoundingClientRect();
		this.width = Math.max(320, Math.round(bounds.width));
		this.height = Math.max(320, Math.round(bounds.height));
		this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
		this.computeClusterCenters();
		this.restartSimulation();
		this.fitCurrentView();
	}

	restartSimulation() {
		cancelAnimationFrame(this.frame);
		this.computeClusterCenters();
		this.alpha = 0.92;
		if (this.reducedMotion) {
			for (let index = 0; index < 90; index += 1) this.tickSimulation();
			this.renderGraph();
			return;
		}
		this.frame = requestAnimationFrame(() => this.runSimulation());
	}

	runSimulation() {
		if (!document.contains(this.app)) return;
		if (this.alpha < 0.018) {
			this.renderGraph();
			return;
		}
		this.tickSimulation();
		this.renderGraph();
		this.alpha *= 0.982;
		this.frame = requestAnimationFrame(() => this.runSimulation());
	}

	tickSimulation() {
		const nodes = this.getVisibleNodes();
		const links = this.getVisibleEdges();
		const alpha = this.alpha;

		for (const edge of links) {
			const source = edge.sourceNode;
			const target = edge.targetNode;
			let dx = target.x - source.x;
			let dy = target.y - source.y;
			const distance = Math.sqrt(dx * dx + dy * dy) || 1;
			const targetDistance = 105 - edge.score * 28;
			const strength = 0.028 * alpha;
			const force = (distance - targetDistance) * strength;
			dx /= distance;
			dy /= distance;
			source.vx += dx * force;
			source.vy += dy * force;
			target.vx -= dx * force;
			target.vy -= dy * force;
		}

		for (let i = 0; i < nodes.length; i += 1) {
			const left = nodes[i];
			const center = this.clusterCenters[left.primaryDomain] || {
				x: this.width / 2,
				y: this.height / 2,
			};
			left.vx += (center.x - left.x) * 0.018 * alpha;
			left.vy += (center.y - left.y) * 0.018 * alpha;

			for (let j = i + 1; j < nodes.length; j += 1) {
				const right = nodes[j];
				let dx = right.x - left.x;
				let dy = right.y - left.y;
				const distance = Math.sqrt(dx * dx + dy * dy) || 1;
				const minDistance = left.radius + right.radius + 12;
				const charge = (-130 * alpha) / (distance * distance);
				left.vx += dx * charge;
				left.vy += dy * charge;
				right.vx -= dx * charge;
				right.vy -= dy * charge;

				if (distance < minDistance) {
					const push = ((minDistance - distance) / distance) * 0.5;
					dx *= push;
					dy *= push;
					left.x -= dx;
					left.y -= dy;
					right.x += dx;
					right.y += dy;
				}
			}
		}

		for (const node of nodes) {
			node.vx *= 0.82;
			node.vy *= 0.82;
			node.x += node.vx;
			node.y += node.vy;
			node.x = clamp(node.x, node.radius + 8, this.width - node.radius - 8);
			node.y = clamp(node.y, node.radius + 8, this.height - node.radius - 8);
		}
	}

	renderGraph() {
		this.applyTransform();
		for (const edge of this.edges) {
			const element = this.edgeElements.get(`${edge.source}::${edge.target}`);
			if (!element || !edge.sourceNode || !edge.targetNode) continue;
			const source = edge.sourceNode;
			const target = edge.targetNode;
			const midX = (source.x + target.x) / 2;
			const midY = (source.y + target.y) / 2;
			const dx = target.x - source.x;
			const dy = target.y - source.y;
			const curve = Math.min(26, Math.max(-26, (edge.score - 0.35) * 40));
			const length = Math.sqrt(dx * dx + dy * dy) || 1;
			const curveX = midX + (-dy / length) * curve;
			const curveY = midY + (dx / length) * curve;
			element.setAttribute(
				"d",
				`M${source.x},${source.y} Q${curveX},${curveY} ${target.x},${target.y}`,
			);
		}

		for (const node of this.nodes) {
			const element = this.nodeElements.get(node.id);
			if (!element) continue;
			element.setAttribute("transform", `translate(${node.x},${node.y})`);
		}
	}

	applyTransform() {
		this.viewport.setAttribute(
			"transform",
			`translate(${this.transform.x},${this.transform.y}) scale(${this.transform.k})`,
		);
	}

	fitCurrentView() {
		if (this.state.selectedId) {
			const selected = this.nodeById.get(this.state.selectedId);
			if (selected) {
				this.fitNodes([
					selected,
					...this.getRelatedNodes(selected.id).filter((node) => node.visible),
				]);
				return;
			}
		}
		if (this.state.selectedDomain) {
			const domainNodes = this.getVisibleNodes().filter(
				(node) => node.primaryDomain === this.state.selectedDomain,
			);
			this.fitNodes(domainNodes.length ? domainNodes : this.getVisibleNodes());
			return;
		}
		this.fitNodes(this.getVisibleNodes());
	}

	fitNodes(nodes) {
		const visibleNodes = nodes.filter((node) => node?.visible !== false);
		if (visibleNodes.length === 0) return;
		let minX = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const node of visibleNodes) {
			minX = Math.min(minX, node.x - node.radius);
			maxX = Math.max(maxX, node.x + node.radius);
			minY = Math.min(minY, node.y - node.radius);
			maxY = Math.max(maxY, node.y + node.radius);
		}
		const padding = visibleNodes.length === 1 ? 180 : 92;
		const boxWidth = Math.max(1, maxX - minX + padding);
		const boxHeight = Math.max(1, maxY - minY + padding);
		const scale = clamp(
			Math.min(this.width / boxWidth, this.height / boxHeight),
			0.45,
			2.2,
		);
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		this.transform = {
			x: this.width / 2 - centerX * scale,
			y: this.height / 2 - centerY * scale,
			k: scale,
		};
		this.applyTransform();
	}

	resetView() {
		this.resetNodePositions();
		this.restartSimulation();
		window.setTimeout(() => this.fitCurrentView(), 80);
	}

	zoomAt(scaleDelta, clientX, clientY) {
		const rect = this.svg.getBoundingClientRect();
		const cx = clientX ? clientX - rect.left : rect.width / 2;
		const cy = clientY ? clientY - rect.top : rect.height / 2;
		const nextScale = clamp(this.transform.k * scaleDelta, 0.35, 3);
		const graphX = (cx - this.transform.x) / this.transform.k;
		const graphY = (cy - this.transform.y) / this.transform.k;
		this.transform = {
			x: cx - graphX * nextScale,
			y: cy - graphY * nextScale,
			k: nextScale,
		};
		this.applyTransform();
	}

	toGraphPoint(event) {
		const rect = this.svg.getBoundingClientRect();
		return {
			x: (event.clientX - rect.left - this.transform.x) / this.transform.k,
			y: (event.clientY - rect.top - this.transform.y) / this.transform.k,
		};
	}

	startNodeDrag(event, node) {
		if (event.button !== undefined && event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		this.dragNode = node;
		this.dragStart = {
			x: event.clientX,
			y: event.clientY,
			moved: false,
		};
		this.svg.classList.add("is-dragging");
		this.svg.setPointerCapture?.(event.pointerId);
	}

	startPan(event) {
		if (event.button !== undefined && event.button !== 0) return;
		if (event.target.closest?.(".impact-node")) return;
		event.preventDefault();
		this.panStart = {
			x: event.clientX,
			y: event.clientY,
			transform: { ...this.transform },
		};
		this.svg.classList.add("is-panning");
		this.svg.setPointerCapture?.(event.pointerId);
	}

	handlePointerMove(event) {
		if (this.dragNode) {
			event.preventDefault();
			if (this.dragStart) {
				const moveDistance = Math.hypot(
					event.clientX - this.dragStart.x,
					event.clientY - this.dragStart.y,
				);
				this.dragStart.moved = this.dragStart.moved || moveDistance > 5;
			}
			const point = this.toGraphPoint(event);
			this.dragNode.x = clamp(
				point.x,
				this.dragNode.radius + 8,
				this.width - this.dragNode.radius - 8,
			);
			this.dragNode.y = clamp(
				point.y,
				this.dragNode.radius + 8,
				this.height - this.dragNode.radius - 8,
			);
			this.dragNode.vx = 0;
			this.dragNode.vy = 0;
			this.alpha = Math.max(this.alpha, 0.25);
			this.renderGraph();
			return;
		}
		if (this.panStart) {
			event.preventDefault();
			this.transform.x =
				this.panStart.transform.x + event.clientX - this.panStart.x;
			this.transform.y =
				this.panStart.transform.y + event.clientY - this.panStart.y;
			this.applyTransform();
		}
	}

	endPointerGesture(event) {
		this.svg.releasePointerCapture?.(event.pointerId);
		if (this.dragNode) {
			const node = this.dragNode;
			const wasPress = !this.dragStart?.moved;
			this.dragNode = null;
			this.dragStart = null;
			this.svg.classList.remove("is-dragging");

			if (wasPress) {
				const now = Date.now();
				if (
					this.lastNodePress?.id === node.id &&
					now - this.lastNodePress.time < 360
				) {
					this.openProject(node.id);
				} else {
					this.selectProject(node.id);
				}
				this.lastNodePress = { id: node.id, time: now };
			} else {
				this.restartSimulation();
			}
		}
		if (this.panStart) {
			this.panStart = null;
			this.svg.classList.remove("is-panning");
		}
	}

	handleNodeKeydown(event, node) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			this.selectProject(node.id);
		}
	}

	showNodeTooltip(node, event) {
		this.tooltip.innerHTML = `<strong>${escapeHTML(node.title)}</strong><span>${escapeHTML(node.primaryDomain)}</span>`;
		this.moveTooltip(event);
		this.tooltip.hidden = false;
	}

	showEdgeTooltip(edge, event) {
		const through = formatList(
			[...edge.sharedTags, ...edge.sharedDomains].slice(0, 5),
		);
		this.tooltip.innerHTML = `<strong>Related through</strong><span>${escapeHTML(through)}</span>`;
		this.moveTooltip(event);
		this.tooltip.hidden = false;
	}

	moveTooltip(event) {
		if (!this.tooltip || this.tooltip.hidden) return;
		const container = this.svg.parentElement.getBoundingClientRect();
		const tooltipBounds = this.tooltip.getBoundingClientRect();
		const x = clamp(
			event.clientX - container.left + 14,
			8,
			container.width - tooltipBounds.width - 8,
		);
		const y = clamp(
			event.clientY - container.top + 14,
			8,
			container.height - tooltipBounds.height - 8,
		);
		this.tooltip.style.left = `${x}px`;
		this.tooltip.style.top = `${y}px`;
	}

	hideTooltip() {
		this.tooltip.hidden = true;
	}
}

function initProjectImpactGraph() {
	const app = document.querySelector("[data-impact-app]");
	if (!app) return;
	if (window.__projectImpactGraph?.app === app) return;
	window.__projectImpactGraph?.destroy?.();
	window.__projectImpactGraph = new ProjectImpactGraph(app);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initProjectImpactGraph, {
		once: true,
	});
} else {
	initProjectImpactGraph();
}

document.addEventListener("astro:page-load", initProjectImpactGraph);
document.addEventListener("swup:page:view", initProjectImpactGraph);
