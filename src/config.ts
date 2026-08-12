import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Anubha Parashar",
	subtitle: "AI Projects",
	lang: "en",
	accentColor: {
		position: 20,
		fixed: false,
	},
	banner: {
		enable: true,
		src: "assets/images/demo-banner.png",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true,
		depth: 2,
	},
	favicon: [],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: "Impact Domain",
			url: "/impact-domain/",
		},
		{
			name: "Website",
			url: "https://anubhaparashar.github.io/",
			external: true,
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/demo-avatar.jpg",
	name: "Dr. Anubha Parashar",
	bio: "Dr. Anubha Parashar is an AI researcher and practitioner at Pearce Services, with a PhD, 50+ publications, and 6 patents spanning GenAI, Agentic AI, computer vision, predictive systems, and intelligent automation.",
	links: [
		{
			name: "LinkedIn",
			icon: "fa6-brands:linkedin",
			url: "https://www.linkedin.com/in/anubhaparashar/",
		},
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/dranubhaparashar/",
		},
		{
			name: "GitHub Personal",
			icon: "fa6-brands:github",
			url: "https://github.com/anubhaparashar",
		},
		{
			name: "Hugging Face Spaces",
			icon: "custom:hugging-face",
			url: "https://huggingface.co/AnubhaParashar/spaces",
			rel: "noopener noreferrer",
		},
		{
			name: "YouTube",
			icon: "fa6-brands:youtube",
			url: "https://www.youtube.com/@Dr.AnubhaParashar",
			rel: "noopener noreferrer",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: false,
	name: "",
	url: "",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};
