import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.nettmark.com";
  const now = new Date();

  const routes = [
    "",
    "/for-businesses",
    "/for-partners",
    "/pricing",
    "/commission-ads",
    "/login",
    "/create-account",
  ];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "/commission-ads" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/commission-ads" ? 0.9 : 0.7,
  }));
}
