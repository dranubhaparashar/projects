export type Publication = {
	id: string;
	number: string;
	title: string;
	year: number;
	authors: string[];
	primaryAuthor: string;
	journal: string;
	volume: string;
	articleNumber: string;
	issn: string;
	publisher: string;
	doi: string;
	doiUrl: string;
	impactFactor?: string;
	quartile?: string;
};

export type Patent = {
	title: string;
	number: string;
	status?: string;
	year?: number;
	url?: string;
};

export const publications: Publication[] = [
	{
		id: "vehicle-scale-llms-2026",
		number: "01",
		title:
			"Vehicle-Scale LLMs: Integrating low-rank residuals and 4-bit quantization for in-vehicle AI",
		year: 2026,
		authors: [
			"Anubha Parashar",
			"Apoorva Parashar",
			"Bhavya Joshi",
			"Kavita Jhajharia",
			"Aditya Sinha",
		],
		primaryAuthor: "Anubha Parashar",
		journal: "Array",
		volume: "29",
		articleNumber: "100709",
		issn: "2590-0056",
		publisher: "Elsevier",
		doi: "10.1016/j.array.2026.100709",
		doiUrl: "https://doi.org/10.1016/j.array.2026.100709",
		impactFactor: "4.5",
		quartile: "SCI Q1",
	},
];

/** Add only records verified against an official patent registry. */
export const patents: Patent[] = [];

/** Set only after the profile URL has been verified. */
export const googleScholarUrl = "";

/** Optional future archive route; keep empty until that page exists. */
export const publicationsPageUrl = "";
