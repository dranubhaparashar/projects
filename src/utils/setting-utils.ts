import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

export const DEFAULT_LIGHT_ACCENT_POSITION = 20;
export const DEFAULT_DARK_ACCENT_POSITION = 60;
export const DEFAULT_LIGHT_ACCENT = "#1264E8";
export const DEFAULT_DARK_ACCENT = "#43D7FF";
export const ACCENT_STORAGE_KEYS = {
	light: {
		position: "premium-accent-position-light",
		color: "premium-accent-color-light",
	},
	dark: {
		position: "premium-accent-position-dark",
		color: "premium-accent-color-dark",
	},
	legacy: {
		position: "premium-accent-position",
		color: "premium-accent-color",
	},
} as const;
const LEGACY_HUE_STORAGE_KEY = "hue";

export const PREMIUM_ACCENT_ANCHORS = [
	{ position: 0, color: "#0D4FC7" },
	{ position: 20, color: DEFAULT_LIGHT_ACCENT },
	{ position: 40, color: "#2488FF" },
	{ position: DEFAULT_DARK_ACCENT_POSITION, color: DEFAULT_DARK_ACCENT },
	{ position: 80, color: "#5B70FF" },
	{ position: 100, color: "#8178FF" },
] as const;

export const PREMIUM_ACCENT_GRADIENT = `linear-gradient(to right, ${PREMIUM_ACCENT_ANCHORS.map(({ position, color }) => `${color} ${position}%`).join(", ")})`;

type RgbColor = {
	r: number;
	g: number;
	b: number;
};

function normalizeAccentPosition(
	value: number | string | null | undefined,
	fallback = DEFAULT_LIGHT_ACCENT_POSITION,
): number {
	if (value == null || String(value).trim() === "") {
		return fallback;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return fallback;
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

function getActiveAccentTheme(): typeof LIGHT_MODE | typeof DARK_MODE {
	return typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark")
		? DARK_MODE
		: LIGHT_MODE;
}

function getThemeStorageKeys(theme = getActiveAccentTheme()) {
	return theme === DARK_MODE
		? ACCENT_STORAGE_KEYS.dark
		: ACCENT_STORAGE_KEYS.light;
}

function migrateLegacyAccentPreference(): void {
	if (typeof localStorage === "undefined") return;

	const legacyPosition = localStorage.getItem(
		ACCENT_STORAGE_KEYS.legacy.position,
	);
	if (legacyPosition === null) return;

	const normalizedPosition = normalizeAccentPosition(legacyPosition);
	const legacyColor =
		localStorage.getItem(ACCENT_STORAGE_KEYS.legacy.color) ||
		interpolatePremiumColor(normalizedPosition);

	for (const keys of [ACCENT_STORAGE_KEYS.light, ACCENT_STORAGE_KEYS.dark]) {
		if (localStorage.getItem(keys.position) === null) {
			localStorage.setItem(keys.position, String(normalizedPosition));
		}
		if (localStorage.getItem(keys.color) === null) {
			localStorage.setItem(keys.color, legacyColor);
		}
	}

	localStorage.removeItem(ACCENT_STORAGE_KEYS.legacy.position);
	localStorage.removeItem(ACCENT_STORAGE_KEYS.legacy.color);
}

export function getDefaultAccentPosition(
	theme = getActiveAccentTheme(),
): number {
	if (theme === DARK_MODE) return DEFAULT_DARK_ACCENT_POSITION;
	if (typeof document === "undefined") return DEFAULT_LIGHT_ACCENT_POSITION;

	const configCarrier = document.getElementById("config-carrier");
	return normalizeAccentPosition(
		configCarrier?.dataset.accentPosition || DEFAULT_LIGHT_ACCENT_POSITION,
		DEFAULT_LIGHT_ACCENT_POSITION,
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

	migrateLegacyAccentPreference();
	const storageKeys = getThemeStorageKeys();
	const defaultPosition = getDefaultAccentPosition();
	return normalizeAccentPosition(
		localStorage.getItem(storageKeys.position),
		defaultPosition,
	);
}

export function getAccentColor(position: number = getAccentPosition()): string {
	return interpolatePremiumColor(position);
}

export function hasCustomAccent(): boolean {
	if (typeof localStorage === "undefined") return false;
	migrateLegacyAccentPreference();
	return localStorage.getItem(getThemeStorageKeys().position) !== null;
}

export function getThemeDefaultAccent(theme: LIGHT_DARK_MODE): string {
	return theme === DARK_MODE ? DEFAULT_DARK_ACCENT : DEFAULT_LIGHT_ACCENT;
}

export function getEffectiveAccentColor(position = getAccentPosition()): string {
	const theme = getActiveAccentTheme();
	if (!hasCustomAccent()) return getThemeDefaultAccent(theme);
	return localStorage.getItem(getThemeStorageKeys(theme).color) ||
		interpolatePremiumColor(position);
}

export function setAccentPosition(position: number): void {
	const normalizedPosition = normalizeAccentPosition(position);
	const accentColor = interpolatePremiumColor(normalizedPosition);

	if (typeof localStorage !== "undefined") {
		migrateLegacyAccentPreference();
		const storageKeys = getThemeStorageKeys();
		localStorage.setItem(storageKeys.position, String(normalizedPosition));
		localStorage.setItem(storageKeys.color, accentColor);
		localStorage.removeItem(LEGACY_HUE_STORAGE_KEY);
	}

	if (typeof document === "undefined") {
		return;
	}

	document.documentElement.style.setProperty("--accent-color", accentColor);
}

export function clearAccentCustomization(): void {
	if (typeof localStorage !== "undefined") {
		migrateLegacyAccentPreference();
		const storageKeys = getThemeStorageKeys();
		localStorage.removeItem(storageKeys.position);
		localStorage.removeItem(storageKeys.color);
	}
	const theme = document.documentElement.classList.contains("dark") ? DARK_MODE : LIGHT_MODE;
	document.documentElement.style.setProperty("--accent-color", getThemeDefaultAccent(theme));
}

export function applyAccentToDocument(): void {
	if (typeof document === "undefined") return;
	const position = getAccentPosition();
	document.documentElement.style.setProperty(
		"--accent-color",
		getEffectiveAccentColor(position),
	);
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
	applyAccentToDocument();

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
