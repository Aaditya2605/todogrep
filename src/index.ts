#!/usr/bin/env node
import { Command } from "commander";
import { scanCommand } from "./commands/scan.js";

const program = new Command();

program
  .name("todogrep")
  .description("Find, track, and manage code TODOs. Git-blame aware, stale detection, priority sorting.")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan codebase for TODOs, FIXMEs, HACKs, and other markers")
  .option("-p, --path <path>", "Project root", process.cwd())
  .option("--stale <days>", "Days threshold for stale TODOs", "90")
  .option("--json", "Output as JSON")
  .option("-t, --tag <tag>", "Filter by tag (TODO, FIXME, HACK, BUG, etc.)")
  .option("-a, --author <name>", "Filter by git blame author")
  .option("--stale-only", "Show only stale TODOs")
  .option("-n, --limit <n>", "Max items to show", "30")
  .action(scanCommand);

// Default = scan
program.action(() => {
  scanCommand({ path: process.cwd(), stale: "90", limit: "30" });
});

program.parse();
