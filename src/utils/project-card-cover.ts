export interface ProjectCardCoverInput {
	title: string;
	projectType: string;
	domain: string;
	capability?: string;
	icon: string;
	accentColor: string;
	keywords?: string[];
}

export interface GeneratedProjectCardCover {
	src: string;
	alt: string;
}

type CoverMotif =
	| "clinical-documents"
	| "identity-policy"
	| "protocol-hub"
	| "quantization"
	| "route-optimization"
	| "predictive-maintenance"
	| "service-orchestration"
	| "telecom-infrastructure"
	| "vehicle-network"
	| "vision-detection"
	| "network";

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

const MOTIF_LABELS: Record<CoverMotif, string> = {
	"clinical-documents": "document review and clinical validation",
	"identity-policy": "credential and policy selection",
	"protocol-hub": "client, protocol hub and tool-server topology",
	quantization: "quantization matrix and low-rank inference",
	"route-optimization": "depot, route nodes and vehicle path",
	"predictive-maintenance":
		"asset telemetry, risk curve and maintenance signal",
	"service-orchestration": "agent-routed service orchestration",
	"telecom-infrastructure":
		"network tower, workflow documents and infrastructure links",
	"vehicle-network": "connected in-vehicle inference network",
	"vision-detection": "computer-vision detection pipeline",
	network: "connected project systems",
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
	return shortened || normalized.slice(0, maxLength).trim();
}

function selectMotif(input: ProjectCardCoverInput): CoverMotif {
	const terms = [
		input.title,
		input.domain,
		input.capability || "",
		...(input.keywords || []),
	]
		.join(" ")
		.toLowerCase();
	if (
		/\b(lightdid|zkp|zero[- ]knowledge|anoncreds|credential|decentralized identity)\b/.test(
			terms,
		)
	)
		return "identity-policy";
	if (
		/\b(medclaim|medical|clinical|insurance claim|claim review)\b/.test(terms)
	)
		return "clinical-documents";
	if (
		/\b(vrp|vehicle routing|route optimization|fleet routing|or-tools|pyvrp)\b/.test(
			terms,
		)
	)
		return "route-optimization";
	if (
		/\b(predictive maintenance|preventive maintenance|generator failure|failure risk|asset reliability)\b/.test(
			terms,
		)
	)
		return "predictive-maintenance";
	if (
		/\b(telecom|telecommunications|copper reclamation|pole validation|network infrastructure)\b/.test(
			terms,
		)
	)
		return "telecom-infrastructure";
	if (/\b(vehicle|automotive|in-vehicle)\b/.test(terms))
		return "vehicle-network";
	if (
		/\b(microservice|service registry|service composition|dag planning|orchestration)\b/.test(
			terms,
		)
	)
		return "service-orchestration";
	if (
		/\b(mcp 2(?:\.0)?|model context protocol|tool server|client.?server|protocol)\b/.test(
			terms,
		)
	)
		return "protocol-hub";
	if (
		/\b(dacr|quantization|low[- ]rank|memory[- ]efficient|int4|inference compression)\b/.test(
			terms,
		)
	)
		return "quantization";
	if (
		/\b(yolo|computer vision|object detection|key detection|opencv)\b/.test(
			terms,
		)
	)
		return "vision-detection";
	return "network";
}

