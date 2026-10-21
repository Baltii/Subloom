import type { ExpoConfig } from "expo/config";
import { existsSync } from "node:fs";
import { version } from "./package.json";

const config: ExpoConfig = {
  name: "Subloom",
  slug: "subloom",
  version,
  scheme: "subloom",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.subloom.app",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.subloom.app",
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ||
      (existsSync("google-services.json")
        ? "./google-services.json"
        : undefined),
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      monochromeImage: "./assets/monochrome-icon.png",
      backgroundColor: "#087C65",
    },
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/icon.png",
    name: "Subloom",
    description: "A little clarity for your recurring world.",
  },
  plugins: [
    "expo-router",
    "expo-web-browser",
    "expo-secure-store",
    "expo-sqlite",
    "expo-notifications",
    "expo-font",
    "expo-dev-client",
    "expo-status-bar",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-mark.png",
        imageWidth: 120,
        backgroundColor: "#F8FAF8",
        dark: {
          image: "./assets/splash-mark-dark.png",
          backgroundColor: "#101A16",
        },
      },
    ],
    "expo-image",
    "expo-sharing",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose a receipt screenshot to review a possible subscription.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  extra: { eas: { projectId: "5fb4e136-7628-472b-8345-8d194255754d" } },
};
export default config;
