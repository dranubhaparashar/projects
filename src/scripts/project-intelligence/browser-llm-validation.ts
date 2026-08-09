import type { BrowserRagSource } from "./browser-ai-types";

export type LocalAiValidationReason =
	| "validation=accepted"
	| "validation=answer-contains-url"
	| "validation=answer-too-long"
	| "validation=invalid-json"
	| "validation=empty-answer"
	| "validation=json-garbage"
	| "validation=code-fence-garbage"
	| "validation=missing-answer"
	| "validation=source-id-in-answer"
	| "validation=no-valid-source-ids"
	| "validation=truncated-json"
	| `validation=accepted-filtered-source-ids:${string}`
	| `validation=unknown-source-id:${string}`;

export interface ParsedGeneratedJson {
	answer?: string;
	answerFieldPresent: boolean;
	jsonParseSuccess: boolean;
	reason?: "invalid-json" | "missing-answer" | "truncated-json";
	sourceIds: string[];
}

export interface LocalAiValidationResult {
	accepted: boolean;
	answer?: string;
	answerFieldPresent: boolean;
	allowedSourceIds: string[];
	jsonParseSuccess: boolean;
	reason: LocalAiValidationReason;
	rejectedSourceIds: string[];
	returnedSourceIds: string[];
	sources: BrowserRagSource[];
}

