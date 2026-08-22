export interface PostPdfEntry {
	id?: string;
	slug?: string;
	data?: {
		pdf?: string;
	};
}

export function slugToPdfBasename(slug?: string): string;
export function getGeneratedPostPdfPath(slug?: string): string;
export function contentIdToPdfSlug(contentId?: string): string;
export function getGeneratedPostPdfPathFromContentId(
	contentId?: string,
): string;
export function getPostPdfPath(entry?: PostPdfEntry): string;
