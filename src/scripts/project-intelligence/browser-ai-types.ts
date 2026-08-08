export interface BrowserAssetUrls {
	chunks: string;
	vectorMetadata: string;
	vectors: string;
}

export interface BrowserAiProgress {
	stage: "embedding-model" | "embedding" | "llm-model" | "generation";
	status: string;
	progress?: number;
	loaded?: number;
	total?: number;
}

export interface BrowserConversationTurn {
	role: "user" | "assistant";
	content: string;
}

export interface BrowserLexicalHint {
	project_id: string;
	score: number;
	reasons: string[];
}

export interface BrowserRagSource {
	source_id: string;
	project_id: string;
	project_title: string;
	section: string;
	url: string;
}

export interface BrowserRelatedProject {
	id: string;
	title: string;
	url: string;
}

export interface BrowserProjectChunk {
	chunk_id: string;
	project_id: string;
	project_title: string;
	section: string;
	text: string;
	url: string;
	tags: string[];
	technologies: string[];
	capabilities: string[];
	impact_domains: string[];
	deployment_status: string;
}

export interface BrowserHybridHit {
	chunk: BrowserProjectChunk;
	semanticScore: number;
	lexicalScore: number;
	hybridScore: number;
}

export interface BrowserRagAnswer {
	answer: string;
	sources: BrowserRagSource[];
	related_projects: BrowserRelatedProject[];
	retrieval: {
		mode: "hybrid";
		semantic_matches: number;
		context_chunks: number;
		project_ids: string[];
		timings_ms: {
			assets: number;
			embedding: number;
			vector_search: number;
			hybrid_ranking: number;
			total: number;
		};
	};
	context: BrowserHybridHit[];
}

export interface BrowserAiCapabilities {
	semanticSearch: boolean;
	localLlm: boolean;
	webGpu: boolean;
	isMobile: boolean;
	isLowMemory: boolean;
	reason: string;
}
