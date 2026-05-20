import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "家庭中控",
    short_name: "家庭中控",
    description: "家庭記帳、待辦事項、帳單提醒、保養提醒與雲端同步。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff45f",
    theme_color: "#fff45f",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
