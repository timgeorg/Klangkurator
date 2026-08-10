# AI-Assisted Curation

Status: Planned (Post-MVP, long-term roadmap)
Last Updated: 2026-08-09
Source: User refinement 2026-08-09; set planning session 2026-08-08

## Principle

**AI augments curation, it doesn't replace it.** AI skills propose options;
the DJ always decides. All AI runs locally — no cloud APIs, no audio sent
to external services.

## AI Skills

### 1. AI Set Planning (PF-50)

The flagship AI skill. Replicates and scales the Sterling session workflow:

**Input:**
- Target duration (e.g. 120 min)
- Crates to draw from (e.g. Melodic Techno, Deep House, Afro House)
- Event context (e.g. "sunset set, friends, outdoor")
- Optional: vibe keywords ("tearjerker ending", "peak at 1h mark")

**Output:**
- Full set plan with phases, track assignments, transition notes
- Energy curve visualization
- Flags (artist clustering, genre ping-pong — same checks as the manual
  set planning feature)

**Implementation:**
- Local LLM (Ollama / llama-cpp-python) with a structured prompt
- The LLM receives: track pool (filtered to selected crates), each track's
  notes/tags/BPM/energy/vibe, and the phase structure
- The LLM proposes a set plan as structured JSON
- The DJ reviews, adjusts, and confirms
- The LLM does NOT pick tracks the DJ doesn't have — it only works with
  the actual library

### 2. AI Transition Suggestions (PF-51)

Given Track A in a set, AI suggests Track B for the next position:
- Uses musical features (BPM, key, energy) + transition history
- LLM prompt: "Track A is [notes]. Suggest 3 tracks from this pool that
  would transition well, with a one-sentence reason each."
- The DJ picks one (or none) and writes the transition notes

### 3. AI Micro-Structure Suggestions (PF-53)

Within a phase, AI proposes the ordering of tracks:
- "You have 7 tracks in the Building phase. Suggested order: B, D, F, A, C, E, G
  because..."
- Uses energy curve, genre flow, and artist clustering avoidance
- The DJ can accept, modify, or ignore

This directly encodes the micro-structure feedback from the planning session
(where Sterling suggested reordering Phase 2 into deep block → Afro block).

### 4. Spectral Clustering (PF-52)

Cluster tracks by audio similarity, not just metadata:
- Extract audio features (MFCC, tempo, spectral centroid, chroma) using
  `librosa` or `essentia`
- Cluster using standard algorithms (k-means, DBSCAN, or hierarchical)
- Surface as "smart crates" — tracks that sound similar even if they're
  in different folders or genres
- Use case: "I didn't know this Deep House track sounds like my Afro House
  tracks — I can use it as a bridge"

### 5. AI Vibe Analysis (PF-54)

AI reads the DJ's notes on a track and suggests:
- `phase_tags`: "Based on your notes ('atmospheric, soft drums, long intro'),
  this fits Opening and Building phases"
- `vibe_tags`: "Suggested vibes: atmospheric, warm, uplifting"

This speeds up the annotation process — the DJ writes free-text notes and
the AI proposes structured tags.

### 6. Energy Arc Optimization (PF-55)

Given a partially built set with gaps in the energy curve:
- "Your energy dips at position 12 — you need a track with energy 4 here"
- Suggests tracks from the pool that fill the gap

## Local AI Stack

| Component | Technology | Notes |
|---|---|---|
| LLM inference | Ollama or llama-cpp-python | Consistent with Smartimize's approach |
| Audio feature extraction | `librosa` or `essentia` | For spectral clustering |
| Embedding (notes similarity) | Local sentence embeddings | For finding tracks with similar vibe descriptions |
| Vector store | In-memory or simple file | No need for Chroma — the dataset is small |

All processing is local. No audio, notes, or track data leaves the machine.
This is consistent with P9 and OOS-9.