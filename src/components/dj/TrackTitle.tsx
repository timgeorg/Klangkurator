import { splitTitle } from "@/lib/trackFormat";

/**
 * A track title with its trailing version or catalogue part set quieter:
 * "Wanna See You Again (6 SENSE Remix) [DEP08]". Lists of tracks use it so
 * two versions of one track never read the same. It wraps like text; pass
 * "truncate" where it has to stay on one line.
 */
export function TrackTitle({ title, className }: { title: string; className?: string }) {
  const { main, version } = splitTitle(title);
  return (
    <span className={className}>
      {main}
      {version && <span className="font-normal text-muted-foreground"> {version}</span>}
    </span>
  );
}
