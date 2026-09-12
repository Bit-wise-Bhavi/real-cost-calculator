import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Real Cost",
        short_name: "Real Cost",
        description: "Understand where your money goes.",
        start_url: "/",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#020617",
        orientation: "portrait",
        icons: [
            {
                src: "/image1.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/image.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
    };
}