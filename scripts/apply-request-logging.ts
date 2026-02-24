/**
 * One-time script to apply withRequestLogging to all API route handlers.
 * Run: npx tsx scripts/apply-request-logging.ts
 *
 * Converts:
 *   export async function POST(request: NextRequest) { ... }
 * to:
 *   async function postHandler(request: NextRequest) { ... }
 *   export const POST = withRequestLogging(postHandler, "POST /api/...");
 *
 * Also adds the withRequestLogging import if missing.
 */

import * as fs from "fs";
import * as path from "path";

const API_DIR = path.join(process.cwd(), "src", "app", "api");
const ROUTE_FILE = "route.ts";
const WRAPPER_IMPORT =
  'import { withRequestLogging } from "@/lib/api/with-request-logging";';

const METHOD_NAMES = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const HANDLER_NAMES: Record<(typeof METHOD_NAMES)[number], string> = {
  GET: "getHandler",
  POST: "postHandler",
  PUT: "putHandler",
  PATCH: "patchHandler",
  DELETE: "deleteHandler",
};

function findRoutePath(filePath: string): string {
  const relative = path.relative(
    path.join(process.cwd(), "src", "app"),
    filePath,
  );
  const dir = path.dirname(relative);
  return "/" + dir.replace(/\\/g, "/");
}

function findMatchingBrace(content: string, openBraceIndex: number): number {
  let depth = 0;
  for (let i = openBraceIndex; i < content.length; i++) {
    const c = content[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface MethodMatch {
  method: (typeof METHOD_NAMES)[number];
  startIndex: number;
  openBraceIndex: number;
  closeBraceIndex: number;
  params: string;
  returnType: string;
  fullHeader: string;
}

function findMethodMatches(content: string): MethodMatch[] {
  const matches: MethodMatch[] = [];
  for (const method of METHOD_NAMES) {
    const regex = new RegExp(
      `export async function ${method}\\s*\\(([^)]*)\\)\\s*(:\\s*[^{]+)?\\s*\\{`,
      "g",
    );
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      const fullHeader = m[0];
      const openBraceIndex = m.index + fullHeader.length - 1;
      const closeBraceIndex = findMatchingBrace(content, openBraceIndex);
      if (closeBraceIndex === -1) continue;
      matches.push({
        method,
        startIndex: m.index,
        openBraceIndex,
        closeBraceIndex,
        params: m[1]!,
        returnType: m[2] || "",
        fullHeader,
      });
    }
  }
  return matches.sort((a, b) => b.startIndex - a.startIndex);
}

function applyToFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, "utf-8");

  const methodMatches = findMethodMatches(content);
  if (methodMatches.length === 0) return false;

  const routePath = findRoutePath(filePath);

  for (const m of methodMatches) {
    const handlerName = HANDLER_NAMES[m.method];
    const replacement = `async function ${handlerName}(${m.params})${m.returnType} {`;
    content =
      content.slice(0, m.startIndex) +
      replacement +
      content.slice(m.openBraceIndex + 1);

    const exportLine = `\nexport const ${m.method} = withRequestLogging(${handlerName}, "${m.method} ${routePath}");`;
    const insertPos = m.closeBraceIndex + 1;
    content =
      content.slice(0, insertPos) + exportLine + content.slice(insertPos);
  }

  if (!content.includes(WRAPPER_IMPORT)) {
    const lastImportMatch = content.match(/from ["'][^"']+["'];?\s*\n/);
    const insertIndex = lastImportMatch
      ? content.lastIndexOf(lastImportMatch[0]) + lastImportMatch[0].length
      : content.indexOf("\n") + 1;
    content =
      content.slice(0, insertIndex) +
      WRAPPER_IMPORT +
      "\n" +
      content.slice(insertIndex);
  }

  fs.writeFileSync(filePath, content);
  return true;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...walkDir(full));
    } else if (e.name === ROUTE_FILE) {
      results.push(full);
    }
  }
  return results;
}

const routeFiles = walkDir(API_DIR);
let count = 0;
for (const file of routeFiles) {
  try {
    if (applyToFile(file)) {
      console.log("Updated:", path.relative(process.cwd(), file));
      count++;
    }
  } catch (err) {
    console.error("Error processing", file, err);
  }
}
console.log(`Done. Updated ${count} files.`);
