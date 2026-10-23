const path = require("node:path");
const {
  version: electronVersion,
} = require("./node_modules/electron/package.json");
module.exports = {
  appId: "com.subloom.windows",
  productName: "Subloom",
  electronVersion,
  directories: { output: path.resolve(__dirname, "../build/windows") },
  files: [
    "main.cjs",
    "preload.cjs",
    "runtime.cjs",
    "notifications.cjs",
    "web/**/*",
    "icon.png",
  ],
  asar: true,
  npmRebuild: false,
  // Keep the existing subloom:// auth callback shared with mobile and Mac.
  protocols: [{ name: "Subloom", schemes: ["subloom"] }],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    icon: path.resolve(__dirname, "../assets/icon.png"),
    artifactName: "Subloom-${version}-windows-${arch}-setup.${ext}",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
