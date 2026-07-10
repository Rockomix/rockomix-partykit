import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/party/", "/join/"],
    },
    sitemap: "https://www.mykaraoke.party/sitemap.xml",
  };
}
