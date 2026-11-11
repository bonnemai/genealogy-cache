import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { GenealogyRecord, recordKey } from "./model.js";

export type Repository = { get(url: string): Promise<GenealogyRecord | undefined>; put(record: GenealogyRecord): Promise<void>; list(limit: number): Promise<GenealogyRecord[]> };
export function dynamoRepository(client: DynamoDBDocumentClient, tableName: string): Repository {
  return {
    async get(url) { return (await client.send(new GetCommand({ TableName: tableName, Key: { pk: recordKey(url) } }))).Item as GenealogyRecord | undefined; },
    async put(record) { await client.send(new PutCommand({ TableName: tableName, Item: record })); },
    async list(limit) { return ((await client.send(new ScanCommand({ TableName: tableName, Limit: limit }))).Items ?? []) as GenealogyRecord[]; }
  };
}
