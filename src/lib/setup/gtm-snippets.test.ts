import { describe, expect, it } from "vitest";

import { generateDefaultGtmSnippets, generateGtmSnippets } from "./gtm-snippets";

describe("GTM Voluum-compatible snippet generation", () => {
  it("generates copyable registration and FTD image/HTML snippets", () => {
    const result = generateDefaultGtmSnippets("https://tracker.example.test/");

    expect(result.postbackPath).toBe("/postback");
    expect(result.snippets.map((snippet) => snippet.label)).toEqual([
      "Registration",
      "First-time deposit (FTD)",
    ]);
    expect(result.snippets[0]?.imageUrl).toBe(
      "https://tracker.example.test/postback?cid={{ClickID}}&et=reg",
    );
    expect(result.snippets[0]?.html).toContain('src="https://tracker.example.test/postback?cid={{ClickID}}&amp;et=reg"');
  });

  it("preserves GTM variables and URI-encodes static and dynamic query values", () => {
    const result = generateGtmSnippets({
      trackerBaseUrl: "https://tracker.example.test/base?secret=must-not-survive",
      cidVariable: "{{ Click ID }}",
      events: [
        {
          label: "FTD & deposit",
          eventType: "ftd",
          txidVariable: "{{Transaction ID}}",
          payoutVariable: "{{Payout Value}}",
          currencyVariable: "{{Currency}}",
        },
      ],
    });
    const snippet = result.snippets[0];
    expect(snippet?.imageUrl).toBe(
      "https://tracker.example.test/postback?cid={{%20Click%20ID%20}}&et=ftd&txid={{Transaction%20ID}}&payout={{Payout%20Value}}&currency={{Currency}}",
    );
    expect(snippet?.label).toBe("FTD & deposit");
    expect(snippet?.imageUrl).not.toContain("secret");
    expect(snippet?.html).not.toContain("secret");
  });

  it("supports a unique txid event without adding credentials", () => {
    const result = generateGtmSnippets({
      trackerBaseUrl: "https://tracker.example.test",
      events: [{ label: "Purchase", eventType: "purchase", txidVariable: "{{Order ID}}" }],
    });
    expect(result.snippets[0]?.imageUrl).toContain("et=purchase");
    expect(result.snippets[0]?.imageUrl).toContain("txid={{Order%20ID}}");
    expect(result.snippets[0]?.html).not.toMatch(/authorization|bearer|secret|token/i);
  });

  it("rejects unsafe tracker URLs and invalid event types", () => {
    expect(() => generateDefaultGtmSnippets("javascript:alert(1)")).toThrow(/HTTP or HTTPS/);
    expect(() => generateGtmSnippets({
      trackerBaseUrl: "https://tracker.example.test",
      events: [{ label: "Bad", eventType: "ftd&bad" }],
    })).toThrow(/event type/);
  });
});