function motifMarkup(motif: CoverMotif): string {
	switch (motif) {
		case "route-optimization":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="118" y="236" width="128" height="148" rx="20"/><path d="M151 264h62m-62 27h41m-41 27h62m-62 27h46"/>
				<path d="M275 342c54-104 117-116 169-44s119 80 189-4 128-53 192 20"/>
				<circle class="motif-fill" cx="292" cy="319" r="13"/><circle class="motif-fill" cx="433" cy="290" r="13"/><circle class="motif-fill" cx="577" cy="326" r="13"/><circle class="motif-fill" cx="714" cy="277" r="13"/>
				<rect class="motif-surface" x="777" y="287" width="74" height="48" rx="12"/><circle class="motif-fill" cx="794" cy="342" r="10"/><circle class="motif-fill" cx="834" cy="342" r="10"/>
				<path d="M805 287v-20h23v20M453 298l-13-8 5 15M588 319l-15 6 15 6"/>
			</g>`;
		case "predictive-maintenance":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="119" y="250" width="205" height="134" rx="21"/><circle class="motif-soft" cx="221" cy="317" r="43"/><path d="M221 274v86m-43-43h86M190 286l62 62m0-62-62 62"/>
				<path d="M352 331h54l23-48 35 91 39-119 34 76h60"/><circle class="motif-fill" cx="429" cy="283" r="7"/><circle class="motif-fill" cx="503" cy="255" r="7"/>
				<rect class="motif-surface" x="626" y="232" width="221" height="166" rx="21"/><path d="M656 359c27-13 45-30 63-52s42-31 95-44"/><path d="M656 262v97h160"/>
				<path class="motif-soft" d="M739 276h79v45h-79z"/><path d="m759 299 13 13 28-31"/>
			</g>`;
		case "telecom-infrastructure":
			return `<g class="motif-stroke">
				<path class="motif-surface" d="M221 230 171 399h100l-50-169Z"/><path d="M191 330h60m-72 36h84M199 295h44M221 230v-19"/>
				<path d="M167 263a76 76 0 0 1 108 0M143 238a110 110 0 0 1 156 0"/>
				<rect class="motif-surface" x="386" y="239" width="166" height="72" rx="16"/><rect class="motif-surface" x="386" y="345" width="166" height="72" rx="16"/><path d="M414 263h110m-110 22h72M414 369h110m-110 22h82"/>
				<circle class="motif-fill" cx="679" cy="275" r="17"/><circle class="motif-fill" cx="793" cy="354" r="17"/><path d="M271 319h82l33-44m166 0h127l114 79M552 381h94l33-106"/>
				<path d="m343 308 10 11-10 11m325-66 11 11-11 11m114 57 11 11-11 11"/>
			</g>`;
		case "quantization":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="126" y="232" width="242" height="158" rx="20"/>
				${Array.from({ length: 20 }, (_, index) => {
					const column = index % 5;
					const row = Math.floor(index / 5);
					const emphasized = (column + row * 2) % 4 === 0;
					return `<rect x="${150 + column * 39}" y="${254 + row * 30}" width="27" height="18" rx="4" class="${emphasized ? "motif-fill" : "motif-soft"}"/>`;
				}).join("")}
				<path d="M390 310h82m-18-16 18 16-18 16"/>
				<rect class="motif-surface" x="500" y="247" width="126" height="126" rx="20"/>
				<rect class="motif-fill" x="526" y="270" width="18" height="80" rx="7"/>
				<rect class="motif-fill" x="555" y="286" width="18" height="64" rx="7" opacity=".72"/>
				<rect class="motif-fill" x="584" y="304" width="18" height="46" rx="7" opacity=".44"/>
				<path d="M648 310h82"/><circle class="motif-surface" cx="770" cy="310" r="39"/><path d="m754 310 11 11 23-25"/>
			</g>`;
		case "vehicle-network":
			return `<g class="motif-stroke">
				<path class="motif-surface" d="M126 337h300l-22-64c-7-20-24-31-45-31H231c-19 0-35 8-47 23l-58 72Z"/>
				<path d="M188 292h199m-143-50-18 50m117-50 22 50"/>
				<circle class="motif-surface" cx="194" cy="349" r="31"/><circle class="motif-fill" cx="194" cy="349" r="10"/>
				<circle class="motif-surface" cx="361" cy="349" r="31"/><circle class="motif-fill" cx="361" cy="349" r="10"/>
				<circle class="motif-fill" cx="519" cy="271" r="14"/><circle class="motif-fill" cx="621" cy="328" r="14"/>
				<circle class="motif-fill" cx="748" cy="254" r="14"/><circle class="motif-fill" cx="797" cy="354" r="14"/>
				<path d="M519 271 621 328l127-74 49 100M621 328l176 26M404 304l115-33"/>
				<rect class="motif-surface" x="568" y="229" width="105" height="48" rx="15"/><path d="M591 253h59"/>
			</g>`;
		case "service-orchestration":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="118" y="235" width="144" height="58" rx="16"/><rect class="motif-surface" x="118" y="337" width="144" height="58" rx="16"/>
				<rect class="motif-surface" x="698" y="235" width="144" height="58" rx="16"/><rect class="motif-surface" x="698" y="337" width="144" height="58" rx="16"/>
				<path d="M143 258h59m-59 14h89M143 360h70m-70 14h91M723 258h66m-66 14h92M723 360h78m-78 14h52"/>
				<path d="m480 230 92 80-92 80-92-80 92-80Z" class="motif-surface"/><circle class="motif-fill" cx="480" cy="310" r="22"/>
				<path d="M262 264h105l36 31m-141 71h105l36-41m154-30 36-31h105m-141 61 36 41h105"/>
				<path d="m352 253 15 11-15 11m0 80 15 11-15 11m256-124-15 11 15 11m0 80-15 11 15 11"/>
			</g>`;
		case "protocol-hub":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="116" y="249" width="146" height="52" rx="16"/><rect class="motif-surface" x="116" y="330" width="146" height="52" rx="16"/>
				<path d="M143 268h76m-76 15h52M143 349h87m-87 15h59"/>
				<circle class="motif-surface" cx="480" cy="316" r="92"/><circle class="motif-soft" cx="480" cy="316" r="58"/><circle class="motif-fill" cx="480" cy="316" r="22"/>
				<path d="M262 275h125m-125 81h125M573 272h73m-73 87h73"/>
				<rect class="motif-surface" x="646" y="226" width="82" height="82" rx="19"/><rect class="motif-surface" x="756" y="226" width="82" height="82" rx="19"/>
				<rect class="motif-surface" x="646" y="337" width="82" height="82" rx="19"/><rect class="motif-surface" x="756" y="337" width="82" height="82" rx="19"/>
				<path d="M669 253h36m-36 15h36m110-15h36m-36 15h36M669 364h36m-36 15h36m110-15h36m-36 15h36"/>
				<circle class="motif-fill" cx="687" cy="286" r="5"/><circle class="motif-fill" cx="797" cy="286" r="5"/><circle class="motif-fill" cx="687" cy="397" r="5"/><circle class="motif-fill" cx="797" cy="397" r="5"/>
			</g>`;
		case "identity-policy":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="126" y="230" width="250" height="168" rx="22"/><circle class="motif-soft" cx="184" cy="291" r="28"/>
				<path d="M229 270h103m-103 25h82M154 344h178m-178 25h127"/>
				<path class="motif-surface" d="M498 230 430 259v53c0 57 26 95 68 116 42-21 68-59 68-116v-53l-68-29Z"/><path d="m469 323 21 21 42-49"/>
				<path d="M566 314h88m-18-15 18 15-18 15M654 314l59-58m-59 58 59 58"/>
				<rect class="motif-surface" x="713" y="224" width="128" height="63" rx="18"/><rect class="motif-surface" x="713" y="341" width="128" height="63" rx="18"/>
				<path d="M740 249h74m-74 16h48M740 366h74m-74 16h48"/>
			</g>`;
		case "clinical-documents":
			return `<g class="motif-stroke">
				<rect class="motif-soft" x="136" y="249" width="192" height="150" rx="18" transform="rotate(-6 232 324)"/><rect class="motif-surface" x="162" y="224" width="212" height="174" rx="20"/>
				<path d="M197 265h142m-142 30h116m-116 30h136m-136 30h82M127 260v-35h35m247 0h35v35M127 364v35h35m247 0h35v-35"/>
				<path d="M514 235h160l71 75-71 75H514l-71-75 71-75Z" class="motif-surface"/><path d="M577 271v78m-39-39h78M745 310h68"/>
				<path class="motif-surface" d="M842 274c-26 0-47 17-47 39 0 12 7 24 18 31l-7 28 28-19h8c26 0 47-17 47-40s-21-39-47-39Z"/>
				<circle class="motif-fill" cx="825" cy="314" r="4"/><circle class="motif-fill" cx="842" cy="314" r="4"/><circle class="motif-fill" cx="859" cy="314" r="4"/>
			</g>`;
		case "vision-detection":
			return `<g class="motif-stroke">
				<rect class="motif-surface" x="120" y="228" width="370" height="184" rx="22"/>
				<path d="M148 272v-20h23m291 20v-20h-23M148 366v20h23m291-20v20h-23"/><rect class="motif-soft" x="208" y="262" width="128" height="92" rx="12"/>
				<circle class="motif-fill" cx="272" cy="304" r="21"/><path d="m263 304 9 9 19-22M490 320h92m-18-15 18 15-18 15"/>
				<rect class="motif-surface" x="608" y="242" width="103" height="58" rx="16"/><rect class="motif-surface" x="608" y="340" width="103" height="58" rx="16"/>
				<circle class="motif-surface" cx="802" cy="320" r="48"/><path d="M711 271h37l22 28m-59 70h37l22-28M783 320h38m-19-19v38"/>
			</g>`;
		default:
			return `<g class="motif-stroke">
				<circle class="motif-surface" cx="480" cy="310" r="72"/><circle class="motif-fill" cx="480" cy="310" r="22"/>
				<circle class="motif-surface" cx="226" cy="257" r="44"/><circle class="motif-surface" cx="244" cy="382" r="44"/>
				<circle class="motif-surface" cx="716" cy="241" r="44"/><circle class="motif-surface" cx="749" cy="370" r="44"/>
				<path d="m267 266 142 31m-126 66 131-35m135-42 126-36m-128 83 181 29"/>
				<circle class="motif-fill" cx="226" cy="257" r="9"/><circle class="motif-fill" cx="244" cy="382" r="9"/><circle class="motif-fill" cx="716" cy="241" r="9"/><circle class="motif-fill" cx="749" cy="370" r="9"/>
			</g>`;
	}
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
	const motif = selectMotif(input);
	const motifDescription = MOTIF_LABELS[motif];
	const accessibleTitle = `${input.title} — ${input.domain}`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-labelledby="cover-title cover-description">
	<title id="cover-title">${escapeXml(accessibleTitle)}</title>
	<desc id="cover-description">A generated portfolio cover using a ${escapeXml(motifDescription)} motif.</desc>
	<style>
		.label{font:700 21px Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:1.2px;fill:#475569}
		.category{font:700 16px Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.8px;fill:${accent}}
		.capability{font:650 18px Inter,ui-sans-serif,system-ui,sans-serif;fill:#526076}
		.motif-stroke{fill:none;stroke:${accent};stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
		.motif-surface{fill:#FFFFFF;stroke:${border}}
		.motif-soft{fill:${panel};stroke:${border}}
		.motif-fill{fill:${accent};stroke:none}
	</style>
	<rect width="960" height="540" rx="28" fill="${background}"/>
	<rect x="1" y="1" width="958" height="538" rx="27" fill="none" stroke="${border}" stroke-width="2"/>
	<rect width="10" height="540" rx="5" fill="${accent}"/>
	<rect x="72" y="48" width="76" height="76" rx="21" fill="#FFFFFF" stroke="${border}" stroke-width="2"/>
	<g transform="translate(88 64) scale(1.85)" fill="none" stroke="${accent}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${iconMarkup}</g>
	<rect x="676" y="62" width="212" height="44" rx="22" fill="${panel}"/>
	<text x="782" y="90" text-anchor="middle" class="category">${escapeXml(category)}</text>
	<text x="72" y="184" class="label">${escapeXml(domain)}</text>
	<path d="M72 207h816" stroke="${border}" stroke-width="2"/>
	${motifMarkup(motif)}
	<circle cx="80" cy="486" r="5" fill="${accent}"/>
	<text x="98" y="493" class="capability">${escapeXml(capability)}</text>
</svg>`;
	return {
		src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
		alt: `Generated ${input.domain} cover with ${motifDescription} motif`,
	};
}
