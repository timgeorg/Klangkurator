# Behavior contract — the BPM metrical level (issue #66)

Written **before** implementation. The spec is `docs/requirements/11_SONG_MODEL.md`
for `bpm_fit`, and `21_DATA_MODEL_LIBRARY_JSON.md`. Run it against the sandbox copy of
the real library, with the backend on its own port.

## The two groups this contract separates

A rule that only moved the first group would be easy. This contract exists because
the second group must not move.

**Must change** (stored → truth):

| Track | Detected | Truth |
|---|---|---|
| Bitch Don't Kill My Vibe (Darren After Edit) | 86.1 | 129.2 |
| Love The Right Way | 89.1 | 129.2 |
| Luke Dean & Omar + — Make Believe | 89.1 | 129.2 |
| Gnarls Barkley — Crazy (WeDamnz VIP Edit) | 63.0 | 129.2 |
| Rihanna — Pon De Replay (Qash Extended Remix) | 63.0 | 129.2 |

**Must not change:**

| Track | Detected | Why |
|---|---|---|
| Kids – Stranger Things Vol. 1 | 60.1 | a genuinely slow intro |
| Pon De Replay (techno remix) | 136.0 | already right |
| Crazy In Love (feat. JAY-Z) | 99.4 | already right |

## Clauses (given / when / then)

### BC-1 — the detector corrects the five wrong readings
**Given** any of the five tracks above **when** the detector runs with no hint **then**
it reports a BPM within 2 of 129.2.

### BC-2 — a slow track stays slow
**Given** the 60.1 BPM intro **when** the detector runs with no hint **then** it
reports a BPM within 2 of 60.1. The naive "bias with a 120–145 prior" approach fails
this clause. It returns 129.2 **and** `bpm_fit=True`, so nothing flags the error.

### BC-3 — an already-correct reading does not move
**Given** a track whose detected BPM is already right **when** the detector runs
again **then** it reports a value within 1 of the earlier one.

### BC-4 — the review pass shows candidates and writes nothing
**Given** a suspect track **when** the user opens the review pass **then** the pass
shows the stored, doubled and one-and-a-half values. It shows the window each one
falls into, and it writes nothing until the user checks a track.

### BC-5 — bulk review where the candidates agree
**Given** suspects where all three candidates agree **when** the user selects them
together **then** one action applies them. Each write is a normal song update.

### BC-6 — a doubtful value is visible in the table
**Given** a stored BPM the detector could not place in the expected window **then** the
row carries a quiet marker. The marker's accessible name says what it means.

### BC-7 — the background job never overwrites a human value
**Given** a track with a BPM **when** the library-wide job runs **then** that value is
untouched (INV-13). The job only fills a missing BPM.

### BC-8 — a track the detector cannot place stores its honest value
**Given** a signal the detector cannot place in the expected window **then** the stored
value is the honest detection and `bpm_fit` is False.

### BC-9 — the hand-checked set is the regression set
**Given** the five tracks a human corrected by hand **when** the detector runs with no
hint **then** it returns 129.2 for all five. A change that breaks this clause cannot
ship.

## Known limits (recorded, and left to another ticket)

- The drum & bass, UK garage and trance crates need their own window. The issue puts
  that out of scope. A window per crate is a decision for another ticket.
- Rekordbox keeps its own tempo for a track that it analysed. The export writes the
  app's value.
