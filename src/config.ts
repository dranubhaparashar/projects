import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "Anubha",
	subtitle: "Demo Site",
	lang: "en",
	themeColor: {
		hue: 250,
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
	bio: "I am Me. In all the world, there is no one else exactly like me. Everything that comes out of me is authentically mine, because I alone chose it -- I own everything about me: my body, my feelings, my mouth, my voice, all my actions, whether they be to others or myself. I own my fantasies, my dreams, my hopes, my fears. I own my triumphs and successes, all my failures and mistakes. Because I own all of me, I can become intimately acquainted with me. By so doing, I can love me and be friendly with all my parts. I know there are aspects about myself that puzzle me, and other aspects that I do not know -- but as long as I am friendly and loving to myself, I can courageously and hopefully look for solutions to the puzzles and ways to find out more about me. However I look and sound, whatever I say and do, and whatever I think and feel at a given moment in time is authentically me. If later some parts of how I looked, sounded, thought, and felt turn out to be unfitting, I can discard that which is unfitting, keep the rest, and invent something new for that which I discarded. I can see, hear, feel, think, say, and do. I have the tools to survive, to be close to others, to be productive, and to make sense and order out of the world of people and things outside of me. I own me, and therefore, I can engineer me.",
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
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};