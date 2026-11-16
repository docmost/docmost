// @vitest-environment node
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const runNode = promisify(execFile);
const fixture = fileURLToPath(
  new URL("./fixtures/collaboration-view-retention.cjs", import.meta.url),
);

describe("collaboration view retention", () => {
  it.each(["import", "require"])(
    "releases a destroyed view while its sync plugin is retained (%s)",
    async (moduleLoader) => {
      // A separate process allows real GC without references held by the test runner.
      const { stdout } = await runNode(
        process.execPath,
        ["--no-webstorage", "--expose-gc", fixture, moduleLoader],
        { timeout: 10_000 },
      );

      expect(JSON.parse(stdout)).toEqual({
        pluginRetained: true,
        viewRetained: false,
        domRetained: false,
      });
    },
    15_000,
  );
});
