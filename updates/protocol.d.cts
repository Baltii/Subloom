export type UpdatePlatform =
  "windows-x64" | "macos-arm64" | "macos-x64" | "android-test";
export type ReleaseAsset = {
  platform: UpdatePlatform;
  name: string;
  url: string;
  size: number;
  sha256: string;
  signature: string;
};
export type AppRelease = {
  schema: 1;
  version: string;
  commit: string;
  publishedAt: string;
  assets: ReleaseAsset[];
};
export const REPOSITORY: string;
export const FEED_URL: string;
export const VERSION: RegExp;
export const PLATFORMS: UpdatePlatform[];
export function newerVersion(candidate: string, installed: string): boolean;
export function validateRelease(input: unknown): AppRelease;
export function parseEnvelope(text: string): {
  payload: string;
  signature: string;
};
