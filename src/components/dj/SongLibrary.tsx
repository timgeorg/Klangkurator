import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronsRight, FolderInput, Search, SlidersHorizontal, X } from "lucide-react";

import { EmptyState } from "@/components/layout/EmptyState";
import { LibraryViewSwitch } from "@/components/layout/LibraryViewSwitch";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { COLUMN_DEFINITIONS, useColumnConfig } from "@/hooks/useColumnConfig";
import { useRevealedRows } from "@/hooks/useRevealedRows";
import { getMainGenreColor } from "@/lib/genreData";
import { useLibraryFilters } from "@/lib/LibraryFilterContext";
import { usePlayer } from "@/lib/PlayerContext";
import { createSongWriter, type SongWriter } from "@/lib/songWriter";
import { getSettings, saveSettings } from "@/lib/settings";
import { storage, Song, SongPatch, SongTag, Tag } from "@/lib/storage";
import { crateById, getCrates, subscribeCrates } from "@/lib/crates";
import { crateOf, isMinorKey } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { EditSongDialog } from "./EditSongDialog";
import {
  FILTER_CONFIG,
  FilterOptions,
  FilterState,
  FilterValue,
  INITIAL_FILTERS,
  RangeValue,
  SortState,
  clickCrate,
  filterSongs,
  toggleCrate,
  visibleCrates,
} from "./libraryTable";
import { LyricsDialog } from "./LyricsDialog";
import { SongTableHeader } from "./SongTableHeader";
import { SongTableRow } from "./SongTableRow";

const SORT_VALUE: Record<string, (s: Song) => string | number | undefined | null> = {
  title: (s) => s.title,
  artist: (s) => s.artist,
  album: (s) => s.album,
  crate: (s) => crateOf(s),
  bpm: (s) => s.bpm,
  key: (s) => s.musical_key,
  energy: (s) => s.energy,
  people: (s) => s.people ?? 0,
  rank: (s) => s.rank || undefined,
  duration: (s) => s.duration,
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** How many crate tabs fit before the bar collapses and hides the rest (issue #49). */
const CRATE_TAB_LIMIT = 10;

/** The expand choice for the crate tabs; collapsed until one is stored. */
function readCratesExpanded(): boolean {
  const stored = getSettings().crateTabsExpanded;
  return typeof stored === "boolean" ? stored : false;
}

/** Store the crate tabs' expand choice (settings.json, issue #51). */
function writeCratesExpanded(expanded: boolean): void {
  saveSettings({ crateTabsExpanded: expanded });
}

/** A counter that changes whenever the crate registry does (issue #11). */
function useCrateRegistryTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeCrates(() => setTick((value) => value + 1)), []);
  return tick;
}

/**
 * A crate tab's tooltip: the crate's own folder inside its music location, so
 * two crates with one name are told apart without opening the settings.
 *
 * @param crateId - The crate the tab stands for.
 * @returns The path the crate lives at, or nothing when the registry is empty.
 */
function crateTitle(crateId: string): string | undefined {
  const crate = crateById(crateId);
  if (!crate) return undefined;
  const name = crate.location_path.replace(/\/$/, "");
  return `${name}/${crate.name}`;
}

/** A patch applied the way the backend applies it: null clears the field. */
function applyPatch(song: Song, patch: SongPatch): Song {
  const next: Record<string, unknown> = { ...song };
  for (const [field, value] of Object.entries(patch)) {
    if (value === null) delete next[field];
    else if (value !== undefined) next[field] = value;
  }
  return next as unknown as Song;
}

