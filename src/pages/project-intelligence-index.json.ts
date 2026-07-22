import { getCollection } from "astro:content";
import { buildPortfolioKnowledgeIndex } from "../utils/project-intelligence-index";

export const prerender = true;

export async function GET() {
	const entries = await getCollection("posts");
	const index = buildPortfolioKnowledgeIndex(entries);

	return new Response(JSON.stringify(index), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
}
