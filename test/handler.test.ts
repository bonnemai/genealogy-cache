import { describe, expect, it, vi } from "vitest";
import { makeHandler } from "../src/handler.js";
import type { Repository } from "../src/repository.js";

const repository: Repository = { get: vi.fn(), put: vi.fn(), list: vi.fn() };
const event = (method: string, rawPath: string, extra = {}) => ({ requestContext: { http: { method } }, rawPath, headers: {}, queryStringParameters: {}, body: null, ...extra }) as any;
const invoke = (input: any) => makeHandler(repository)(input, {} as any, (() => {}) as any) as Promise<any>;
describe("API", () => {
  it("returns a cache miss by URL", async () => { vi.mocked(repository.get).mockResolvedValueOnce(undefined); const response = await invoke(event("GET", "/records", { queryStringParameters: { url: "https://example.org/a" } })); expect(response.statusCode).toBe(200); expect(JSON.parse(response.body).found).toBe(false); expect(repository.get).toHaveBeenCalledWith("https://example.org/a"); });
  it("lists records and bounds the requested size", async () => { vi.mocked(repository.list).mockResolvedValueOnce([]); const response = await invoke(event("GET", "/records", { queryStringParameters: { limit: "1000" } })); expect(response.statusCode).toBe(200); expect(repository.list).toHaveBeenCalledWith(100); });
  it("uses the default list size and rejects malformed sizes", async () => {
    vi.mocked(repository.list).mockResolvedValueOnce([]);
    expect((await invoke(event("GET", "/records"))).statusCode).toBe(200);
    expect(repository.list).toHaveBeenCalledWith(50);
    expect((await invoke(event("GET", "/records", { queryStringParameters: { limit: "1.5" } }))).statusCode).toBe(400);
  });
  it("stores a valid parsed record", async () => { const response = await invoke(event("POST", "/records", { body: JSON.stringify({ url: "https://example.org/a", fields: {}, parserVersion: "v1", status: "parsed" }) })); expect(response.statusCode).toBe(201); expect(repository.put).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.org/a" })); });
  it("rejects incomplete payloads", async () => expect((await invoke(event("POST", "/records", { body: "{}" }))).statusCode).toBe(400));
  it("rejects invalid JSON and invalid field/status shapes", async () => {
    expect((await invoke(event("POST", "/records", { body: "{" }))).statusCode).toBe(400);
    expect((await invoke(event("POST", "/records", { body: JSON.stringify({ url: "https://example.org/a", fields: [], parserVersion: "v1", status: "parsed" }) }))).statusCode).toBe(400);
    expect((await invoke(event("POST", "/records", { body: JSON.stringify({ url: "https://example.org/a", fields: {}, parserVersion: "v1", status: "unknown" }) }))).statusCode).toBe(400);
  });
  it("handles CORS and unknown routes", async () => { expect((await invoke(event("OPTIONS", "/records"))).statusCode).toBe(204); expect((await invoke(event("DELETE", "/records"))).statusCode).toBe(404); });
  it("returns invalid-request errors", async () => { vi.mocked(repository.get).mockRejectedValueOnce(new Error("invalid URL")); expect((await invoke(event("GET", "/records", { queryStringParameters: { url: "not-a-url" } }))).statusCode).toBe(400); });
});
