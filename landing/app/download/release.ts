// The public GitHub release is the source of truth. Never hardcode versioned asset URLs.
const latestReleaseApi = "https://api.github.com/repos/Baltii/Subloom/releases/latest";
const releaseAssetPath = "/Baltii/Subloom/releases/download/";

export type InstallAsset = {
  name: string;
  url: string;
  size: number;
  checksumUrl: string | null;
};

export type LatestRelease = {
  tag: string;
  publishedAt: string | null;
  url: string;
  android: InstallAsset | null;
  macArm: InstallAsset | null;
  macIntel: InstallAsset | null;
  windows: InstallAsset | null;
};

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size: number;
};

function isGithubAsset(value: unknown): value is GithubAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<GithubAsset>;
  if (typeof asset.name !== "string" ||
      typeof asset.browser_download_url !== "string" ||
      typeof asset.size !== "number" || !Number.isFinite(asset.size) || asset.size < 0) return false;

  try {
    const url = new URL(asset.browser_download_url);
    return url.origin === "https://github.com" && url.pathname.startsWith(releaseAssetPath);
  } catch {
    return false;
  }
}

function findInstaller(assets: GithubAsset[], pattern: RegExp): InstallAsset | null {
  const file = assets.find(asset => pattern.test(asset.name));
  if (!file) return null;
  const checksum = assets.find(asset => asset.name === file.name + ".sha256");
  return {
    name: file.name,
    url: file.browser_download_url,
    size: file.size,
    checksumUrl: checksum?.browser_download_url ?? null,
  };
}

export async function getLatestRelease(): Promise<LatestRelease | null> {
  try {
    // Next.js refreshes this cached API response every minute, so a new GitHub
    // release automatically replaces old installer links without redeployment.
    const response = await fetch(latestReleaseApi, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Subloom-landing" },
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const release = data as Record<string, unknown>;
    if (typeof release.tag_name !== "string" ||
        typeof release.html_url !== "string" ||
        !Array.isArray(release.assets)) return null;

    const assets = release.assets.filter(isGithubAsset);
    return {
      tag: release.tag_name,
      publishedAt: typeof release.published_at === "string" ? release.published_at : null,
      url: release.html_url,
      android: findInstaller(assets, /android.*\.apk$/i),
      macArm: findInstaller(assets, /macos[-_](?:arm64|aarch64)\.(?:zip|dmg)$/i),
      macIntel: findInstaller(assets, /macos[-_](?:x64|amd64|x86_64)\.(?:zip|dmg)$/i),
      windows: findInstaller(assets, /windows.*(?:setup|installer)\.exe$/i),
    };
  } catch {
    // A temporary GitHub API error must never become a broken download URL.
    return null;
  }
}
