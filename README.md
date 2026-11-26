# Genealogy Cache

Genealogy Cache prevents repeated analysis of civil-register, marriage, death, birth, and notarial documents. Before an agent reads a source URL, it asks this API whether a structured extraction already exists. On a cache miss, the caller parses the document and writes the result back. This reduces AI context usage, creates an audit trail, and keeps a link to the original archival source.

## Architecture

The backend is a small AWS serverless service:

`Codex skill or web UI → Lambda Function URL → DynamoDB`

The Lambda Function URL uses IAM authentication. DynamoDB uses on-demand capacity, is encrypted at rest, and stores only structured extraction metadata. Original scans, PDFs, or long OCR text should later be held in S3, with a reference in the DynamoDB record.

## Current API

- `GET /records?url=<source-url>` returns `{ found, record }`.
- `GET /records?limit=50` returns shared cached records.
- `POST /records` writes a parsed record. Required body fields are `url`, `fields`, `parserVersion`, and `status`.

URLs are canonicalised and hashed globally. Therefore, when person A has parsed a source URL, person B gets the same result from the cache instead of initiating another analysis. The shared record must never include private notes or personal credentials.

## Multi-user roadmap

1. Add Amazon Cognito User Pools and an API Gateway JWT authorizer (or validate JWTs in Lambda).
2. Keep the **record cache global by canonical URL**, but add an `AccessLog` DynamoDB table keyed by authenticated `sub` and timestamp.
3. Record who reused a cache entry without exposing who originally parsed it; query this table for each user's history in the UI.
4. Add S3 per-user prefixes only for private originals/notes, while public archival source results remain shared.
5. Add a moderation/status workflow so only validated extractions are returned as shared results.

## Development

The local transcription MCP has moved to [genealogy-transcription-mcp](../genealogy-transcription-mcp/README.md).

### AWS backend

Requires Node.js 24+.

```sh
npm install
npm run build
npm test
```

For an AWS deployment, SAM transpiles the TypeScript Lambda with esbuild:

```sh
sam validate --lint
sam build
sam deploy --guided
```

Run the local HTTP adapter with an in-memory repository:

```sh
./run.sh local
```

Run it in Docker for the host architecture, or explicitly as an arm64 container on Apple Silicon:

```sh
./run.sh docker
./run.sh macos
```

The local adapter is intended for development only; it does not persist records and does not connect to DynamoDB. The deployed Lambda continues to use `src/handler.handler` and DynamoDB.

The test suite enforces 90% line/function/statement coverage and 85% branch coverage. GitHub Actions runs type checking and tests on every push and pull request. Deploy the infrastructure with AWS SAM after configuring AWS credentials: `sam build && sam deploy --guided`.
