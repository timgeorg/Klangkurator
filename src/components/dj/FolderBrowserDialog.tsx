import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Folder, Home, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, describeApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DirEntry {
  name: string;
  path: string;
  has_children: boolean;
}

interface BrowseResponse {
  path: string;
  parent: string | null;
  directories: DirEntry[];
}

interface FolderBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen directory path. */
  onSelect: (path: string) => void;
}

const shortName = (path: string) => path.split("/").filter(Boolean).pop() || path;

/** The path as the user knows it: "~/Music/House" inside the home folder. */
const displayPath = (path: string, home: string) =>
  home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;

/**
 * Folder browser backed by GET /api/library/browse, for browser tabs (the
 * desktop app uses the system dialog). Click or Enter opens a folder; "Use"
 * takes the folder that is open. Browsing starts in, and stays inside, the
 * backend's home folder.
 */
export function FolderBrowserDialog({ open, onOpenChange, onSelect }: FolderBrowserDialogProps) {
  const [home, setHome] = useState("");
  const [current, setCurrent] = useState("");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLButtonElement>(null);
  const focusListAfterLoad = useRef(false);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<BrowseResponse>(`/library/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`);
      if (!path || path === "~") setHome(res.path);
      setCurrent(res.path);
      setParent(res.parent);
      setEntries(res.directories);
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Start at the home folder every time the dialog opens.
  useEffect(() => {
    if (open) {
      setCurrent("");
      setEntries([]);
      browse();
    }
  }, [open, browse]);

  // Opening a folder replaces the list; put focus on its first row so the
  // keyboard user isn't dropped back to the top of the page.
  useEffect(() => {
    if (!focusListAfterLoad.current || loading) return;
    focusListAfterLoad.current = false;
    const first = listRef.current?.querySelector<HTMLElement>("button[data-folder]");
    (first ?? upRef.current ?? listRef.current)?.focus();
  }, [entries, loading]);

  const openFolder = (dir: DirEntry) => {
    focusListAfterLoad.current = true;
    browse(dir.path);
  };

  const choose = () => {
    onSelect(current);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,42rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>Choose your music folder</DialogTitle>
          <DialogDescription>
            Open the folder that holds all your music, then use it. Each subfolder becomes a crate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-y border-border px-3 py-2">
          <Button
            ref={upRef}
            variant="ghost"
            size="icon-sm"
            disabled={!parent || loading}
            onClick={() => parent && browse(parent)}
            aria-label="Up one level"
            title="Up one level"
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={loading}
            onClick={() => browse("~")}
            aria-label="Home folder"
            title="Home folder"
          >
            <Home />
          </Button>
          <span className="k-num ml-1 min-w-0 flex-1 truncate text-xs text-muted-foreground" title={current}>
            {current ? displayPath(current, home) : "…"}
          </span>
          {loading && <Loader2 aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        <div
          ref={listRef}
          tabIndex={-1}
          aria-busy={loading}
          className={cn(
            "min-h-[16rem] flex-1 overflow-y-auto p-1.5 outline-none transition-opacity duration-fast",
            loading && entries.length > 0 && "opacity-60",
          )}
        >
          {error ? (
            <div role="alert" className="flex h-full min-h-[15rem] flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => browse()}>
                Go to the home folder
              </Button>
            </div>
          ) : loading && entries.length === 0 ? (
            <div aria-hidden className="space-y-1.5 p-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-7" style={{ width: `${82 - i * 9}%` }} />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="flex h-full min-h-[15rem] items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
              No subfolders here. Use this folder, or go up a level.
            </p>
          ) : (
            <ul aria-label={`Folders in ${shortName(current)}`}>
              {entries.map((dir) => (
                <li key={dir.path}>
                  <button
                    type="button"
                    data-folder
                    onClick={() => openFolder(dir)}
                    disabled={loading}
                    className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
                  >
                    <Folder aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{dir.name}</span>
                    {dir.has_children && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:items-center">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!current || loading || !!error} onClick={choose} className="max-w-full sm:max-w-[16rem]">
            <span className="truncate">{current ? `Use “${shortName(current)}”` : "Use this folder"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
