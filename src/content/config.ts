import { defineCollection, z } from "astro:content";

const textOrList = z.union([z.string(), z.array(z.string())]);

const projectLink = z.object({
	label: z.string(),
	url: z.string(),
	kind: z
		.enum([
			"demo",
			"github",
			"paper",
			"documentation",
			"dataset",
			"report",
			"video",
		])
		.optional(),
});

const metric = z.object({
	label: z.string(),
	value: z.string(),
	context: z.string().optional(),
});

const algorithm = z.union([
	z.string(),
	z.object({
		name: z.string(),
		role: z.string().optional(),
		rationale: z.string().optional(),
		input: z.string().optional(),
		output: z.string().optional(),
	}),
]);

const postsCollection = defineCollection({
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		pdf: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		impact_domain: z.string().optional().default(""),
		impact_domains: z.array(z.string()).optional().default([]),
		problems: z.array(z.string()).optional().default([]),
		capabilities: z.array(z.string()).optional().default([]),
		technologies: z.array(z.string()).optional().default([]),
		github_url: z.string().optional().default(""),
		demo_url: z.string().optional().default(""),
		paper_url: z.string().optional().default(""),
		documentation_url: z.string().optional().default(""),
		deployment: z.string().optional().default(""),
		dataset: z.string().optional().default(""),
		results: z.string().optional().default(""),
		related_projects: z
			.array(
				z.union([
					z.string(),
					z.object({
						title: z.string(),
						url: z.string(),
						description: z.string().optional(),
					}),
				]),
			)
			.optional()
			.default([]),
		comparison: z
			.object({
				project_type: z.string().optional().default(""),
				industry: z.string().optional().default(""),
				business_problem: z.string().optional().default(""),
				input: z.string().optional().default(""),
				output: z.string().optional().default(""),
				primary_capability: z.string().optional().default(""),
				technologies: z.array(z.string()).optional().default([]),
				model_or_algorithm: z.string().optional().default(""),
				dataset: z.string().optional().default(""),
				scale: z.string().optional().default(""),
				deployment_status: z.string().optional().default(""),
				deployment_environment: z.string().optional().default(""),
				infrastructure: z.string().optional().default(""),
				evaluation_metrics: z.string().optional().default(""),
				explainability: z.string().optional().default(""),
				human_in_the_loop: z.string().optional().default(""),
				limitations: z.string().optional().default(""),
				my_contribution: z.string().optional().default(""),
			})
			.optional(),
		featured: z.boolean().optional().default(false),
		video_url: z.string().optional().default(""),
		architecture: z
			.object({
				src: z.string(),
				alt: z.string().optional().default(""),
				caption: z.string().optional().default(""),
			})
			.optional(),
		youtube: z
			.union([
				z.string(),
				z.object({
					url: z.string(),
					title: z.string().optional(),
				}),
			])
			.optional(),
		contribution: z
			.object({
				role: z.string().optional(),
				items: z.array(z.string()).optional().default([]),
			})
			.optional(),
		project_links: z.array(projectLink).optional().default([]),
		views: z
			.object({
				executive: z
					.object({
						overview: textOrList.optional(),
						business_problem: textOrList.optional(),
						solution: textOrList.optional(),
						proposed_solution: textOrList.optional(),
						outcome: z
							.union([
								textOrList,
								z.object({
									summary: textOrList,
									status: z
										.enum(["achieved", "prototype", "expected"])
										.optional(),
									metrics: z.array(metric).optional().default([]),
								}),
							])
							.optional(),
						cost_risk_reduction: textOrList.optional(),
						deployment_context: z
							.object({
								status: z.string().optional(),
								details: textOrList.optional(),
							})
							.optional(),
						key_capabilities: z.array(z.string()).optional().default([]),
					})
					.optional(),
				technical: z
					.object({
						summary: textOrList.optional(),
						processing_pipeline: z.array(z.string()).optional().default([]),
						algorithms: z.array(algorithm).optional().default([]),
						dataset: z
							.object({
								name: z.string().optional(),
								type: z.string().optional(),
								source: z.string().optional(),
								size: z.string().optional(),
								classes: z.string().optional(),
								class_distribution: z.string().optional(),
								split: z.string().optional(),
								annotation_format: z.string().optional(),
								input_resolution: z.string().optional(),
								video_duration: z.string().optional(),
								frame_rate: z.string().optional(),
								augmentation: textOrList.optional(),
								synthetic_data: z.string().optional(),
								privacy: z.string().optional(),
							})
							.optional(),
						training_evaluation: textOrList.optional(),
						metrics: z.array(metric).optional().default([]),
						infrastructure: z
							.union([
								z.array(z.string()),
								z.object({
									compute: z.array(z.string()).optional().default([]),
									data: z.array(z.string()).optional().default([]),
									application: z.array(z.string()).optional().default([]),
									deployment: z.array(z.string()).optional().default([]),
									monitoring: z.array(z.string()).optional().default([]),
								}),
							])
							.optional(),
						deployment_architecture: textOrList.optional(),
						limitations: z.array(z.string()).optional().default([]),
						future_improvements: z.array(z.string()).optional().default([]),
						reproducibility_links: z.array(projectLink).optional().default([]),
					})
					.optional(),
			})
			.optional(),
		lang: z.string().optional().default(""),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	schema: z.object({}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
