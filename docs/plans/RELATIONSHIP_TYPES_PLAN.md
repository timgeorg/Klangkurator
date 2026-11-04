# Relationship Types The User Edits — Plan (issue #81)

Status: Built 2026-11-04
Issue: #81 — "Relationship types become a list the user edits, in directions"
Spec: `docs/requirements/14_RELATIONSHIPS.md` (REQ-14-RT, -RD, -RP, -RM),
`34_MCP_SERVER.md` (REQ-34-RT), INV-26, INV-27, `21_DATA_MODEL_LIBRARY_JSON.md`
› `relationship_types`
Contract: `docs/plans/RELATIONSHIP_TYPES_BEHAVIOR_CONTRACT.md`

## Tim's ask, and what it decides

> *"I need song relationships in directions. "is remix of" is the opposite "is
> original of"". I need these differentiated."*

> *"I want transitions to be like tags and genres to be editable."*

Three decisions follow, and nothing else does:

1. **The type is a row the user owns**, not a constant in three files. It has an
   id, a name, a colour, a both-ways mark and an opposite.
2. **A relationship reads in its direction.** The row keeps `source → target`;
   what changed is that the user can say which side the open track is, and that
   the app refuses a second row stating the same fact from the other side.
3. **The list is library content.** It lives in `library.json` beside the tags
   and the genres, so it joins the backup and survives a cleared browser.

## What was wrong before

Three files each held their own copy of eight types: a backend comment, a
TypeScript union and an MCP tuple. The add form always stored the open song as
the source, so picking "Remix" on the page of the original stored "the original
is a remix of the remix" — the direction was in the data and unreachable in the
UI. Eight fixed line styles drove the graph, the map and both legends, and an
import could bring in a row whose type the library had never seen.

## The data model

```json
"relationship_types": [
  { "id": "remix", "name": "is remix of", "color": "#6B5BD6",
    "both_ways": false, "opposite_id": "original" },
  { "id": "original", "name": "is original of", "color": "#6B5BD6",
    "both_ways": false, "opposite_id": "remix" }
]
```

- A relationship row stores the type's **id**. A rename rewrites no row.
- `transition` is a fixed id: the Transitions page, the set editor and the map
  find transitions by it (INV-26). The user may rename and recolour it; it stays
  one-way, without an opposite, and cannot be deleted.
- `opposite_id` is mutual, the pair shares one colour, and `both_ways: true`
  excludes an opposite.
- `color: null` draws in the foreground, as transitions always have.

## The migration

`LibraryStore._migrate_relationship_types` runs on the first read and is
idempotent.

1. A library without the key gets the six defaults.
2. Each other value a row uses gets a type whose id is that value, whose name is
   the old label (`cover` → "Cover") and whose colour is the old line colour,
   else the palette's fallback. A value with no label takes the value as its
   name.
3. A type enters the list only if a row uses it.
4. Once the key exists nothing changes, so a second read writes nothing.

The defaults reuse the old ids `remix`, `same_sample` and `transition`, so no
relationship row is rewritten. `original`, `works_as_mashup` and `same_vibe` are
new ids. The old `mashup` meant "A is a mashup containing B"; the new "works as
mashup" pairs two tracks, so the update does not merge them.

## The rules the API holds

| Action | Rule |
|---|---|
| add a type | a name is required; names are unique, case ignored |
| rename | the id stays, so every relationship shows the new name at once |
| recolour | the pair takes one colour |
| name an opposite | mutually linked; an old opposite of the other type is cleared; a both-ways type cannot be one |
| mark both ways | clears the pair on both types |
| delete | with an opposite: rows move to it with source and target swapped. Without one: its rows go too. The transition type is refused |
| add a relationship | an unknown type is 422 (INV-27). A restatement is 409: same pair and type the same way, the opposite type the other way, or a both-ways type either way |

## The reading rule

