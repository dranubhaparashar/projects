import {
	ICON_PATHS,
	injectInlineIcons,
	svgElement,
} from "./project-impact-graph-icons.js";
import {
	clamp,
	createDisplayTitle,
	escapeHTML,
	formatList,
	hashString,
	normalizeText,
	readExplorerUrlState,
	splitLabelText,
	updateExplorerUrl,
} from "./project-impact-graph-utils.js";

const STORAGE_KEY = "project-impact-view";

function loadStoredMode() {
	try {
		return localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "graph";
	} catch {
		return "graph";
	}
}

function storeMode(mode) {
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		// Local storage is an optional convenience.
	}
}

function createNodeLabel(node) {
	const label = svgElement("text", {
		class: "impact-node-label",
		"aria-hidden": "true",
		y: node.radius + 16,
	});
	for (const [index, line] of node.labelLines.entries()) {
		const tspan = svgElement("tspan", {
			x: "0",
			dy: index === 0 ? "0" : "1.15em",
		});
		tspan.textContent = line;
		label.append(tspan);
	}
	return label;
}

class ProjectImpactExplorer {
	constructor(app) {
		this.app = app;
		this.data = JSON.parse(
			app.querySelector("#project-impact-data")?.textContent || "{}",
		);
		this.explorer = app.querySelector("[data-impact-explorer]") || app;
		this.body = app.querySelector("[data-impact-explorer-body]");
		this.stage = app.querySelector("[data-impact-stage]");
		this.svg = app.querySelector("[data-impact-svg]");
		this.hoverCard = app.querySelector("[data-impact-hover-card]");
		this.details = app.querySelector("[data-impact-details]");
		this.detailsContent = app.querySelector("[data-impact-details-content]");
		this.status = app.querySelector("[data-impact-status]");
		this.filterResults = app.querySelector("[data-impact-filter-results]");
		this.emptyState = app.querySelector("[data-impact-empty]");
		this.srSummary = app.querySelector("[data-impact-sr-summary]");
		this.list = app.querySelector("[data-impact-list]");
		this.legend = app.querySelector("[data-impact-legend]");
		this.legendList = app.querySelector("[data-impact-legend-list]");
		this.filterPanel = app.querySelector("[data-impact-filter-panel]");
		this.scrim = app.querySelector("[data-impact-close-panels]");
		this.fullscreenButton = app.querySelector("[data-impact-fullscreen]");
		this.urlState = readExplorerUrlState();
		this.width = 900;
		this.height = 680;
		this.alpha = 0;
		this.frame = 0;
		this.resizeFrame = 0;
		this.fitFrame = 0;
		this.fitTimer = 0;
		this.searchTimer = 0;
		this.cardTimer = 0;
		this.fullscreenFrame = 0;
		this.labelsArePersistent = true;
		this.fullscreenActive = false;
		this.usingFullscreenFallback = false;
		this.previousBodyOverflow = "";
		this.reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		this.mobileQuery = window.matchMedia("(max-width: 767px)");
		this.tabletQuery = window.matchMedia("(max-width: 1080px)");
		this.transform = { x: 0, y: 0, k: 1 };
		this.treeBounds = null;
		this.state = {
			mode: loadStoredMode(),
			layout: this.urlState.layout,
			clusterBy: this.urlState.clusterBy,
			query: "",
			domain: "",
			category: "",
			tag: "",
			year: "",
			selectedId: "",
			selectedGroup: this.urlState.group,
			hoveredId: "",
			hoveredGroup: "",
			activeEdgeId: "",
			filtersOpen: false,
			legendOpen: !this.tabletQuery.matches,
		};
		this.cardPinned = false;
		this.cardPointerInside = false;
		this.lastCardPosition = null;
		this.collapsedGroups = new Set();
		this.modeById = new Map(
			this.data.clusterModes.map((mode) => [mode.id, mode]),
		);
		if (!this.modeById.has(this.state.clusterBy)) {
			this.state.clusterBy = "impact-domain";
		}
		this.projects = new Map(
			this.data.projects.map((project) => [project.id, project]),
		);
		this.nodes = this.data.projects.map((project, index) => {
			const displayTitle = createDisplayTitle(project.title);
			const labelLines = splitLabelText(displayTitle);
			return {
				...project,
				index,
				displayTitle,
				labelLines,
				labelWidth:
					Math.max(...labelLines.map((line) => line.length), 8) * 6.4,
				labelHeight: labelLines.length * 13,
				radius: 20 + Math.min(7, project.relatedProjects.length * 1.4),
				collisionRadius: 50,
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				visible: true,
				matchesBaseFilters: true,
				treeHidden: false,
				searchText: normalizeText(
					[
						project.title,
						project.description,
						project.category,
						project.primaryDomain,
						...project.domains,
						...project.tags,
						...project.technologies,
						...project.industries,
						...project.problems,
						...Object.values(project.clusterAssignments).flatMap(
							(assignment) => [
								assignment.primaryCluster,
								...assignment.secondaryClusters,
							],
						),
					].join(" "),
				),
			};
		});
		this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
		this.edges = this.data.edges.map((edge) => ({
			...edge,
			id: `${edge.source}::${edge.target}`,
			sourceNode: this.nodeById.get(edge.source),
			targetNode: this.nodeById.get(edge.target),
			visible: true,
		}));
		this.edgeById = new Map(this.edges.map((edge) => [edge.id, edge]));
		this.nodeElements = new Map();
		this.edgeElements = new Map();
		this.clusterRegionElements = new Map();
		this.treeGroupElements = new Map();
		this.clusterCenters = {};
		this.groupMeta = new Map();
		this.dragNode = null;
		this.dragStart = null;
		this.panStart = null;
		this.lastNodePress = null;
		this.boundDocumentKeydown = (event) =>
			this.handleDocumentKeydown(event);
		this.boundFullscreenChange = () => this.handleFullscreenChange();
		this.boundPopState = () => this.restoreUrlState();
		this.boundResize = () => {
			cancelAnimationFrame(this.resizeFrame);
			this.resizeFrame = requestAnimationFrame(() => this.handleResize());
		};

		this.setupSvg();
		this.bindControls();
		this.refreshClusterMode({ resetGroup: false });
		injectInlineIcons(this.app);
		this.app.classList.add("impact-enhanced");
		this.setPanelState("legend", this.state.legendOpen, {
			focus: false,
			refit: false,
		});
		this.setPanelState("filters", false, { focus: false, refit: false });
		this.setMode(this.state.mode, false);
		this.setLayout(this.state.layout, false);
		this.applyFilters(false);
		this.handleResize();
		updateExplorerUrl(this.state, false);
	}

	destroy() {
		cancelAnimationFrame(this.frame);
		cancelAnimationFrame(this.resizeFrame);
		cancelAnimationFrame(this.fitFrame);
		cancelAnimationFrame(this.fullscreenFrame);
		clearTimeout(this.fitTimer);
		clearTimeout(this.searchTimer);
		clearTimeout(this.cardTimer);
		this.resizeObserver?.disconnect();
		window.removeEventListener("resize", this.boundResize);
		document.removeEventListener("keydown", this.boundDocumentKeydown);
		document.removeEventListener(
			"fullscreenchange",
			this.boundFullscreenChange,
		);
		window.removeEventListener("popstate", this.boundPopState);
		if (this.usingFullscreenFallback) {
			this.exitFallbackFullscreen({ restoreFocus: false, refit: false });
		}
		this.unlockBodyScroll();
	}

	get activeMode() {
		return (
			this.modeById.get(this.state.clusterBy) ||
			this.modeById.get("impact-domain")
		);
	}

	getGroupAssignment(node) {
		return (
			node.clusterAssignments[this.state.clusterBy] ||
			node.clusterAssignments["impact-domain"]
		);
	}

	getGroup(node) {
		return this.getGroupAssignment(node).primaryCluster;
	}

	getGroupId(node) {
		return this.getGroupAssignment(node).primaryClusterId;
	}

	getNodeAriaLabel(node) {
		const group = this.getGroupAssignment(node);
		return `${node.title}. ${node.category}. ${group.primaryCluster}. ${node.relatedProjects.length} related projects.`;
	}

	getEdgeAriaLabel(edge) {
		const source = this.projects.get(edge.source);
		const target = this.projects.get(edge.target);
		return `Relationship between ${source?.title || edge.source} and ${target?.title || edge.target}. ${edge.explanation}`;
	}

