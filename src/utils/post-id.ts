export function normalizePostId(pathname: string): string {
	const clean = pathname
		.split("?")[0]
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean)
		.at(-1);

	return (clean || pathname)
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function getProjectPostId(slugOrPath: string): string {
	return normalizePostId(slugOrPath);
}
