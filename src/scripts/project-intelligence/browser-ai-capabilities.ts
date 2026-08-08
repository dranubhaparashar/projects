import type { BrowserAiCapabilities } from "./browser-ai-types";

interface NavigatorWithAiCapabilities extends Navigator {
	deviceMemory?: number;
	gpu?: {
		requestAdapter: () => Promise<{
			features?: { has: (feature: string) => boolean };
		} | null>;
	};
}

let capabilitiesPromise: Promise<BrowserAiCapabilities> | null = null;

export function detectBrowserAiCapabilities(): Promise<BrowserAiCapabilities> {
	if (capabilitiesPromise) return capabilitiesPromise;
	capabilitiesPromise = (async () => {
		const browserNavigator = navigator as NavigatorWithAiCapabilities;
		const semanticSearch =
			typeof Worker !== "undefined" &&
			typeof WebAssembly !== "undefined" &&
			typeof fetch === "function";
		const isMobile =
			/mobi|android|iphone|ipad|ipod/i.test(browserNavigator.userAgent) ||
			window.matchMedia("(max-width: 700px)").matches;
		const isLowMemory =
			typeof browserNavigator.deviceMemory === "number" &&
			browserNavigator.deviceMemory < 4;
		let adapter: Awaited<
			ReturnType<
				NonNullable<NavigatorWithAiCapabilities["gpu"]>["requestAdapter"]
			>
		> = null;
		try {
			adapter = (await browserNavigator.gpu?.requestAdapter()) ?? null;
		} catch {
			adapter = null;
		}
		const webGpu = Boolean(adapter);
		const shaderF16 = Boolean(adapter?.features?.has("shader-f16"));
		const localLlm = webGpu && shaderF16 && !isMobile && !isLowMemory;
		let reason = "Local generation is available.";
		if (!webGpu)
			reason = "WebGPU is unavailable; using grounded browser retrieval.";
		else if (!shaderF16) {
			reason =
				"This WebGPU adapter lacks shader-f16; using grounded browser retrieval.";
		} else if (isMobile || isLowMemory) {
			reason =
				"Local generation is disabled on this mobile or low-memory device.";
		}
		return {
			semanticSearch,
			localLlm,
			webGpu,
			isMobile,
			isLowMemory,
			reason,
		};
	})();
	return capabilitiesPromise;
}
