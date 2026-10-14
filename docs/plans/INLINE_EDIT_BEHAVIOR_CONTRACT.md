---
source: session
tags:
  - plan
  - contract
  - library
status: active
created: 2026-10-13
---
# Behavior contract — inline editing in the library table (issue #3)

Observable behavior of the library table's inline editing, written before the
build so a source-blind validator can judge the running app. Each clause is
Given / When / Then. "Reload" means a full page reload of the browser tab.

Run against a sandbox copy of the library, never the user's real data.

## Every editable value

- **IE-1** Given the library table, when the pointer rests on an Artist, Album, BPM, Key, Genre, Subgenres, Energy, Dance, Social, Lyrics or Notes value, then the value shows that it can be clicked (a fill behind it and a pointer cursor). Title, Cover, Waveform, Time and Crate offer no editing; a click on the title still opens the song page.
- **IE-2** Given any of those values, when it is reached with Tab, then it shows a visible focus ring, and its accessible name names the field, the track and the current value (for example "Genre for Feng Shui: Techno").
- **IE-3** Given any inline change, then it is saved without a dialog or a Save button and is still there after a reload.
- **IE-4** Given an active sort, search or column filter, when a track's value is changed inline so that the track no longer fits the sort, search or filter, then its row stays where it was. The table re-sorts and re-filters only when the search, a filter or the sort is changed next.
- **IE-5** Given the backend stops responding, when a value is changed inline, then a notification says the change wasn't saved, and the table does not go on showing the unsaved value as if it were saved.

## Text values: Artist, Album, BPM

- **IE-6** Given an Artist, Album or BPM value, when it is clicked (or Enter is pressed on it), then a text field replaces it in place with the current value selected. Typing and pressing Enter, or moving focus away, saves the trimmed value. Escape restores the old value. After Enter or Escape, keyboard focus is on the value again.
- **IE-7** Given the Album field, when it is emptied and saved, then the album is cleared and the cell shows "–".
- **IE-8** Given the Artist field, when it is emptied and Enter is pressed, then nothing is saved and a message says a track needs an artist; when focus then leaves the field, the old artist comes back.
- **IE-9** Given the BPM field, when "127,5" or "127.5" is entered, then the BPM becomes 127.5. When it is emptied, then the BPM is cleared ("–"). When something that isn't a number from 40 to 250 is entered and Enter is pressed, then nothing is saved and a message says what is allowed.
- **IE-10** Given a text field whose value was not changed, when it is closed, then no save request is sent.

## Notes (unchanged behavior)

- **IE-11** Given a Notes value, when it is clicked, then the mixing note opens for editing (Shift+Enter starts a new line); Enter or moving focus away saves it, Escape discards the edit, and an emptied note is cleared. While the mixing note is empty, a drum or element note shows as a muted hint ("Drums: …"), and the editor opens empty, never with the hint.

## Pickers: Genre and Key

- **IE-12** Given a Genre value, when it is clicked (or Enter or Space is pressed on it), then a list of the genres from Settings opens, each with its colour, with a search field and the track's current genre checked. Choosing a genre saves it and closes the list. "No genre" clears it. Escape closes the list without a change. Focus returns to the Genre value.
- **IE-13** Given a track with subgenres, when its genre is changed inline, then its subgenres stay.
- **IE-14** Given a Key value, when it is clicked, then a list of the 24 keys opens, each in short notation with its full name ("Am", "A minor"), with a search field and the current key checked. Choosing a key saves it, and a minor key shows in the minor-key colour. "No key" clears it. Typing "am" or "a minor" finds A minor.
- **IE-15** Given a track whose genre or key isn't in the standard list (read from the file's tags), then that value is offered at the top of the list, checked.

## Subgenres

- **IE-16** Given the Subgenres value of a track with a genre, when it is clicked, then a list opens with the track's subgenres first (checked) and the genre's other subgenres after. Choosing an entry adds or removes it at once; the list stays open, and its entries keep their places while it is open. A typed name that isn't in the list is offered as "Create “…”", which adds it to the track and to the genre's subgenres in Settings. For a genre from the file's tags that Settings doesn't list, the entry reads "Add “…” to this track" and adds it to the track only.
- **IE-17** Given a track whose genre was read from the file's tags (shown in the Genre column, never set by hand), then its Subgenres list offers that genre's subgenres, and adding one keeps the genre shown.
- **IE-18** Given a track without a genre, when its Subgenres value is clicked, then the list says to set a genre first, and any subgenres the track already has can still be removed.

## Ratings: Energy, Dance, Social, and Rank

Rank behaves like the three ratings, drawn as five stars, with "Unranked" for 0. The three ratings may hold one decimal from the Edit dialog (issue #7): a stored 3.8 shows 3 filled bars.

- **IE-19** Given an Energy, Dance or Social value (five rising bars), when the mouse moves over the bars, then they preview the value under the pointer; moving away without clicking leaves the value unchanged. When a bar is clicked, then the rating becomes that bar's whole value (1–5). Clicking the bar of the current value (bar 3 when the rating is exactly 3) clears the rating (no bars filled).
- **IE-20** Given a rating with keyboard focus, when Right or Up is pressed, then the rating goes up by one, and Left or Down takes it down by one, within 0–5 (a decimal keeps its decimal: 3.8 becomes 4.8). Home or 0 clears it, End sets 5, and the keys 1–5 set that value. The page and the table do not scroll. A screen reader announces it as a slider with its name ("Energy for Feng Shui") and value ("3 of 5", "3.8 of 5", or "Unrated"; "Unranked" for Rank).
- **IE-21** Given a touch screen, when a rating is tapped, then a picker with "Unrated" and 1 to 5 opens, each target at least 44px; choosing one sets it and closes the picker. Enter or Space on a focused rating opens the same picker.

## Lyrics

- **IE-22** Given a Lyrics value (or "No lyrics"), when it is clicked, then the lyrics editor for that track opens; after saving, the cell shows the start of the new lyrics without a reload.

## Layout and regressions

- **IE-23** Given 1440, 1280, 768 and 375px wide windows in both themes, when any inline editor or picker is open, then the page does not scroll sideways (outside the table's own scroll area), pickers stay inside the window, and opening a picker does not scroll the table under it.
- **IE-24** The tags cell still adds and removes tags (+ and ×); the # column still shows Play and Edit on hover and keyboard focus; the Edit dialog still saves every field.