	setupSvg() {
		this.svg.textContent = "";
		this.viewport = svgElement("g", { class: "impact-graph-viewport" });
		this.clusterLayer = svgElement("g", {
			class: "impact-cluster-layer",
		});
		this.treeLinkLayer = svgElement("g", {
			class: "impact-tree-link-layer",
		});
		this.edgeLayer = svgElement("g", { class: "impact-edge-layer" });
		this.treeGroupLayer = svgElement("g", {
			class: "impact-tree-group-layer",
		});
		this.nodeLayer = svgElement("g", { class: "impact-node-layer" });
		this.viewport.append(
			this.clusterLayer,
			this.treeLinkLayer,
			this.edgeLayer,
			this.treeGroupLayer,
			this.nodeLayer,
		);
		this.svg.append(this.viewport);

		for (const edge of this.edges) {
			const group = svgElement("g", {
				class: "impact-edge-group",
				"data-edge-id": edge.id,
				role: "button",
				tabindex: "0",
				"aria-label": this.getEdgeAriaLabel(edge),
			});
			const visiblePath = svgElement("path", {
				class: "impact-edge",
				"aria-hidden": "true",
			});
			const hitPath = svgElement("path", {
				class: "impact-edge-hit",
				"aria-hidden": "true",
			});
			const title = svgElement("title");
			title.textContent = this.getEdgeAriaLabel(edge);
			group.append(visiblePath, hitPath, title);
			group.addEventListener("pointerenter", (event) => {
				this.state.activeEdgeId = edge.id;
				this.updateHighlighting();
				this.showRelationshipCard(edge, event, false, 130);
			});
			group.addEventListener("pointermove", (event) => {
				this.lastCardPosition = {
					clientX: event.clientX,
					clientY: event.clientY,
				};
				if (!this.cardPinned) this.positionHoverCard(event);
			});
			group.addEventListener("pointerleave", () => {
				if (!this.cardPinned && this.state.activeEdgeId === edge.id) {
					this.state.activeEdgeId = "";
					this.updateHighlighting();
				}
				this.scheduleCardClose();
			});
			group.addEventListener("focus", (event) => {
				this.state.activeEdgeId = edge.id;
				this.updateHighlighting();
				this.showRelationshipCard(edge, event, false, 0);
			});
			group.addEventListener("blur", (event) => {
				if (this.hoverCard.contains(event.relatedTarget)) return;
				if (!this.cardPinned && this.state.activeEdgeId === edge.id) {
					this.state.activeEdgeId = "";
					this.updateHighlighting();
				}
				this.scheduleCardClose();
			});
			group.addEventListener("click", (event) => {
				event.stopPropagation();
				this.selectRelationship(edge, event);
			});
			group.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					this.selectRelationship(edge, event);
				}
			});
			this.edgeLayer.append(group);
			this.edgeElements.set(edge.id, group);
		}

		for (const node of this.nodes) {
			const element = svgElement("g", {
				class: "impact-node",
				role: "button",
				tabindex: "0",
				"data-node-id": node.id,
				"aria-label": this.getNodeAriaLabel(node),
			});
			const hitWidth = Math.max(node.labelWidth + 24, node.radius * 2 + 24);
			const hitHeight = node.radius * 2 + node.labelHeight + 36;
			const hitTarget = svgElement("rect", {
				class: "impact-node-hit",
				x: -hitWidth / 2,
				y: -node.radius - 12,
				width: hitWidth,
				height: hitHeight,
				rx: 12,
			});
			const circle = svgElement("circle", {
				class: "impact-node-disc",
				r: node.radius,
			});
			const iconGroup = svgElement("g", {
				class: "impact-node-icon",
				transform: "translate(-12 -12)",
			});
			for (const pathData of ICON_PATHS[node.icon] || ICON_PATHS.network) {
				iconGroup.append(svgElement("path", { d: pathData }));
			}
			const title = svgElement("title");
			title.textContent = node.title;
			element.append(
				hitTarget,
				circle,
				iconGroup,
				createNodeLabel(node),
				title,
			);
			element.addEventListener("click", (event) => {
				event.stopPropagation();
				if (this.suppressClickNodeId === node.id) return;
				this.selectProject(node.id);
			});
			element.addEventListener("dblclick", () => this.openProject(node.id));
			element.addEventListener("pointerenter", (event) => {
				this.state.hoveredId = node.id;
				this.updateHighlighting();
				this.showNodeCard(node, event, 130);
			});
			element.addEventListener("pointermove", (event) => {
				this.lastCardPosition = {
					clientX: event.clientX,
					clientY: event.clientY,
				};
				if (!this.cardPinned) this.positionHoverCard(event);
			});
			element.addEventListener("pointerleave", () => {
				if (this.state.hoveredId === node.id) {
					this.state.hoveredId = "";
					this.updateHighlighting();
				}
				this.scheduleCardClose();
			});
			element.addEventListener("focus", (event) => {
				this.state.hoveredId = node.id;
				this.updateHighlighting();
				this.showNodeCard(node, event, 0);
			});
			element.addEventListener("blur", (event) => {
				if (this.hoverCard.contains(event.relatedTarget)) return;
				if (this.state.hoveredId === node.id) {
					this.state.hoveredId = "";
					this.updateHighlighting();
				}
				this.scheduleCardClose();
			});
			element.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					this.selectProject(node.id);
				}
			});
			element.addEventListener("pointerdown", (event) =>
				this.startNodeDrag(event, node),
			);
			this.nodeLayer.append(element);
			this.nodeElements.set(node.id, element);
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

		if ("ResizeObserver" in window) {
			this.resizeObserver = new ResizeObserver(this.boundResize);
			this.resizeObserver.observe(this.svg.parentElement);
		} else {
			window.addEventListener("resize", this.boundResize);
		}
	}

	bindControls() {
		this.app.querySelector("[data-impact-search]")?.addEventListener(
			"input",
			(event) => {
				clearTimeout(this.searchTimer);
				this.searchTimer = window.setTimeout(() => {
					this.state.query = event.target.value;
					this.applyFilters();
				}, 130);
			},
		);
		this.app.querySelectorAll("[data-impact-filter]").forEach((control) => {
			control.addEventListener("change", (event) => {
				this.state[event.target.dataset.impactFilter] = event.target.value;
				this.applyFilters();
			});
		});
		this.app
			.querySelector("[data-impact-cluster-filter]")
			?.addEventListener("change", (event) => {
				this.state.selectedGroup = event.target.value;
				this.applyFilters();
				updateExplorerUrl(this.state, true);
			});
		this.app
			.querySelectorAll("[data-impact-clear-filters]")
			.forEach((button) =>
				button.addEventListener("click", () => this.clearFilters()),
			);
		this.app
			.querySelector("[data-impact-apply-filters]")
			?.addEventListener("click", () =>
				this.setPanelState("filters", false, { focus: true }),
			);
		this.app.querySelectorAll("[data-impact-view]").forEach((button) => {
			button.addEventListener("click", () =>
				this.setMode(button.dataset.impactView),
			);
		});
		this.app.querySelectorAll("[data-impact-layout]").forEach((button) => {
			button.addEventListener("click", () =>
				this.setLayout(button.dataset.impactLayout),
			);
		});
		this.app
			.querySelector("[data-impact-cluster-by]")
			?.addEventListener("change", (event) =>
				this.setClusterBy(event.target.value),
			);
		this.app.querySelectorAll("[data-impact-toggle]").forEach((button) => {
			button.addEventListener("click", () => {
				const panel = button.dataset.impactToggle;
				this.setPanelState(panel, !this.state[`${panel}Open`], {
					focus: true,
				});
			});
		});
		this.app.querySelectorAll("[data-impact-close]").forEach((button) => {
			button.addEventListener("click", () =>
				this.setPanelState(button.dataset.impactClose, false, { focus: true }),
			);
		});
		this.scrim?.addEventListener("click", () => {
			this.setPanelState("filters", false, { focus: false });
			this.setPanelState("legend", false, { focus: false });
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
		this.fullscreenButton?.addEventListener("click", () =>
			this.toggleFullscreen(),
		);
		this.app
			.querySelector("[data-impact-tree='expand']")
			?.addEventListener("click", () => {
				this.collapsedGroups.clear();
				this.renderTree();
				this.scheduleFit(40);
			});
		this.app
			.querySelector("[data-impact-tree='collapse']")
			?.addEventListener("click", () => {
				this.collapsedGroups = new Set(
					this.getVisibleGroups().map((group) => group.id),
				);
				this.renderTree();
				this.scheduleFit(40);
			});
		this.app.addEventListener("click", (event) => {
			const selectTarget = event.target.closest("[data-impact-select]");
			if (selectTarget) {
				event.preventDefault();
				this.setMode("graph");
				this.selectProject(selectTarget.dataset.impactSelect);
				return;
			}
			if (event.target.closest("[data-impact-clear-selection]")) {
				this.clearSelection();
			}
			if (event.target.closest("[data-impact-close-card]")) {
				this.closeHoverCard(true);
			}
		});
		this.hoverCard.addEventListener("pointerenter", () => {
			this.cardPointerInside = true;
			clearTimeout(this.cardTimer);
		});
		this.hoverCard.addEventListener("pointerleave", () => {
			this.cardPointerInside = false;
			this.scheduleCardClose();
		});
		document.addEventListener("keydown", this.boundDocumentKeydown);
		document.addEventListener(
			"fullscreenchange",
			this.boundFullscreenChange,
		);
		window.addEventListener("popstate", this.boundPopState);
	}

	setMode(mode, shouldStore = true) {
		this.state.mode = mode === "list" ? "list" : "graph";
		this.app.querySelectorAll("[data-impact-view]").forEach((button) => {
			const active = button.dataset.impactView === this.state.mode;
			button.setAttribute("aria-selected", String(active));
			button.tabIndex = active ? 0 : -1;
		});
		this.app.querySelectorAll("[data-impact-panel]").forEach((panel) => {
			panel.hidden = panel.dataset.impactPanel !== this.state.mode;
		});
		this.app
			.querySelector("[data-impact-tree-actions]")
			?.toggleAttribute(
				"hidden",
				this.state.mode !== "graph" || this.state.layout !== "tree",
			);
		if (shouldStore) storeMode(this.state.mode);
		if (this.state.mode === "graph") {
			requestAnimationFrame(() => {
				this.handleResize();
				this.scheduleFit(80);
			});
		} else {
			this.renderList();
		}
	}

	setLayout(layout, shouldSync = true) {
		this.state.layout = layout === "tree" ? "tree" : "cluster";
		this.app.querySelectorAll("[data-impact-layout]").forEach((button) => {
			button.setAttribute(
				"aria-pressed",
				String(button.dataset.impactLayout === this.state.layout),
			);
		});
		this.app
			.querySelector("[data-impact-tree-actions]")
			?.toggleAttribute(
				"hidden",
				this.state.mode !== "graph" || this.state.layout !== "tree",
			);
		this.svg.setAttribute(
			"aria-label",
			this.state.layout === "tree"
				? `Project hierarchy grouped by ${this.activeMode.label}`
				: `Project relationship graph clustered by ${this.activeMode.label}`,
		);
		this.explorer.classList.toggle(
			"impact-layout-tree",
			this.state.layout === "tree",
		);
		this.clusterLayer.hidden = this.state.layout !== "cluster";
		this.edgeLayer.hidden = this.state.layout !== "cluster";
		this.treeLinkLayer.hidden = this.state.layout !== "tree";
		this.treeGroupLayer.hidden = this.state.layout !== "tree";
		if (this.state.layout === "tree") {
			cancelAnimationFrame(this.frame);
			this.renderTree();
		} else {
			this.resetNodePositions();
			this.restartSimulation({ fitAfter: true });
		}
		this.updateHighlighting();
		this.scheduleFit(80);
		if (shouldSync) updateExplorerUrl(this.state, true);
	}

	setClusterBy(mode, shouldSync = true) {
		if (!this.modeById.has(mode)) mode = "impact-domain";
		if (mode === this.state.clusterBy && shouldSync) return;
		this.state.clusterBy = mode;
		this.state.selectedGroup = "";
		this.collapsedGroups.clear();
		this.refreshClusterMode({ resetGroup: true });
		this.applyFilters(false);
		this.setLayout(this.state.layout, false);
		if (this.state.selectedId) {
			this.renderDetails(this.nodeById.get(this.state.selectedId));
		}
		this.scheduleFit(80);
		if (shouldSync) updateExplorerUrl(this.state, true);
	}

	refreshClusterMode({ resetGroup = false } = {}) {
		if (resetGroup) this.state.selectedGroup = "";
		if (
			this.state.selectedGroup &&
			!this.activeMode.groups.some(
				(group) => group.label === this.state.selectedGroup,
			)
		) {
			this.state.selectedGroup = "";
		}
		this.groupMeta = new Map(
			this.activeMode.groups.map((group) => [group.id, group]),
		);
		const clusterBy = this.app.querySelector("[data-impact-cluster-by]");
		if (clusterBy) clusterBy.value = this.state.clusterBy;
		const legendTitle = this.app.querySelector("[data-impact-legend-title]");
		if (legendTitle) legendTitle.textContent = this.activeMode.legendHeading;
		const listLabel = this.app.querySelector("[data-impact-list-group-label]");
		if (listLabel) listLabel.textContent = this.activeMode.label;
		this.updateNodeStyles();
		this.rebuildClusterRegions();
		this.rebuildClusterFilter();
		this.renderLegend();
		this.renderList();
	}

	updateNodeStyles() {
		for (const node of this.nodes) {
			const group = this.groupMeta.get(this.getGroupId(node));
			const color = group?.color || "#475569";
			const element = this.nodeElements.get(node.id);
			if (!element) continue;
			element.style.setProperty("--node-stroke", color);
			element.style.setProperty(
				"--node-fill",
				`color-mix(in srgb, ${color} 13%, white)`,
			);
			element.style.setProperty(
				"--node-fill-dark",
				`color-mix(in srgb, ${color} 24%, #101418)`,
			);
			element.setAttribute("aria-label", this.getNodeAriaLabel(node));
		}
	}

	rebuildClusterRegions() {
		this.clusterLayer.textContent = "";
		this.clusterRegionElements.clear();
		for (const group of this.activeMode.groups) {
			const region = svgElement("g", {
				class: "impact-cluster-region",
				"data-cluster-group": group.id,
			});
			region.style.setProperty("--cluster-color", group.color);
			const ellipse = svgElement("ellipse");
			const label = svgElement("text", {
				class: "impact-cluster-label",
			});
			label.textContent = group.label;
			region.append(ellipse, label);
			this.clusterLayer.append(region);
			this.clusterRegionElements.set(group.id, region);
		}
	}

	rebuildClusterFilter() {
		const control = this.app.querySelector("[data-impact-cluster-filter]");
		const label = this.app.querySelector(
			"[data-impact-cluster-filter-label]",
		);
		if (!control) return;
		if (label) label.textContent = `${this.activeMode.label} group`;
		control.innerHTML = `<option value="">All groups</option>${this.activeMode.groups
			.map(
				(group) =>
					`<option value="${escapeHTML(group.label)}">${escapeHTML(group.label)}</option>`,
			)
			.join("")}`;
		control.value = this.state.selectedGroup;
	}

	setPanelState(panelName, open, { focus = false, refit = true } = {}) {
		const isFilters = panelName === "filters";
		const panel = isFilters ? this.filterPanel : this.legend;
		if (!panel) return;
		if (open && this.tabletQuery.matches) {
			const otherName = isFilters ? "legend" : "filters";
			if (this.state[`${otherName}Open`]) {
				this.setPanelState(otherName, false, { focus: false, refit: false });
			}
		}
		this.state[`${panelName}Open`] = open;
		this.explorer.classList.toggle(`${panelName}-open`, open);
		panel.setAttribute("aria-hidden", String(!open));
		panel.setAttribute(
			"role",
			this.tabletQuery.matches ? "dialog" : "complementary",
		);
		if (this.tabletQuery.matches) {
			panel.toggleAttribute("aria-modal", open);
		} else {
			panel.removeAttribute("aria-modal");
		}
		const toggle = this.app.querySelector(
			`[data-impact-toggle="${panelName}"]`,
		);
		toggle?.setAttribute("aria-expanded", String(open));
		const temporaryOpen =
			this.tabletQuery.matches &&
			(this.state.filtersOpen || this.state.legendOpen);
		if (this.scrim) this.scrim.hidden = !temporaryOpen;
		if (focus) {
			requestAnimationFrame(() => {
				if (open) {
					panel
						.querySelector("input, select, button, [tabindex='0']")
						?.focus({ preventScroll: true });
				} else {
					toggle?.focus({ preventScroll: true });
				}
			});
		}
		if (refit) this.refitAfterStructureChange();
	}

	restoreUrlState() {
		const next = readExplorerUrlState();
		const clusterChanged = next.clusterBy !== this.state.clusterBy;
		this.state.clusterBy = next.clusterBy;
		this.state.selectedGroup = next.group;
		if (clusterChanged) this.refreshClusterMode({ resetGroup: false });
		this.setLayout(next.layout, false);
		this.rebuildClusterFilter();
		this.applyFilters();
	}

	matchesBaseFilters(node) {
		const query = normalizeText(this.state.query);
		return (
			(!query || node.searchText.includes(query)) &&
			(!this.state.domain || node.domains.includes(this.state.domain)) &&
			(!this.state.category || node.category === this.state.category) &&
			(!this.state.tag || node.tags.includes(this.state.tag)) &&
			(!this.state.year || node.year === this.state.year)
		);
	}

	applyFilters(shouldFit = true) {
		const visibleIds = new Set();
		for (const node of this.nodes) {
			node.matchesBaseFilters = this.matchesBaseFilters(node);
			const matchesGroup =
				!this.state.selectedGroup ||
				this.getGroup(node) === this.state.selectedGroup;
			node.visible = node.matchesBaseFilters && matchesGroup;
			if (node.visible) visibleIds.add(node.id);
		}
		for (const edge of this.edges) {
			edge.visible =
				visibleIds.has(edge.source) && visibleIds.has(edge.target);
		}
		if (this.state.selectedId && !visibleIds.has(this.state.selectedId)) {
			this.clearSelection({ refit: false });
			this.srSummary.textContent =
				"The selected project is outside the current filters, so its details were closed.";
		}
		this.emptyState.hidden = visibleIds.size > 0;
		this.updateFilterState();
		this.renderLegend();
		this.renderList();
		this.updateStatus();
		this.updateHighlighting();
		if (this.state.layout === "tree") {
			this.renderTree();
		} else {
			this.resetNodePositions();
			this.restartSimulation({ fitAfter: shouldFit });
		}
		if (shouldFit) this.scheduleFit(90);
	}

	clearFilters() {
		this.state.query = "";
		this.state.domain = "";
		this.state.category = "";
		this.state.tag = "";
		this.state.year = "";
		this.state.selectedGroup = "";
		const search = this.app.querySelector("[data-impact-search]");
		if (search) search.value = "";
		this.app.querySelectorAll("[data-impact-filter]").forEach((control) => {
			control.value = "";
		});
		const groupControl = this.app.querySelector(
			"[data-impact-cluster-filter]",
		);
		if (groupControl) groupControl.value = "";
		this.applyFilters();
		updateExplorerUrl(this.state, false);
	}

	getActiveFilterCount() {
		return [
			this.state.query,
			this.state.domain,
			this.state.category,
			this.state.tag,
			this.state.year,
			this.state.selectedGroup,
		].filter(Boolean).length;
	}

	updateFilterState() {
		const count = this.getActiveFilterCount();
		const badge = this.app.querySelector("[data-impact-filter-count]");
		const button = this.app.querySelector("[data-impact-toggle='filters']");
		if (badge) {
			badge.textContent = String(count);
			badge.hidden = count === 0;
		}
		button?.setAttribute(
			"aria-label",
			count
				? `Filters, ${count} active`
				: "Filters, none active",
		);
		const visibleCount = this.getVisibleNodes().length;
		if (this.filterResults) {
			this.filterResults.textContent = `${visibleCount} ${visibleCount === 1 ? "project" : "projects"} visible`;
		}
		this.app.querySelectorAll(".impact-clear-filters").forEach((button) => {
			button.disabled = count === 0;
		});
	}

	getVisibleNodes() {
		return this.nodes.filter((node) => node.visible);
	}

	getRenderedNodes() {
		return this.nodes.filter(
			(node) => node.visible && !(this.state.layout === "tree" && node.treeHidden),
		);
	}

	getVisibleEdges() {
		return this.edges.filter((edge) => edge.visible);
	}

	getVisibleGroups({ baseFiltersOnly = false } = {}) {
		const nodes = this.nodes.filter((node) =>
			baseFiltersOnly ? node.matchesBaseFilters : node.visible,
		);
		const counts = new Map();
		for (const node of nodes) {
			const id = this.getGroupId(node);
			counts.set(id, (counts.get(id) || 0) + 1);
		}
		return this.activeMode.groups
			.filter((group) => (counts.get(group.id) || 0) > 0)
			.map((group) => ({ ...group, count: counts.get(group.id) || 0 }));
	}

	updateStatus() {
		const visibleNodes = this.getVisibleNodes();
		const visibleEdges = this.getVisibleEdges();
		const groupCount = new Set(
			visibleNodes.map((node) => this.getGroupId(node)),
		).size;
		this.status.textContent = `${visibleNodes.length} ${visibleNodes.length === 1 ? "project" : "projects"} · ${groupCount} ${groupCount === 1 ? "group" : "groups"} · ${visibleEdges.length} ${visibleEdges.length === 1 ? "relationship" : "relationships"}`;
	}

	renderLegend() {
		const groups = this.getVisibleGroups({ baseFiltersOnly: true });
		const total = this.nodes.filter((node) => node.matchesBaseFilters).length;
		this.legendList.innerHTML = `
			<button type="button" class="impact-legend-item${this.state.selectedGroup ? "" : " is-active"}" data-impact-group="" aria-pressed="${String(!this.state.selectedGroup)}">
				<span class="impact-legend-icon" data-impact-icon="network" aria-hidden="true"></span>
				<span>All groups</span><strong>${total}</strong>
			</button>
			${groups
				.map(
					(group) => `<button type="button" class="impact-legend-item${this.state.selectedGroup === group.label ? " is-active" : ""}" data-impact-group="${escapeHTML(group.label)}" data-impact-group-id="${escapeHTML(group.id)}" style="--group-color: ${escapeHTML(group.color)}" aria-pressed="${String(this.state.selectedGroup === group.label)}">
						<span class="impact-legend-icon" data-impact-icon="${escapeHTML(group.icon)}" aria-hidden="true"></span>
						<span>${escapeHTML(group.label)}</span><strong>${group.count}</strong>
					</button>`,
				)
				.join("")}`;
		injectInlineIcons(this.legendList);
		this.legendList.querySelectorAll("[data-impact-group]").forEach((button) => {
			const groupLabel = button.dataset.impactGroup || "";
			const groupId = button.dataset.impactGroupId || "";
			button.addEventListener("click", () => {
				this.state.selectedGroup =
					this.state.selectedGroup === groupLabel ? "" : groupLabel;
				const filter = this.app.querySelector(
					"[data-impact-cluster-filter]",
				);
				if (filter) filter.value = this.state.selectedGroup;
				this.applyFilters();
				updateExplorerUrl(this.state, true);
			});
			button.addEventListener("pointerenter", () => {
				this.state.hoveredGroup = groupId;
				this.updateHighlighting();
			});
			button.addEventListener("pointerleave", () => {
				if (this.state.hoveredGroup === groupId) {
					this.state.hoveredGroup = "";
					this.updateHighlighting();
				}
			});
			button.addEventListener("focus", () => {
				this.state.hoveredGroup = groupId;
				this.updateHighlighting();
			});
			button.addEventListener("blur", () => {
				if (this.state.hoveredGroup === groupId) {
					this.state.hoveredGroup = "";
					this.updateHighlighting();
				}
			});
		});
	}

	renderList() {
		if (!this.list) return;
		const sections = this.getVisibleGroups()
			.map((group) => {
				const projects = this.getVisibleNodes().filter(
					(node) => this.getGroupId(node) === group.id,
				);
				if (projects.length === 0) return "";
				return `<section class="impact-list-domain" data-list-group-id="${escapeHTML(group.id)}">
					<header class="impact-list-domain-header" style="--domain-color: ${escapeHTML(group.color)}">
						<span class="impact-list-domain-icon" data-impact-icon="${escapeHTML(group.icon)}" aria-hidden="true"></span>
						<div><h2>${escapeHTML(group.label)}</h2><p>${projects.length} ${projects.length === 1 ? "project" : "projects"}</p></div>
					</header>
					<div class="impact-list-grid">${projects
						.map((project) => this.renderListProject(project))
						.join("")}</div>
				</section>`;
			})
			.join("");
		this.list.innerHTML = sections;
		injectInlineIcons(this.list);
	}

	renderListProject(project) {
		const technologies = project.technologies
			.slice(0, 8)
			.map((technology) => `<span>${escapeHTML(technology)}</span>`)
			.join("");
		const related = this.getRelatedProjectDetails(project.id)
			.slice(0, 5)
			.map(
				({ project: relatedProject, edge }) =>
					`<li><button type="button" data-impact-select="${escapeHTML(relatedProject.id)}">${escapeHTML(relatedProject.title)}</button><span>${escapeHTML(edge.explanation)}</span></li>`,
			)
			.join("");
		return `<article class="impact-list-project card-base" data-list-project="${escapeHTML(project.id)}">
			<div class="impact-list-project-main">
				<h3>${escapeHTML(project.title)}</h3>
				<p class="impact-list-meta">${escapeHTML(project.category)} · ${escapeHTML(project.date)}</p>
				<p>${escapeHTML(project.description)}</p>
				<p class="impact-list-active-cluster"><strong>Active group:</strong> ${escapeHTML(this.getGroup(project))}</p>
			</div>
			<div class="impact-chip-row" aria-label="${escapeHTML(project.title)} technologies">${technologies}</div>
			${related ? `<div class="impact-list-related"><h4>Related projects</h4><ul>${related}</ul></div>` : ""}
			<a class="impact-project-link btn-regular" href="${escapeHTML(project.url)}">View Project</a>
		</article>`;
	}

	selectProject(projectId) {
		const node = this.nodeById.get(projectId);
		if (!node?.visible) return;
		this.closeHoverCard(true);
		this.state.selectedId = projectId;
		this.renderDetails(node);
		this.updateHighlighting();
		this.srSummary.textContent = `${node.title} selected. Project details opened.`;
	}

	clearSelection({ refit = true } = {}) {
		this.state.selectedId = "";
		this.details.hidden = true;
		this.details.setAttribute("aria-hidden", "true");
		this.explorer.classList.remove("has-project-details");
		this.detailsContent.textContent = "";
		this.updateHighlighting();
		if (refit) this.scheduleFit(40);
	}

	openProject(projectId) {
		const project = this.projects.get(projectId);
		if (project?.url) window.location.href = project.url;
	}

	renderDetails(project) {
		if (!project) {
			this.clearSelection({ refit: false });
			return;
		}
		const assignment = this.getGroupAssignment(project);
		const related = this.getRelatedProjectDetails(project.id);
		const additionalDomains = project.domains.filter(
			(domain) => domain !== project.primaryDomain,
		);
		const additionalGroups = assignment.secondaryClusters;
		const technologies = project.technologies
			.map((technology) => `<span>${escapeHTML(technology)}</span>`)
			.join("");
		const tags = project.tags
			.map((tag) => `<span>${escapeHTML(tag)}</span>`)
			.join("");
		const relatedMarkup = related.length
			? `<ul class="impact-detail-related-list">${related
					.map(
						({ project: relatedProject, edge }) => `<li>
							<button type="button" class="impact-related-button" data-impact-select="${escapeHTML(relatedProject.id)}">${escapeHTML(relatedProject.title)}</button>
							<p>${escapeHTML(edge.explanation)}</p>
							<div class="impact-detail-relationship-tags">${[
								...edge.sharedTechnologies,
								...edge.sharedTags,
								...edge.sharedDomains,
							]
								.slice(0, 5)
								.map((item) => `<span>${escapeHTML(item)}</span>`)
								.join("")}</div>
						</li>`,
					)
					.join("")}</ul>`
			: '<p class="impact-detail-related-note">No strong related projects in the current graph.</p>';
		const externalLinks = project.links
			.map(
				(link) =>
					`<a class="impact-secondary-link" href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)}</a>`,
			)
			.join("");
		const secondaryLabel =
			this.state.clusterBy === "technology"
				? "Primary technology group"
				: this.state.clusterBy === "industry"
					? "Primary industry"
					: this.state.clusterBy === "project-type"
						? "Project type group"
						: "Primary impact-domain group";

		this.detailsContent.innerHTML = `
			<h3>${escapeHTML(project.title)}</h3>
			<div class="impact-detail-meta"><span>${escapeHTML(project.category)}</span><span>${escapeHTML(project.year)}</span></div>
			<div class="impact-current-view">
				<span>Current view</span>
				<strong>Clustered by ${escapeHTML(this.activeMode.label)}</strong>
				<p>${escapeHTML(secondaryLabel)}: ${escapeHTML(assignment.primaryCluster)}</p>
			</div>
			<p class="impact-detail-description">${escapeHTML(project.description)}</p>
			<div class="impact-detail-section"><h4>Primary impact domain</h4><span class="impact-domain-chip">${escapeHTML(project.primaryDomain)}</span></div>
			${additionalDomains.length ? `<div class="impact-detail-section"><h4>Additional impact domains</h4><div class="impact-chip-row">${additionalDomains.map((domain) => `<span>${escapeHTML(domain)}</span>`).join("")}</div></div>` : ""}
			${additionalGroups.length ? `<div class="impact-detail-section"><h4>Additional ${escapeHTML(this.activeMode.label.toLowerCase())} groups</h4><div class="impact-chip-row">${additionalGroups.map((group) => `<span>${escapeHTML(group)}</span>`).join("")}</div></div>` : ""}
			<div class="impact-detail-section"><h4>Technologies</h4><div class="impact-chip-row">${technologies || "<span>See published project metadata</span>"}</div></div>
			<div class="impact-detail-section"><h4>Tags</h4><div class="impact-chip-row">${tags}</div></div>
			${project.deployment ? `<div class="impact-detail-section"><h4>Deployment</h4><p>${escapeHTML(project.deployment)}</p></div>` : ""}
			<div class="impact-detail-section"><h4>${related.length} ${related.length === 1 ? "related project" : "related projects"}</h4>${relatedMarkup}</div>
			<div class="impact-detail-actions"><a class="impact-project-link btn-regular" href="${escapeHTML(project.url)}">View full project</a>${externalLinks}</div>`;
		this.details.hidden = false;
		this.details.setAttribute("aria-hidden", "false");
		this.explorer.classList.add("has-project-details");
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

	showNodeCard(node, event, delay = 0) {
		if (this.cardPinned) return;
		clearTimeout(this.cardTimer);
		this.cardTimer = window.setTimeout(() => {
			const assignment = this.getGroupAssignment(node);
			this.hoverCard.className = "impact-hover-card impact-node-preview";
			this.hoverCard.innerHTML = `
				<p class="impact-hover-kicker">Project preview</p>
				<strong>${escapeHTML(node.title)}</strong>
				<div class="impact-hover-meta"><span>${escapeHTML(node.category)}</span><span>${escapeHTML(assignment.primaryCluster)}</span></div>
				<p>${escapeHTML(node.description)}</p>
				<div class="impact-hover-tags">${node.technologies
					.slice(0, 5)
					.map((technology) => `<span>${escapeHTML(technology)}</span>`)
					.join("")}</div>
				<p class="impact-hover-hint">${node.relatedProjects.length} related ${node.relatedProjects.length === 1 ? "project" : "projects"} · Click to view details</p>`;
			this.hoverCard.hidden = false;
			this.positionHoverCard(event);
		}, delay);
	}

	showRelationshipCard(edge, event, pinned = false, delay = 0) {
		clearTimeout(this.cardTimer);
		this.cardTimer = window.setTimeout(() => {
			const source = this.projects.get(edge.source);
			const target = this.projects.get(edge.target);
			const sharedCapabilities = [
				...edge.sharedTechnologies,
				...edge.sharedTags,
			]
				.filter((item, index, values) => values.indexOf(item) === index)
				.slice(0, 6);
			this.cardPinned = pinned;
			this.hoverCard.className =
				"impact-hover-card impact-relationship-card";
			this.hoverCard.innerHTML = `
				${pinned ? '<button type="button" class="impact-hover-close" data-impact-close-card aria-label="Close relationship card">×</button>' : ""}
				<p class="impact-hover-kicker">Why these projects are connected</p>
				<div class="impact-relationship-pair"><strong>${escapeHTML(source?.title)}</strong><span aria-hidden="true">↔</span><strong>${escapeHTML(target?.title)}</strong></div>
				<div class="impact-hover-types">${edge.relationshipTypes.map((type) => `<span>${escapeHTML(type)}</span>`).join("")}</div>
				${sharedCapabilities.length ? `<div><b>Shared capabilities</b><div class="impact-hover-tags">${sharedCapabilities.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}</div></div>` : ""}
				${edge.sharedIndustries.length ? `<p><b>Shared industry:</b> ${escapeHTML(formatList(edge.sharedIndustries))}</p>` : ""}
				${edge.sharedDomains.length ? `<p><b>Shared domain:</b> ${escapeHTML(formatList(edge.sharedDomains))}</p>` : ""}
				<p>${escapeHTML(edge.explanation)}</p>
				<div class="impact-hover-actions"><a href="${escapeHTML(source?.url)}">View ${escapeHTML(source?.title)}</a><a href="${escapeHTML(target?.url)}">View ${escapeHTML(target?.title)}</a></div>`;
			this.hoverCard.hidden = false;
			this.positionHoverCard(event);
			this.srSummary.textContent = this.getEdgeAriaLabel(edge);
		}, delay);
	}

	selectRelationship(edge, event) {
		this.closeHoverCard(true);
		this.state.activeEdgeId = edge.id;
		this.updateHighlighting();
		this.showRelationshipCard(edge, event, true, 0);
	}

	positionHoverCard(event) {
		if (this.hoverCard.hidden) return;
		const container = this.svg.parentElement.getBoundingClientRect();
		const target = event?.currentTarget;
		const targetBounds = target?.getBoundingClientRect?.();
		const clientX =
			event?.clientX || targetBounds?.right || container.left + container.width / 2;
		const clientY =
			event?.clientY || targetBounds?.top || container.top + container.height / 2;
		requestAnimationFrame(() => {
			if (this.hoverCard.hidden) return;
			const bounds = this.hoverCard.getBoundingClientRect();
			let left = clientX - container.left + 18;
			let top = clientY - container.top + 18;
			if (left + bounds.width > container.width - 10) {
				left = clientX - container.left - bounds.width - 18;
			}
			if (top + bounds.height > container.height - 10) {
				top = clientY - container.top - bounds.height - 18;
			}
			this.hoverCard.style.left = `${clamp(left, 10, Math.max(10, container.width - bounds.width - 10))}px`;
			this.hoverCard.style.top = `${clamp(top, 10, Math.max(10, container.height - bounds.height - 10))}px`;
		});
	}

	scheduleCardClose() {
		clearTimeout(this.cardTimer);
		if (this.cardPinned) return;
		this.cardTimer = window.setTimeout(() => {
			if (!this.cardPointerInside) this.closeHoverCard();
		}, 180);
	}

	closeHoverCard(force = false) {
		if (this.cardPinned && !force) return;
		clearTimeout(this.cardTimer);
		this.cardPinned = false;
		this.hoverCard.hidden = true;
		this.hoverCard.innerHTML = "";
		this.state.activeEdgeId = "";
		this.updateHighlighting();
	}

	updateHighlighting() {
		const selectedId = this.state.selectedId;
		const activeId = this.state.hoveredId || selectedId;
		const activeEdge = this.edgeById.get(this.state.activeEdgeId);
		const connectedIds = new Set();
		if (activeId) {
			for (const edge of this.edges) {
				if (edge.source === activeId) connectedIds.add(edge.target);
				if (edge.target === activeId) connectedIds.add(edge.source);
			}
		}
		for (const node of this.nodes) {
			const element = this.nodeElements.get(node.id);
			if (!element) continue;
			const rendered =
				node.visible &&
				!(this.state.layout === "tree" && node.treeHidden);
			const isEdgeEndpoint =
				activeEdge &&
				(activeEdge.source === node.id || activeEdge.target === node.id);
			const groupHighlighted =
				this.state.hoveredGroup &&
				this.getGroupId(node) === this.state.hoveredGroup;
			const dimmed =
				rendered &&
				((activeEdge && !isEdgeEndpoint) ||
					(!activeEdge &&
						activeId &&
						node.id !== activeId &&
						!connectedIds.has(node.id)) ||
					(!activeEdge &&
						!activeId &&
						this.state.hoveredGroup &&
						!groupHighlighted));
			element.classList.toggle("is-hidden", !rendered);
			element.classList.toggle("is-selected", node.id === selectedId);
			element.classList.toggle("is-hovered", node.id === this.state.hoveredId);
			element.classList.toggle("is-connected", connectedIds.has(node.id));
			element.classList.toggle("is-edge-endpoint", Boolean(isEdgeEndpoint));
			element.classList.toggle("is-group-highlighted", Boolean(groupHighlighted));
			element.classList.toggle("is-dimmed", Boolean(dimmed));
			element.tabIndex = rendered ? 0 : -1;
		}
		for (const edge of this.edges) {
			const element = this.edgeElements.get(edge.id);
			if (!element) continue;
			const rendered = edge.visible && this.state.layout === "cluster";
			const activeForNode =
				activeId && (edge.source === activeId || edge.target === activeId);
			const active = activeEdge?.id === edge.id || activeForNode;
			const groupActive =
				this.state.hoveredGroup &&
				(this.getGroupId(edge.sourceNode) === this.state.hoveredGroup ||
					this.getGroupId(edge.targetNode) === this.state.hoveredGroup);
			element.classList.toggle("is-hidden", !rendered);
			element.classList.toggle("is-active", Boolean(active));
			element.classList.toggle(
				"is-dimmed",
				Boolean(
					rendered &&
						((activeEdge && !active) ||
							(!activeEdge && activeId && !active) ||
							(!activeEdge &&
								!activeId &&
								this.state.hoveredGroup &&
								!groupActive)),
				),
			);
			element.tabIndex = rendered ? 0 : -1;
		}
		for (const [groupId, region] of this.clusterRegionElements) {
			const highlighted = this.state.hoveredGroup === groupId;
			const activeNodeGroup = activeId
				? this.getGroupId(this.nodeById.get(activeId))
				: "";
			region.classList.toggle("is-highlighted", highlighted);
			region.classList.toggle(
				"is-dimmed",
				Boolean(
					(this.state.hoveredGroup && !highlighted) ||
						(activeNodeGroup && activeNodeGroup !== groupId),
				),
			);
		}
	}

	resetNodePositions() {
		this.computeClusterCenters();
		const offsets = new Map();
		for (const node of this.nodes) {
			const groupId = this.getGroupId(node);
			const center = this.clusterCenters[groupId] || {
				x: this.width / 2,
				y: this.height / 2,
			};
			const ordinal = offsets.get(groupId) || 0;
			offsets.set(groupId, ordinal + 1);
			const hash = hashString(node.id);
			const angle = ((hash % 360) / 180) * Math.PI + ordinal * 0.74;
			const ring = Math.floor(ordinal / 6);
			const distance = 42 + ring * 52 + (hash % 24);
			node.x = center.x + Math.cos(angle) * distance;
			node.y = center.y + 18 + Math.sin(angle) * distance;
			node.vx = 0;
			node.vy = 0;
			node.treeHidden = false;
		}
	}

	computeClusterCenters() {
		const groups = this.getVisibleGroups();
		this.clusterCenters = {};
		if (groups.length === 0) return;
		const aspect = Math.max(0.75, this.width / Math.max(this.height, 1));
		const columns = Math.max(
			1,
			Math.min(groups.length, Math.ceil(Math.sqrt(groups.length * aspect))),
		);
		const rows = Math.ceil(groups.length / columns);
		const horizontalPadding = Math.min(120, this.width * 0.1);
		const verticalPadding = Math.min(100, this.height * 0.1);
		const cellWidth =
			(this.width - horizontalPadding * 2) / Math.max(columns, 1);
		const cellHeight =
			(this.height - verticalPadding * 2) / Math.max(rows, 1);
		groups.forEach((group, index) => {
			const column = index % columns;
			const row = Math.floor(index / columns);
			const rowItems = Math.min(columns, groups.length - row * columns);
			const rowOffset = ((columns - rowItems) * cellWidth) / 2;
			this.clusterCenters[group.id] = {
				x:
					horizontalPadding +
					rowOffset +
					column * cellWidth +
					cellWidth / 2,
				y: verticalPadding + row * cellHeight + cellHeight / 2,
			};
		});
	}

	restartSimulation({ fitAfter = false } = {}) {
		cancelAnimationFrame(this.frame);
		if (this.state.layout !== "cluster") return;
		this.computeClusterCenters();
		this.alpha = 0.94;
		if (this.reducedMotion) {
			for (let index = 0; index < 85; index += 1) this.tickSimulation();
			this.renderGraph();
			if (fitAfter) this.scheduleFit(0);
			return;
		}
		this.fitAfterSimulation = fitAfter;
		this.frame = requestAnimationFrame(() => this.runSimulation());
	}

	runSimulation() {
		if (!document.contains(this.app) || this.state.layout !== "cluster") return;
		if (this.alpha < 0.02) {
			this.renderGraph();
			if (this.fitAfterSimulation) {
				this.fitAfterSimulation = false;
				this.scheduleFit(0);
			}
			return;
		}
		this.tickSimulation();
		this.renderGraph();
		this.alpha *= 0.979;
		this.frame = requestAnimationFrame(() => this.runSimulation());
	}

	tickSimulation() {
		const nodes = this.getRenderedNodes();
		const links = this.getVisibleEdges();
		const alpha = this.alpha;
		for (const edge of links) {
			const source = edge.sourceNode;
			const target = edge.targetNode;
			let deltaX = target.x - source.x;
			let deltaY = target.y - source.y;
			const distance = Math.hypot(deltaX, deltaY) || 1;
			const targetDistance = 116 - edge.score * 24;
			const force = (distance - targetDistance) * 0.021 * alpha;
			deltaX /= distance;
			deltaY /= distance;
			source.vx += deltaX * force;
			source.vy += deltaY * force;
			target.vx -= deltaX * force;
			target.vy -= deltaY * force;
		}
		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			const left = nodes[leftIndex];
			const center = this.clusterCenters[this.getGroupId(left)] || {
				x: this.width / 2,
				y: this.height / 2,
			};
			left.vx += (center.x - left.x) * 0.025 * alpha;
			left.vy += (center.y + 15 - left.y) * 0.025 * alpha;
			for (
				let rightIndex = leftIndex + 1;
				rightIndex < nodes.length;
				rightIndex += 1
			) {
				const right = nodes[rightIndex];
				let deltaX = right.x - left.x;
				let deltaY = right.y - left.y;
				const distance = Math.hypot(deltaX, deltaY) || 1;
				const sameGroup = this.getGroupId(left) === this.getGroupId(right);
				const minimum =
					left.collisionRadius + right.collisionRadius + (sameGroup ? 12 : 28);
				const charge = (-220 * alpha) / (distance * distance);
				left.vx += deltaX * charge;
				left.vy += deltaY * charge;
				right.vx -= deltaX * charge;
				right.vy -= deltaY * charge;
				if (distance < minimum) {
					const push = ((minimum - distance) / distance) * 0.48;
					deltaX *= push;
					deltaY *= push;
					left.x -= deltaX;
					left.y -= deltaY;
					right.x += deltaX;
					right.y += deltaY;
				}
			}
		}
		for (const node of nodes) {
			node.vx *= 0.8;
			node.vy *= 0.8;
			node.x += node.vx;
			node.y += node.vy;
			const horizontal = this.labelsArePersistent
				? Math.max(node.radius, node.labelWidth / 2)
				: node.radius;
			const bottom = this.labelsArePersistent
				? node.radius + node.labelHeight + 24
				: node.radius;
			node.x = clamp(node.x, horizontal + 12, this.width - horizontal - 12);
			node.y = clamp(node.y, node.radius + 34, this.height - bottom - 12);
		}
	}

	renderGraph() {
		this.applyTransform();
		if (this.state.layout === "tree") {
			for (const node of this.nodes) {
				this.nodeElements
					.get(node.id)
					?.setAttribute("transform", `translate(${node.x},${node.y})`);
			}
			return;
		}
		this.renderClusterRegions();
		for (const edge of this.edges) {
			const element = this.edgeElements.get(edge.id);
			if (!element || !edge.sourceNode || !edge.targetNode) continue;
			const source = edge.sourceNode;
			const target = edge.targetNode;
			const middleX = (source.x + target.x) / 2;
			const middleY = (source.y + target.y) / 2;
			const deltaX = target.x - source.x;
			const deltaY = target.y - source.y;
			const length = Math.hypot(deltaX, deltaY) || 1;
			const curve = clamp((edge.score - 0.35) * 42, -24, 24);
			const controlX = middleX + (-deltaY / length) * curve;
			const controlY = middleY + (deltaX / length) * curve;
			const path = `M${source.x},${source.y} Q${controlX},${controlY} ${target.x},${target.y}`;
			element.querySelectorAll("path").forEach((pathElement) => {
				pathElement.setAttribute("d", path);
			});
		}
		for (const node of this.nodes) {
			this.nodeElements
				.get(node.id)
				?.setAttribute("transform", `translate(${node.x},${node.y})`);
		}
	}

	renderClusterRegions() {
		const nodesByGroup = new Map();
		for (const node of this.getVisibleNodes()) {
			const id = this.getGroupId(node);
			if (!nodesByGroup.has(id)) nodesByGroup.set(id, []);
			nodesByGroup.get(id).push(node);
		}
		for (const [groupId, region] of this.clusterRegionElements) {
			const nodes = nodesByGroup.get(groupId) || [];
			region.classList.toggle("is-hidden", nodes.length === 0);
			if (nodes.length === 0) continue;
			let minimumX = Number.POSITIVE_INFINITY;
			let maximumX = Number.NEGATIVE_INFINITY;
			let minimumY = Number.POSITIVE_INFINITY;
			let maximumY = Number.NEGATIVE_INFINITY;
			for (const node of nodes) {
				const side = Math.max(node.radius, node.labelWidth / 2);
				minimumX = Math.min(minimumX, node.x - side);
				maximumX = Math.max(maximumX, node.x + side);
				minimumY = Math.min(minimumY, node.y - node.radius - 10);
				maximumY = Math.max(
					maximumY,
					node.y + node.radius + node.labelHeight + 18,
				);
			}
			const centerX = (minimumX + maximumX) / 2;
			const centerY = (minimumY + maximumY) / 2;
			const radiusX = Math.max(82, (maximumX - minimumX) / 2 + 36);
			const radiusY = Math.max(68, (maximumY - minimumY) / 2 + 34);
			const ellipse = region.querySelector("ellipse");
			const label = region.querySelector("text");
			ellipse.setAttribute("cx", centerX);
			ellipse.setAttribute("cy", centerY);
			ellipse.setAttribute("rx", Math.min(radiusX, this.width * 0.44));
			ellipse.setAttribute("ry", Math.min(radiusY, this.height * 0.4));
			label.setAttribute("x", centerX);
			label.setAttribute("y", Math.max(20, centerY - radiusY + 22));
			label.textContent = `${this.groupMeta.get(groupId)?.label || groupId} · ${nodes.length}`;
		}
	}

	renderTree() {
		this.treeLinkLayer.textContent = "";
		this.treeGroupLayer.textContent = "";
		this.treeGroupElements.clear();
		const groups = this.getVisibleGroups();
		const columnWidth = 224;
		const sidePadding = 120;
		const contentWidth = Math.max(
			this.width,
			groups.length * columnWidth + sidePadding * 2,
		);
		const rootX = contentWidth / 2;
		const rootY = 58;
		const groupY = 175;
		let maximumProjectRows = 0;
		const root = svgElement("g", {
			class: "impact-tree-root",
			transform: `translate(${rootX},${rootY})`,
		});
		root.append(
			svgElement("rect", {
				x: -105,
				y: -25,
				width: 210,
				height: 50,
				rx: 13,
			}),
		);
		const rootLabel = svgElement("text", { "text-anchor": "middle", y: 5 });
		rootLabel.textContent = this.activeMode.rootLabel;
		root.append(rootLabel);
		this.treeGroupLayer.append(root);

		groups.forEach((group, groupIndex) => {
			const groupX =
				sidePadding + groupIndex * columnWidth + columnWidth / 2;
			const groupNodes = this.getVisibleNodes().filter(
				(node) => this.getGroupId(node) === group.id,
			);
			const collapsed = this.collapsedGroups.has(group.id);
			maximumProjectRows = Math.max(
				maximumProjectRows,
				collapsed ? 0 : groupNodes.length,
			);
			const rootLink = svgElement("path", {
				class: "impact-tree-link",
				d: `M${rootX},${rootY + 25} C${rootX},${groupY - 42} ${groupX},${groupY - 42} ${groupX},${groupY - 27}`,
			});
			this.treeLinkLayer.append(rootLink);
			const groupElement = svgElement("g", {
				class: "impact-tree-group",
				transform: `translate(${groupX},${groupY})`,
				role: "button",
				tabindex: "0",
				"aria-expanded": String(!collapsed),
				"aria-label": `${group.label}, ${groupNodes.length} projects, ${collapsed ? "collapsed" : "expanded"}`,
			});
			groupElement.style.setProperty("--group-color", group.color);
			groupElement.append(
				svgElement("rect", {
					x: -92,
					y: -28,
					width: 184,
					height: 56,
					rx: 12,
				}),
			);
			const groupLabel = svgElement("text", {
				class: "impact-tree-group-label",
				"text-anchor": "middle",
				y: -2,
			});
			groupLabel.textContent = group.label;
			const groupCount = svgElement("text", {
				class: "impact-tree-group-count",
				"text-anchor": "middle",
				y: 16,
			});
			groupCount.textContent = `${groupNodes.length} ${groupNodes.length === 1 ? "project" : "projects"} · ${collapsed ? "+" : "−"}`;
			groupElement.append(groupLabel, groupCount);
			const toggle = () => {
				if (this.collapsedGroups.has(group.id)) {
					this.collapsedGroups.delete(group.id);
				} else {
					this.collapsedGroups.add(group.id);
				}
				this.renderTree();
				this.scheduleFit(50);
			};
			groupElement.addEventListener("click", toggle);
			groupElement.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					toggle();
				}
			});
			groupElement.addEventListener("pointerenter", () => {
				this.state.hoveredGroup = group.id;
				this.updateHighlighting();
			});
			groupElement.addEventListener("pointerleave", () => {
				this.state.hoveredGroup = "";
				this.updateHighlighting();
			});
			groupElement.addEventListener("focus", () => {
				this.state.hoveredGroup = group.id;
				this.updateHighlighting();
			});
			groupElement.addEventListener("blur", () => {
				this.state.hoveredGroup = "";
				this.updateHighlighting();
			});
			this.treeGroupLayer.append(groupElement);
			this.treeGroupElements.set(group.id, groupElement);

			groupNodes.forEach((node, projectIndex) => {
				node.treeHidden = collapsed;
				node.x = groupX;
				node.y = 315 + projectIndex * 102;
				node.vx = 0;
				node.vy = 0;
				if (!collapsed) {
					this.treeLinkLayer.append(
						svgElement("path", {
							class: "impact-tree-link impact-tree-project-link",
							d: `M${groupX},${groupY + 28} C${groupX},${node.y - 48} ${node.x},${node.y - 48} ${node.x},${node.y - node.radius}`,
						}),
					);
				}
			});
		});
		for (const node of this.nodes) {
			if (!node.visible) node.treeHidden = true;
		}
		const contentHeight = Math.max(
			this.height,
			315 + Math.max(0, maximumProjectRows - 1) * 102 + 110,
		);
		this.treeBounds = {
			minX: 0,
			minY: 0,
			maxX: contentWidth,
			maxY: contentHeight,
		};
		this.renderGraph();
		this.updateHighlighting();
	}

	handleResize() {
		if (!this.svg?.parentElement) return;
		const bounds = this.svg.parentElement.getBoundingClientRect();
		this.width = Math.max(320, Math.round(bounds.width));
		this.height = Math.max(420, Math.round(bounds.height));
		this.labelsArePersistent = window.innerWidth >= 768;
		for (const node of this.nodes) {
			node.collisionRadius =
				node.radius + (this.labelsArePersistent ? 38 : 16);
		}
		this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
		if (this.state.layout === "tree") {
			this.renderTree();
		} else {
			this.computeClusterCenters();
			this.restartSimulation({ fitAfter: true });
		}
		this.scheduleFit(90);
	}

	applyTransform() {
		this.viewport.setAttribute(
			"transform",
			`translate(${this.transform.x},${this.transform.y}) scale(${this.transform.k})`,
		);
	}

	fitCurrentView() {
		if (this.state.layout === "tree" && this.treeBounds) {
			this.fitBounds(this.treeBounds, 64);
			return;
		}
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
		if (this.state.selectedGroup) {
			const groupNodes = this.getVisibleNodes().filter(
				(node) => this.getGroup(node) === this.state.selectedGroup,
			);
			this.fitNodes(groupNodes);
			return;
		}
		this.fitNodes(this.getRenderedNodes());
	}

	fitNodes(nodes) {
		const visibleNodes = nodes.filter(
			(node) => node?.visible && !node.treeHidden,
		);
		if (visibleNodes.length === 0) return;
		let minimumX = Number.POSITIVE_INFINITY;
		let maximumX = Number.NEGATIVE_INFINITY;
		let minimumY = Number.POSITIVE_INFINITY;
		let maximumY = Number.NEGATIVE_INFINITY;
		for (const node of visibleNodes) {
			const side = Math.max(node.radius, node.labelWidth / 2 + 12);
			minimumX = Math.min(minimumX, node.x - side);
			maximumX = Math.max(maximumX, node.x + side);
			minimumY = Math.min(minimumY, node.y - node.radius - 12);
			maximumY = Math.max(
				maximumY,
				node.y + node.radius + node.labelHeight + 26,
			);
		}
		this.fitBounds(
			{ minX: minimumX, minY: minimumY, maxX: maximumX, maxY: maximumY },
			visibleNodes.length === 1 ? 180 : 120,
		);
	}

	fitBounds(bounds, padding = 100) {
		const boxWidth = Math.max(1, bounds.maxX - bounds.minX + padding * 2);
		const boxHeight = Math.max(1, bounds.maxY - bounds.minY + padding * 2);
		const minimumScale = this.state.layout === "tree" ? 0.18 : 0.38;
		const scale = clamp(
			Math.min(this.width / boxWidth, this.height / boxHeight),
			minimumScale,
			2.2,
		);
		const centerX = (bounds.minX + bounds.maxX) / 2;
		const centerY = (bounds.minY + bounds.maxY) / 2;
		this.transform = {
			x: this.width / 2 - centerX * scale,
			y: this.height / 2 - centerY * scale,
			k: scale,
		};
		this.applyTransform();
	}

	resetView() {
		this.closeHoverCard(true);
		this.transform = { x: 0, y: 0, k: 1 };
		if (this.state.layout === "tree") {
			this.renderTree();
		} else {
			this.resetNodePositions();
			this.restartSimulation({ fitAfter: true });
		}
		this.scheduleFit(80);
	}

	scheduleFit(delay = 60) {
		clearTimeout(this.fitTimer);
		this.fitTimer = window.setTimeout(() => {
			if (this.state.mode === "graph") this.fitCurrentView();
		}, delay);
	}

	refitAfterStructureChange() {
		cancelAnimationFrame(this.fitFrame);
		this.fitFrame = requestAnimationFrame(() => {
			this.fitFrame = requestAnimationFrame(() => {
				if (this.state.mode !== "graph") return;
				this.handleResize();
				this.scheduleFit(40);
			});
		});
	}

	zoomAt(scaleDelta, clientX, clientY) {
		const rect = this.svg.getBoundingClientRect();
		const centerX = clientX ? clientX - rect.left : rect.width / 2;
		const centerY = clientY ? clientY - rect.top : rect.height / 2;
		const nextScale = clamp(this.transform.k * scaleDelta, 0.16, 3.2);
		const graphX = (centerX - this.transform.x) / this.transform.k;
		const graphY = (centerY - this.transform.y) / this.transform.k;
		this.transform = {
			x: centerX - graphX * nextScale,
			y: centerY - graphY * nextScale,
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
		if (this.state.layout === "tree") return;
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
		if (
			event.target.closest?.(
				".impact-node, .impact-edge-group, .impact-tree-group",
			)
		) {
			return;
		}
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
			const distance = Math.hypot(
				event.clientX - this.dragStart.x,
				event.clientY - this.dragStart.y,
			);
			this.dragStart.moved = this.dragStart.moved || distance > 5;
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
			const moved = this.dragStart?.moved;
			this.dragNode = null;
			this.dragStart = null;
			this.svg.classList.remove("is-dragging");
			if (moved) {
				this.suppressClickNodeId = node.id;
				window.setTimeout(() => {
					this.suppressClickNodeId = "";
				}, 80);
				this.restartSimulation();
			}
		}
		if (this.panStart) {
			this.panStart = null;
			this.svg.classList.remove("is-panning");
		}
	}

	isBrowserFullscreenActive() {
		return document.fullscreenElement === this.explorer;
	}

	isFullscreenActive() {
		return this.fullscreenActive || this.isBrowserFullscreenActive();
	}

	async toggleFullscreen() {
		if (this.isFullscreenActive()) {
			await this.exitFullscreen();
		} else {
			await this.enterFullscreen();
		}
	}

	async enterFullscreen() {
		this.fullscreenButton?.focus({ preventScroll: true });
		if (this.explorer.requestFullscreen) {
			try {
				await this.explorer.requestFullscreen();
				this.usingFullscreenFallback = false;
				this.setFullscreenState(true, {
					fallback: false,
					restoreFocus: false,
				});
				return;
			} catch {
				// Use the in-page fallback when the browser rejects the API request.
			}
		}
		this.enterFallbackFullscreen();
	}

	async exitFullscreen() {
		if (this.usingFullscreenFallback) {
			this.exitFallbackFullscreen();
			return;
		}
		if (this.isBrowserFullscreenActive() && document.exitFullscreen) {
			try {
				await document.exitFullscreen();
			} catch {
				this.setFullscreenState(false);
			}
			return;
		}
		this.setFullscreenState(false);
	}

	enterFallbackFullscreen() {
		this.usingFullscreenFallback = true;
		this.lockBodyScroll();
		this.setFullscreenState(true, {
			fallback: true,
			restoreFocus: false,
		});
	}

	exitFallbackFullscreen({ restoreFocus = true, refit = true } = {}) {
		if (!this.usingFullscreenFallback) return;
		this.usingFullscreenFallback = false;
		this.setFullscreenState(false, { restoreFocus, refit });
	}

	setFullscreenState(
		active,
		{
			fallback = this.usingFullscreenFallback,
			restoreFocus = true,
			refit = true,
		} = {},
	) {
		this.fullscreenActive = active;
		this.explorer.classList.toggle(
			"impact-explorer--fullscreen-active",
			active,
		);
		this.explorer.classList.toggle(
			"impact-explorer--fullscreen",
			active && fallback,
		);
		if (!active) this.unlockBodyScroll();
		this.updateFullscreenButton(active);
		if (refit) this.refitAfterStructureChange();
		if (!active && restoreFocus) {
			requestAnimationFrame(() =>
				this.fullscreenButton?.focus({ preventScroll: true }),
			);
		}
	}

	updateFullscreenButton(active = this.isFullscreenActive()) {
		if (!this.fullscreenButton) return;
		const label = active
			? "Exit full screen"
			: "View explorer in full screen";
		this.fullscreenButton.setAttribute("aria-label", label);
		this.fullscreenButton.setAttribute("aria-pressed", String(active));
		this.fullscreenButton.setAttribute("title", label);
		this.fullscreenButton
			.querySelector('[data-impact-fullscreen-icon="enter"]')
			?.toggleAttribute("hidden", active);
		this.fullscreenButton
			.querySelector('[data-impact-fullscreen-icon="exit"]')
			?.toggleAttribute("hidden", !active);
	}

	handleFullscreenChange() {
		const active = this.isBrowserFullscreenActive();
		if (active) {
			this.usingFullscreenFallback = false;
			this.setFullscreenState(true, {
				fallback: false,
				restoreFocus: false,
			});
		} else if (this.fullscreenActive && !this.usingFullscreenFallback) {
			this.setFullscreenState(false);
		}
	}

	handleDocumentKeydown(event) {
		if (event.key !== "Escape" || !document.contains(this.app)) return;
		if (!this.hoverCard.hidden) {
			event.preventDefault();
			this.closeHoverCard(true);
			return;
		}
		if (
			this.state.filtersOpen &&
			(this.tabletQuery.matches || this.filterPanel.contains(document.activeElement))
		) {
			event.preventDefault();
			this.setPanelState("filters", false, { focus: true });
			return;
		}
		if (
			this.state.legendOpen &&
			this.tabletQuery.matches &&
			this.legend.contains(document.activeElement)
		) {
			event.preventDefault();
			this.setPanelState("legend", false, { focus: true });
			return;
		}
		if (!this.details.hidden) {
			event.preventDefault();
			this.clearSelection();
			return;
		}
		if (this.usingFullscreenFallback) {
			event.preventDefault();
			this.exitFallbackFullscreen();
		}
	}

	lockBodyScroll() {
		if (!document.body.classList.contains("impact-fullscreen-scroll-lock")) {
			this.previousBodyOverflow = document.body.style.overflow;
		}
		document.body.classList.add("impact-fullscreen-scroll-lock");
		document.body.style.overflow = "hidden";
	}

	unlockBodyScroll() {
		if (!document.body.classList.contains("impact-fullscreen-scroll-lock")) {
			return;
		}
		document.body.classList.remove("impact-fullscreen-scroll-lock");
		document.body.style.overflow = this.previousBodyOverflow || "";
	}
}

function initProjectImpactExplorer() {
	const app = document.querySelector("[data-impact-app]");
	if (!app) return;
	if (window.__projectImpactGraph?.app === app) return;
	window.__projectImpactGraph?.destroy?.();
	window.__projectImpactGraph = new ProjectImpactExplorer(app);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initProjectImpactExplorer, {
		once: true,
	});
} else {
	initProjectImpactExplorer();
}

document.addEventListener("astro:page-load", initProjectImpactExplorer);
document.addEventListener("swup:page:view", initProjectImpactExplorer);
