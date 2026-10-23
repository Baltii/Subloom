const { contextBridge, ipcRenderer } = require("electron");
// Expose bounded operations, never Node, arbitrary IPC, or filesystem access.
contextBridge.exposeInMainWorld("subloomWindows", {
  version: 1,
  openAuth: (url, redirect) =>
    ipcRenderer.invoke("subloom:auth", url, redirect),
  cancelAuth: () => ipcRenderer.invoke("subloom:auth-cancel"),
  notifications: {
    activate: (identity) =>
      ipcRenderer.invoke("subloom:notification-activate", identity),
    enable: (identity, enabled) =>
      ipcRenderer.invoke("subloom:notification-enable", identity, enabled),
    replace: (identity, requests) =>
      ipcRenderer.invoke("subloom:notification-replace", identity, requests),
    test: (identity) =>
      ipcRenderer.invoke("subloom:notification-test", identity),
    openSettings: () => ipcRenderer.invoke("subloom:notification-settings"),
    onClick: (listener) => {
      const receive = (_event, response) => listener(response);
      ipcRenderer.on("subloom:notification-click", receive);
      return () =>
        ipcRenderer.removeListener("subloom:notification-click", receive);
    },
  },
});
