import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DimensionReport,
  type GapBin,
  type GapRegion,
  reportLibraryGaps,
} from "@/lib/libraryGaps";
import { storage, type Song } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** The bar height a bin draws, as a share of its section's tallest bin. */
const MIN_BAR_HEIGHT = 2;

/** One region row: the range, its own count, and the two dense sides. */
function RegionRow({ region, report }: { region: GapRegion; report: DimensionReport }) {
  const { format } = report;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 py-2">
      <span className="k-num text-[13px] font-medium tabular-nums">
        {format(region.from)}–{format(region.to)}
      </span>
      <span className="k-num text-[13px] text-muted-foreground">
        {region.count === 0 ? "empty" : region.count === 1 ? "1 track" : `${region.count} tracks`}
      </span>
      <span className="k-num text-xs text-muted-foreground">
        between {region.leftFlank} and {region.rightFlank}
      </span>
    </li>
  );
}

/**
 * One bin's bar. The height carries its count on a linear scale, so a thin
 * region is a nearly flat run and the bar alone cannot carry the finding. The
 * region therefore also draws a rule on the axis below, which marks the stretch
 * without touching the heights.
 */
function Bar({ bin, peak, report }: { bin: GapBin; peak: number; report: DimensionReport }) {
  const height = peak > 0 ? Math.max(MIN_BAR_HEIGHT, (bin.count / peak) * 100) : MIN_BAR_HEIGHT;
  const { format } = report;
  return (
    <div
      role="img"
      aria-label={`${format(bin.from)} to ${format(bin.to)}: ${bin.count === 1 ? "1 track" : `${bin.count} tracks`}`}
      title={`${format(bin.from)}–${format(bin.to)} · ${bin.count}`}
      className={cn(
        "min-w-0 flex-1 self-end rounded-t-[2px] transition-colors duration-fast",
        bin.inRegion ? "bg-signal" : bin.dense ? "bg-foreground/45" : "bg-foreground/15",
      )}
      style={{ height: `${height}%` }}
    />
  );
}

/** One dimension: its numbers, its strip and its regions. */
function DimensionSection({ report }: { report: DimensionReport }) {
  const peak = useMemo(() => report.bins.reduce((max, bin) => Math.max(max, bin.count), 0), [report.bins]);
  const first = report.bins[0];
  const last = report.bins[report.bins.length - 1];
  return (
    <section aria-labelledby={`gaps-${report.dimension}`} className="border-t border-border py-7 first:border-t-0">
      <SectionHeader title={<span id={`gaps-${report.dimension}`}>{report.label}</span>} />

      <p className="k-num mt-2 text-xs text-muted-foreground">
        {report.measured === 1 ? "1 measured track" : `${report.measured} measured tracks`}
        {` · ${report.widthLabel} per bin`}
        {report.insufficient
          ? ""
          : ` · ${report.bins.length === 1 ? "1 bin" : `${report.bins.length} bins`} · dense from ${report.floor}`}
      </p>

      {report.insufficient ? (
        <p className="mt-4 max-w-prose text-[13px] text-muted-foreground">
          Not enough data. This report needs at least 50 tracks with a value here, and only {report.measured}{" "}
          {report.measured === 1 ? "has" : "have"} one.
        </p>
      ) : (
        <>
          <div aria-hidden className="mt-5 flex h-24 items-end gap-px">
            {report.bins.map((bin) => (
              <Bar key={bin.from} bin={bin} peak={peak} report={report} />
            ))}
          </div>
          {/* The axis, and on it the stretch each region covers: at this scale
              a thin run is a flat line, so the rule is what makes it findable. */}
          <div aria-hidden className="flex gap-px border-t border-border">
            {report.bins.map((bin) => (
              <span
                key={bin.from}
                className={cn("h-[3px] min-w-0 flex-1", bin.inRegion && "bg-signal")}
              />
            ))}
          </div>
          <div className="k-num mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{first ? report.format(first.from) : ""}</span>
            <span>{last ? report.format(last.to) : ""}</span>
          </div>

          {report.dimension === "bpm" && report.grid ? (
            <p className="mt-5 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              BPM is approximate here. Klangkurator reads tempo off a fixed grid of{" "}
              <span className="k-num">{Math.round(report.grid.constant * 100) / 100}</span> ÷ k, and{" "}
              {report.grid.onGrid} of {report.grid.distinct} distinct BPM values in this library sit on it. A hole
              between two grid points is therefore partly the analyser’s resolution, not only a thin patch in the
              collection.
            </p>
          ) : null}

          {report.regions.length === 0 ? (
            <p className="mt-5 max-w-prose text-[13px] text-muted-foreground">
              No thin region. Every stretch that holds little is next to a side that holds little too.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {report.regions.map((region) => (
                <RegionRow key={region.from} region={region} report={report} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The library gap report (issue #9, REQ-9-GR): where the collection is thin in
 * one dimension at a time, read-only and unweighted.
 */
export default function LibraryGaps() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      setSongs(await storage.getSongs());
      setStatus("ready");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "unknown error");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reports = useMemo(() => reportLibraryGaps(songs), [songs]);
  const ready = status === "ready";
  const anyRegion = reports.some((report) => report.regions.length > 0);

  return (
    <div className="min-h-full">
      <PageHeader
        title="Gaps"
        meta={ready ? (songs.length === 1 ? "1 track" : `${songs.length} tracks`) : undefined}
      />

      {status === "error" ? (
        <EmptyState
          title="The report didn’t load."
          body={`Klangkurator couldn't reach its backend: ${loadError}. Check that the app is running (./run.sh status), then try again.`}
          action={<Button onClick={() => load()}>Try again</Button>}
          arrangement="split"
        />
      ) : status === "loading" ? (
        <div role="status" aria-label="Loading the gap report" className="max-w-3xl space-y-4 px-5 py-7 md:px-8">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <EmptyState
          title="No tracks to measure."
          body="The report counts where your collection is thin. Import some music first, and it will show you the shape of what you have."
          arrangement="stack"
        />
      ) : (
        <div className="max-w-3xl px-5 pb-10 md:px-8">
          <p className="mt-6 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
            The four dimensions below bucket the library and report the stretches that hold almost nothing while
            both sides hold a lot. It counts what you have. It does not ask what you want, and it changes nothing.
          </p>

          {!anyRegion ? (
            <p className="mt-5 max-w-prose rounded-lg border border-dashed border-border p-5 text-[13px] leading-relaxed">
              No thin region in any dimension. BPM, energy, year and playtime all hold up across the range your
              library covers.
            </p>
          ) : null}

          <div className="mt-7">
            {reports.map((report) => (
              <DimensionSection key={report.dimension} report={report} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
