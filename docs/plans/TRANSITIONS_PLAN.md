# Transitions Page — Plan (issue #82)

Status: Built 2026-11-04
Issue: #82 — "A Transitions page"
Spec: `docs/requirements/19_TRANSITIONS.md` (REQ-19-TL, -TA, -TM, -TI),
`14_RELATIONSHIPS.md` (REQ-14-RD VC8), `21_DATA_MODEL_LIBRARY_JSON.md` ›
Typed sides and ideas on transitions, `33_TRACK_MAP.md` (REQ-33-LY)
Contract: `docs/plans/TRANSITIONS_BEHAVIOR_CONTRACT.md`

## Tim's ask, and what it decides

The verbatim quote is at the top of
[19_TRANSITIONS.md](../requirements/19_TRANSITIONS.md). Tim asked for a view of
transitions and transition ideas, in a set or not. His hierarchy is transition
→ block → set. His example is the Tate McRae track "Housewife" into the Hannah
Montana track "Best of Both Worlds". He later picked **one store** of three
options. Three decisions follow.

1. **A transition is a relationship of the transition type.** The app gets no
   second entity and no second file. The page is a view over `relationships`,
   plus the pairs the track map already derives.
2. **A side can be a typed track.** It holds `{artist, title}` in place of a
   song id, on the `transition` type only. The user can save the pair before
   both songs exist.
3. **An idea is a mark on a saved transition.** It means the user has not tried
   the transition yet. It stays a transition everywhere else the app draws
   them.

## What already existed

`buildTransitions` (`src/lib/trackMap/transitions.ts`) returns the
`transition` relationships. It also returns the consecutive tracks of blocks
and sets. It deduplicates each direction and keeps each edge's sources and
their notes.

The type list is `library.json` content. `transition` is a fixed id
(`TRANSITION_TYPE_ID`). `src/lib/relationshipTypes.ts` answers its name and its
colour.

`POST /api/relationships` refuses an unknown type with 422. It refuses a
duplicate with 409.

## The model

```json
{
  "id": "uuid",
  "source_song_id": null,
  "source_track": { "artist": "tatemcrae", "title": "housewife" },
  "target_song_id": null,
  "target_track": { "artist": "hannah montana", "title": "best of both worlds" },
  "relationship_type": "transition",
  "idea": true,
  "notes": "fits really well",
  "created_at": "2026-11-04T10:00:00Z"
}
```

The backend checks these rules in `backend/models/relationship.py`.

| Rule | Function |
|---|---|
| One form per end: a song id or a typed track | `validate_sides` |
| A typed side needs a title, and an empty artist becomes `""` | `clean_typed_track` |
| No song sits on both ends | `validate_sides` |
| Typed sides and `idea` belong to `transition` alone | `validate_typed_rules` |
| Two typed sides are one track on artist and title, case ignored | `typed_track_key`, `side_key` |

`side_key` also gives the duplicate rule its reach. A library song is
`song:<id>`. A typed side is `typed:<artist>␀<title>`. The two never match.
That is REQ-19-TM VC13 in one line: the app links nothing by itself.

## The page

`src/pages/Transitions.tsx` answers `/transitions`. The sidebar lists
"Transitions" after Sets.

`src/lib/transitionRows.ts` builds the rows. It is pure, so it tests without a
DOM. It works in four steps.

1. `buildTransitions` gives the library pairs from saved transitions, blocks
   and sets.
2. The saved transitions with a typed side come straight from the rows. That
   function needs two song ids, so it skips them.
3. A row that both make is one row. The saved transition's id and idea mark
   join it there.
4. Rows sort by the first title, then the second, with case ignored.

The page then searches with `searchRows` and filters with `filterRows`. Both
live in the same module, so the rules test without a DOM.

## The API

- `POST /api/relationships` takes `source_track`, `target_track` and `idea`.
- `PATCH /api/relationships/{id}` takes `notes`, `idea`, and `link_side` with
  `song_id`. A link writes the song id in place of the typed track. The app
  refuses a link that makes a self-pair with 422. It refuses a restatement with
  409.
- `GET /api/songs/{id}/transition-suggestions` returns each row with `idea`.

## What every other consumer does with a typed side

| Consumer | Behaviour |
|---|---|
| `buildTransitions` | No edge, because it needs two song ids (REQ-19-TM VC8) |
| `buildModel`, `connections`, `core` | No edge and no partner |
| Relationship graph tab | No node, so no line. The details list shows the typed text. |
| Song page, Relationships dialog | The typed side shows as text with "Not in library" |
| `get_related_songs` | Skips it, because there is no partner track |
| `get_transition_suggestions` | Skips a typed target (VC9) and returns `idea` |
| `_remap_relationship` | Keeps a typed side through an import (VC12) |
| MCP `list_relationships`, `get_transitions` | The typed fields, and `idea` |

## Risks and their handling

- **An import can lose a typed side.** `_remap_relationship` used to drop any
  row with an id it could not remap. It now remaps only the ends that have an
  id. It drops a row only when an end has neither form. An export and import
  round trip is in the verification.
- **The page can double a row.** A saved transition and a block pair can
  describe the same pair. `buildTransitionRows` keys a row on its two sides, so
  they land on one row. The saved transition's actions join it there.
- **A typed title finds nothing in the track picker.** The picker matched
  `title artist album` as one string, so "artist title" found nothing.
  `TrackPicker` gained an optional `initialQuery`. The link action opens it
  with the typed title.
- **A 375 px row can squeeze two long titles.** The row is a two-column grid
  above `sm`. Below it, the second track stacks under the first, so a title
  keeps its width.

## Files

New files:

- `src/pages/Transitions.tsx`
- `src/lib/transitionRows.ts` and `src/lib/transitionRows.test.ts`
- `backend/tests/test_transitions.py`
- this plan and its contract

Changed files:

- `src/App.tsx`, `src/components/layout/DJSidebar.tsx`, `src/lib/storage.ts`
- `src/lib/trackMap/{transitions,buildModel,connections,core}.ts`
- `src/pages/TrackMap.tsx`, `src/pages/SongDetailPage.tsx`
- `src/components/map/TrackDetails.tsx`
- `src/components/dj/{SongRelationshipsDialog,RelationshipGraphTab}.tsx`
- `src/components/sets/{SetEditor,TrackPicker}.tsx`
- `backend/models/relationship.py`, `backend/api/relationships.py`
- `backend/storage/library_store.py`, `backend/services/import_merge.py`
- `backend/tests/test_mcp_server.py`, `mcp_server/tools.py`
- the seven requirement files

## Not in scope

- Putting a transition into a block or a set from this page.
- Mix points, technique, rating and play count (31_TRANSITION_MINING.md).
- A link the app makes by itself.
- A typed side from an agent. `link_tracks` takes library tracks only.
