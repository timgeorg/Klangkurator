// Track map (issue #8) — the `/map` page (plan phase 3): the whole library on
// one canvas, placed so similar tracks sit near each other, with the map rail
// beside it and the toolbar above it. It fetches the library, builds the
// similarity model, solves the layout headless and hands the positions to the
// cold renderer; nothing is computed on the canvas.
//
// The hook order is the plan's PM-8 order, consumers after their dependencies:
// data state and its load effect, features, connections and transitions, the
// config, the filters and the core, the shown set, the model, the seeds and
// positions, the selection and its URL effect, then the visible edges.
//
// Phase 4a: the inputs, the layers and the collapse states come from
// `useMapConfig` (saved under `klangkurator.map.v1`, validated on read); the
// search and the filters come from the shared `LibraryFilterContext` above the
// routes, so the table and the map narrow the library together (TM-R11), and
// `filterSongs` (extracted from the table) is the one predicate both use. The
// rail carries the Similarity and Filters sections and collapses as a whole and
// per section. The entry points (the Table | Map switch, Open in map,
// Show on map) are phase 7: this route exists for testing.
//
// Phase 4b: the core. `/map?core=<id>` anchors the map on that song and its
// relationship partners, recomputed from the loaded relationships on arrival so
// a reload keeps it, and narrowed alongside the shared filters; the Filters
// section carries it as a removable chip, and removing the chip drops `core`
// from the URL and counts the whole library again (TM-H1, TM-H2). Show its
// relationships on the map makes that track the core, replacing any existing one
// (TM-H3). The re-layout motion is the canvas's, in
// `components/map/TrackMapCanvas.tsx` over `lib/trackMap/positionsAnimation.ts`.
//
// Phase 5: the Layers section switches the three edge layers, and what the
// canvas draws is `visibleEdges` (`lib/trackMap/layerEdges.ts`) — the model's
// edges narrowed by those switches and, for the computed nearest layer, by the
// selection. The layers are deliberately not a dependency of the model, so
// switching one redraws and never re-solves, and no node moves (TM-L4). The
// legend in the rail names the kinds actually on screen (TM-L1, TM-L5).
//
// Phase 6: above the node threshold (`T`) the shown tracks collapse into the
// chosen dimension's clusters (`lib/trackMap/clusters.ts`), the rail's Clusters
// section names the dimension and why, and choosing a cluster — there or on the
// canvas — adds a `ClusterFilter`, matched by the cluster's own `groupKey`, kept
// in the Filters section as a removable chip; removing it re-runs the choice,
// which brings the clusters back (TM-C1–TM-C5). The fallbacks (crate, then the
// artist's first letter) and the last resort (the first `T` by title, with the
// notice) are the cluster module's (TM-C7, TM-C9, TM-C10).
//
// Phase 7: the page is now lazy-loaded from `src/App.tsx` (so its renderer
// leaves the library's first paint), its header carries the Table | Map switch
// (`LibraryViewSwitch`), and `/map?focus=<id>` is reached by the song page's
// Show on map and `/map?core=<id>` by the dialog's Open in map. Below 768 px
// the switch is left out and the notice below stands.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crosshair, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

import { EditSongDialog } from "@/components/dj/EditSongDialog";
import { type FilterOptions, type SongTagsById, filterSongs } from "@/components/dj/libraryTable";
import { EmptyState } from "@/components/layout/EmptyState";
import { LibraryViewSwitch } from "@/components/layout/LibraryViewSwitch";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapControlsRail, SelectedTrackRail } from "@/components/map/rail/MapRail";
import { TrackHoverPopover } from "@/components/map/TrackHoverPopover";
import type { NearestRow, PartnerRow } from "@/components/map/TrackDetails";
import { TrackMapCanvas } from "@/components/map/TrackMapCanvas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { useMapConfig } from "@/hooks/useMapConfig";
import { useLibraryFilters } from "@/lib/LibraryFilterContext";
import { usePlayer } from "@/lib/PlayerContext";
import { getMainGenreColor } from "@/lib/genreData";
import {
  storage,
  type Block,
  type DJSet,
  type Song,
  type SongRelationship,
  type SongTag,
  type Tag,
} from "@/lib/storage";
import { crateOf, isMinorKey } from "@/lib/trackFormat";
import { buildModel } from "@/lib/trackMap/buildModel";
import {
  clusterGroups,
  CLUSTER_DIMENSION_LABELS,
  DEFAULT_NODE_THRESHOLD,
  filterByClusterFilters,
} from "@/lib/trackMap/clusters";
import { buildConnections } from "@/lib/trackMap/connections";
import { coreMemberIds } from "@/lib/trackMap/core";
import { buildFeatures } from "@/lib/trackMap/features";
import { visibleEdges as edgesForLayers } from "@/lib/trackMap/layerEdges";
import { solveLayout } from "@/lib/trackMap/layout";
import { nearest } from "@/lib/trackMap/similarity";
import { buildTransitions } from "@/lib/trackMap/transitions";
import type { ClusterDimension, ClusterFilter, Positions, TrackMapCanvasHandle } from "@/lib/trackMap/types";

