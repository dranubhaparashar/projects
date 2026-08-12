export function slugToPdfBasename(slug) {
	return String(slug || "")
		.split("/")
		.filter(Boolean)
		.join("-")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "") || "project-post";
}

export function getGeneratedPostPdfPath(slug) {
	return `/downloads/${slugToPdfBasename(slug)}-project-details.pdf`;
}

export function contentIdToPdfSlug(contentId) {
	const normalized = String(contentId || "").replace(/\\/g, "/");
	const withoutExtension = normalized.replace(/\.(?:md|mdx)$/i, "");
	const segments = withoutExtension.split("/").filter(Boolean);
	if (segments.at(-1)?.toLowerCase() === "index") segments.pop();
	return segments
		.map((segment) =>
			String(segment)
				.toLowerCase()
				.normalize("NFKD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^a-z0-9\s-]/g, "")
				.trim()
				.replace(/\s+/g, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.filter(Boolean)
		.join("-") || "project-post";
}

export function getGeneratedPostPdfPathFromContentId(contentId) {
	return `/downloads/${contentIdToPdfSlug(contentId)}-project-details.pdf`;
}

export function getPostPdfPath(entry) {
	const explicitPdf = String(entry?.data?.pdf || "").trim();
	return explicitPdf || getGeneratedPostPdfPathFromContentId(entry?.id || entry?.slug || "");
}
