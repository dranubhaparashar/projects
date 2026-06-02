export function getProjectPostId(slugOrPath: string): string {
	const clean = slugOrPath
		.split("?")[0]
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean)
		.at(-1);

	return (clean || slugOrPath)
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
