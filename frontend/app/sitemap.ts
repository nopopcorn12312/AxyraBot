import type { MetadataRoute } from "next";
import { seoLandingPages, siteUrl } from "./seo-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const landingPages: MetadataRoute.Sitemap = Object.values(seoLandingPages).map(({ slug }) => ({
    url: `${siteUrl}/${slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  return [...landingPages, { url: `${siteUrl}/docs`, changeFrequency: "monthly", priority: 0.7 }];
}