| Side | Type with an opposite | Both-ways | One-way, no opposite |
|---|---|---|---|
| source | the type's name | the type's name | the type's name + `→` |
| target | the opposite's name | the type's name | the type's name + `←` |

The arrow carries the direction only where the phrase cannot, so it never
contradicts the name.

## The frontend

`src/lib/relationshipTypes.ts` loads the list once beside the settings, the
genres and the crates, caches it, and notifies subscribers. It answers the name,
the reading on a given track, the colour, whether a type is the transition type,
and the legend entries — one per type, and one per opposite pair.

`src/lib/relationshipStyle.ts` derives the line from the type: its colour, solid
if one-way, dotted if both-ways, `transition` the heaviest. The fixed styles and
the TypeScript union are deleted, not deprecated.

`RELATIONSHIP_STYLES` and the union had five call sites (the dialog, the graph
tab, the rail's Layers section, `layerEdges` and the canvas). Each now resolves
through the list, so a type the user invents draws without a code change.

## The MCP surface

`list_relationship_types` is the one addition, a read tool: id, name, both-ways
mark and opposite. `link_tracks` resolves a name or an id, case ignored, and a
name wins, so a type the user named after another type's id stays reachable. A
miss names every type. `list_relationships` carries each row's `type_name`.

The counts in `34_MCP_SERVER.md` were stale since #11 (24 in the file, 25 in the
code); they now read 26 tools and 11 read tools.

## Files in scope

Backend: `models/relationship.py`, `storage/library_store.py`,
`api/relationships.py`, `api/misc.py`, `services/import_merge.py`, and the tests.
Frontend: `lib/relationshipTypes.ts` (new), `lib/relationshipStyle.ts`,
`lib/storage.ts`, `api.ts` (the `PATCH` helper the dialog's settings page needs),
`lib/settings.ts` (the boot read), the dialog, the graph tab, `RelationLine`,
`SongDetailPage`, `Settings`, `LayersSection`, `layerEdges`, `buildModel`,
`transitions`, `TrackMap`, `TrackMapCanvas`. MCP: `mcp_server/tools.py` and its
tests.

`src/lib/api.ts` is the one file added to the issue's list: the Settings page
edits a type with `PATCH /api/relationship-types/{id}`, and the shared client
had no `patch`. It is four lines beside `put`.

## Deferred

- A new type made inline from the dialog's picker. Types are made in Settings.
- Reordering the types.
- Tracks outside the library, ideas and the Transitions page — issue #82.
- The old `in_playlist` type is not auto-managed and never was; no code writes
  it. A library that used it keeps it as an ordinary type.

## Decisions taken at build time

1. **An empty type list is seeded, not trusted.** The transition type cannot be
   deleted, so a list without it can only come from a hand edit or a reset.
   Healing it on the next read costs one write and keeps INV-26 true, the way
   the crate pass heals its registry.
2. **A both-ways type cannot take an opposite**, and naming a both-ways type as
   an opposite is refused (422) rather than silently clearing the mark. The
   spec's VC1 says "a one-way type can name another one-way type"; refusing is
   the honest reading.
3. **The delete confirmation states the outcome, not only the count.** A type
   with an opposite loses no relationship, and saying "1 relationship now reads
   as is original of, with the two tracks swapped" is what the user needs to
   decide.
4. **A row's type id is remapped by name on import**, and a row whose type the
   envelope does not carry is dropped rather than stored with an unknown type
   (INV-27).

## Risks and how they are handled

| Risk | Handling |
|---|---|
| A rename breaks transitions | transitions are found by the fixed id, and the API refuses a change to its shape |
| A pair drifts to two colours or one-sided links | the pair is written in one place, `_link_pair`, and the store's validator refuses a broken list |
| The migration rewrites rows | it appends a type and never touches a row; proved on a copy of the 1,907-song library |
| An import leaves a dangling type id | the mapping is built from names first, and a row with no mapping is dropped |
| The legend doubles for a pair | `relationshipLegend` merges an opposite pair into one entry |
