import { describe, it, expect } from "vitest";
import { escapeHtml } from "../escape-html";

describe("escapeHtml", () => {
  it("escapes markup so no tag survives", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml(`<a href='x'>`)).toBe("&lt;a href=&#039;x&#039;&gt;");
  });

  it("escapes a bare ampersand", () => {
    expect(escapeHtml("AT&T & co")).toBe("AT&amp;T &amp; co");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  // UAT SEC-009: stored text keeps a typed `<` / `>` as `&lt;` / `&gt;`.
  it("keeps stored &lt; and &gt; so the reader sees < and >", () => {
    expect(escapeHtml(`Tom's drill & "saw" &lt;3 5 &gt; 4`)).toBe(
      "Tom&#039;s drill &amp; &quot;saw&quot; &lt;3 5 &gt; 4",
    );
  });

  it("never lets stored entities rebuild a tag", () => {
    expect(escapeHtml("&lt;a href=x&gt;<b>")).toBe("&lt;a href=x&gt;&lt;b&gt;");
  });
});
