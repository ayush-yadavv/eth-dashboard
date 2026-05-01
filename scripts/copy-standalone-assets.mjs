import { cp, mkdir } from "node:fs/promises";

await mkdir(".next/standalone", { recursive: true });
await cp("public", ".next/standalone/public", {
  force: true,
  recursive: true,
});
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", {
  force: true,
  recursive: true,
});