export function SongLibrary() {
  const navigate = useNavigate();
  const player = usePlayer();
  const columnConfig = useColumnConfig();
  // The Table | Map switch hides below the app's mobile breakpoint (TM-E4).
  const isMobile = useIsMobile();

  // Core data
  const [songs, setSongs] = useState<Song[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [songTags, setSongTags] = useState<Record<string, Tag[]>>({});
  // True until the first load completes; gates the empty-library redirect
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search and filters are shared with the map for the session (TM-R11): they
  // come from the context above the routes, so they carry across the Table |
  // Map switch both ways and survive the browser's Back; clearing them here
  // clears them on the map too. Sort stays this page's own.
  const { searchQuery, setSearchQuery, filters, updateFilter, activeFilterKeys, clearAll } =
    useLibraryFilters();
  // The field stays bound to the live query; the table follows a deferred copy
  // (issue #68). React renders the character at once, builds the table at low
  // priority, and drops a half-built table when the next key arrives. There is
  // no fixed delay, so the results show as soon as the device is free. The
  // deferral stays here and never moves into the context: the map's field and
  // this one read the same live string, and a deferred context value would drop
  // characters.
  const deferredQuery = useDeferredValue(searchQuery);
  // Everything that describes the table reads this: the header count, the empty
  // state and the reset key, so they never disagree with the rows on screen.
  const tableIsFiltering = activeFilterKeys.length > 0 || deferredQuery.trim() !== "";
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const [sort, setSort] = useState<SortState>(null);

  // The crate bar shows ten tabs and collapses the rest (issue #49). The
  // choice is read once, lazily, from storage; a browser without storage
  // starts collapsed.
  const [cratesExpanded, setCratesExpanded] = useState(readCratesExpanded);
  const crateRegistryTick = useCrateRegistryTick();
  const cratesToggleRef = useRef<HTMLButtonElement>(null);
  const allTracksTabRef = useRef<HTMLButtonElement>(null);

  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSongForEdit, setSelectedSongForEdit] = useState<Song | null>(null);
  const [lyricsSong, setLyricsSong] = useState<Song | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  // Right-edge fade when the table is wider than its container
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Edits never move rows: the order on screen freezes at the first edit, so
  // a track that no longer fits the sort, the search or a filter keeps its
  // place (under the pointer) until one of those changes.
  const viewKey = JSON.stringify([deferredQuery, filters, sort]);
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;
  const [frozen, setFrozen] = useState<{ key: string; ids: string[] } | null>(null);
  const rowsRef = useRef<Song[]>([]);
  const freezeRows = useCallback(() => {
    setFrozen((prev) =>
      prev?.key === viewKeyRef.current ? prev : { key: viewKeyRef.current, ids: rowsRef.current.map((s) => s.id) },
    );
  }, []);

  // Inline edits save one request at a time (see songWriter). A failed save
  // says so; once the queue is empty the library reloads from the backend, so
  // the table never goes on showing a change that wasn't saved.
  const loadAllDataRef = useRef<() => Promise<void>>(async () => {});
  const reloadQueued = useRef(false);
  const editCount = useRef(0);
  const writerRef = useRef<SongWriter | null>(null);
  if (!writerRef.current) {
    const writer = createSongWriter((songId) => {
      const title = songsRef.current.find((s) => s.id === songId)?.title;
      toast({
        variant: "destructive",
        title: "Change not saved",
        description: `${title ? `“${title}”` : "A track"} couldn't be saved. Check that Klangkurator is still running.`,
      });
      if (reloadQueued.current) return;
      reloadQueued.current = true;
      writer.idle().then(() => {
        reloadQueued.current = false;
        loadAllDataRef.current();
      });
    });
    writerRef.current = writer;
  }

  const loadAllData = useCallback(async () => {
    try {
      // Three requests in parallel; the song/tag join comes in one call. An
      // inline edit made while they run would be overwritten by this older
      // copy, so the fetch waits for queued edits and repeats after new ones.
      let loaded: [Song[], Tag[], SongTag[]];
      let edits: number;
      do {
        edits = editCount.current;
        await writerRef.current?.idle();
        loaded = await Promise.all([storage.getSongs(), storage.getTags(), storage.getSongTags()]);
      } while (edits !== editCount.current);
      const [loadedSongs, loadedTags, links] = loaded;
      const tagById = new Map(loadedTags.map((t) => [t.id, t]));
      const tagsMap: Record<string, Tag[]> = {};
      for (const link of links) {
        const tag = tagById.get(link.tag_id);
        if (tag) (tagsMap[link.song_id] ??= []).push(tag);
      }
      setSongs(loadedSongs);
      setAllTags(loadedTags);
      setSongTags(tagsMap);
      setLoadError(null);
      setInitialLoadDone(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The library could not be loaded.");
    }
  }, []);
  loadAllDataRef.current = loadAllData;

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // A bulk data change (Settings import, issue #10) bumps the whole library.
  useEffect(() => {
    const onChanged = () => loadAllData();
    window.addEventListener("klangkurator:library-changed", onChanged);
    return () => window.removeEventListener("klangkurator:library-changed", onChanged);
  }, [loadAllData]);

  // Empty library: the table is a dead end, route to the import page.
  // Only when the library itself is empty, not when a filter matches nothing.
  useEffect(() => {
    if (initialLoadDone && songs.length === 0) {
      navigate("/load-files", { replace: true });
    }
  }, [initialLoadDone, songs.length, navigate]);

  // Auto-size the tags column to the widest tag list
  const { autoResizeColumn } = columnConfig;
  useEffect(() => {
    const maxCount = songs.reduce((max, s) => Math.max(max, songTags[s.id]?.length || 0), 0);
    autoResizeColumn("tags", Math.min(360, 160 + Math.max(0, maxCount - 1) * 70));
  }, [songTags, songs, autoResizeColumn]);

  const handleTagsChange = useCallback(
    async (songId: string, tags: Tag[]) => {
      freezeRows();
      setSongTags((prev) => ({ ...prev, [songId]: tags }));
      setAllTags(await storage.getTags());
    },
    [freezeRows],
  );

  // An inline edit: shown at once, saved in the background.
  const patchSong = useCallback(
    (songId: string, patch: SongPatch) => {
      freezeRows();
      editCount.current += 1;
      setSongs((prev) => prev.map((song) => (song.id === songId ? applyPatch(song, patch) : song)));
      writerRef.current?.write(songId, patch);
    },
    [freezeRows],
  );

  const openLyrics = useCallback((song: Song) => {
    setLyricsSong(song);
    setLyricsOpen(true);
  }, []);

  const handleTagCreated = useCallback(async () => {
    setAllTags(await storage.getTags());
  }, []);

  const { current, isPlaying, play, playRun, toggle } = player;
  const currentId = current?.id;
  // Read through a ref so the handler stays stable: next and auto-advance then
  // re-render only the two rows whose state changed, not the whole table (NFR-3)
  const currentIdRef = useRef(currentId);
  currentIdRef.current = currentId;
  // Play starts a run of the rows as shown, so next / previous step to the
  // row below / above (PF-80). The current track's row toggles pause.
  const handlePlaySong = useCallback(
    (song: Song) => {
      const index = rowsRef.current.findIndex((row) => row.id === song.id);
      if (song.id === currentIdRef.current) toggle();
      else if (index < 0) play(song);
      else playRun(rowsRef.current, index);
    },
    [play, playRun, toggle],
  );

  const handleEditSong = useCallback((song: Song) => {
    setSelectedSongForEdit(song);
    setEditDialogOpen(true);
  }, []);

  /** Every crate's displayed name, by id (issue #11).
   *
   * The registry lives outside React, so the tick is the only signal that it
   * changed; the read itself cannot be a dependency the linter can see.
   */
  const crateNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const crate of getCrates()) names.set(crate.id, crate.name);
    return names;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crateRegistryTick]);

  // Filter options come from the loaded data (NFR-4: memoised)
  const filterOptions: FilterOptions = useMemo(() => {
    const mainGenres = new Set<string>();
    const subgenres = new Set<string>();
    const crates = new Set<string>();
    songs.forEach((s) => {
      if (s.mainGenre) mainGenres.add(s.mainGenre);
      s.subgenres?.forEach((g) => subgenres.add(g));
      if (s.genres) s.genres.forEach((g) => mainGenres.add(g));
      else if (s.genre) mainGenres.add(s.genre);
      const crate = crateOf(s);
      if (crate) crates.add(crate);
    });
    return {
      mainGenres: [...mainGenres].sort(collator.compare).map((g) => ({ label: g, value: g, color: getMainGenreColor(g) })),
      subgenres: [...subgenres].sort(collator.compare).map((g) => ({ label: g, value: g })),
      keys: [...new Set(songs.map((s) => s.musical_key).filter(Boolean) as string[])]
        .sort(collator.compare)
        .map((k) => ({
          label: k,
          value: k,
          color: isMinorKey(k) ? "hsl(var(--info))" : "hsl(var(--foreground))",
        })),
      tags: allTags.map((tag) => ({ label: tag.name, value: tag.id, color: tag.color })),
      // A crate's value is its id and its label its name (issue #11), so two
      // crates called "House" in two music locations stay two options.
      crates: [...crates]
        .map((id) => ({ label: crateNames.get(id) ?? id, value: id }))
        .sort((a, b) => collator.compare(a.label, b.label)),
    };
  }, [songs, allTags, crateNames]);

  /** The crates the library holds, in tab order: by displayed name, then id. */
  const crateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    songs.forEach((s) => {
      const c = crateOf(s);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) =>
      collator.compare(crateNames.get(a[0]) ?? a[0], crateNames.get(b[0]) ?? b[0]) ||
      collator.compare(a[0], b[0]),
    );
  }, [songs, crateNames]);

  const filteredSongs = useMemo(() => {
    // The predicate itself is `filterSongs` in libraryTable.ts, shared with the
    // map so the table and the map agree on what matches (phase 4a, TM-R11).
    const rows = filterSongs(songs, songTags, filters, deferredQuery);
    if (!sort || !SORT_VALUE[sort.column]) return rows;
    const get = SORT_VALUE[sort.column];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const missingA = va === undefined || va === null || va === "";
      const missingB = vb === undefined || vb === null || vb === "";
      if (missingA || missingB) return missingA === missingB ? 0 : missingA ? 1 : -1; // missing always last
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return collator.compare(String(va), String(vb)) * dir;
    });
  }, [songs, deferredQuery, filters, songTags, sort]);

  // The rows on screen: the live result, or the frozen order while editing.
  const rows = useMemo(() => {
    if (!frozen || frozen.key !== viewKey) return filteredSongs;
    const byId = new Map(songs.map((song) => [song.id, song]));
    return frozen.ids.flatMap((id) => byId.get(id) ?? []);
  }, [frozen, viewKey, filteredSongs, songs]);

  // The table renders the first rows only and adds a page while the sentinel at
  // its end stays in view (issue #63). `viewKey` is the reset key: a new list
  // starts again, an inline edit keeps its rows. The full `rows` still feed the
  // header count, `aria-rowcount` and the player.
  const { count: revealedCount, sentinelRef } = useRevealedRows(rows.length, viewKey);

  // A new list starts at the top: the first page is all that is rendered, so a
  // scroll position from the previous list would point past its end.
  useEffect(() => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
  }, [viewKey]);
  rowsRef.current = rows;

  // A new search, filter or sort thaws the order for good: going back to an
  // earlier search never brings an old frozen order back.
  useEffect(() => {
    setFrozen((prev) => (prev && prev.key !== viewKey ? null : prev));
  }, [viewKey]);

  // `activeFilterKeys` and `clearAll` come from the shared context with the
  // search and filters themselves (TM-R11).

  // The table's right edge while more columns lie beyond it. A sliver of a
  // cut column is covered by the page ground, so the visible table ends on a
  // whole column; a wider partial column only fades. A small button scrolls
  // to the hidden columns. On touch screens the button would be a target
  // under 44px, so it is left out there and the edge always fades instead,
  // the usual "swipe for more" hint. Updated in the DOM on scroll and resize,
  // never through React state.
  const { visibleColumns, gridTemplate } = columnConfig;
  const edgeRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = tableScrollRef.current;
    const edge = edgeRef.current;
    const moreButton = moreRef.current;
    if (!el || !edge || !moreButton) return;
    const update = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const scrollbarW = el.offsetWidth - el.clientWidth;
      edge.style.right = `${scrollbarW}px`;
      edge.style.bottom = `${el.offsetHeight - el.clientHeight}px`;
      moreButton.style.right = `${scrollbarW + 2}px`;
      const more = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      edge.hidden = !more;
      moreButton.hidden = true;
      if (!more) return;
      const box = el.getBoundingClientRect();
      const visibleRight = el.clientWidth;
      // Where the visible table ends: the last whole column, and the column
      // cut by the edge, if any.
      let lastRight = 0;
      let cover = 0;
      let straddles = false;
      for (const cell of coarse ? [] : el.querySelectorAll<HTMLElement>('[role="columnheader"]')) {
        const r = cell.getBoundingClientRect();
        const left = r.left - box.left;
        const right = r.right - box.left;
        if (right <= visibleRight) {
          lastRight = Math.max(lastRight, right);
          continue;
        }
        if (left < visibleRight) {
          straddles = true;
          if (visibleRight - left < 120) cover = visibleRight - left + 8;
        }
        break;
      }
      // The button (24px, 2px from the edge) only shows where it has room of
      // its own: on the covered strip, over a wide faded column, or in an
      // empty gap after the last whole column. Never on a column's header.
      const room = cover || (straddles ? Infinity : visibleRight - lastRight);
      moreButton.hidden = coarse || room < 28;
      // The visible table already ends on a whole column: nothing to cover.
      if (!coarse && !straddles) {
        edge.hidden = true;
        return;
      }
      // An alpha mask: only the black's opacity counts, it is never seen as a color.
      const solid = "#000"; // impeccable-disable-line design-system-color
      const mask = cover
        ? `linear-gradient(to right, transparent, ${solid} 10px)`
        : `linear-gradient(to left, ${solid}, transparent)`;
      edge.style.width = `${cover || 40}px`;
      edge.style.maskImage = mask;
      edge.style.webkitMaskImage = mask;
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [rows.length, gridTemplate, initialLoadDone]);

  const crateTotal = filterOptions.crates.length;
  const meta = !initialLoadDone
    ? undefined
    : tableIsFiltering
      ? `${rows.length} of ${songs.length} tracks`
      : `${songs.length} ${songs.length === 1 ? "track" : "tracks"}` +
        (crateTotal > 0 ? ` · ${crateTotal} ${crateTotal === 1 ? "crate" : "crates"}` : "");

  // The ids drive the tab bar; the names are only ever displayed.
  const crateIds = crateCounts.map(([crate]) => crate);
  // Which tabs show, and how many stay hidden (issue #49). Pure: recomputed
  // per render, cheap enough to stay out of a memo.
  const { shown: shownCrates, hidden: hiddenCrates } = visibleCrates(
    crateIds,
    filters.crate,
    cratesExpanded,
    CRATE_TAB_LIMIT,
  );

  // A crate tab: a plain click selects that crate alone, Shift adds it to or
  // removes it from the selection (issue #49). A tab deselected while
  // collapsed disappears, so when it had focus the toggle takes it (BC-15):
  // whether it survives is decided from the next selection, before the filter
  // changes.
  const handleCrateClick = (crate: string, additive: boolean, tab: HTMLButtonElement) => {
    const next = additive ? toggleCrate(filters.crate, crate) : clickCrate(filters.crate, crate);
    const hadFocus = document.activeElement === tab;
    const { shown } = visibleCrates(crateIds, next, cratesExpanded, CRATE_TAB_LIMIT);
    updateFilter("crate", next);
    if (!hadFocus || shown.includes(crate)) return;
    requestAnimationFrame(() => (cratesToggleRef.current ?? allTracksTabRef.current)?.focus());
  };

  // Expand or collapse the crate tabs, remember the choice, and keep focus on
  // the toggle that made the change (BC-3). Collapsing hides nothing when every
  // hidden crate is selected, so the toggle unmounts: focus then goes to the
  // first tab, which is always there.
  const handleToggleCrates = () => {
    const next = !cratesExpanded;
    setCratesExpanded(next);
    writeCratesExpanded(next);
    const toggleSurvives =
      crateIds.length > CRATE_TAB_LIMIT &&
      (next || visibleCrates(crateIds, filters.crate, next, CRATE_TAB_LIMIT).hidden > 0);
    requestAnimationFrame(() => (toggleSurvives ? cratesToggleRef.current : allTracksTabRef.current)?.focus());
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Library"
        meta={meta}
        actions={
          <>
            {!isMobile && <LibraryViewSwitch fromTable />}
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search the library"
                placeholder="Search title, artist, genre, key"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-chip pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={() => setColumnSettingsOpen(true)}>
              <SlidersHorizontal />
              Columns
            </Button>
            <Button variant="outline" asChild>
              <Link to="/load-files">
                <FolderInput />
                Import
              </Link>
            </Button>
          </>
        }
      >
        {(crateCounts.length > 0 || activeFilterKeys.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {crateCounts.length > 0 && (
              <div role="group" aria-label="Crates" className="-ml-1 flex select-none flex-wrap items-center gap-1">
                <CrateTab
                  ref={allTracksTabRef}
                  label="All tracks"
                  count={songs.length}
                  active={filters.crate.length === 0}
                  onClick={() => updateFilter("crate", [])}
                />
                {crateCounts
                  .filter(([crate]) => shownCrates.includes(crate))
                  .map(([crate, count]) => (
                    <CrateTab
                      key={crate}
                      label={crateNames.get(crate) ?? crate}
                      count={count}
                      active={filters.crate.includes(crate)}
                      title={crateTitle(crate)}
                      onClick={(additive, tab) => handleCrateClick(crate, additive, tab)}
                    />
                  ))}
                {crateIds.length > CRATE_TAB_LIMIT && (cratesExpanded || hiddenCrates > 0) && (
                  <button
                    ref={cratesToggleRef}
                    type="button"
                    onClick={handleToggleCrates}
                    aria-expanded={cratesExpanded}
                    className="inline-flex h-8 items-center rounded-chip px-3.5 text-[13px] font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11"
                  >
                    {cratesExpanded ? "Show fewer" : `+${hiddenCrates} more`}
                  </button>
                )}
              </div>
            )}
            {activeFilterKeys.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeFilterKeys.map((key) => (
                  <FilterChip
                    key={key}
                    label={COLUMN_DEFINITIONS[key]?.label ?? key}
                    value={describeFilter(key, filters[key], filterOptions)}
                    onRemove={() => updateFilter(key, INITIAL_FILTERS[key])}
                  />
                ))}
                <Button variant="link" size="sm" onClick={clearAll} className="h-6 text-xs">
                  Clear all
                </Button>
              </div>
            )}
          </div>
        )}
      </PageHeader>

      <div className="relative min-h-0 flex-1">
        <div
          ref={tableScrollRef}
          className="absolute inset-0 overflow-auto [scroll-padding:2.75rem_3.5rem_0_0.5rem]"
          // Keyboard focus inside the table (header buttons, cells) lands clear
          // of the right-edge fade instead of under it or past the edge.
          onFocusCapture={(e) => {
            const el = tableScrollRef.current;
            const target = e.target as HTMLElement;
            // Keyboard focus only: scrolling under a mouse click would move the
            // control away from the pointer and swallow the click. Pickers are
            // portaled out of the table, so focus inside them is left alone.
            if (!el || target === el || !el.contains(target) || !target.matches(":focus-visible")) return;
            const box = el.getBoundingClientRect();
            const r = target.getBoundingClientRect();
            const rightLimit = box.left + el.clientWidth - 56;
            if (r.right > rightLimit) el.scrollLeft += Math.min(r.right - rightLimit, r.left - box.left - 8);
            else if (r.left < box.left + 8) el.scrollLeft -= box.left + 8 - r.left;
            // After the browser's own scroll-into-view: nothing ends up under
            // the sticky header (Shift+Tab walks upwards through the rows).
            requestAnimationFrame(() => {
              const header = el.querySelector<HTMLElement>('[role="rowgroup"]');
              const below = el.getBoundingClientRect().top + (header?.offsetHeight ?? 37) + 4;
              const top = target.getBoundingClientRect().top;
              if (top < below && !header?.contains(target)) el.scrollTop -= below - top;
            });
          }}
        >
          {loadError ? (
            <EmptyState
              title="The library didn't load."
              body={`Klangkurator couldn't reach its backend: ${loadError}. Check that the app is running (./run.sh status), then try again.`}
              action={<Button onClick={() => loadAllData()}>Try again</Button>}
              arrangement="split"
            />
          ) : !initialLoadDone ? (
            <TableSkeleton gridTemplate={gridTemplate} columns={visibleColumns} />
          ) : (
            <>
              <div role="table" aria-label="Library" aria-rowcount={rows.length + 1} className="w-max min-w-full">
                <SongTableHeader
                  columnConfig={columnConfig}
                  filters={filters}
                  filterOptions={filterOptions}
                  onFilterChange={updateFilter}
                  sort={sort}
                  onSortChange={setSort}
                />
                <div role="rowgroup">
                  {rows.slice(0, revealedCount).map((song, index) => (
                    <SongTableRow
                      key={song.id}
                      song={song}
                      index={index}
                      songTags={songTags[song.id] || EMPTY_TAGS}
                      allTags={allTags}
                      visibleColumns={visibleColumns}
                      gridTemplate={gridTemplate}
                      isCurrent={song.id === currentId}
                      isPlaying={song.id === currentId && isPlaying}
                      onPlaySong={handlePlaySong}
                      onEditSong={handleEditSong}
                      onTagsChange={handleTagsChange}
                      onTagCreated={handleTagCreated}
                      onPatch={patchSong}
                      onOpenLyrics={openLyrics}
                    />
                  ))}
                </div>
                {/* Reveals the next page when it comes into view. It sits outside
                    `role="rowgroup"`: a rowgroup may only hold rows. */}
                {revealedCount < rows.length && (
                  <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />
                )}
              </div>
              {rows.length === 0 && songs.length > 0 && (
                <div className="sticky left-0 w-full max-w-3xl p-5 md:p-8">
                  <EmptyState
                    size="inline"
                    arrangement="stack"
                    title="No track matches."
                    body={
                      deferredQuery.trim()
                        ? `Nothing in your ${songs.length} tracks matches “${deferredQuery.trim()}” with the current filters.`
                        : "The active filters exclude every track."
                    }
                    action={
                      <Button variant="outline" size="sm" onClick={clearAll}>
                        Clear search and filters
                      </Button>
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div ref={edgeRef} aria-hidden hidden className="k-ground pointer-events-none absolute top-0 z-20" />
        <button
          ref={moreRef}
          type="button"
          hidden
          tabIndex={-1}
          aria-hidden
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const el = tableScrollRef.current;
            if (!el) return;
            // Snap so that a column starts 40px before the edge: it lands on the
            // covered strip and the button keeps its room for the next press.
            const room = 40;
            const box = el.getBoundingClientRect();
            const target = el.scrollLeft + el.clientWidth * 0.7;
            const lefts = Array.from(el.querySelectorAll<HTMLElement>('[role="columnheader"]'), (h) => h.getBoundingClientRect().left - box.left + el.scrollLeft);
            const snapped = lefts.filter((left) => left <= target + el.clientWidth - room).pop();
            const next = snapped === undefined ? target : snapped - (el.clientWidth - room);
            el.scrollTo({ left: next > el.scrollLeft + room ? next : target, behavior: "smooth" });
          }}
          title="More columns"
          // [&[hidden]]:hidden: inline-flex would otherwise win over the hidden attribute
          className="absolute top-1.5 z-30 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-1 transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[hidden]]:hidden"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <ColumnSettingsDialog open={columnSettingsOpen} onOpenChange={setColumnSettingsOpen} columnConfig={columnConfig} />
      <EditSongDialog
        song={selectedSongForEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={() => {
          freezeRows();
          loadAllData();
        }}
      />
      <LyricsDialog
        song={lyricsSong}
        open={lyricsOpen}
        onOpenChange={setLyricsOpen}
        onSave={(updated) => {
          freezeRows();
          // Only the lyrics: other fields may still have inline edits on their way.
          setSongs((prev) =>
            prev.map((song) => (song.id === updated.id ? { ...song, lyrics: updated.lyrics ?? undefined } : song)),
          );
        }}
      />
    </div>
  );
}

const EMPTY_TAGS: Tag[] = [];

const CrateTab = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    count: number;
    active: boolean;
    /** The tooltip naming the Shift+click shortcut on the crate tabs (REQ-13-CT). */
    title?: string;
    /** The click that picked this tab; `additive` is Shift held (issue #49). */
    onClick: (additive: boolean, tab: HTMLButtonElement) => void;
  }
>(function CrateTab({ label, count, active, title, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => onClick(e.shiftKey, e.currentTarget)}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-8 max-w-[16rem] items-center gap-2 rounded-chip px-3.5 text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(pointer:coarse)]:min-h-11",
        active ? "bg-signal-soft text-signal-text" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn("k-num text-[11px]", active ? "text-signal-text/80" : "text-muted-foreground/80")}>{count}</span>
    </button>
  );
});

