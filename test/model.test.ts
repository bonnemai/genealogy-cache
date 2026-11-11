import { describe, expect, it } from "vitest";
import { newRecord, normaliseUrl, recordKey } from "../src/model.js";

describe("record identity", () => {
  it("normalises URL tracking values and fragments", () => expect(normaliseUrl("https://EXAMPLE.org/a?utm_source=x&id=4#scan")).toBe("https://example.org/a?id=4"));
  it("sorts query parameters for stable identity", () => expect(normaliseUrl("https://example.org/a?z=2&a=1")).toBe(normaliseUrl("https://example.org/a?a=1&z=2")));
  it("uses the same key for a canonical source", () => expect(recordKey("https://example.org/a#scan")).toEqual(recordKey("https://example.org/a")));
  it("creates auditable records", () => expect(newRecord({ url: "https://example.org/a", fields: {}, parserVersion: "v1", status: "parsed" }, "2026-11-10T00:00:00.000Z")).toMatchObject({ createdAt: "2026-11-10T00:00:00.000Z" }));
});
