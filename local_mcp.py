"""Local stdio MCP server. Never uploads images or writes to AWS."""
from mcp.server.fastmcp import FastMCP
from local_transcription import Transcriber

server = FastMCP("genealogy-local")
worker = Transcriber()


@server.tool()
def list_manuscripts() -> list[str]:
    """List images already saved inside the local manuscripts folder."""
    return worker.list_manuscripts()


@server.tool()
def transcribe_manuscript(filename: str) -> dict:
    """Transcribe a local manuscript with the configured Ollama or MLX-VLM backend, reusing a cached result when possible."""
    return worker.transcribe(filename)


@server.tool()
def get_transcription(filename: str) -> dict | None:
    """Read a cached transcription without starting a new inference."""
    return worker.get_transcription(filename)


@server.tool()
def prepare_cache_record(filename: str, source_url: str) -> dict:
    """Prepare an unreviewed payload for the existing genealogy-cache API; do not upload it."""
    return worker.record_payload(filename, source_url)


if __name__ == "__main__":
    server.run(transport="stdio")
