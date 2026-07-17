import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const loopsDir = join(root, "static", "audio", "loops");
const supported = /\.(wav|mp3|ogg|m4a|aac|flac|opus)$/i;
const files = readdirSync(loopsDir)
  .filter((name) => supported.test(name))
  .sort((left, right) => left.localeCompare(right));

writeFileSync(join(loopsDir, "manifest.json"), `${JSON.stringify(files, null, 2)}\n`);
console.log(`Indexed ${files.length} loop sounds`);
