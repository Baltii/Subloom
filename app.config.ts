import type { ExpoConfig } from "expo/config";
import { existsSync } from "node:fs";
import { version } from "./package.json";
const githubApk =
  process.env.EXPO_PUBLIC_ANDROID_UPDATE_CHANNEL === "github-test";
const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
const androidVersionCode = major * 1_000_000 + minor * 1000 + patch;
if (
  !Number.isSafeInteger(androidVersionCode) ||
  androidVersionCode > 2_100_000_000
)
  throw new Error(
    "The Android release version is outside the supported range.",
  );

const config: ExpoConfig = {
  name: "Subloom",
  slug: "subloom",
  version,
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    url: "https://u.expo.dev/5fb4e136-7628-472b-8345-8d194255754d",
    enabled: !githubApk,
    checkAutomatically: "NEVER",
    fallbackToCacheTimeout: 0,
  },
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
    versionCode: androidVersionCode,
    permissions: githubApk
      ? ["android.permission.REQUEST_INSTALL_PACKAGES"]
      : [],
    blockedPermissions: githubApk
      ? []
      : ["android.permission.REQUEST_INSTALL_PACKAGES"],
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
    "expo-updates",
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
  extra: {
    androidUpdateChannel: githubApk ? "github-test" : "store",
    eas: { projectId: "5fb4e136-7628-472b-8345-8d194255754d" },
  },
};
export default config;