function uniqueTrustedSources(sources: BrowserRagSource[]): BrowserRagSource[] {
	const seen = new Set<string>();
	return sources.filter((source) => {
		const key = source.source_id.trim().toUpperCase() || source.url.trim();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

interface JsonObjectCandidate {
	candidate?: string;
	truncated: boolean;
}

function singleTopLevelJsonObject(value: string): JsonObjectCandidate {
	let depth = 0;
	let escaped = false;
	let inString = false;
	let start = -1;
	let end = -1;
	let objects = 0;

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') inString = false;
			continue;
		}
		if (character === '"') {
			inString = true;
			continue;
		}
		if (character === "{") {
			if (depth === 0) {
				objects += 1;
				if (objects > 1) return { truncated: false };
				start = index;
			}
			depth += 1;
		} else if (character === "}") {
			if (depth === 0) return { truncated: false };
			depth -= 1;
			if (depth === 0) end = index;
		}
	}

	if (depth > 0 || (start >= 0 && end < start)) return { truncated: true };
	if (objects !== 1 || start < 0 || end < start) return { truncated: false };
	const surrounding = `${value.slice(0, start)}${value.slice(end + 1)}`;
	if (["[", "]", "{", "}"].some((token) => surrounding.includes(token))) {
		return { truncated: false };
	}
	return { candidate: value.slice(start, end + 1), truncated: false };
}

function parseObject(value: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed !== null &&
			typeof parsed === "object" &&
			!Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

export function parseGeneratedJson(value: string): ParsedGeneratedJson {
	const trimmed = value.trim();
	let parsed = parseObject(trimmed);
	let truncated = false;

	if (!parsed) {
		const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
		if (fenced) parsed = parseObject(fenced[1].trim());
	}
	if (!parsed) {
		const extracted = singleTopLevelJsonObject(trimmed);
		truncated = extracted.truncated;
		if (extracted.candidate) parsed = parseObject(extracted.candidate);
	}
	if (!parsed) {
		return {
			answerFieldPresent: false,
			jsonParseSuccess: false,
			reason: truncated ? "truncated-json" : "invalid-json",
			sourceIds: [],
		};
	}

	const answerFieldPresent = Object.hasOwn(parsed, "answer");
	const answer =
		typeof parsed.answer === "string" ? parsed.answer.trim() : undefined;
	const sourceIds = Array.isArray(parsed.source_ids)
		? parsed.source_ids
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
	if (!answer) {
		return {
			answerFieldPresent,
			jsonParseSuccess: true,
			reason: "missing-answer",
			sourceIds,
		};
	}
	return {
		answer,
		answerFieldPresent,
		jsonParseSuccess: true,
		sourceIds,
	};
}

function diagnosticSourceId(value: string): string {
	return value.trim().slice(0, 64) || "<empty>";
}

export function validateGeneratedBrowserAnswer(options: {
	generated: string;
	allowedSources: BrowserRagSource[];
}): LocalAiValidationResult {
	const parsed = parseGeneratedJson(options.generated);
	const allowedByCanonicalId = new Map(
		options.allowedSources.map((source) => [
			source.source_id.trim().toUpperCase(),
			source,
		]),
	);
	const allowedSourceIds = options.allowedSources.map(
		(source) => source.source_id,
	);
	const base = {
		answerFieldPresent: parsed.answerFieldPresent,
		allowedSourceIds,
		jsonParseSuccess: parsed.jsonParseSuccess,
		returnedSourceIds: parsed.sourceIds.map(diagnosticSourceId),
	};
	if (!parsed.jsonParseSuccess || !parsed.answer) {
		return {
			...base,
			accepted: false,
			reason: `validation=${parsed.reason || "invalid-json"}`,
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (/https?:\/\/|www\./i.test(parsed.answer)) {
		return {
			...base,
			accepted: false,
			answer: parsed.answer,
			reason: "validation=answer-contains-url",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (parsed.answer.length > 4_000) {
		return {
			...base,
			accepted: false,
			answer: parsed.answer,
			reason: "validation=answer-too-long",
			rejectedSourceIds: [],
			sources: [],
		};
	}

	const sources: BrowserRagSource[] = [];
	const rejectedSourceIds: string[] = [];
	const seen = new Set<string>();
	for (const returnedId of parsed.sourceIds) {
		const canonicalId = returnedId.trim().toUpperCase();
		const source = allowedByCanonicalId.get(canonicalId);
		if (!source) {
			rejectedSourceIds.push(diagnosticSourceId(returnedId));
			continue;
		}
		if (!seen.has(canonicalId)) {
			seen.add(canonicalId);
			sources.push(source);
		}
	}
	const uniqueRejectedSourceIds = [...new Set(rejectedSourceIds)];
	if (!sources.length) {
		return {
			...base,
			accepted: false,
			answer: parsed.answer,
			reason: uniqueRejectedSourceIds.length
				? `validation=unknown-source-id:${uniqueRejectedSourceIds.join(",")}`
				: "validation=no-valid-source-ids",
			rejectedSourceIds: uniqueRejectedSourceIds,
			sources,
		};
	}
	return {
		...base,
		accepted: true,
		answer: parsed.answer,
		reason: uniqueRejectedSourceIds.length
			? `validation=accepted-filtered-source-ids:${uniqueRejectedSourceIds.join(",")}`
			: "validation=accepted",
		rejectedSourceIds: uniqueRejectedSourceIds,
		sources,
	};
}

export function validateGeneratedPlainTextAnswer(options: {
	generated: string;
	allowedSources: BrowserRagSource[];
	insufficientInformation: string;
}): LocalAiValidationResult {
	const answer = options.generated.trim();
	const sources = uniqueTrustedSources(options.allowedSources);
	const base = {
		answerFieldPresent: true,
		allowedSourceIds: sources.map((source) => source.source_id),
		jsonParseSuccess: true,
		returnedSourceIds: [],
	};
	if (!answer) {
		return {
			...base,
			accepted: false,
			reason: "validation=empty-answer",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (/^```|```$/.test(answer)) {
		return {
			...base,
			accepted: false,
			answer,
			reason: "validation=code-fence-garbage",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (
		(answer.startsWith("{") && answer.endsWith("}")) ||
		(answer.startsWith("[") && answer.endsWith("]")) ||
		/"(?:answer|source_ids)"\s*:/i.test(answer)
	) {
		return {
			...base,
			accepted: false,
			answer,
			reason: "validation=json-garbage",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (/https?:\/\/|www\./i.test(answer)) {
		return {
			...base,
			accepted: false,
			answer,
			reason: "validation=answer-contains-url",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (/\bS\d+\b/i.test(answer)) {
		return {
			...base,
			accepted: false,
			answer,
			reason: "validation=source-id-in-answer",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (answer.length > 4_000) {
		return {
			...base,
			accepted: false,
			answer,
			reason: "validation=answer-too-long",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (answer === options.insufficientInformation) {
		return {
			...base,
			accepted: true,
			answer,
			reason: "validation=accepted",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	if (!sources.length) {
		return {
			...base,
			accepted: false,
			answer,
			reason: "validation=no-valid-source-ids",
			rejectedSourceIds: [],
			sources: [],
		};
	}
	return {
		...base,
		accepted: true,
		answer,
		reason: "validation=accepted",
		rejectedSourceIds: [],
		sources,
	};
}
