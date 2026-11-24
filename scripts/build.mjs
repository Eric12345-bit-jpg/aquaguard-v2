import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "public");
await mkdir(output, { recursive: true });
await mkdir(join(output, "lib"), { recursive: true });
await cp(join(root, "index.html"), join(output, "index.html"));
await cp(join(root, "src"), join(output, "src"), { recursive: true, force: true });
await cp(join(root, "lib", "i18n.mjs"), join(output, "lib", "i18n.mjs"), { force: true });
console.log("AquaGuard static output ready in public/");