function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-chip border border-border pl-2.5 pr-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[12rem] truncate font-medium">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function describeFilter(key: keyof FilterState, value: FilterValue, options: FilterOptions): string {
  const type = FILTER_CONFIG[key].type;
  if (type === "text") return `“${value}”`;
  if (type === "range") {
    const range = value as RangeValue;
    const fmt = (n?: number) => (n === undefined ? "" : key === "duration" ? `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}` : String(n));
    if (range.min !== undefined && range.max !== undefined) return `${fmt(range.min)}–${fmt(range.max)}`;
    return range.min !== undefined ? `≥ ${fmt(range.min)}` : `≤ ${fmt(range.max)}`;
  }
  const list = (value as string[]) ?? [];
  const optionsKey = FILTER_CONFIG[key].optionsKey;
  const labelOf = (v: string) => (optionsKey ? options[optionsKey].find((o) => o.value === v)?.label : undefined) ?? v;
  return list.length <= 2 ? list.map(labelOf).join(", ") : `${list.length} selected`;
}

function TableSkeleton({ gridTemplate, columns }: { gridTemplate: string; columns: string[] }) {
  return (
    <div aria-busy="true" aria-label="Loading the library" className="w-max min-w-full">
      <div className="h-9 border-b border-border" />
      {Array.from({ length: 12 }, (_, r) => (
        <div
          key={r}
          className="grid h-11 items-center gap-2 border-b border-border/70 px-3"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((c) =>
            c === "cover" ? (
              <Skeleton key={c} className="h-8 w-8 rounded-[3px]" />
            ) : (
              <Skeleton key={c} className={cn("h-2.5", c === "title" ? "w-4/5" : "w-1/2")} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
