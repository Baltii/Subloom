const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("wasm");

function projectDirectory(name) {
  const directory = path
    .join(__dirname, name)
    .split(path.sep)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[/\\\\]");
  return new RegExp(`^${directory}(?:[/\\\\]|$)`);
}

// Expo's development env context matches every `.env*` file, but its
// transformer only parses these standard variants. Keep custom/private files
// out of that context while preserving public env updates during Fast Refresh.
config.resolver.blockList = [
  ...[config.resolver.blockList].flat().filter(Boolean),
  /(?:^|[/\\])\.env(?!(?:\.(?:local|(?:development|production)(?:\.local)?))?$)[^/\\]*$/,
  projectDirectory("build"),
  projectDirectory("supabase"),
];
module.exports = config;
