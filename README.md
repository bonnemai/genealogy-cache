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

### Local manuscript transcription (Apple Silicon)

The optional Python worker and stdio MCP server keep manuscript images and raw
transcriptions on your Mac. The AWS Lambda API remains unchanged. Every result
is marked `needs_review`; historical handwriting can be misread even by vision models.

```sh
ollama pull qwen3.5:9b
# Start Ollama if it is not already running: ollama serve
python3 -m venv .venv
.venv/bin/pip install -r requirements-local.txt
mkdir -p ~/Genealogy/manuscrits
# Save the original archival JPG/PNG/WebP into that folder, then:
.venv/bin/python local_transcription.py list
.venv/bin/python local_transcription.py transcribe mariage_1782.jpg
.venv/bin/python local_transcription.py get mariage_1782.jpg
```

The cache in `~/Genealogy/transcriptions/` is keyed by image SHA-256, model,
prompt version and context setting, so a second request for the same image
does not call Ollama. The default context is 8192; images must be at most 20 MiB.
Use `GENEALOGY_DIR` to change the root or `GENEALOGY_MODEL` to select another
installed vision model. Keep the data folder outside the Git repository.

For a local MCP-compatible client, configure a stdio server (replace the absolute paths):

```json
{
  "mcpServers": {
    "genealogy-local": {
      "command": "/Users/you/genealogy-cache/.venv/bin/python",
      "args": ["/Users/you/genealogy-cache/local_mcp.py"]
    }
  }
}
```

Tools: `list_manuscripts`, `transcribe_manuscript`, `get_transcription`, and
`prepare_cache_record`. The last tool prepares the existing `POST /records`
payload from a local result and an exact archival source URL. It does not
publish anything. A local agent should check the existing AWS cache first,
then use Ollama on a miss, validate the text and extract structured fields
before submitting the record with the existing IAM-authenticated API.
Never share private scans or notes in the global cache. A source URL must
identify the specific image or act, not just an entire register.

This is a local stdio integration for a client running on the Mac; hosted
ChatGPT cannot directly see that folder or connect to its localhost. For use
in hosted ChatGPT, attach the resulting text manually or use the existing
authenticated cache after review. Images are not uploaded by this worker.
Run the Python tests without Ollama or MCP dependencies:

```sh
python3 -m unittest discover -s test -p 'test_local_*.py'
```

### AWS backend

Requires Node.js 22+.

```sh
npm install
npm run build
npm test
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
