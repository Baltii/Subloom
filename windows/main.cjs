const {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  session,
  shell,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  APP_URL,
  isAppURL,
  externalURL,
  bundledFile,
  createAuthBroker,
} = require("./runtime.cjs");
const smokeMode = process.argv
  .find((arg) => /^--smoke-test=(write|read)$/.test(arg))
  ?.split("=")[1];
if (smokeMode && process.env.SUBLOOM_SMOKE_USER_DATA)
  app.setPath("userData", process.env.SUBLOOM_SMOKE_USER_DATA);
app.setName("Subloom");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "subloom-app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const auth = createAuthBroker((url) => shell.openExternal(url));
let window;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    const callback = argv.find((arg) => arg.startsWith("subloom://"));
    if (callback) auth.complete(callback);
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => auth.cancel());
  app
    .whenReady()
    .then(async () => {
      if (process.platform === "win32" && app.isPackaged && !smokeMode) {
        app.setAppUserModelId("com.subloom.windows");
        app.setAsDefaultProtocolClient("subloom");
      }
      const store = session.fromPartition("persist:subloom");
      store.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      store.setPermissionCheckHandler(() => false);
      store.protocol.handle("subloom-app", async (request) => {
        if (!["GET", "HEAD"].includes(request.method))
          return new Response(null, { status: 405 });
        const file = bundledFile(request.url, path.join(__dirname, "web"));
        if (!file) return new Response(null, { status: 404 });
        try {
          const response = await net.fetch(pathToFileURL(file).href);
          const headers = new Headers(response.headers);
          headers.set("X-Content-Type-Options", "nosniff");
          headers.set("Referrer-Policy", "no-referrer");
          headers.set(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'",
          );
          return new Response(
            request.method === "HEAD" ? null : response.body,
            { status: response.status, headers },
          );
        } catch {
          return new Response(null, { status: 404 });
        }
      });
      window = new BrowserWindow({
        title: "Subloom",
        width: 1280,
        height: 860,
        minWidth: 390,
        minHeight: 600,
        backgroundColor: "#F8FAF8",
        icon: path.join(__dirname, "icon.png"),
        autoHideMenuBar: true,
        show: !smokeMode,
        webPreferences: {
          session: store,
          preload: path.join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      });
      const openLink = (url) => {
        const target = externalURL(url);
        if (target) void shell.openExternal(target).catch(() => {});
      };
      if (smokeMode) {
        window.webContents.on("console-message", (details) => {
          if (details.level === "error") console.error(details.message);
        });
      }
      window.webContents.setWindowOpenHandler(({ url }) => {
        openLink(url);
        return { action: "deny" };
      });
      window.webContents.on("will-navigate", (event, url) => {
        if (!isAppURL(url)) {
          event.preventDefault();
          openLink(url);
        }
      });
      window.webContents.on("will-redirect", (event, url) => {
        if (!isAppURL(url)) event.preventDefault();
      });
      window.webContents.on("will-attach-webview", (event) =>
        event.preventDefault(),
      );
      window.webContents.on(
        "did-start-navigation",
        (_event, _url, inPlace, mainFrame) => {
          if (mainFrame && !inPlace) auth.cancel();
        },
      );
      window.on("closed", () => {
        auth.cancel();
        window = null;
      });
      store.on("will-download", (_event, item) => {
        item.setSaveDialogOptions({
          title: "Save Subloom export",
          defaultPath: path.join(
            app.getPath("downloads"),
            path.basename(item.getFilename()),
          ),
        });
      });
      ipcMain.handle("subloom:auth", (event, url, redirect) => {
        if (
          event.sender !== window?.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          !isAppURL(event.senderFrame.url)
        )
          throw new Error("Sign-in must start in the Subloom app.");
        return auth.open(url, redirect);
      });
      await window.loadURL(APP_URL);
      if (smokeMode) {
        const result = await window.webContents
          .executeJavaScript(`(async () => {
          const until = async (check, label) => {
            const deadline = Date.now() + 30000;
            while (!check()) {
              if (Date.now() > deadline) throw new Error("App did not reach " + label);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          };
          const snapshot = () => JSON.parse(localStorage.getItem("subloom:v1:guest") || "null");
          if (typeof require !== "undefined" || !globalThis.subloomWindows?.openAuth) throw new Error("Renderer isolation failed");
          if (${JSON.stringify(smokeMode)} === "write") {
            await until(() => document.querySelector('[data-testid="onboarding-next"]'), "welcome screen");
            document.querySelector('[data-testid="onboarding-next"]').click();
            await until(() => document.body.innerText.includes("Step 2 of 3"), "second welcome step");
            document.querySelector('[data-testid="onboarding-next"]').click();
            await until(() => document.querySelector('[data-testid="get-started"]'), "guest setup");
            document.querySelector('[data-testid="get-started"]').click();
          }
          await until(() => snapshot()?.onboarded === true && document.body.innerText.includes("Your subscriptions, at a glance."), "saved guest dashboard");
          if (snapshot().schemaVersion !== 1) throw new Error("Guest workspace did not persist");
          const route = await fetch("/settings");
          if (!route.ok || !(await route.text()).includes("<html")) throw new Error("SPA route failed");
          if ((await fetch("/missing.js")).status !== 404) throw new Error("Missing asset should fail");
          return true;
        })()`);
        if (!result) throw new Error("Windows smoke test failed");
        store.flushStorageData();
        await store.cookies.flushStore();
        app.quit();
      }
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
}
