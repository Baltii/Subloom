import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  devIndicators: false,
};

export default config;
