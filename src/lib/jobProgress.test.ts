import { describe, expect, it } from "vitest";

import { isImportPage, runEnd } from "./jobProgress";

describe("isImportPage", () => {
  it("matches the Import page with and without a trailing slash", () => {
    expect(isImportPage("/load-files")).toBe(true);
    expect(isImportPage("/load-files/")).toBe(true);
  });

  it("does not match any other page", () => {
    for (const path of ["/", "/map", "/load-files-old", "/load-files/x", "/sets/load-files"]) {
      expect(isImportPage(path)).toBe(false);
    }
  });
});

describe("runEnd", () => {
  it("is failed when the job reports an error", () => {
    expect(runEnd({ finished: true, error: "disk full", result: null })).toBe("failed");
  });

  it("is finished when the job finished with a result", () => {
    expect(runEnd({ finished: true, error: null, result: { total: 3 } })).toBe("finished");
  });

  it("is vanished when neither a result nor an error came back", () => {
    // A restarted backend answers with its idle state.
    expect(runEnd({ finished: false, error: null, result: null })).toBe("vanished");
  });
});
