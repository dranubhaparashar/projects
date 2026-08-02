export interface ProjectCardCoverInput {
	title: string;
	projectType: string;
	domain: string;
	capability?: string;
	icon: string;
	accentColor: string;
}

export interface GeneratedProjectCardCover {
	src: string;
	alt: string;
}

const ICON_MARKUP: Record<string, string> = {
	factory:
		'<path d="M3 21V10l6 4v-4l6 4V5h4v16H3Z"/><path d="M7 21v-3h3v3m3 0v-3h3v3"/>',
	"radio-tower":
		'<path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m9 22 3-8 3 8M5.6 17.5a8 8 0 0 1 0-11m12.8 0a8 8 0 0 1 0 11M8.4 14.8a4 4 0 0 1 0-5.6m7.2 0a4 4 0 0 1 0 5.6"/>',
	eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/>',
	bot: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/>',
	shield:
		'<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
	"graduation-cap":
		'<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 12v4c2.8 2.1 7.2 2.1 10 0v-4M21 9v6"/>',
	route:
		'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h-1"/>',
	server:
		'<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/>',
	sparkles:
		'<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3ZM6 13l.9 2.1L9 16l-2.1.9L6 19l-.9-2.1L3 16l2.1-.9L6 13Zm12 1 .8 1.7 1.7.8-1.7.8L18 19l-.8-1.7-1.7-.8 1.7-.8L18 14Z"/>',
	network:
		'<circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="m11 7-5 9m7-9 5 9M7 18h10"/>',
};

function escapeXml(value: string): string {
	return String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function normalizedHex(value: string): string {
	return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : "#2563EB";
}

function mixWithWhite(value: string, whiteWeight: number): string {
	const hex = normalizedHex(value).slice(1);
	const channels = [0, 2, 4].map((offset) =>
		Number.parseInt(hex.slice(offset, offset + 2), 16),
	);
	const mixed = channels.map((channel) =>
		Math.round(channel * (1 - whiteWeight) + 255 * whiteWeight),
	);
	return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function truncateWords(value: string, maxLength: number): string {
	const normalized = String(value || "")
		.replace(/\s+/g, " ")
		.trim();
	if (normalized.length <= maxLength) return normalized;
	const shortened = normalized.slice(0, maxLength + 1).replace(/\s+\S*$/, "");
	return `${shortened || normalized.slice(0, maxLength).trim()}…`;
}

function titleLines(value: string): string[] {
	const words = String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.split(" ");
	const lines: string[] = [];
	for (const word of words) {
		const current = lines.at(-1) || "";
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length <= 31 || !current) {
			if (lines.length === 0) lines.push(candidate);
			else lines[lines.length - 1] = candidate;
			continue;
		}
		if (lines.length === 2) {
			lines[1] = truncateWords(`${lines[1]} ${word}`, 31);
			break;
		}
		lines.push(word);
	}
	return lines.slice(0, 2).map((line) => truncateWords(line, 34));
}

export function generateProjectCardCover(
	input: ProjectCardCoverInput,
): GeneratedProjectCardCover {
	const accent = normalizedHex(input.accentColor);
	const background = mixWithWhite(accent, 0.92);
	const panel = mixWithWhite(accent, 0.84);
	const border = mixWithWhite(accent, 0.68);
	const iconMarkup = ICON_MARKUP[input.icon] || ICON_MARKUP.network;
	const domain = truncateWords(input.domain, 43).toUpperCase();
	const category = truncateWords(input.projectType, 28).toUpperCase();
	const capability = truncateWords(input.capability || input.domain, 42);
	const lines = titleLines(input.title);
	const titleStartY = lines.length === 1 ? 358 : 330;
	const titleMarkup = lines
		.map(
			(line, index) =>
				`<text x="72" y="${titleStartY + index * 58}" class="title">${escapeXml(line)}</text>`,
		)
		.join("");
	const accessibleTitle = `${input.title} — ${input.domain}`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="cover-title cover-description">
	<title id="cover-title">${escapeXml(accessibleTitle)}</title>
	<desc id="cover-description">Generated portfolio cover for ${escapeXml(input.title)}</desc>
	<style>
		.label{font:700 20px Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:1.4px;fill:#475569}
		.category{font:700 16px Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.8px;fill:${accent}}
		.title{font:750 45px Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-1.1px;fill:#172033}
		.capability{font:650 18px Inter,ui-sans-serif,system-ui,sans-serif;fill:#526076}
	</style>
	<rect width="960" height="540" rx="28" fill="${background}"/>
	<rect x="1" y="1" width="958" height="538" rx="27" fill="none" stroke="${border}" stroke-width="2"/>
	<rect width="10" height="540" rx="5" fill="${accent}"/>
	<rect x="72" y="66" width="86" height="86" rx="23" fill="#FFFFFF" stroke="${border}" stroke-width="2"/>
	<g transform="translate(91 85) scale(2)" fill="none" stroke="${accent}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${iconMarkup}</g>
	<rect x="676" y="76" width="212" height="44" rx="22" fill="${panel}"/>
	<text x="782" y="104" text-anchor="middle" class="category">${escapeXml(category)}</text>
	<path d="M72 238h816" stroke="${border}" stroke-width="2"/>
	<text x="72" y="288" class="label">${escapeXml(domain)}</text>
	${titleMarkup}
	<circle cx="80" cy="474" r="5" fill="${accent}"/>
	<text x="98" y="481" class="capability">${escapeXml(capability)}</text>
</svg>`;
	return {
		src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
		alt: `${input.title} project cover for ${input.domain}`,
	};
}
