import { importLink, readCapped, readSpecSource, specSourceOf, withoutSpec } from "./importLink";
import { EXAMPLE_SPEC } from "./spec";

const SITE = "https://builder.pyrevitlabs.io/";

describe("import link", () => {
  it("round-trips a spec through a link", async () => {
    const link = importLink(EXAMPLE_SPEC, SITE);
    const source = specSourceOf(link);
    expect(source?.kind).toBe("inline");
    const result = await readSpecSource(source ?? { kind: "inline", text: "" });
    expect(result.errors).toEqual([]);
    expect(result.layout?.extensionName).toBe("Acme Tools");
  });

  it("reads raw JSON as a person pastes it, & and spaces included", async () => {
    const source = specSourceOf(
      `${SITE}#spec={"name":"A & B","tabs":[{"name":"T","panels":[{"name":"P","items":[]}]}]}`,
    );
    const result = await readSpecSource(source ?? { kind: "inline", text: "" });
    expect(result.layout?.extensionName).toBe("A & B");
  });

  it("reads base64url", async () => {
    const json = JSON.stringify({
      name: "Été",
      tabs: [{ name: "T", panels: [{ name: "P", items: [] }] }],
    });
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const result = await readSpecSource(
      specSourceOf(`${SITE}#spec=${b64}`) ?? { kind: "inline", text: "" },
    );
    expect(result.layout?.extensionName).toBe("Été");
  });

  it("finds spec_url and refuses plain http", async () => {
    expect(specSourceOf(`${SITE}?spec_url=https%3A%2F%2Fx.io%2Fa.json`)).toEqual({
      kind: "url",
      url: "https://x.io/a.json",
    });
    const result = await readSpecSource({ kind: "url", url: "http://x.io/a.json" });
    expect(result.errors[0]?.message).toMatch(/https/);
    expect(specSourceOf(`${SITE}?theme=pyrevit#other=1`)).toBeNull();
  });

  it("drops the spec from the URL, keeping the rest", () => {
    expect(withoutSpec(`${SITE}?theme=pyrevit#spec={}`)).toBe(`${SITE}?theme=pyrevit`);
    expect(withoutSpec(`${SITE}?spec_url=https%3A%2F%2Fx.io&theme=dark`)).toBe(
      `${SITE}?theme=dark`,
    );
  });

  it("stops reading a hosted spec past the cap, whatever Content-Length says", async () => {
    const big = new Response("x".repeat(1000));
    expect(await readCapped(big, 999)).toBeNull();
    expect(await readCapped(new Response("{}"), 999)).toBe("{}");
  });
});
