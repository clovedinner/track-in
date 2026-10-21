import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/about",
    "/features",
    "/pricing",
    "/docs",
    "/articles",
    "/articles/why-the-click-id-matters",
  ].map((path) => ({
    url: `https://trakio.org${path}`,
  }));
}
