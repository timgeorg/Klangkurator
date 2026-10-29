"""`python -m mcp_server`: the MCP server over stdio (REQ-34-CT).

Startup does no I/O, so a client can connect and list the tools even with the
app stopped.
"""

from mcp_server.tools import server


def main() -> None:
    """Run the server on the stdio transport its client opened."""
    server.run("stdio")


if __name__ == "__main__":
    main()
