import { execFileSync } from "node:child_process";
import { TYPES } from "./bundleTypes";
import { defaultScript, pyString } from "./templates";

const python = (() => {
  try {
    execFileSync("python3", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

const HOSTILE = [
  "Renumber\nSheets",
  'Say "Hi"',
  'x"\nimport os\nos.system("calc")\n#',
  'Back\\slash """ and   line',
];

describe("starter scripts", () => {
  it("hold titles and authors as Python string literals", () => {
    for (const text of HOSTILE) {
      const script = defaultScript(
        { type: "toggle", name: "T", title: text, author: text },
        TYPES.toggle,
      );
      expect(script).toContain(`__title__ = ${pyString(text)}`);
      expect(script).not.toMatch(/^import os/m);
    }
  });

  it.runIf(python)("are valid Python whatever the title or author", () => {
    for (const type of ["pushbutton", "toggle"] as const) {
      for (const text of HOSTILE) {
        const script = defaultScript({ type, name: "B", title: text, author: text }, TYPES[type]);
        // Parses without running: a SyntaxError makes python exit non-zero.
        execFileSync("python3", ["-I", "-c", "import ast,sys; ast.parse(sys.stdin.read())"], {
          input: script,
        });
      }
    }
  });
});
