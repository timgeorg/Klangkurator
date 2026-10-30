# Technical plan — add a song to a set (issue #64)

Spec: `docs/requirements/16_SET_PLANNING.md` REQ-16-AS. Contract:
`ADD_TO_SET_BEHAVIOR_CONTRACT.md`.
Branch: `feature_64_add-to-set`, stacked on `feature_68_smooth-search`.

## Verified facts (2026-10-30, the feature branches)

- `SetEditor` appends with
  `{ id: crypto.randomUUID(), type, ref_id, position: prev.length, transition_notes: "", alternative_transitions: [] }`
  (`src/components/sets/SetEditor.tsx:142-146`), and offers only songs the set does
  not hold yet (`usedSongs`, `:109`; `availableSongs`).
- On save the editor renumbers every item `0..n-1` and trims the transition note,
  leaving it out when empty (`SetEditor.tsx:179-187`).
- `PUT /api/sets/{id}` merges the fields it receives (`model_dump(exclude_unset=True)`,
  `backend/api/sets.py`), and an explicit null clears only the optional fields
  (`_CLEARABLE`, added by the unpushed `4915cce`). Sending `items` therefore leaves
  `name`, `description`, `notes` and `phases` untouched.
- **A stored set can have sparse positions.** `byPosition` sorts by the stored value
  (`src/components/sets/setModel.ts:18-20`). Deleting an item does not renumber until
  the editor's next save, so `position: items.length` can place a new item before the
  real end. This is why the helper renumbers.
- **`phases` is a second place a song can live.** `DJSetBase` carries both `items` and
  `phases` (`backend/models/set.py:33-41`), and the editor says how many phase tracks
  a set has without showing them (`16_SET_PLANNING.md`, "Current Set Editor").
- **Stored items may carry older keys.** `SetItem` takes `ref_id` only, but data from
  older builds has `song_id` / `block_id` (`setModel.ts:23-26`, and the spec's "Items
  resolve by `ref_id`"). Passing such an item back unchanged fails request validation.
- `storage.getSets()` and `storage.updateSet()` are live API calls
  (`src/lib/storage.ts:254-256`; the interface is `:199-201`).
- The `#` column is 52 px (`useColumnConfig.ts:20`) and already holds the row number
  plus two 24 px buttons (`SongTableRow.tsx`), revealed by
  `group-hover/row` and `group-has-[:focus-visible]/row`. Persisted widths are not
  clamped on load (`useColumnConfig.ts:100-133`).
- The song page's action row has five buttons, not four: Play, Edit, Re-analyze,
  Relationships and Show on map (`SongDetailPage.tsx:154-178`).
- `toast` is a single-slot notice (`TOAST_LIMIT = 1`, `src/hooks/use-toast.ts:5`), so
  a success notice replaces whatever was showing.
- `vitest` runs on node (`vite.config.ts:24`); `crypto` is a browser global, so the
  test stubs it.

## Decisions

1. **`addSongToItems` normalises and renumbers.** It returns the exact payload the
   editor would have written. This makes the request valid for legacy items and puts
   the song last in the order the app reads.
2. **Phases stay exactly as they were.** The helper takes and returns `items` only, and
   the request sends `items` only. A phase-only set therefore gets its song at the end
   of the flat running order, which is where the editor appends, and its phases keep
   their own order.
3. **Membership reads `items` and `phases`, through one exported helper** (`setHasSong`),
   so the disabled state and the check mark cannot disagree.
4. **The `#` column widens to 84 px** and a stored narrower width is lifted on load.
   Three 24 px actions plus the number need the room, and the scope list allows it.
5. **The success and error notices use the app's existing `toast`**, whose
   single-slot replacement is accepted (documented in the contract).

## Files

- `src/lib/setItems.ts` — `itemRef`, `setHasSong`, `addSongToItems`.
- `src/lib/setItems.test.ts` — the growth, normalisation, renumber and membership rules.
- `src/components/sets/AddToSetMenu.tsx` — the popover, the list and the row button.
- `src/components/dj/SongTableRow.tsx` — the third action.
- `src/pages/SongDetailPage.tsx` — the button after Relationships.
- `src/hooks/useColumnConfig.ts` — the wider `# column and its load migration.
- `src/lib/00_Index.md`, `src/components/sets/00_Index.md` — the index lines.
- `docs/plans/ADD_TO_SET_PLAN.md`, `ADD_TO_SET_BEHAVIOR_CONTRACT.md`, `00_Index.md`.
- `docs/requirements/13_LIBRARY_VIEW.md`, `16_SET_PLANNING.md`,
  `92_PLANNED_FEATURES.md` (PF-90), `99_CHANGELOG.md`.

## Gotchas

- The trigger sits inside the row, whose own click opens the editor. The button must
  stop propagation, or picking the action also opens the song dialog.
- The trigger is hidden at `opacity-0` while the pointer is on the row, so the
  portaled menu must not depend on the trigger's own visibility; Radix keeps it
  mounted.
- `AddToSetMenu` is a popover inside a `role="row"`. It must portal out, or the table's
  grid would lay it out as a cell; Radix `PopoverContent` already does.
- `getSets()` rejects rather than returning `[]`, so the menu needs a failure state;
  otherwise "No sets yet" would lie.

## Verification

The gates in `AGENTS.md` and the live check at 1440, 1280, 768 and 375 px in both
themes.
