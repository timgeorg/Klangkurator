import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronsRight, FolderInput, Search, SlidersHorizontal, X } from "lucide-react";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { COLUMN_DEFINITIONS, useColumnConfig } from "@/hooks/useColumnConfig";
import { getMainGenreColor } from "@/lib/genreData";
import { usePlayer } from "@/lib/PlayerContext";
import { createSongWriter, type SongWriter } from "@/lib/songWriter";
import { storage, Song, SongPatch, Tag } from "@/lib/storage";
import { crateOf, isMinorKey } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

import { ColumnSettingsDialog } from "./ColumnSettingsDialog";
import { EditSongDialog } from "./EditSongDialog";
import { FILTER_CONFIG, FilterOptions, FilterState, FilterValue, RangeValue, SortState, isFilterActive } from "./libraryTable";
import { LyricsDialog } from "./LyricsDialog";
import { SongTableHeader } from "./SongTableHeader";
import { SongTableRow } from "./SongTableRow";

const INITIAL_FILTERS: FilterState = {
  title: "",
  artist: "",
  album: "",
  rootFolder: [],
  genre: [],
  subgenres: [],
  bpm: {},
  key: [],
  energy: {},
  danceability: {},
  social: {},
  rank: {},
  duration: {},
  tags: [],
};

