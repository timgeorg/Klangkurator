import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Folder, FolderOpen, ArrowUp, Home } from "lucide-react";
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
  /** Called with the chosen directory path on "Select". */
  onSelect: (path: string) => void;
}

/**
 * Native-style folder browser backed by GET /api/library/browse.
 *
 * Desktop (PyWebView) mode uses the OS dialog instead — this component is
 * the browser-mode replacement for the old manual path input. Starting
 * point is the backend's home directory; browsing is sandboxed there.
 */
export function FolderBrowserDialog({ open, onOpenChange, onSelect }: FolderBrowserDialogProps) {
  const [current, setCurrent] = useState<string>("");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<BrowseResponse>(
        `/library/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`
      );
      setCurrent(res.path);
      setParent(res.parent);
      setEntries(res.directories);
    } catch (e: any) {
      setError(e.message || "Could not list directory");
    } finally {
      setLoading(false);
    }
  }, []);

  // (Re)load whenever the dialog opens; reset to home each time.
  useEffect(() => {
    if (open) {
      setCurrent("");
      setEntries([]);
      browse();
    }
  }, [open, browse]);

  const handleOpenDir = async (dir: DirEntry) => {
    setNavigating(dir.path);
    await browse(dir.path);
    setNavigating(null);
  };

  const shortName = (p: string) => p.split("/").filter(Boolean).pop() || p;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose your music root folder</DialogTitle>
          <DialogDescription>
            The folder that contains all your music. Subfolders become crates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <FolderOpen className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="truncate font-mono text-xs" title={current}>
              {current || "…"}
            </span>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm" variant="ghost" className="h-7 px-2"
              disabled={!parent || loading}
              onClick={() => browse(parent!)}
              title="Up one level"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7 px-2"
              disabled={loading}
              onClick={() => browse("~")}
              title="Home"
            >
              <Home className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="h-64 overflow-y-auto rounded-md border border-border">
          {loading && entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-red-400">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No subfolders here
            </div>
          ) : (
            <ul className="p-1">
              {entries.map((dir) => (
                <li key={dir.path}>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                      "hover:bg-table-row-hover transition-colors",
                      navigating === dir.path && "opacity-50"
                    )}
                    onDoubleClick={() => handleOpenDir(dir)}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-orange-500/80" />
                    <span className="truncate">{dir.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!current || loading}
            onClick={() => {
              onSelect(current);
              onOpenChange(false);
            }}
            title={current ? `Use ${shortName(current)} as root folder` : undefined}
          >
            Use this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}