import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("public/project-intelligence");
const chunksPath = resolve(root, "project-chunks.json");
const metadataPath = resolve(root, "project-vector-metadata.json");
const vectorsPath = resolve(root, "project-vectors.bin");

const [chunks, metadata, vectorStats] = await Promise.all([
	readFile(chunksPath, "utf8").then(JSON.parse),
	readFile(metadataPath, "utf8").then(JSON.parse),
	stat(vectorsPath),
]);

const fail = (message) => {
	throw new Error(`Invalid browser RAG assets: ${message}`);
};

if (metadata.model !== "BAAI/bge-small-en-v1.5")
	fail("unexpected source model");
if (metadata.browser_model !== "Xenova/bge-small-en-v1.5") {
	fail("unexpected browser model");
}
if (metadata.dimensions !== 384 || metadata.dtype !== "float32-le") {
	fail("unexpected vector format");
}
if (!metadata.normalized || metadata.pooling !== "cls") {
	fail("embedding normalization or pooling mismatch");
}
if (chunks.chunks.length !== metadata.count) fail("chunk count mismatch");
if (metadata.chunks.length !== metadata.count) fail("position count mismatch");
if (vectorStats.size !== metadata.count * metadata.dimensions * 4) {
	fail("binary vector byte size mismatch");
}
if (chunks.index.content_hash !== metadata.content_hash)
	fail("content hash mismatch");

for (let index = 0; index < metadata.count; index += 1) {
	const chunk = chunks.chunks[index];
	const position = metadata.chunks[index];
	if (position.index !== index || position.chunk_id !== chunk.chunk_id) {
		fail(`chunk order mismatch at row ${index}`);
	}
	if (!String(chunk.url || "").startsWith("/projects/posts/")) {
		fail(`untrusted project URL at row ${index}`);
	}
}

const serialized = JSON.stringify({ chunks, metadata });
for (const forbidden of [
	"PUBLIC_PROJECT_AI_API_URL",
	"PROJECT_AI_OLLAMA_URL",
	"C:\\\\Users\\",
	"/home/",
	"/mnt/",
]) {
	if (serialized.includes(forbidden))
		fail(`private value ${forbidden} is exposed`);
}

console.log(
	`Validated browser RAG assets: ${chunks.index.project_count} projects, ${metadata.count} chunks, ${metadata.dimensions} dimensions, ${vectorStats.size} vector bytes.`,
);
