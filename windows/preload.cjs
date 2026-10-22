const { contextBridge, ipcRenderer } = require("electron");
// Expose one bounded operation, never Node, arbitrary IPC, or filesystem access.
contextBridge.exposeInMainWorld("subloomWindows", {
  version: 1,
  openAuth: (url, redirect) =>
    ipcRenderer.invoke("subloom:auth", url, redirect),
});
