"""Settings and genres endpoints (issue #51).

Preferences live in `~/.klangkurator/settings.json` so they travel with the
library folder and survive clearing browser data; genres are library content and
live in `library.json`, which puts them in the backup.
"""

import logging

from fastapi import APIRouter, HTTPException

from backend.storage import get_library_store, get_settings_store
from backend.storage.settings_store import SettingsError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings():
    """The whole preferences document, or `{}` when nothing was saved yet.

    Returns:
        dict: The stored preferences.
    """
    return get_settings_store().get_all()


@router.put("/settings")
def put_settings(body: dict):
    """Shallow-merge a partial preferences document.

    Args:
        body (dict): The keys to change.

    Returns:
        dict: The document after the merge.

    Raises:
        HTTPException: 422 for an unknown key or a wrong type; nothing is
            written then.
    """
    try:
        return get_settings_store().put(body)
    except SettingsError as exc:
        raise HTTPException(422, str(exc))


@router.get("/genres")
def get_genres():
    """The genre list, each `{name, color, subgenres}`.

    Returns:
        list[dict]: The stored genres.
    """
    return get_library_store().get_genres()


@router.put("/genres")
def put_genres(body: list[dict]):
    """Replace the genre list.

    Args:
        body (list[dict]): The new list.

    Returns:
        list[dict]: The stored list.

    Raises:
        HTTPException: 422 for a malformed genre or a duplicate name.
    """
    try:
        return get_library_store().set_genres(body)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
