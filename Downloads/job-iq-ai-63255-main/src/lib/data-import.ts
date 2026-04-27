import * as XLSX from "xlsx";

export type ImportedRow = Record<string, unknown>;

export const SUPPORTED_IMPORT_EXTENSIONS = ".csv,.tsv,.txt,.json,.jsonl,.xlsx,.xls";
export const SUPPORTED_IMPORT_LABEL = "CSV, Excel, JSON, JSONL ou TXT";

const FIELD_ALIASES: Record<string, string[]> = {
  prompt: [
    "prompt",
    "input",
    "question",
    "text",
    "instruction",
    "query",
    "request",
    "message",
    "content",
    "contenu",
    "texte",
  ],
  response: [
    "response",
    "output",
    "answer",
    "completion",
    "reply",
    "result",
    "target",
    "expected",
    "reponse",
    "réponse",
  ],
  response_a: [
    "response_a",
    "output_a",
    "answer_a",
    "completion_a",
    "candidate_a",
    "chosen",
    "preferred",
    "winner",
    "option_a",
    "reponse_a",
    "réponse_a",
  ],
  response_b: [
    "response_b",
    "output_b",
    "answer_b",
    "completion_b",
    "candidate_b",
    "rejected",
    "dispreferred",
    "loser",
    "option_b",
    "reponse_b",
    "réponse_b",
  ],
  conversation: ["conversation", "messages", "dialogue", "turns", "chat", "history"],
};

const DELIMITER_CANDIDATES = [",", ";", "\t", "|"] as const;

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s./\\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
  }

  return value;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeRow(row: Record<string, unknown>): ImportedRow {
  return Object.fromEntries(
    Object.entries(row)
      .map(([key, value]) => [normalizeHeader(key), normalizeValue(value)])
      .filter(([key]) => typeof key === "string" && key.length > 0)
  );
}

function toText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) || typeof value === "object") {
    const serialized = JSON.stringify(value);
    return serialized === "{}" || serialized === "[]" ? undefined : serialized;
  }
  return undefined;
}

function getMeaningfulEntries(row: ImportedRow): Array<[string, unknown]> {
  return Object.entries(row).filter(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    if (["id", "idx", "index", "row", "row_number", "line", "ligne"].includes(normalizedKey)) {
      return false;
    }
    return hasMeaningfulValue(value);
  });
}

function getPositionalFallback(row: ImportedRow, field: string): unknown {
  const entries = getMeaningfulEntries(row);

  switch (field) {
    case "prompt":
      return entries[0]?.[1];
    case "response":
    case "response_a":
      return entries[1]?.[1];
    case "response_b":
      return entries[2]?.[1];
    case "conversation":
      return entries.find(([, value]) => Array.isArray(value))?.[1];
    default:
      return undefined;
  }
}

export function resolveFieldValue(row: ImportedRow, field: string): unknown {
  const aliases = FIELD_ALIASES[field] || [field];

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const value = row[normalizedAlias] ?? row[alias];
    if (hasMeaningfulValue(value)) return value;
  }

  const fallback = getPositionalFallback(row, field);
  return hasMeaningfulValue(fallback) ? fallback : undefined;
}

export function resolveTextField(row: ImportedRow, field: string): string | undefined {
  return toText(resolveFieldValue(row, field));
}

function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) count += 1;
  }

  return count;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.filter((line) => line.trim()).slice(0, 5);
  let bestDelimiter = ",";
  let bestScore = -1;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const score = sample.reduce((sum, line) => sum + countDelimiter(line, delimiter), 0);
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  }

  return bestDelimiter;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseDelimitedText(text: string): ImportedRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines);
  const rawHeaders = parseDelimitedLine(lines[0], delimiter);
  const headers = rawHeaders.map((header, index) => normalizeHeader(header) || `column_${index + 1}`);

  return lines
    .slice(1)
    .map((line) => {
      const values = parseDelimitedLine(line, delimiter);
      return normalizeRow(
        Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
      );
    })
    .filter((row) => getMeaningfulEntries(row).length > 0);
}

function normalizeJsonEntry(entry: unknown): ImportedRow {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    return normalizeRow(entry as Record<string, unknown>);
  }

  return { prompt: toText(entry) ?? "" };
}

function parsePlainText(text: string): ImportedRow[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ prompt: line }));
}

async function parseSpreadsheet(file: File): Promise<ImportedRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];

  const worksheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  return rows.map(normalizeRow).filter((row) => getMeaningfulEntries(row).length > 0);
}

export async function parseStructuredDataFile(file: File): Promise<ImportedRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  if (["xlsx", "xls"].includes(extension)) {
    return parseSpreadsheet(file);
  }

  const text = await file.text();

  if (extension === "jsonl") {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => normalizeJsonEntry(JSON.parse(line)));
  }

  if (extension === "json") {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(normalizeJsonEntry);
    return [normalizeJsonEntry(parsed)];
  }

  if (["csv", "tsv"].includes(extension) || file.type.includes("csv") || file.type.includes("tab-separated")) {
    return parseDelimitedText(text);
  }

  if (extension === "txt") {
    const nonEmptyLines = text.split(/\r?\n/).filter((line) => line.trim());
    const firstLine = nonEmptyLines[0] || "";
    const looksDelimited = DELIMITER_CANDIDATES.some((delimiter) => countDelimiter(firstLine, delimiter) > 0);
    return looksDelimited ? parseDelimitedText(text) : parsePlainText(text);
  }

  throw new Error(`Format non supporté. Utilisez ${SUPPORTED_IMPORT_LABEL}.`);
}