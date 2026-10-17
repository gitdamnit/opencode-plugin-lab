// Worker: create one snapshot in a shared fixture project.
// Usage: node gts-snapshotter.mjs <projectRoot> <marker> <index>
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { snapshot } from "/opt/lab/plugins/git-that-shit/dist/engine/snapshot.js";

const [, , projectRoot, marker, indexStr] = process.argv;
const index = Number(indexStr || 0);

// Change a tracked file so the snapshot has content to commit.
writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "concurrent-fixture", version: `1.0.${index}` }, null, 2));

const result = await snapshot({ projectRoot, reason: `concurrent ${marker}`, type: "manual", trigger: "concurrency-test" });
console.log(JSON.stringify({ marker, committed: result.committed, hash: result.shortHash ?? null }));