/** How long the camera takes to land; the canvas's own 220 ms, plus a frame. */
const ZOOM_SETTLE_MS = 260;

/**
 * Issue #33: what the Focus button does. Tim asked for both the camera move and
 * the re-arrangement, with a switch so the better-feeling one can be found.
 * `"both"` is the default; change this constant to try the others.
 */
export const FOCUS_BEHAVIOUR: "both" | "camera" | "arrange" = "both";
/** How far a focused track's neighbours are pulled towards it (1 would stack them on it). */
const FOCUS_PULL = 0.45;

type MapStatus = "loading" | "ready" | "error";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** The map page: canvas, map rail and toolbar, at the saved inputs. */
export default function TrackMap() {
  const isMobile = useIsMobile();
  const { current, isPlaying, play, toggle } = usePlayer();
  const [searchParams, setSearchParams] = useSearchParams();

  // (1) The library, loaded once and reloaded after an edit saves.
  const [songs, setSongs] = useState<Song[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [songTags, setSongTags] = useState<SongTag[]>([]);
  const [relationships, setRelationships] = useState<SongRelationship[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sets, setSets] = useState<DJSet[]>([]);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const [loadedSongs, loadedTags, loadedSongTags, loadedRelationships, loadedBlocks, loadedSets] = await Promise.all([
        storage.getSongs(),
        storage.getTags(),
        storage.getSongTags(),
        storage.getSongRelationships(),
        storage.getBlocks(),
        storage.getSets(),
      ]);
      if (request !== requestRef.current) return;
      setSongs(loadedSongs);
      setTags(loadedTags);
      setSongTags(loadedSongTags);
      setRelationships(loadedRelationships);
      setBlocks(loadedBlocks);
      setSets(loadedSets);
      setErrorMessage("");
      setStatus("ready");
    } catch (error) {
      if (request !== requestRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : "The library could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // (2) Every song's values for the composite, with the tag join applied.
  const features = useMemo(() => buildFeatures(songs, songTags), [songs, songTags]);
  const featureById = useMemo(() => new Map(features.map((feature) => [feature.id, feature])), [features]);
  const songById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  // (3) Who is connected to whom, and every transition fact the library holds.
  const { connections, transitions } = useMemo(() => {
    const facts = buildTransitions({ relationships, blocks, sets, songs });
    return { connections: buildConnections(relationships, facts), transitions: facts };
  }, [blocks, relationships, sets, songs]);

  // (4) The saved settings: inputs and weights, the layers slice (all on; phase
  // 5 switches them), the collapse states and the rail's own open state, under
  // `klangkurator.map.v1`, validated on read.
  const config = useMapConfig();
  /** TM-R5: every input switched off leaves nothing to compare on. */
  const noInputs = config.enabledCount === 0;

  // (5) The search and filters, shared with the library table for the session
  // (TM-R11), plus the filter options the Filters section offers. `filterSongs`
  // is the table's own predicate, extracted so both views agree.
  const { searchQuery, filters, isFiltering, clearAll } = useLibraryFilters();

  // The core: the track the map is anchored on, from `?core=<id>` on arrival or
  // from Show its relationships on the map. Page state, like the plan's step 5;
  // the URL is the source on arrival and the chip writes it back (TM-H1–TM-H3).
  // It is read from the URL on the first render, so the map solves straight to
  // the core's tracks and nothing animates on load.
  const [coreId, setCoreId] = useState<string | null>(() => searchParams.get("core"));

  // (6) The shown tracks: the library narrowed by the shared search and filters
  // and by the core, then by the chosen cluster filters. Above the node
  // threshold the model below clusters what is left (phase 6); the last resort
  // is the first `T` by title, with the notice (TM-C10).
  const songTagsById = useMemo<SongTagsById>(() => {
    const bySong: Record<string, { id: string }[]> = {};
    for (const link of songTags) (bySong[link.song_id] ??= []).push({ id: link.tag_id });
    return bySong;
  }, [songTags]);

  const filtered = useMemo(
    () => filterSongs(songs, songTagsById, filters, searchQuery),
    [filters, searchQuery, songTagsById, songs],
  );

  // The core narrows that set alongside the shared filters: only the core song
  // and its relationship partners stay, in the filter order (TM-H1, TM-H3). The
  // members are recomputed from the loaded relationships every time, which is
  // what makes a reload keep the core (its id is all the URL carries). A core
  // naming no song in the library narrows nothing, so a bad `?core=` id shows
  // the whole library while the URL effect drops it, instead of flashing an
  // empty map.
  const activeCoreId = coreId && songById.has(coreId) ? coreId : null;

  const coreMembers = useMemo(
    () => (activeCoreId ? coreMemberIds(activeCoreId, relationships) : null),
    [activeCoreId, relationships],
  );

  const narrowed = useMemo(
    () => (coreMembers ? filtered.filter((song) => coreMembers.has(song.id)) : filtered),
    [coreMembers, filtered],
  );

  // (6b) The chosen cluster filters: page state, session-only like the core
  // (REQ-33-PS). Each one keeps exactly the tracks whose `groupKey` for its
  // dimension equals its value, so choosing a cluster reveals its members and
  // no one else; the model below re-runs the choice over what is left, and
  // removing a chip brings the clusters back (TM-C3).
  const [clusterFilters, setClusterFilters] = useState<ClusterFilter[]>([]);

  const clusterNarrowed = useMemo(
    () => filterByClusterFilters(narrowed, features, clusterFilters),
    [clusterFilters, features, narrowed],
  );

  const filterOptions = useMemo<FilterOptions>(() => {
    const mainGenres = new Set<string>();
    const subgenres = new Set<string>();
    const crates = new Set<string>();
    for (const song of songs) {
      if (song.mainGenre) mainGenres.add(song.mainGenre);
      song.subgenres?.forEach((subgenre) => subgenres.add(subgenre));
      if (song.genres) song.genres.forEach((genre) => mainGenres.add(genre));
      else if (song.genre) mainGenres.add(song.genre);
      const crate = crateOf(song);
      if (crate) crates.add(crate);
    }
    return {
      mainGenres: [...mainGenres].sort(collator.compare).map((genre) => ({ label: genre, value: genre, color: getMainGenreColor(genre) })),
      subgenres: [...subgenres].sort(collator.compare).map((name) => ({ label: name, value: name })),
      keys: [...new Set(songs.map((song) => song.musical_key).filter(Boolean) as string[])]
        .sort(collator.compare)
        .map((key) => ({
          label: key,
          value: key,
          color: isMinorKey(key) ? "hsl(var(--info))" : "hsl(var(--foreground))",
        })),
      tags: tags.map((tag) => ({ label: tag.name, value: tag.id, color: tag.color })),
      rootFolders: [...crates].sort(collator.compare).map((crate) => ({ label: crate, value: crate })),
    };
  }, [songs, tags]);

  // (7) The model. Below the node threshold it is the shown tracks; above it the
  // tracks collapse into the chosen dimension's clusters, and the last resort
  // shows the first `T` by title (phase 6, TM-C1–TM-C10). Layers and collapse
  // states are deliberately not dependencies, so switching a layer never
  // re-solves the layout.
  const model = useMemo(
    () =>
      buildModel({
        songs: clusterNarrowed,
        features,
        inputs: config.inputs,
        connections,
        relationships,
        transitions,
      }),
    [clusterNarrowed, config.inputs, connections, features, relationships, transitions],
  );

  /** The dimension, the reason and the clusters with their counts, for the rail (TM-C1). */
  const clusters = useMemo(
    () => ({ groups: clusterGroups(model.nodes), dimension: model.clusterDimension, reason: model.clusterReason ?? null }),
    [model.clusterDimension, model.clusterReason, model.nodes],
  );

  /** The dimension the canvas is really drawing clusters for; the last resort is tracks, not clusters. */
  const clusterDimension = model.lastResort ? null : clusters.dimension;

  // TM-R7: the filters exclude every shown track. The shown set is the filtered
  // library narrowed by the core, so a core whose members the filters all
  // exclude reports the same way — Clear filters brings the core's tracks back.
  // A chosen cluster filter that keeps nothing (a stale chip) reports it too.
  const noMatches = (isFiltering || clusterFilters.length > 0) && clusterNarrowed.length === 0;

  // (8) The seeds the canvas reports back, and the positions the solve effect
  // writes. A re-solve starts from the positions on screen, so the map keeps
  // its shape.
  const seedsRef = useRef<Positions>(new Map());
  const [positions, setPositions] = useState<Positions>(new Map());

  useEffect(() => {
    setPositions(solveLayout(model.nodes, model.links, seedsRef.current));
  }, [model]);

  const handleDisplayedPositions = useCallback((displayed: Positions) => {
    seedsRef.current = displayed;
  }, []);

  // (9) The selection, its `?focus=` effect and the callbacks that read it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusNotice, setFocusNotice] = useState<string | null>(null);
  /** The focus value already applied or written, so neither effect fights the other. */
  const handledFocusRef = useRef<string | null>(null);
  const firstWriteRef = useRef(true);
  const [centreRequest, setCentreRequest] = useState<string | null>(null);
  const canvasRef = useRef<TrackMapCanvasHandle | null>(null);

  const focusParam = searchParams.get("focus");

  // `?focus=<id>` selects and centres that track; an unknown id shows a short
  // notice and selects nothing.
  useEffect(() => {
    if (status !== "ready" || !focusParam) return;
    if (focusParam === handledFocusRef.current) return;
    handledFocusRef.current = focusParam;
    const target = songById.get(focusParam);
    if (target) {
      setSelectedId(target.id);
      setFocusNotice(null);
      setCentreRequest(target.id);
      return;
    }
    setSelectedId(null);
    setFocusNotice(`No track in the library has the id “${focusParam}”.`);
  }, [focusParam, songById, status]);

  // Selecting a track replaces `?focus=` in the URL, so a reload keeps the
  // selection. The first run is skipped: the URL on arrival is the source. An
  // unknown `?focus=` id with nothing selected is left alone, so the notice
  // stays and the URL is not rewritten under it.
  useEffect(() => {
    if (firstWriteRef.current) {
      firstWriteRef.current = false;
      return;
    }
    const currentFocus = searchParams.get("focus");
    if (currentFocus && !selectedId && !songById.has(currentFocus)) return;
    if ((selectedId ?? null) === currentFocus) return;
    const next = new URLSearchParams(searchParams);
    if (selectedId) next.set("focus", selectedId);
    else next.delete("focus");
    handledFocusRef.current = selectedId ?? null;
    setSearchParams(next, { replace: true });
  }, [searchParams, selectedId, setSearchParams, songById]);

  const selectTrack = useCallback((id: string | null, centre = false) => {
    setSelectedId(id);
    setFocusNotice(null);
    if (id && centre) setCentreRequest(id);
  }, []);

  const handleListSelect = useCallback((id: string) => selectTrack(id, true), [selectTrack]);

  // (9a) Choosing a cluster — in the Clusters list or on the canvas — adds a
  // `ClusterFilter` matched by the cluster's own dimension and value, so the map
  // then shows exactly its members. If they are still above the threshold the
  // model re-runs the choice over what is left (TM-C3).
  const clusterNodeById = useMemo(
    () => new Map(model.nodes.filter((node) => node.kind === "cluster").map((node) => [node.id, node])),
    [model.nodes],
  );

  const addClusterFilter = useCallback((dimension: ClusterDimension, value: string) => {
    setSelectedId(null);
    setClusterFilters((prev) =>
      prev.some((filter) => filter.dimension === dimension && filter.value === value)
        ? prev
        : [...prev, { dimension, value }],
    );
  }, []);

  const handleCanvasNodeSelect = useCallback(
    (id: string | null) => {
      const node = id ? clusterNodeById.get(id) : undefined;
      // A cluster node chooses that cluster; a track node (or empty canvas)
      // selects the track, exactly as track mode does.
      if (node && node.clusterDimension !== undefined && node.clusterValue !== undefined) {
        addClusterFilter(node.clusterDimension, node.clusterValue);
        return;
      }
      selectTrack(id);
    },
    [addClusterFilter, clusterNodeById, selectTrack],
  );

  /** Removing a cluster chip runs the choice again, which brings the clusters back (TM-C3). */
  const handleRemoveClusterFilter = useCallback((filter: ClusterFilter) => {
    setClusterFilters((prev) =>
      prev.filter((candidate) => !(candidate.dimension === filter.dimension && candidate.value === filter.value)),
    );
  }, []);

  const handleChooseCluster = useCallback(
    (dimension: ClusterDimension, value: string) => addClusterFilter(dimension, value),
    [addClusterFilter],
  );

  // (9b) The core's URL effect. `?core=<id>` on arrival is the source: the core
  // is that song and its relationship partners, recomputed from the loaded
  // relationships, so a reload keeps it (TM-H1). A changed core writes `core`
  // back, so removing the chip drops it from the URL (TM-H2) and Show its
  // relationships replaces it (TM-H3).
  const coreParam = searchParams.get("core");
  const handledCoreRef = useRef<string | null>(null);
  const firstCoreWriteRef = useRef(true);

  useEffect(() => {
    if (status !== "ready" || !coreParam) return;
    if (coreParam === handledCoreRef.current) return;
    handledCoreRef.current = coreParam;
    if (songById.has(coreParam)) {
      setCoreId(coreParam);
      return;
    }
    // A core that names no song in the library is no core (the map shows the
    // whole library; `activeCoreId` is null for it), and the stale id is dropped
    // from the URL rather than left telling every reload otherwise.
    setCoreId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("core");
    setSearchParams(next, { replace: true });
  }, [coreParam, searchParams, setSearchParams, songById, status]);

  useEffect(() => {
    if (firstCoreWriteRef.current) {
      firstCoreWriteRef.current = false;
      return;
    }
    if ((coreId ?? null) === coreParam) return;
    const next = new URLSearchParams(searchParams);
    if (coreId) next.set("core", coreId);
    else next.delete("core");
    handledCoreRef.current = coreId ?? null;
    setSearchParams(next, { replace: true });
  }, [coreId, coreParam, searchParams, setSearchParams]);

  // Show its relationships on the map: the core becomes that track and its
  // partners, replacing any existing core, and the track is selected and centred
  // so the map reads as its neighbourhood (TM-H3, REQ-33-IN).
  const handleShowRelationships = useCallback(
    (song: Song) => {
      setCoreId(song.id);
      selectTrack(song.id, true);
    },
    [selectTrack],
  );

  /** TM-H2: removing the chip drops the core, and with it `core` from the URL. */
  const handleRemoveCore = useCallback(() => setCoreId(null), []);

  /**
   * The way out of the no-match state: clears the shared search and filters and
   * the chosen cluster filters, so whatever left nothing to show is resolved —
   * the cluster chips are session-only page state, not the shared filters.
   */
  const handleClearFilters = useCallback(() => {
    clearAll();
    setClusterFilters([]);
  }, [clearAll]);

  const handlePlay = useCallback(
    (song: Song) => {
      // A run of one: no previous or next. The playing track pauses and resumes.
      if (current?.id === song.id) toggle();
      else play(song);
    },
    [current?.id, play, toggle],
  );

  // Issue #32: a double-click on a track plays it, a run of one — the same
  // action as the details' Play, so the two can never disagree.
  const handleCanvasDoubleClick = useCallback(
    (id: string) => {
      const song = songById.get(id);
      if (!song) return;
      setSelectedId(song.id);
      setFocusNotice(null);
      handlePlay(song);
    },
    [handlePlay, songById],
  );

  // Issue #35: the node under the pointer, for the instant popover. Held with
  // its screen point; cleared the moment the pointer leaves the node.
  const [hovered, setHovered] = useState<{ id: string; x: number; y: number } | null>(null);
  const canvasBoxRef = useRef<HTMLDivElement | null>(null);
  const handleCanvasHover = useCallback(
    (id: string | null, clientX: number | null, clientY: number | null) => {
      if (!id || clientX === null || clientY === null) {
        setHovered(null);
        return;
      }
      const box = canvasBoxRef.current?.getBoundingClientRect();
      if (!box) {
        setHovered(null);
        return;
      }
      setHovered({ id, x: clientX - box.left, y: clientY - box.top });
    },
    [],
  );

  const [editSong, setEditSong] = useState<Song | null>(null);
  const handleProperties = useCallback((song: Song) => setEditSong(song), []);

  // Esc clears the selection, except while the Edit dialog is open (that Esc
  // belongs to the dialog).
  useEffect(() => {
    if (editSong) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") selectTrack(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editSong, selectTrack]);

  // A wanted centre runs once the track has a position to centre on. It waits
  // two frames, so the canvas's own first fit (which frames the whole map) has
  // run first and left the camera alone; the focused track then really is at
  // the canvas centre, which a click there hits (TM-M3).
  useEffect(() => {
    if (!centreRequest || !positions.has(centreRequest)) return;
    const id = centreRequest;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        canvasRef.current?.centreOn(id);
        setCentreRequest((current) => (current === id ? null : current));
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [centreRequest, positions]);

  // Issue #33: Focus. It centres the camera on the selected track and, by
  // default, re-arranges the map around it: every other node is pulled towards
  // the selected one by its similarity, so the tracks closest to it sit closest
  // to it. `FOCUS_BEHAVIOUR` picks both, the camera alone, or the re-arrangement
  // alone. The re-arrange is a one-off transform of the solved positions (not a
  // change to the model), so it cannot fight the layout: the next real solve
  // replaces it, which is the REQ-33-LO exception this issue names.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusArrangement = useMemo(() => {
    if (!focusedId || FOCUS_BEHAVIOUR === "camera") return null;
    const centre = positions.get(focusedId);
    const feature = featureById.get(focusedId);
    if (!centre || !feature) return null;
    // Similarity to the focused track, over the tracks the map is showing.
    const shownFeatures = model.nodes.flatMap((node) => {
      const entry = node.kind === "track" ? featureById.get(node.id) : undefined;
      return entry ? [entry] : [];
    });
    const strengths = new Map(
      nearest(feature, shownFeatures, { inputs: config.inputs, connections, k: shownFeatures.length }).map((entry) => [
        entry.id,
        entry.s,
      ]),
    );
    const arranged: Positions = new Map();
    for (const [id, spot] of positions) {
      if (id === focusedId) {
        arranged.set(id, { x: 0, y: 0 });
        continue;
      }
      const pull = (strengths.get(id) ?? 0) * FOCUS_PULL;
      arranged.set(id, { x: (spot.x - centre.x) * (1 - pull), y: (spot.y - centre.y) * (1 - pull) });
    }
    return arranged;
  }, [config.inputs, connections, featureById, focusedId, model.nodes, positions]);

  /** The positions the canvas draws: the solve, or the focus arrangement over it. */
  const displayedPositions = focusArrangement ?? positions;

  const handleFocus = useCallback(() => {
    if (!selectedId) return;
    setFocusedId(selectedId);
    setCentreRequest(selectedId);
  }, [selectedId]);

  // Issue #34: arriving from the table with a track playing focuses it, so the
  // map opens on what you are listening to. Only the Table | Map switch passes
  // the flag (`?from=table`); a plain arrival by the sidebar, or Back, does not.
  const arrivedFromTableRef = useRef(false);
  useEffect(() => {
    if (status !== "ready") return;
    if (searchParams.get("from") !== "table") {
      arrivedFromTableRef.current = false;
      return;
    }
    if (arrivedFromTableRef.current) return;
    arrivedFromTableRef.current = true;
    const playing = current;
    if (!playing) return;
    // "On the map" means in the shown set, not merely in the library: a filter,
    // the search or the core can exclude the playing track, and selecting an
    // invisible track would be a silent no-op. Tim, 2026-10-15: a quick toast
    // says so, and playback carries on.
    const shown = model.nodes.some((node) => node.kind === "track" && node.id === playing.id);
    if (!shown) {
      toast({ title: "The playing track is not on the map", description: playing.title });
      return;
    }
    setSelectedId(playing.id);
    setFocusNotice(null);
    setCentreRequest(playing.id);
  }, [current, model.nodes, searchParams, songById, status]);

  // (10) What the renderer may draw. The layers come from `useMapConfig`
  // (defaults on, phase 5 switches them); the filter is pure and tested in
  // `lib/trackMap/layerEdges.ts`. The nearest layer follows the selection, so
  // the map is not a hairball of every link — except on a clustered map, whose
  // nearest edges are the cluster links (phase 6), which no selection can pick
  // and which therefore follow the layer switch alone. This list is what the
  // rail's Layers legend names, and it is no dependency of the model above, so
  // switching a layer redraws and never re-solves (TM-L4). The authored
  // relationships and transitions keep the model's order and its edge objects.
  const clustered = clusterDimension !== null;
  const visibleEdges = useMemo(
    () => edgesForLayers(model.edges, config.layers, selectedId, { clusterLinks: clustered }),
    [clustered, config.layers, model.edges, selectedId],
  );

  // The selected track's rail data (PM-8 keeps these after the model).
  const tagsBySong = useMemo(() => {
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    const bySong = new Map<string, Tag[]>();
    for (const link of songTags) {
      const tag = tagById.get(link.tag_id);
      if (!tag) continue;
      const list = bySong.get(link.song_id);
      if (list) list.push(tag);
      else bySong.set(link.song_id, [tag]);
    }
    return bySong;
  }, [songTags, tags]);

  const selectedSong = selectedId ? songById.get(selectedId) ?? null : null;

  const nearestRows = useMemo<NearestRow[]>(() => {
    const feature = selectedId ? featureById.get(selectedId) : undefined;
    if (!feature) return [];
    // The tracks the map is showing, in node order: in track mode the shown set,
    // in cluster mode none, because a cluster node is not a track.
    const shownFeatures = model.nodes.flatMap((node) => {
      const entry = node.kind === "track" ? featureById.get(node.id) : undefined;
      return entry ? [entry] : [];
    });
    return nearest(feature, shownFeatures, { inputs: config.inputs, connections }).flatMap((entry) => {
      const song = songById.get(entry.id);
      return song ? [{ song, s: entry.s }] : [];
    });
  }, [config.inputs, connections, featureById, model.nodes, selectedId, songById]);

  const partnerRows = useMemo<PartnerRow[]>(() => {
    if (!selectedId) return [];
    const rows: PartnerRow[] = [];
    for (const relationship of relationships) {
      if (relationship.source_song_id === selectedId) {
        const song = songById.get(relationship.target_song_id);
        if (song) {
          rows.push({
            id: relationship.id,
            song,
            type: relationship.relationship_type,
            direction: "source",
            notes: relationship.notes,
          });
        }
      } else if (relationship.target_song_id === selectedId) {
        const song = songById.get(relationship.source_song_id);
        if (song) {
          rows.push({
            id: relationship.id,
            song,
            type: relationship.relationship_type,
            direction: "target",
            notes: relationship.notes,
          });
        }
      }
    }
    return rows;
  }, [relationships, selectedId, songById]);

  // The toolbar reports the canvas's own zoom level as text (TM-M9).
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomTimerRef = useRef<number | null>(null);

  const readZoom = useCallback(() => {
    const level = canvasRef.current?.zoomLevel();
    if (level !== undefined) setZoomLevel(level);
  }, []);

  useEffect(
    () => () => {
      if (zoomTimerRef.current !== null) window.clearTimeout(zoomTimerRef.current);
    },
    [],
  );

  const runZoom = useCallback(
    (action: (handle: TrackMapCanvasHandle) => void) => {
      const handle = canvasRef.current;
      if (!handle) return;
      action(handle);
      readZoom();
      // The camera moves in the canvas's own 220 ms; read again once it lands.
      if (zoomTimerRef.current !== null) window.clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = window.setTimeout(readZoom, ZOOM_SETTLE_MS);
    },
    [readZoom],
  );

  // The canvas frames the map itself on a new solve, so the level shown stays
  // the level on screen; it is read once the fit has landed.
  useEffect(() => {
    const timer = window.setTimeout(readZoom, ZOOM_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [positions, readZoom]);

  // The canvas's accessible name (REQ-33-AX): the whole library is "Map of N
  // tracks"; a clustered map says how many tracks and how many clusters, like
  // "Map of 1,200 tracks in 9 genre clusters" (TM-C1).
  const shownTrackCount = clustered ? clusterNarrowed.length : model.nodes.length;
  const canvasLabel = clusterDimension
    ? `Map of ${shownTrackCount} tracks in ${clusters.groups.length} ${CLUSTER_DIMENSION_LABELS[clusterDimension]} clusters`
    : `Map of ${model.nodes.length} tracks`;
  if (status === "error") {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <EmptyState
          arrangement="split"
          title="The map didn't load."
          body={`Klangkurator couldn't reach its backend: ${errorMessage}. Check that the app is running (./run.sh status), then try again.`}
          action={<Button onClick={reload}>Try again</Button>}
        />
      </div>
    );
  }

  if (status === "loading") return <MapSkeleton />;

  if (isMobile) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <EmptyState
          arrangement="split"
          title="The map needs a wider window."
          body="Below 768 px there is no room for a map; the table remains the way to browse the library."
          action={
            <Button asChild>
              <Link to="/">Back to the table</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <EmptyState
          arrangement="orbit"
          title="No tracks to map yet."
          body="The map is your library placed by how similar the tracks are. Import a music folder to start."
          action={
            <Button asChild>
              <Link to="/load-files">Import</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Map"
        meta={`${shownTrackCount} ${shownTrackCount === 1 ? "track" : "tracks"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* TM-E1: the same Table | Map switch the table's header carries.
                (The 375 px notice above returns before this header, so the
                switch is never reachable there; TM-E4.) */}
            <LibraryViewSwitch fromTable />
            <div role="group" aria-label="Map zoom" className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleFocus}
                disabled={!selectedId}
                title="Centre the map on the selected track"
              >
                <Crosshair />
                Focus
              </Button>
              <Button variant="outline" onClick={() => runZoom((handle) => handle.zoomIn())}>
                <ZoomIn />
                Zoom in
              </Button>
              <Button variant="outline" onClick={() => runZoom((handle) => handle.zoomOut())}>
                <ZoomOut />
                Zoom out
              </Button>
              <Button variant="outline" onClick={() => runZoom((handle) => handle.fit())}>
                <Maximize2 />
                Fit
              </Button>
              <Button variant="outline" onClick={() => runZoom((handle) => handle.reset())}>
                <RotateCcw />
                Reset
              </Button>
              <output aria-label="Zoom level" className="k-num inline-block w-12 text-right text-[13px] text-muted-foreground">
                {Math.round(zoomLevel * 100)}%
              </output>
            </div>
          </div>
        }
      />

      {/* Issue #36: two rails. The map's controls — similarity, filters,
          layers, clusters and the status line — sit on the LEFT, so the right
          rail holds only the selected track and its details are reachable
          without scrolling. Both collapse as a whole and per section, and both
          collapse states persist (useMapConfig). */}
      <div className="flex min-h-0 flex-1">
        <MapControlsRail
          config={config}
          filterOptions={filterOptions}
          coreSong={activeCoreId ? songById.get(activeCoreId) ?? null : null}
          onRemoveCore={handleRemoveCore}
          shownCount={shownTrackCount}
          unlinkedCount={model.unlinkedCount}
          focusNotice={focusNotice}
          truncated={model.lastResort === true}
          noMatches={noMatches}
          clusterDimension={clusters.dimension}
          clusterReason={clusters.reason}
          clusterGroups={clusters.groups}
          clusterFilters={clusterFilters}
          onChooseCluster={handleChooseCluster}
          onRemoveClusterFilter={handleRemoveClusterFilter}
          edges={visibleEdges}
          song={selectedSong}
          tags={selectedSong ? tagsBySong.get(selectedSong.id) ?? [] : []}
          nearest={nearestRows}
          partners={partnerRows}
          transitions={transitions}
          songById={songById}
          isPlaying={!!current && current.id === selectedId && isPlaying}
          onPlay={handlePlay}
          onProperties={handleProperties}
          onShowRelationships={handleShowRelationships}
          onSelect={handleListSelect}
        />
        <div className="min-h-0 min-w-0 flex-1 p-3">
          <div ref={canvasBoxRef} className="relative h-full w-full overflow-hidden rounded-lg border border-border">
            {model.nodes.length > 0 && positions.size > 0 && (
              <TrackMapCanvas
                ref={canvasRef}
                nodes={model.nodes}
                edges={visibleEdges}
                positions={displayedPositions}
                selectedId={selectedId}
                playingId={current?.id ?? null}
                label={canvasLabel}
                onSelect={handleCanvasNodeSelect}
                onDoubleClick={handleCanvasDoubleClick}
                onHover={isMobile ? undefined : handleCanvasHover}
                onDisplayedPositions={handleDisplayedPositions}
              />
            )}
            {/* Issue #35: the instant hover popover, beside the canvas rather
                than inside its conditional. Not on touch, where there is no
                hover to speak of (gated on `isMobile`). */}
            {hovered && !isMobile && songById.get(hovered.id) && (
              <TrackHoverPopover
                song={songById.get(hovered.id)!}
                tags={tagsBySong.get(hovered.id) ?? []}
                x={hovered.x}
                y={hovered.y}
                bounds={{
                  width: canvasBoxRef.current?.clientWidth ?? 0,
                  height: canvasBoxRef.current?.clientHeight ?? 0,
                }}
              />
            )}
            {/* TM-R5: with every input off there is no similarity to compute, so
                no nearest tracks show. Said on the canvas too, so it is visible
                with the rail collapsed. */}
            {noInputs && (
              <div className="absolute inset-x-0 top-0 flex justify-center p-4">
                <p role="status" className="rounded-chip border border-border bg-popover px-3 py-1.5 text-[13px] text-foreground shadow-1">
                  Pick at least one input.
                </p>
              </div>
            )}
            {/* TM-R7: filters that match no track, over the canvas, with the way
                out. The rail reports it too, so either place says so. */}
            {noMatches && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <EmptyState
                  size="inline"
                  arrangement="stack"
                  title="No track matches."
                  body={
                    searchQuery.trim()
                      ? `Nothing in your ${songs.length} tracks matches “${searchQuery.trim()}” with the current filters.`
                      : "The active filters exclude every track on the map."
                  }
                  action={
                    // Clears the search, the filters and the cluster chips, so
                    // the way out always resolves whatever left nothing to show.
                    <Button variant="outline" size="sm" onClick={handleClearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>

        <SelectedTrackRail
          config={config}
          song={selectedSong}
          tags={selectedSong ? tagsBySong.get(selectedSong.id) ?? [] : []}
          nearest={nearestRows}
          partners={partnerRows}
          transitions={transitions}
          songById={songById}
          isPlaying={!!current && current.id === selectedId && isPlaying}
          onPlay={handlePlay}
          onProperties={handleProperties}
          onShowRelationships={handleShowRelationships}
          onSelect={handleListSelect}
        />
      </div>

      <EditSongDialog
        song={editSong}
        open={editSong !== null}
        onOpenChange={(open) => {
          if (!open) setEditSong(null);
        }}
        onSave={() => {
          // The saved track comes back through the reload; the model re-solves.
          reload();
        }}
      />
    </div>
  );
}

/** The loading state: skeletons shaped like the header, the canvas and the rail. */
function MapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the map" className="flex h-full min-h-0 flex-col">
      <div className="flex h-[4.5rem] items-center gap-4 border-b border-border px-5 md:px-8">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="ml-auto h-8 w-52" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 p-3">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
        <div className="w-80 shrink-0 space-y-3 border-l border-border p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
