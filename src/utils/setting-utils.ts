import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

const DEFAULT_ACCENT_POSITION = 0;
const ACCENT_POSITION_STORAGE_KEY = "premium-accent-position";
const ACCENT_COLOR_STORAGE_KEY = "premium-accent-color";
const LEGACY_HUE_STORAGE_KEY = "hue";

export const PREMIUM_ACCENT_GRADIENT =
	"linear-gradient(to right, #1E3A5F 0%, #0F766E 25%, #5B4B8A 50%, #7F1D3A 75%, #374151 100%)";

const PREMIUM_ACCENT_ANCHORS = [
	{ position: 0, color: "#1E3A5F" },
	{ position: 25, color: "#0F766E" },
	{ position: 50, color: "#5B4B8A" },
	{ position: 75, color: "#7F1D3A" },
	{ position: 100, color: "#374151" },
] as const;

type RgbColor = {
	r: number;
	g: number;
	b: number;
};

function normalizeAccentPosition(
	value: number | string | null | undefined,
): number {
	if (value == null || String(value).trim() === "") {
		return DEFAULT_ACCENT_POSITION;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_ACCENT_POSITION;
	}

	return Math.min(100, Math.max(0, parsed));
}

function parseHexColor(hexColor: string): RgbColor {
	const hex = hexColor.replace("#", "");
	return {
		r: Number.parseInt(hex.slice(0, 2), 16),
		g: Number.parseInt(hex.slice(2, 4), 16),
		b: Number.parseInt(hex.slice(4, 6), 16),
	};
}

function toHexChannel(value: number): string {
	return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
}

function rgbToHex({ r, g, b }: RgbColor): string {
	return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

export function getDefaultAccentPosition(): number {
	if (typeof document === "undefined") {
		return DEFAULT_ACCENT_POSITION;
	}

	const configCarrier = document.getElementById("config-carrier");
	return normalizeAccentPosition(
		configCarrier?.dataset.accentPosition || DEFAULT_ACCENT_POSITION,
	);
}

export function interpolatePremiumColor(position: number): string {
	const normalizedPosition = normalizeAccentPosition(position);
	const exactAnchor = PREMIUM_ACCENT_ANCHORS.find(
		(anchor) => anchor.position === normalizedPosition,
	);

	if (exactAnchor) {
		return exactAnchor.color;
	}

	const upperAnchor = PREMIUM_ACCENT_ANCHORS.find(
		(anchor) => anchor.position > normalizedPosition,
	);
	const lowerAnchor = [...PREMIUM_ACCENT_ANCHORS]
		.reverse()
		.find((anchor) => anchor.position < normalizedPosition);

	if (!lowerAnchor) {
		return PREMIUM_ACCENT_ANCHORS[0].color;
	}
	if (!upperAnchor) {
		return PREMIUM_ACCENT_ANCHORS[PREMIUM_ACCENT_ANCHORS.length - 1].color;
	}

	const progress =
		(normalizedPosition - lowerAnchor.position) /
		(upperAnchor.position - lowerAnchor.position);
	const lowerRgb = parseHexColor(lowerAnchor.color);
	const upperRgb = parseHexColor(upperAnchor.color);

	return rgbToHex({
		r: lowerRgb.r + (upperRgb.r - lowerRgb.r) * progress,
		g: lowerRgb.g + (upperRgb.g - lowerRgb.g) * progress,
		b: lowerRgb.b + (upperRgb.b - lowerRgb.b) * progress,
	});
}

export function getAccentPosition(): number {
	if (typeof localStorage === "undefined") {
		return getDefaultAccentPosition();
	}

	return normalizeAccentPosition(
		localStorage.getItem(ACCENT_POSITION_STORAGE_KEY) ??
			getDefaultAccentPosition(),
	);
}

export function getAccentColor(position: number = getAccentPosition()): string {
	return interpolatePremiumColor(position);
}

export function setAccentPosition(position: number): void {
	const normalizedPosition = normalizeAccentPosition(position);
	const accentColor = interpolatePremiumColor(normalizedPosition);

	if (typeof localStorage !== "undefined") {
		localStorage.setItem(
			ACCENT_POSITION_STORAGE_KEY,
			String(normalizedPosition),
		);
		localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, accentColor);
		localStorage.removeItem(LEGACY_HUE_STORAGE_KEY);
	}

	if (typeof document === "undefined") {
		return;
	}

	document.documentElement.style.setProperty("--accent-color", accentColor);
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE): void {
	switch (theme) {
		case LIGHT_MODE:
			document.documentElement.classList.remove("dark");
			break;
		case DARK_MODE:
			document.documentElement.classList.add("dark");
			break;
		case AUTO_MODE:
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			break;
	}

	// Set the theme for Expressive Code
	document.documentElement.setAttribute(
		"data-theme",
		expressiveCodeConfig.theme,
	);
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	localStorage.setItem("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}
