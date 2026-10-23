"""The one HTTP path every tool goes through (REQ-34-CT).

Errors are `ToolError`, not bare exceptions: only that reaches the MCP client
verbatim. A bare raise arrives as "Error executing tool <name>" with the cause
dropped, which tells a user nothing.
"""

from typing import Any

import httpx2
from mcp.server.mcpserver.exceptions import ToolError

from mcp_server import config

#: Every transport failure, plus a URL that cannot be parsed at all. The six
#: timeout classes are all `HTTPError`s, so naming the base class closes this
#: set instead of widening it: `UnsupportedProtocol` (a URL pasted without a
#: scheme) and `RemoteProtocolError` (the app mid-restart) used to escape as a
#: bare "Error executing tool" with no advice. `InvalidURL` is not an
#: `HTTPError`, so it is named separately.
_UNREACHABLE = (httpx2.HTTPError, httpx2.InvalidURL)


def call(method: str, path: str, *, json: Any = None, params: dict | None = None) -> Any:
    """Call the app's API and return its JSON body.

    Args:
        method (str): GET, POST, PUT or DELETE.
        path (str): An API path beginning with "/api/".
        json (Any): The request body, when the route takes one.
        params (dict | None): Query parameters.

    Returns:
        Any: The parsed response body, or None for 204.

    Raises:
        ToolError: The backend is unreachable, or it answered 4xx/5xx.
    """
    url = f"{config.api_url()}{path}"
    try:
        with _client() as client:
            response = client.request(method, url, json=json, params=params)
    except _UNREACHABLE:
        raise ToolError(_unreachable_message()) from None

    if response.status_code >= 400:
        raise ToolError(f"{response.status_code}: {_detail(response)}")
    if response.status_code == 204 or not response.content:
        return None
    return response.json()


def _client() -> httpx2.Client:
    """An HTTP client for one request.

    `config.TRANSPORT` is a test seam: the tests point the client at the app's
    TestClient instead of a listening socket. Unset in normal use.

    Returns:
        httpx2.Client: A client with the configured timeout.
    """
    return httpx2.Client(
        timeout=config.timeout(),
        transport=getattr(config, "TRANSPORT", None),
    )


def _detail(response: httpx2.Response) -> str:
    """FastAPI's own `detail` when there is one, else the raw body.

    Args:
        response (httpx2.Response): A failed response.

    Returns:
        str: A message a user can act on.
    """
    try:
        body = response.json()
    except ValueError:
        return response.text or f"HTTP {response.status_code}"
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, str):
            return detail
        if isinstance(detail, list):
            return "; ".join(str(item) for item in detail)
    return str(body)


def _unreachable_message() -> str:
    """The one message an unreachable backend produces (BC-22).

    Returns:
        str: The URL that failed and how to start the app.
    """
    return (
        f"Klangkurator is not reachable at {config.api_url()}. "
        "Start it with ./run.sh in the app folder, then try again."
    )
