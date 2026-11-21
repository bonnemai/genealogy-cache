import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GenealogyRecord, newRecord } from "./model.js";
import { dynamoRepository, Repository } from "./repository.js";

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>;

const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({ statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const isFields = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isStatus = (value: unknown): value is GenealogyRecord["status"] => value === "parsed" || value === "needs_review" || value === "failed";
const parseLimit = (value: string | undefined): number => {
  if (value === undefined) return 50;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) throw new Error("limit must be an integer");
  return Math.min(Math.max(parsed, 1), 100);
};
export function makeHandler(repository: Repository): Handler {
  return async event => {
    try {
      if (event.requestContext.http.method === "OPTIONS") return { statusCode: 204, body: "" };
      if (event.requestContext.http.method === "GET" && event.rawPath === "/records") {
        const url = event.queryStringParameters?.url;
        if (url) { const record = await repository.get(url); return json(200, { found: Boolean(record), record: record ?? null }); }
        const limit = parseLimit(event.queryStringParameters?.limit);
        return json(200, { records: await repository.list(limit) });
      }
      if (event.requestContext.http.method === "POST" && event.rawPath === "/records") {
        const body = JSON.parse(event.body ?? "{}") as Partial<Omit<GenealogyRecord, "pk" | "createdAt" | "updatedAt">>;
        if (!body || typeof body !== "object" || !body.url || !body.parserVersion || !isStatus(body.status) || !isFields(body.fields)) return json(400, { error: "url, parserVersion, status and fields are required" });
        const record = newRecord(body as Omit<GenealogyRecord, "pk" | "createdAt" | "updatedAt">); await repository.put(record); return json(201, { record });
      }
      return json(404, { error: "not found" });
    } catch (error) { return json(400, { error: error instanceof Error ? error.message : "invalid request" }); }
  };
}
const tableName = process.env.TABLE_NAME;
export const handler = tableName ? makeHandler(dynamoRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName)) : undefined;
