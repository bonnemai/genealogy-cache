import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { makeHandler } from "./handler.js";
import { recordKey, type GenealogyRecord } from "./model.js";
import type { Repository } from "./repository.js";

function localRepository(): Repository {
  const records = new Map<string, GenealogyRecord>();
  return {
    async get(url) { return records.get(recordKey(url)); },
    async put(record) { records.set(record.pk, record); },
    async list(limit) { return [...records.values()].slice(0, limit); }
  };
}

async function requestBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : null;
}

const handler = makeHandler(localRepository());
const port = Number(process.env.PORT ?? 3000);

export const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const queryStringParameters = Object.fromEntries(requestUrl.searchParams.entries());
    const result = await handler({
      requestContext: { http: { method: request.method ?? "GET" } },
      rawPath: requestUrl.pathname,
      queryStringParameters,
      body: await requestBody(request)
    } as never);
    response.statusCode = result.statusCode ?? 500;
    for (const [name, value] of Object.entries(result.headers ?? {})) response.setHeader(name, value);
    response.end(result.body ?? "");
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "internal server error" }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Genealogy Cache listening on http://localhost:${port}`);
});
