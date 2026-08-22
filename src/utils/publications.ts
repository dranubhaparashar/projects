import type { CollectionEntry } from "astro:content";
import { type Publication, publications } from "@/data/credentials";

const publicationById = new Map<string, Publication>();

for (const publication of publications) {
	if (publicationById.has(publication.id)) {
		throw new Error(`Duplicate publication ID: ${publication.id}`);
	}
	publicationById.set(publication.id, publication);
}

function uniqueIds(ids: string[]): string[] {
	const seen = new Set<string>();
	return ids
		.map((id) => id.trim())
		.filter((id) => {
			if (!id || seen.has(id)) return false;
			seen.add(id);
			return true;
		});
}

function normalizeEntryKey(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\\/g, "/")
		.replace(/\/index$/i, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
}

function findProjectEntry(
	projectId: string,
	entries: CollectionEntry<"posts">[],
): CollectionEntry<"posts"> | undefined {
	const normalizedProjectId = normalizeEntryKey(projectId);
	return entries.find(
		(entry) =>
			normalizeEntryKey(entry.slug) === normalizedProjectId ||
			normalizeEntryKey(entry.id) === normalizedProjectId,
	);
}

export function getPublicationsByIds(
	ids: string[] = [],
	owner = "content entry",
): Publication[] {
	return uniqueIds(ids).map((id) => {
		const publication = publicationById.get(id);
		if (!publication) {
			throw new Error(`Unknown publication ID "${id}" referenced by ${owner}.`);
		}
		return publication;
	});
}

/**
 * Resolves direct post/publication links first, then inherits publications from
 * an associated project. IDs are deduplicated before canonical records are read.
 */
export function getRelatedPublications(
	entry: CollectionEntry<"posts">,
	entries: CollectionEntry<"posts">[] = [],
): Publication[] {
	const explicitIds = entry.data.related_publications || [];
	const projectId = entry.data.project_id?.trim() || "";
	const projectEntry = projectId
		? findProjectEntry(projectId, entries)
		: undefined;

	if (projectId && entries.length > 0 && !projectEntry) {
		throw new Error(
			`Unknown project ID "${projectId}" referenced by ${entry.slug}.`,
		);
	}

	const inheritedIds = projectEntry?.data.related_publications || [];
	return getPublicationsByIds([...explicitIds, ...inheritedIds], entry.slug);
}

export function getPublicationSectionId(
	slug: string,
	variant: "business" | "technical" | "post",
): string {
	return `${normalizeEntryKey(slug)}-related-research-${variant}`;
}

export function buildScholarlyArticleJsonLd(
	publication: Publication,
	personId?: string,
): Record<string, unknown> {
	return {
		"@type": "ScholarlyArticle",
		"@id": publication.doiUrl,
		headline: publication.title,
		name: publication.title,
		datePublished: String(publication.year),
		url: publication.doiUrl,
		author: publication.authors.map((author) =>
			author === publication.primaryAuthor && personId
				? {
						"@type": "Person",
						"@id": personId,
						name: author,
					}
				: { "@type": "Person", name: author },
		),
		publisher: {
			"@type": "Organization",
			name: publication.publisher,
		},
		isPartOf: {
			"@type": "PublicationVolume",
			volumeNumber: publication.volume,
			isPartOf: {
				"@type": "Periodical",
				name: publication.journal,
				issn: publication.issn,
			},
		},
		pagination: publication.articleNumber,
		identifier: [
			{
				"@type": "PropertyValue",
				propertyID: "DOI",
				value: publication.doi,
			},
			{
				"@type": "PropertyValue",
				propertyID: "Article number",
				value: publication.articleNumber,
			},
		],
	};
}
