import { readFile } from "node:fs/promises";
import { env, pipeline } from "@huggingface/transformers";

const fixturePath = process.argv[2];
if (!fixturePath) {
	throw new Error(
		"Usage: node scripts/verify-browser-embedding-parity.mjs <fixture.json>",
	);
}
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
if (
	fixture.model !== "BAAI/bge-small-en-v1.5" ||
	fixture.browser_model !== "Xenova/bge-small-en-v1.5"
) {
	throw new Error("Unexpected parity fixture model");
}

env.allowLocalModels = false;
const extractor = await pipeline("feature-extraction", fixture.browser_model, {
	// The Node build names its ONNX CPU provider "cpu"; the browser build uses
	// "wasm" with the same fp32 model, tokenizer, pooling and normalization.
	device: "cpu",
	dtype: "fp32",
});

const similarities = [];
for (const sample of fixture.sentences) {
	const output = await extractor(`${fixture.query_instruction}${sample.text}`, {
		pooling: "cls",
		normalize: true,
	});
	const browser = Float32Array.from(output.data);
	if (browser.length !== sample.vector.length)
		throw new Error("Dimension mismatch");
	let similarity = 0;
	for (let index = 0; index < browser.length; index += 1) {
		similarity += browser[index] * sample.vector[index];
	}
	similarities.push(similarity);
	console.log(`${similarity.toFixed(8)}  ${sample.text}`);
}

const minimum = Math.min(...similarities);
const mean =
	similarities.reduce((sum, value) => sum + value, 0) / similarities.length;
if (minimum < 0.995 || mean < 0.998) {
	throw new Error(
		`Cross-runtime BGE agreement is too low (min=${minimum}, mean=${mean})`,
	);
}
console.log(
	`BGE parity passed: min=${minimum.toFixed(8)}, mean=${mean.toFixed(8)}`,
);
