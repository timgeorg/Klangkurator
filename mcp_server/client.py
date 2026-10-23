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
    _require_safe_path(path)
    url = f"{config.api_url()}{path}"
    try:
        with _client() as client:
            response = client.request(method, url, json=json, params=params)
    except httpx2.TimeoutException:
        # Before the unreachable case: a timeout is an HTTPError too, but the
        # app is running, so "start ./run.sh" would be the wrong advice.
        raise ToolError(_timeout_message()) from None
    except _UNREACHABLE:
        raise ToolError(_unreachable_message()) from None

    if response.status_code >= 400:
        raise ToolError(f"{response.status_code}: {_detail(response)}")
    if response.status_code == 204 or not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        raise ToolError(
            f"The answer to {method} {path} is not JSON (HTTP {response.status_code}). "
            f"Does KLANGKURATOR_URL ({config.api_url()}) point at Klangkurator?"
        ) from None


def _require_safe_path(path: str) -> None:
    """Refuse a path that could leave the route it names.

    Tools put ids into paths, so an id such as "../x" or "x#" would reach a
    different route — `DELETE /api/songs/<id>` among them. The tools check
    their ids as well; this guard covers every call, including future ones.

    Args:
        path (str): The API path a tool built.

    Raises:
        ToolError: The path holds a "." or ".." segment, or ? # % or a backslash.
    """
    segments = path.split("/")
    if any(segment in (".", "..") for segment in segments) or any(ch in path for ch in "?#%\\"):
        raise ToolError(f"Refusing the API path {path!r}: an id in it is not a plain id.")


def _client() -> httpx2.Client:
    """An HTTP client for one request; the tests replace this function.

    Returns:
        httpx2.Client: A client with the configured timeout.
    """
    return httpx2.Client(timeout=config.timeout())


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


def _timeout_message() -> str:
    """The message for an app that is up but did not answer in time.

    Returns:
        str: The URL, the limit, and what to do.
    """
    return (
        f"Klangkurator at {config.api_url()} did not answer within {config.timeout():g} s. "
        "It is running but busy, or slow on a large library: try again, or raise "
        "KLANGKURATOR_TIMEOUT."
    )


def _unreachable_message() -> str:
    """The one message an unreachable backend produces (BC-22).

    Returns:
        str: The URL that failed and how to start the app.
    """
    return (
        f"Klangkurator is not reachable at {config.api_url()}. "
        "Start it with ./run.sh in the app folder, then try again."
    )
