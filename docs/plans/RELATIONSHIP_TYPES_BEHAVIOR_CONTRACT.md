# Relationship Types — Behaviour Contract (issue #81)

Judged **black-box** against a copy of the library, through the running app,
never against Tim's real data folder.

The sandbox copy holds 1,907 songs and 2 relationships, both `remix`. Numbers
below are that copy's.

---

## RT-1 — The first start lists six types

**Given** a `library.json` with no `relationship_types` key.
**When** the app starts.
**Then** Settings shows "is remix of", "is original of", "same sample", "works
as mashup", "transition" and "same vibe", in that order.
**And** "is remix of" and "is original of" each name the other as its opposite.
**And** they share one colour.

## RT-2 — The migration keeps both relationships

**Given** the same library, whose 2 relationships are both `remix`.
**When** the app starts.
**Then** the library still holds 2 relationships.
**And** each keeps its id, its source, its target, its notes and its
`created_at`.
**And** each keeps `relationship_type: "remix"`.
**And** no relationship row was rewritten.

## RT-3 — A second start writes nothing

**Given** a library the first start has already updated.
**When** the app restarts.
**Then** `library.json` is byte-identical to what it held before.
**And** its modification time does not move.

## RT-4 — An old type gets a type of its own, only where a row uses it

**Given** a library whose rows use `cover` and `bootleg`, and no others.
**When** the app starts.
**Then** the list holds a type with the id `cover` named "Cover", and one with
the id `bootleg` named "Bootleg".
**And** it holds no type for `edit`, `mashup` or `in_playlist`.

## RT-5 — A relationship reads in its direction

**Given** the relationship `A is remix of B`.
**When** the user opens A's song page.
**Then** the row reads "is remix of".
**When** the user opens B's song page.
**Then** the row reads "is original of".
**And** neither page shows an arrow on that row.

## RT-6 — A both-ways type reads the same on both tracks

**Given** a relationship of `same vibe` between A and B.
**When** the user opens either song page.
**Then** the row reads "same vibe".
**And** neither row shows an arrow.

## RT-7 — A one-way type without an opposite keeps the direction

**Given** a relationship of `transition` from A to B.
**When** the user opens A's song page.
**Then** the row reads "transition" and points at B.
**When** the user opens B's song page.
**Then** the row reads "transition" and points back at A.

## RT-8 — The picker lists every type in Settings order

**Given** the dialog's add form, opened on a track with an available partner.
**When** the user opens the Type picker.
**Then** it lists all six types.
**And** the order matches Settings.
**And** each entry carries the line its type draws.

## RT-9 — The user states the fact from either side

**Given** the add form on B, with "is original of" chosen and A as the track.
**When** the user picks "the one the type is about" and adds it.
**Then** the library holds one row, `A is remix of B`.
**And** A's page reads "is remix of" and B's reads "is original of".
**And** adding "is remix of" on A for B afterwards is refused with "This
relationship exists".

## RT-10 — One fact, one row

**Given** `A is remix of B`.
**When** the user adds `B is original of A`.
**Then** the app refuses it and says the relationship exists.
**And** the library still holds one row.
**Given** `A same vibe B`.
**When** the user adds `B same vibe A`.
**Then** the app refuses it too.

## RT-11 — A rename shows everywhere at once

**Given** two relationships of "same vibe".
**When** the user renames the type to "same feeling" in Settings.
**Then** Settings shows the new name.
**And** both song pages and the dialog show it without a reload.
**And** no relationship row changed in `library.json`.

## RT-12 — A pair is one line and one legend entry

**Given** a library with a `remix` and an `original` relationship on the map.
**When** the user opens the map's Layers section.
**Then** the legend lists "is remix of / is original of" once.
**And** the two rows draw in one colour.
**When** the user recolours "is remix of" in Settings.
**Then** "is original of" shows the new colour too.

## RT-13 — The transition type keeps its shape

**Given** the Settings page.
**Then** the transition row has no delete action.
**And** its editor offers a name and a colour.
**When** a client sends `DELETE /api/relationship-types/transition`.
**Then** the API refuses it (422).
**And** the type is still there.
**When** the user renames it.
**Then** the map's Transitions layer still draws its edges, and in its colour.

## RT-14 — Deleting a type with an opposite keeps its relationships

**Given** `A is remix of B`, with notes.
**When** the user deletes "is remix of" and confirms.
**Then** the confirmation says the relationship now reads as "is original of",
with the two tracks swapped.
**And** the library holds one row, `B is original of A`.
**And** it keeps its notes and its id.

## RT-15 — Deleting a type without an opposite takes its rows

**Given** `A same vibe B`.
**When** the user deletes "same vibe" and confirms.
**Then** the confirmation states that one relationship is deleted with it.
**And** the library holds no relationship.

## RT-16 — The list survives a restart and a cleared browser

**Given** a recoloured type and a renamed one.
**When** the app restarts, and separately when the browser's site data is
cleared.
**Then** Settings shows the same names, colours, marks and opposites.

## RT-17 — The backup carries the list

**When** the user exports the library.
**Then** the file holds `relationship_types` beside `tags` and `genres`.
**When** the user imports it into a library without that type.
**Then** the type is added, with the imported colour.
**And** a relationship it brings keeps the **name** of its type, even though the
two libraries gave it different ids.

## RT-18 — An agent sees the same list

**When** an MCP client calls `list_relationship_types`.
**Then** it gets one entry per type, with id, name, both-ways mark and opposite.
**When** it calls `link_tracks` with `"is remix of"`, `"Remix"` or `"remix"`.
**Then** each links the `remix` type.
**When** it calls `link_tracks` with a name that is not in the list.
**Then** the error names every type in the list.
**And** the server lists 26 tools, 11 of them read tools.

## RT-19 — Every screen holds at 375 px in both themes

**Given** the app at 1440, 1280, 768 and 375 px, in ink and in paper.
**When** the user opens Settings, a song page with a relationship, the
Relationships dialog (list and graph) and the map.
**Then** no view scrolls sideways.
**And** every relationship name is readable in full.
