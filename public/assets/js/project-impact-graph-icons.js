const SVG_NS = "http://www.w3.org/2000/svg";

export const ICON_PATHS = {
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
	shield: [
		"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
		"M9 12l2 2 4-5",
	],
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
	database: [
		"M4 6c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3Z",
		"M4 6v6c0 2 3.6 3 8 3s8-1 8-3V6",
		"M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6",
	],
	chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
	cloud: [
		"M17.5 19H6a4 4 0 0 1-.5-8 6.5 6.5 0 0 1 12.6-1.8A5 5 0 0 1 17.5 19Z",
	],
	heart: [
		"M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
	],
	energy: ["M13 2 4 14h7l-1 8 9-12h-7l1-8Z"],
	briefcase: [
		"M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z",
		"M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2",
		"M2 12h20",
	],
	filter: [
		"M4 5h16",
		"M7 12h10",
		"M10 19h4",
	],
	legend: [
		"M5 6h.01",
		"M9 6h10",
		"M5 12h.01",
		"M9 12h10",
		"M5 18h.01",
		"M9 18h10",
	],
	maximize: [
		"M8 3H5a2 2 0 0 0-2 2v3",
		"M16 3h3a2 2 0 0 1 2 2v3",
		"M21 16v3a2 2 0 0 1-2 2h-3",
		"M8 21H5a2 2 0 0 1-2-2v-3",
	],
	minimize: [
		"M8 3v3a2 2 0 0 1-2 2H3",
		"M16 3v3a2 2 0 0 0 2 2h3",
		"M21 16h-3a2 2 0 0 0-2 2v3",
		"M3 16h3a2 2 0 0 1 2 2v3",
	],
};

export function svgElement(name, attributes = {}) {
	const element = document.createElementNS(SVG_NS, name);
	for (const [key, value] of Object.entries(attributes)) {
		if (value !== undefined && value !== null) {
			element.setAttribute(key, String(value));
		}
	}
	return element;
}

export function createIconSvg(iconName, size = 20) {
	const svg = svgElement("svg", {
		viewBox: "0 0 24 24",
		width: size,
		height: size,
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

export function injectInlineIcons(root) {
	root?.querySelectorAll("[data-impact-icon]").forEach((target) => {
		if (target.childElementCount > 0) return;
		target.append(createIconSvg(target.dataset.impactIcon || "network"));
	});
}
