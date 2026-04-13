export type TodoTag = "TODO" | "FIXME" | "HACK" | "XXX" | "NOTE" | "BUG" | "OPTIMIZE" | "REVIEW";

export interface TodoItem {
  tag: TodoTag;
  text: string;
  file: string;
  line: number;
  author: string;
  authorDate: string;
  ageDays: number;
  isStale: boolean; // older than threshold
  priority: "low" | "medium" | "high" | "critical";
  context: string; // surrounding lines
}

export interface TodoReport {
  scannedAt: string;
  projectRoot: string;
  totalFiles: number;
  totalTodos: number;
  staleCount: number;
  byTag: Record<string, number>;
  byAuthor: Record<string, number>;
  byFile: Record<string, number>;
  byPriority: Record<string, number>;
  items: TodoItem[];
  stalestTodos: TodoItem[];
}
