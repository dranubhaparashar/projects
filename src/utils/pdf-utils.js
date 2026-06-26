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

export function getPostPdfPath(entry) {
	const explicitPdf = String(entry?.data?.pdf || "").trim();
	return explicitPdf || getGeneratedPostPdfPath(entry?.slug || "");
}