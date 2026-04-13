import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { glob } from "glob";
import type { TodoItem, TodoTag } from "./types.js";

const TAG_PATTERN = /\/\/\s*(TODO|FIXME|HACK|XXX|NOTE|BUG|OPTIMIZE|REVIEW)[\s:]+(.+)/i;
const HASH_TAG_PATTERN = /#\s*(TODO|FIXME|HACK|XXX|NOTE|BUG|OPTIMIZE|REVIEW)[\s:]+(.+)/i;
const BLOCK_TAG_PATTERN = /\*\s*(TODO|FIXME|HACK|XXX|NOTE|BUG|OPTIMIZE|REVIEW)[\s:]+(.+)/i;

const TAG_PRIORITY: Record<string, TodoItem["priority"]> = {
  TODO: "medium",
  FIXME: "high",
  HACK: "high",
  XXX: "high",
  NOTE: "low",
  BUG: "critical",
  OPTIMIZE: "medium",
  REVIEW: "medium",
};

const SOURCE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java", ".kt", ".scala",
  ".c", ".cpp", ".h", ".hpp", ".cs",
  ".swift", ".m", ".mm",
  ".sh", ".bash", ".zsh",
  ".vue", ".svelte", ".astro",
  ".css", ".scss", ".less",
];

const IGNORE_DIRS = [
  "node_modules", ".next", "dist", "build", ".git", "__pycache__",
  "vendor", "target", ".output", "coverage", ".cache",
];

export async function scanTodos(projectRoot: string, staleThresholdDays: number): Promise<TodoItem[]> {
  const pattern = `**/*{${SOURCE_EXTENSIONS.join(",")}}`;
  const files = await glob(pattern, {
    cwd: projectRoot,
    ignore: IGNORE_DIRS.map((d) => `**/${d}/**`),
  });

  const items: TodoItem[] = [];

  for (const file of files) {
    const fullPath = path.join(projectRoot, file);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(TAG_PATTERN) || line.match(HASH_TAG_PATTERN) || line.match(BLOCK_TAG_PATTERN);
      if (!match) continue;

      const tag = match[1].toUpperCase() as TodoTag;
      const text = match[2].trim();

      // Get context (1 line before, 1 after)
      const contextLines = [];
      if (i > 0) contextLines.push(lines[i - 1]);
      contextLines.push(lines[i]);
      if (i < lines.length - 1) contextLines.push(lines[i + 1]);
      const context = contextLines.map((l) => l.trimEnd()).join("\n");

      // Get git blame info
      const { author, date } = getBlameInfo(projectRoot, file, i + 1);
      const ageDays = date
        ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
        : 0;

      items.push({
        tag,
        text,
        file,
        line: i + 1,
        author,
        authorDate: date,
        ageDays,
        isStale: ageDays > staleThresholdDays,
        priority: TAG_PRIORITY[tag] || "medium",
        context,
      });
    }
  }

  return items.sort((a, b) => {
    // Sort: critical first, then by age (oldest first)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.ageDays - a.ageDays;
  });
}

function getBlameInfo(projectRoot: string, file: string, line: number): { author: string; date: string } {
  try {
    const output = execSync(
      `git blame -L ${line},${line} --porcelain -- "${file}" 2>/dev/null`,
      { cwd: projectRoot, encoding: "utf-8" }
    );
    const authorMatch = output.match(/^author (.+)$/m);
    const dateMatch = output.match(/^author-time (\d+)$/m);
    const author = authorMatch?.[1] || "Unknown";
    const timestamp = dateMatch?.[1] ? parseInt(dateMatch[1], 10) * 1000 : 0;
    const date = timestamp ? new Date(timestamp).toISOString() : "";
    return { author, date };
  } catch {
    return { author: "Unknown", date: "" };
  }
}
