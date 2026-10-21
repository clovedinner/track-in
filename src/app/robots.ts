import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/payment-done",
        "/t/",
        "/postback",
        "/g/",
      ],
    },
    sitemap: "https://trakio.org/sitemap.xml",
  };
}