const SORT_VALUE: Record<string, (s: Song) => string | number | undefined | null> = {
  title: (s) => s.title,
  artist: (s) => s.artist,
  album: (s) => s.album,
  rootFolder: (s) => crateOf(s),
  bpm: (s) => s.bpm,
  key: (s) => s.musical_key,
  energy: (s) => s.energy,
  danceability: (s) => s.danceability,
  social: (s) => s.social_acceptance,
  rank: (s) => s.rank || undefined,
  duration: (s) => s.duration,
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

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

  // Core data
  const [songs, setSongs] = useState<Song[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [songTags, setSongTags] = useState<Record<string, Tag[]>>({});
  // True until the first load completes; gates the empty-library redirect
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // UI state (session only: search, filters and sort reset when you leave)
  const [searchQuery, setSearchQuery] = useState("");
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sort, setSort] = useState<SortState>(null);

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
  const viewKey = JSON.stringify([searchQuery, filters, sort]);
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
    // Edits still on their way would be overwritten by an older copy.
    await writerRef.current?.idle();
    try {
      // Three requests in parallel; the song/tag join comes in one call.
      const [loadedSongs, loadedTags, links] = await Promise.all([
        storage.getSongs(),
        storage.getTags(),
        storage.getSongTags(),
      ]);
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

  const { current, isPlaying, play, toggle } = player;
  const currentId = current?.id;
  const handlePlaySong = useCallback(
    (song: Song) => {
      if (song.id === currentId) toggle();
      else play(song);
    },
    [currentId, play, toggle],
  );

  const handleEditSong = useCallback((song: Song) => {
    setSelectedSongForEdit(song);
    setEditDialogOpen(true);
  }, []);

  const updateFilter = useCallback((key: keyof FilterState, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value ?? INITIAL_FILTERS[key] }));
  }, []);

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
      rootFolders: [...crates].sort(collator.compare).map((f) => ({ label: f, value: f })),
    };
  }, [songs, allTags]);

  const crateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    songs.forEach((s) => {
      const c = crateOf(s);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => collator.compare(a[0], b[0]));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = songs.filter((song) => {
      if (q) {
        const hit =
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q) ||
          song.mainGenre?.toLowerCase().includes(q) ||
          song.subgenres?.some((g) => g.toLowerCase().includes(q)) ||
          song.genres?.some((g) => g.toLowerCase().includes(q)) ||
          song.genre?.toLowerCase().includes(q) ||
          song.musical_key?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filters.title && !song.title.toLowerCase().includes(filters.title.toLowerCase())) return false;
      if (filters.artist && !song.artist.toLowerCase().includes(filters.artist.toLowerCase())) return false;
      if (filters.album && !song.album?.toLowerCase().includes(filters.album.toLowerCase())) return false;
      if (filters.rootFolder.length > 0 && !filters.rootFolder.includes(crateOf(song))) return false;
      if (filters.genre.length > 0) {
        const g = [song.mainGenre, ...(song.genres || []), song.genre].filter(Boolean) as string[];
        if (!g.some((x) => filters.genre.includes(x))) return false;
      }
      if (filters.subgenres.length > 0 && !(song.subgenres || []).some((g) => filters.subgenres.includes(g))) return false;
      if (filters.key.length > 0 && (!song.musical_key || !filters.key.includes(song.musical_key))) return false;
      if (filters.bpm.min !== undefined && (!song.bpm || song.bpm < filters.bpm.min)) return false;
      if (filters.bpm.max !== undefined && (!song.bpm || song.bpm > filters.bpm.max)) return false;
      if (filters.energy.min !== undefined && song.energy < filters.energy.min) return false;
      if (filters.energy.max !== undefined && song.energy > filters.energy.max) return false;
      if (filters.danceability.min !== undefined && song.danceability < filters.danceability.min) return false;
      if (filters.danceability.max !== undefined && song.danceability > filters.danceability.max) return false;
      if (filters.social.min !== undefined && song.social_acceptance < filters.social.min) return false;
      if (filters.social.max !== undefined && song.social_acceptance > filters.social.max) return false;
      if (filters.rank.min !== undefined && (song.rank ?? 0) < filters.rank.min) return false;
      if (filters.duration.min !== undefined && (!song.duration || song.duration < filters.duration.min)) return false;
      if (filters.duration.max !== undefined && (!song.duration || song.duration > filters.duration.max)) return false;
      if (filters.tags.length > 0) {
        const ids = songTags[song.id]?.map((t) => t.id) || [];
        if (!filters.tags.some((id) => ids.includes(id))) return false;
      }
      return true;
    });

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
  }, [songs, searchQuery, filters, songTags, sort]);

  // The rows on screen: the live result, or the frozen order while editing.
  const rows = useMemo(() => {
    if (!frozen || frozen.key !== viewKey) return filteredSongs;
    const byId = new Map(songs.map((song) => [song.id, song]));
    return frozen.ids.flatMap((id) => byId.get(id) ?? []);
  }, [frozen, viewKey, filteredSongs, songs]);
  rowsRef.current = rows;

  // A new search, filter or sort thaws the order for good: going back to an
  // earlier search never brings an old frozen order back.
  useEffect(() => {
    setFrozen((prev) => (prev && prev.key !== viewKey ? null : prev));
  }, [viewKey]);

  const activeFilterKeys = (Object.keys(FILTER_CONFIG) as (keyof FilterState)[]).filter((key) =>
    isFilterActive(FILTER_CONFIG[key].type, filters[key]),
  );
  const isFiltering = activeFilterKeys.length > 0 || searchQuery.trim() !== "";
  const clearAll = () => {
    setFilters(INITIAL_FILTERS);
    setSearchQuery("");
  };

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

  const crateTotal = filterOptions.rootFolders.length;
  const meta = !initialLoadDone
    ? undefined
    : isFiltering
      ? `${rows.length} of ${songs.length} tracks`
      : `${songs.length} ${songs.length === 1 ? "track" : "tracks"}` +
        (crateTotal > 0 ? ` · ${crateTotal} ${crateTotal === 1 ? "crate" : "crates"}` : "");

  const activeCrate = filters.rootFolder.length === 1 ? filters.rootFolder[0] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Library"
        meta={meta}
        actions={
          <>
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
              <div role="group" aria-label="Crates" className="-ml-1 flex flex-wrap items-center gap-1">
                <CrateTab
                  label="All tracks"
                  count={songs.length}
                  active={filters.rootFolder.length === 0}
                  onClick={() => updateFilter("rootFolder", [])}
                />
                {crateCounts.map(([crate, count]) => (
                  <CrateTab
                    key={crate}
                    label={crate}
                    count={count}
                    active={activeCrate === crate}
                    onClick={() => updateFilter("rootFolder", activeCrate === crate ? [] : [crate])}
                  />
                ))}
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
              <div role="table" aria-label="Library" aria-rowcount={rows.length} className="w-max min-w-full">
                <SongTableHeader
                  columnConfig={columnConfig}
                  filters={filters}
                  filterOptions={filterOptions}
                  onFilterChange={updateFilter}
                  sort={sort}
                  onSortChange={setSort}
                />
                <div role="rowgroup">
                  {rows.map((song, index) => (
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
              </div>
              {rows.length === 0 && songs.length > 0 && (
                <div className="sticky left-0 w-full max-w-3xl p-5 md:p-8">
                  <EmptyState
                    size="inline"
                    arrangement="stack"
                    title="No track matches."
                    body={
                      searchQuery.trim()
                        ? `Nothing in your ${songs.length} tracks matches “${searchQuery.trim()}” with the current filters.`
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

function CrateTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 max-w-[16rem] items-center gap-2 rounded-chip px-3.5 text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-signal-soft text-signal-text" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cn("k-num text-[11px]", active ? "text-signal-text/80" : "text-muted-foreground/80")}>{count}</span>
    </button>
  );
}

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
