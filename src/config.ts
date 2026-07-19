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
		position: 59,
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
			name: "Website",
			url: "https://anubhaparashar.github.io/",
			external: true,
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/demo-avatar.jpg",
	name: "Anubha Parashar",
	bio: "AI Developer specializing in GenAI, Agentic AI, and intelligent automation. Builds scalable LLM-powered systems, RAG pipelines, and multi-agent architectures. Focused on solving real-world problems with practical, production-ready AI solutions. Continuously exploring cutting-edge AI to create impactful, high-value applications.",
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
