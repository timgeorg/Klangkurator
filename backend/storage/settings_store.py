"""Settings store — wraps settings.json (UI preferences, issue #51).

Preferences live apart from library content: dragging a column must not rewrite
a multi-megabyte `library.json` (NFR-2, issue #51).
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

#: The top-level keys `PUT /api/settings` accepts, and the type each must have.
#: `bool` is checked before `int` because `isinstance(True, int)` is true.
SETTINGS_SCHEMA: dict[str, type | tuple[type, ...]] = {
    "columns": dict,
    "map": dict,
    "theme": str,
    "covers": str,
    "playerDock": str,
    "volume": (int, float),
    "crateTabsExpanded": bool,
}

#: The document version. A file from a newer version keeps its own keys.
SETTINGS_VERSION = 1


class SettingsError(ValueError):
    """A settings write that would be invalid; maps to 422 in the API."""


class SettingsStore:
    """Read and write the preferences document.

    Reads are permissive — a key written by a newer version is returned as it
    is, so an older app never destroys it. Writes are strict: an unknown key or
    a wrong type is refused before anything touches the file.
    """

    def __init__(self, base_store):
        self._data = base_store._data
        self._save_fn = base_store._save

    def get_all(self) -> dict:
        """The whole document, or `{}` when nothing has been saved yet.

        Returns:
            dict: The stored preferences.
        """
        return dict(self._data)

    def put(self, patch: Any) -> dict:
        """Shallow-merge a partial document and return the merged result.

        Args:
            patch (Any): The keys to change.

        Returns:
            dict: The document after the merge.

        Raises:
            SettingsError: The patch is not an object, names an unknown key, or
                gives a value the wrong type. Nothing is written then.
        """
        if not isinstance(patch, dict):
            raise SettingsError("The settings body must be a JSON object")
        unknown = sorted(set(patch) - set(SETTINGS_SCHEMA) - {"version"})
        if unknown:
            raise SettingsError(
                f"Unknown setting(s): {', '.join(unknown)}. "
                f"Allowed: {', '.join(sorted(SETTINGS_SCHEMA))}"
            )
        for key, value in patch.items():
            self._require_type(key, value)

        for key, value in patch.items():
            self._data[key] = value
        self._data["version"] = SETTINGS_VERSION
        self._save_fn()
        logger.debug("Settings written: %s", sorted(patch))
        return dict(self._data)

    def _require_type(self, key: str, value: Any) -> None:
        """Refuse a value whose type the schema does not allow.

        Args:
            key (str): The setting name.
            value (Any): Its proposed value.

        Raises:
            SettingsError: The type is wrong.
        """
        if key == "version":
            return
        expected = SETTINGS_SCHEMA[key]
        # bool is a subclass of int, so `volume: true` must not slip through.
        if expected is bool and not isinstance(value, bool):
            raise SettingsError(f"“{key}” must be true or false")
        if isinstance(expected, tuple):
            if isinstance(value, bool) or not isinstance(value, expected):
                raise SettingsError(f"“{key}” must be a number")
            return
        if not isinstance(value, expected):
            raise SettingsError(f"“{key}” has the wrong type ({type(value).__name__})")
