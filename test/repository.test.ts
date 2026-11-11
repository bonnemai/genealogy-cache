import { describe, expect, it, vi } from "vitest";
import { dynamoRepository } from "../src/repository.js";
describe("Dynamo repository", () => {
  it("maps get, put and list operations", async () => {
    const send = vi.fn().mockResolvedValueOnce({ Item: { pk: "one" } }).mockResolvedValueOnce({}).mockResolvedValueOnce({ Items: [{ pk: "two" }] });
    const repository = dynamoRepository({ send } as any, "records");
    await expect(repository.get("https://example.org/a")).resolves.toEqual({ pk: "one" });
    await repository.put({ pk: "two", url: "https://example.org/b", fields: {}, parserVersion: "v1", status: "parsed", createdAt: "", updatedAt: "" });
    await expect(repository.list(5)).resolves.toEqual([{ pk: "two" }]);
    expect(send).toHaveBeenCalledTimes(3);
  });
  it("maps empty DynamoDB responses to empty values", async () => {
    const repository = dynamoRepository({ send: vi.fn().mockResolvedValue({}) } as any, "records");
    await expect(repository.get("https://example.org/a")).resolves.toBeUndefined();
    await expect(repository.list(5)).resolves.toEqual([]);
  });
});
