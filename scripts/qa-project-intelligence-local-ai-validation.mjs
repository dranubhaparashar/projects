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
const uiSource = await readFile(
	new URL("../src/scripts/project-intelligence.ts", import.meta.url),
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
const {
	parseGeneratedJson,
	validateGeneratedBrowserAnswer,
	validateGeneratedPlainTextAnswer,
} = validationModule;

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

const insufficientInformation =
	"The published portfolio does not provide enough information to confirm that.";
const plain = validateGeneratedPlainTextAnswer({
	allowedSources: sources.slice(0, 4),
	generated: "This is a concise grounded portfolio synthesis.",
	insufficientInformation,
});
assert.equal(plain.accepted, true);
assert.deepEqual(
	plain.sources.map((source) => source.source_id),
	["S1", "S2", "S3", "S4"],
);

for (const generated of ["", "   "]) {
	const empty = validateGeneratedPlainTextAnswer({
		allowedSources: sources,
		generated,
		insufficientInformation,
	});
	assert.equal(empty.accepted, false);
	assert.equal(empty.reason, "validation=empty-answer");
}

const plainUrl = validateGeneratedPlainTextAnswer({
	allowedSources: sources,
	generated: "Read https://example.com for details.",
	insufficientInformation,
});
assert.equal(plainUrl.accepted, false);
assert.equal(plainUrl.reason, "validation=answer-contains-url");

const plainInsufficient = validateGeneratedPlainTextAnswer({
	allowedSources: sources,
	generated: insufficientInformation,
	insufficientInformation,
});
assert.equal(plainInsufficient.accepted, true);
assert.deepEqual(plainInsufficient.sources, []);

const earlyEos = validateGeneratedPlainTextAnswer({
	allowedSources: sources,
	generated: Array.from({ length: 32 }, () => "grounded").join(" "),
	insufficientInformation,
});
assert.equal(earlyEos.accepted, true);

const suppliedOnly = validateGeneratedPlainTextAnswer({
	allowedSources: [sources[1]],
	generated: "This synthesis uses the supplied evidence.",
	insufficientInformation,
});
assert.deepEqual(
	suppliedOnly.sources.map((source) => source.source_id),
	["S2"],
);

const duplicateSources = validateGeneratedPlainTextAnswer({
	allowedSources: [sources[0], { ...sources[0] }],
	generated: "This synthesis uses one deduplicated source.",
	insufficientInformation,
});
assert.deepEqual(
	duplicateSources.sources.map((source) => source.source_id),
	["S1"],
);

const sourceIdInAnswer = validateGeneratedPlainTextAnswer({
	allowedSources: sources,
	generated: "This answer cites S5.",
	insufficientInformation,
});
assert.equal(sourceIdInAnswer.accepted, false);
assert.equal(sourceIdInAnswer.reason, "validation=source-id-in-answer");

const jsonGarbage = validateGeneratedPlainTextAnswer({
	allowedSources: sources,
	generated: '{"answer":"not plain text"}',
	insufficientInformation,
});
assert.equal(jsonGarbage.accepted, false);
assert.equal(jsonGarbage.reason, "validation=json-garbage");

const codeFenceGarbage = validateGeneratedPlainTextAnswer({
	allowedSources: sources,
	generated: "```text\nA fenced answer\n```",
	insufficientInformation,
});
assert.equal(codeFenceGarbage.accepted, false);
assert.equal(codeFenceGarbage.reason, "validation=code-fence-garbage");

assert.match(
	uiSource,
	/The local model did not return a grounded explanation\. The grounded portfolio answer remains above\./,
);
assert.match(uiSource, /Local AI explanation/);
assert.match(uiSource, /Evidence used/);

console.log(
	JSON.stringify(
		{
			status: "passed",
			cases: 22,
			validatedSourceIds: sources.map((source) => source.source_id),
		},
		null,
		2,
	),
);
