import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },

  async headers() {
    return [
      {
        // All routes pe apply karo
        source: "/(.*)",
        headers: [
          {
            // ✅ COOP fix — Google Sign-In popup allow karo
            // "same-origin-allow-popups" means:
            // - Same origin requests: full access
            // - Cross-origin popups (Google login): allowed
            key:   "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;