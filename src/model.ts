import { createHash } from "node:crypto";

export type Person = { firstName?: string; lastName: string; role: string };
export type RecordStatus = "parsed" | "needs_review" | "failed";
export type GenealogyRecord = {
  pk: string; url: string; source?: string; documentType?: string; actDate?: string; place?: string;
  people?: Person[]; fields: Record<string, unknown>; extractedText?: string; confidence?: number;
  parserVersion: string; status: RecordStatus; createdAt: string; updatedAt: string;
};

export function normaliseUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}

export function recordKey(url: string): string {
  return createHash("sha256").update(normaliseUrl(url)).digest("hex");
}

export function newRecord(input: Omit<GenealogyRecord, "pk" | "createdAt" | "updatedAt">, now = new Date().toISOString()): GenealogyRecord {
  return { ...input, url: normaliseUrl(input.url), pk: recordKey(input.url), createdAt: now, updatedAt: now };
}
