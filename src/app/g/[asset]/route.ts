import { NextResponse } from "next/server";

const loader = `(() => {
  const key = "trackin_cid";
  const params = new URLSearchParams(window.location.search);
  const cid = params.get("cid");
  if (cid) {
    window.localStorage.setItem(key, cid);
    document.cookie = key + "=" + encodeURIComponent(cid) + "; Max-Age=2592000; Path=/; SameSite=Lax" + (window.location.protocol === "https:" ? "; Secure" : "");
  }
  const stored = window.localStorage.getItem(key);
  window.trackIn = window.trackIn || {};
  window.trackIn.cid = cid || stored || null;
})();`;

export function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  return context.params.then(({ asset }) => {
    if (asset !== ".js") return new NextResponse("Not found.", { status: 404 });
    return new NextResponse(loader, {
      headers: {
        "cache-control": "public, max-age=300",
        "content-type": "application/javascript; charset=utf-8",
      },
    });
  });
}
