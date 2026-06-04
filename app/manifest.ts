import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "International Regie",
    short_name: "IR",
    description: "Internationale Regieberichte mit Übersetzung und PDF-Erstellung",
    start_url: "/",
    display: "standalone",
    background_color: "#001B5C",
    theme_color: "#001B5C",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
