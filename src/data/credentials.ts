export type Publication = {
	title: string;
	venue: string;
	year: number;
	url?: string;
	doi?: string;
};

export type Patent = {
	title: string;
	number: string;
	status?: string;
	year?: number;
	url?: string;
};

/**
 * TODO(evidence): Add only records verified against DOI/publisher and official
 * patent-registry sources. The repository currently contains aggregate claims,
 * but no publication titles, patent numbers, or Scholar profile URL.
 */
export const publications: Publication[] = [];
export const patents: Patent[] = [];
export const googleScholarUrl = "";
