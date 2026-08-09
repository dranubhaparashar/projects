import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
	new URL(
		"../src/scripts/project-intelligence/browser-llm-validation.ts",
		import.meta.url,
	),
	"utf8",
);
const compiled = ts.transpileModule(source, {
	compilerOptions: {
		module: ts.ModuleKind.ESNext,
		target: ts.ScriptTarget.ES2022,
	},
}).outputText;
const validationModule = await import(
	`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const { parseGeneratedJson, validateGeneratedBrowserAnswer } = validationModule;

const sources = ["S1", "S2", "S3", "S4"].map((sourceId, index) => ({
	project_id: `project-${index + 1}`,
	project_title: `Project ${index + 1}`,
	section: "Overview",
	source_id: sourceId,
	url: `/projects/${index + 1}`,
}));

assert.deepEqual(
	parseGeneratedJson('{"answer":"Grounded answer","source_ids":["S1"]}'),
	{
		answer: "Grounded answer",
		answerFieldPresent: true,
		jsonParseSuccess: true,
		sourceIds: ["S1"],
	},
);

for (const generated of [
	'```json\n{"answer":"Fenced","source_ids":["S2"]}\n```',
	'Here is the result: {"answer":"Surrounded","source_ids":["S3"]} Thanks.',
]) {
	assert.equal(parseGeneratedJson(generated).jsonParseSuccess, true);
}

assert.equal(
	parseGeneratedJson(
		'{"answer":"First","source_ids":["S1"]} {"answer":"Second","source_ids":["S2"]}',
	).reason,
	"invalid-json",
);
assert.equal(
	parseGeneratedJson('{"answer":"Cut off","source_ids":["S1"]').reason,
	"truncated-json",
);
assert.equal(
	parseGeneratedJson('{"response":"Wrong key","source_ids":["S1"]}').reason,
	"missing-answer",
);

const filtered = validateGeneratedBrowserAnswer({
	allowedSources: sources,
	generated:
		'{"answer":"Keep the grounded citation","source_ids":["S1","S5","S1"]}',
});
assert.equal(filtered.accepted, true);
assert.equal(filtered.reason, "validation=accepted-filtered-source-ids:S5");
assert.deepEqual(
	filtered.sources.map((source) => source.source_id),
	["S1"],
);
assert.deepEqual(filtered.rejectedSourceIds, ["S5"]);

const normalized = validateGeneratedBrowserAnswer({
	allowedSources: sources,
	generated: '{"answer":"Normalized IDs","source_ids":[" s2 ","S2"]}',
});
assert.equal(normalized.accepted, true);
assert.deepEqual(
	normalized.sources.map((source) => source.source_id),
	["S2"],
);

const unknownOnly = validateGeneratedBrowserAnswer({
	allowedSources: sources,
	generated: '{"answer":"Unsupported citation","source_ids":["S5"]}',
});
assert.equal(unknownOnly.accepted, false);
assert.equal(unknownOnly.reason, "validation=unknown-source-id:S5");

const noCitations = validateGeneratedBrowserAnswer({
	allowedSources: sources,
	generated: '{"answer":"No citation","source_ids":[]}',
});
assert.equal(noCitations.accepted, false);
assert.equal(noCitations.reason, "validation=no-valid-source-ids");

const unsafeAnswer = validateGeneratedBrowserAnswer({
	allowedSources: sources,
	generated: '{"answer":"See https://example.com instead","source_ids":["S1"]}',
});
assert.equal(unsafeAnswer.accepted, false);
assert.equal(unsafeAnswer.reason, "validation=answer-contains-url");

console.log(
	JSON.stringify(
		{
			status: "passed",
			cases: 11,
			validatedSourceIds: sources.map((source) => source.source_id),
		},
		null,
		2,
	),
);
