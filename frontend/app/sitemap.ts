import type { MetadataRoute } from "next";
import { seoLandingPages, siteUrl } from "./seo-content";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(seoLandingPages).map(({ slug }) => ({
    url: `${siteUrl}/${slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
}
