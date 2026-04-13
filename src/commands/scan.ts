import chalk from "chalk";
import { scanTodos } from "../scanner.js";
import type { TodoItem, TodoReport } from "../types.js";

const TAG_COLORS: Record<string, (s: string) => string> = {
  TODO: chalk.cyan,
  FIXME: chalk.red,
  HACK: chalk.yellow,
  XXX: chalk.magenta,
  NOTE: chalk.gray,
  BUG: chalk.bgRed.white,
  OPTIMIZE: chalk.blue,
  REVIEW: chalk.green,
};

const PRIORITY_COLORS: Record<string, (s: string) => string> = {
  critical: chalk.bgRed.white,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.gray,
};

export async function scanCommand(opts: {
  path: string;
  stale: string;
  json?: boolean;
  tag?: string;
  author?: string;
  staleOnly?: boolean;
  limit: string;
}) {
  const projectRoot = opts.path;
  const staleThreshold = parseInt(opts.stale, 10);
  const limit = parseInt(opts.limit, 10);

  console.log(chalk.bold("\n🔍 Scanning for TODOs...\n"));

  let items = await scanTodos(projectRoot, staleThreshold);

  // Filters
  if (opts.tag) {
    items = items.filter((i) => i.tag === opts.tag!.toUpperCase());
  }
  if (opts.author) {
    const a = opts.author.toLowerCase();
    items = items.filter((i) => i.author.toLowerCase().includes(a));
  }
  if (opts.staleOnly) {
    items = items.filter((i) => i.isStale);
  }

  if (items.length === 0) {
    console.log(chalk.green("  No TODOs found! Clean codebase.\n"));
    return;
  }

  // Build report
  const byTag: Record<string, number> = {};
  const byAuthor: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let staleCount = 0;

  for (const item of items) {
    byTag[item.tag] = (byTag[item.tag] || 0) + 1;
    byAuthor[item.author] = (byAuthor[item.author] || 0) + 1;
    byFile[item.file] = (byFile[item.file] || 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    if (item.isStale) staleCount++;
  }

  if (opts.json) {
    const report: TodoReport = {
      scannedAt: new Date().toISOString(),
      projectRoot,
      totalFiles: Object.keys(byFile).length,
      totalTodos: items.length,
      staleCount,
      byTag, byAuthor, byFile, byPriority,
      items: items.slice(0, limit),
      stalestTodos: [...items].sort((a, b) => b.ageDays - a.ageDays).slice(0, 10),
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Summary
  console.log(chalk.bold("📊 Summary\n"));
  console.log(`  Total: ${chalk.cyan(items.length.toString())} TODOs across ${Object.keys(byFile).length} files`);
  console.log(`  Stale (>${staleThreshold} days): ${staleCount > 0 ? chalk.red(staleCount.toString()) : chalk.green("0")}`);
  console.log();

  // By tag
  console.log(chalk.bold("  By tag:"));
  for (const [tag, count] of Object.entries(byTag).sort((a, b) => b[1] - a[1])) {
    const colorFn = TAG_COLORS[tag] || chalk.gray;
    const bar = "█".repeat(Math.min(30, Math.round((count / items.length) * 30)));
    console.log(`    ${colorFn(tag.padEnd(10))} ${bar} ${count}`);
  }

  // By priority
  console.log(chalk.bold("\n  By priority:"));
  for (const p of ["critical", "high", "medium", "low"]) {
    const count = byPriority[p] || 0;
    if (count === 0) continue;
    const colorFn = PRIORITY_COLORS[p] || chalk.gray;
    console.log(`    ${colorFn(p.padEnd(10))} ${count}`);
  }

  // Top authors
  const topAuthors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topAuthors.length > 0) {
    console.log(chalk.bold("\n  Top authors:"));
    for (const [author, count] of topAuthors) {
      console.log(`    ${chalk.gray(author.padEnd(25))} ${count} TODOs`);
    }
  }

  // Items list
  console.log(chalk.bold(`\n📝 Items (showing ${Math.min(limit, items.length)} of ${items.length}):\n`));

  for (const item of items.slice(0, limit)) {
    const tagColor = TAG_COLORS[item.tag] || chalk.gray;
    const staleMarker = item.isStale ? chalk.red(" [STALE]") : "";
    const age = item.ageDays > 0 ? chalk.gray(` (${item.ageDays}d ago)`) : "";

    console.log(`  ${tagColor(item.tag.padEnd(8))} ${chalk.bold(item.text.slice(0, 80))}${staleMarker}`);
    console.log(`  ${chalk.gray(`         ${item.file}:${item.line}`)} by ${chalk.gray(item.author)}${age}`);
    console.log();
  }

  // Stale TODO warning
  if (staleCount > 0) {
    console.log(chalk.red.bold(`\n⚠ ${staleCount} stale TODOs (older than ${staleThreshold} days)`));
    const stalest = [...items].filter((i) => i.isStale).sort((a, b) => b.ageDays - a.ageDays).slice(0, 3);
    for (const s of stalest) {
      console.log(chalk.red(`  • ${s.file}:${s.line} — "${s.text.slice(0, 60)}" (${s.ageDays} days old)`));
    }
    console.log();
  }
}
