import AppKit
import WebKit
import Network

// Serves only the bundled public web export. No native JS bridge or privileged data endpoints.
final class BundleServer {
    let port: NWEndpoint.Port = 48187
    let root: URL
    var listener: NWListener?
    let queue = DispatchQueue(label: "app.subloom.static-server")
    init(root: URL) { self.root = root.standardizedFileURL }
    func start(ready: @escaping () -> Void, failed: @escaping () -> Void) {
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: .ipv4(.loopback), port: port)
            let listener = try NWListener(using: parameters)
            self.listener = listener
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready: DispatchQueue.main.async(execute: ready)
                case .failed: DispatchQueue.main.async(execute: failed)
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                guard let self else { connection.cancel(); return }
                connection.start(queue: self.queue)
                self.read(connection, buffer: Data())
                self.queue.asyncAfter(deadline: .now() + 5) { connection.cancel() }
            }
            listener.start(queue: queue)
        } catch { DispatchQueue.main.async(execute: failed) }
    }
    private func read(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, complete, error in
            guard let self else { connection.cancel(); return }
            var bytes = buffer
            if let data { bytes.append(data) }
            guard bytes.count <= 8192, error == nil else { connection.cancel(); return }
            if let text = String(data: bytes, encoding: .utf8), text.contains("\r\n\r\n") {
                self.respond(connection, request: text)
            } else if !complete { self.read(connection, buffer: bytes) }
            else { connection.cancel() }
        }
    }
    private func respond(_ connection: NWConnection, request: String) {
        let lines = request.components(separatedBy: "\r\n")
        let first = (lines.first ?? "").split(separator: " ")
        let host = lines.first { $0.lowercased().hasPrefix("host:") }?.dropFirst(5).trimmingCharacters(in: .whitespaces)
        guard first.count == 3, ["GET", "HEAD"].contains(String(first[0])), host == "127.0.0.1:48187" else {
            send(connection, status: "403 Forbidden", mime: "text/plain", body: Data("Request rejected".utf8)); return
        }
        let rawPath = String(first[1]).components(separatedBy: "?")[0]
        guard let path = rawPath.removingPercentEncoding, path.hasPrefix("/"), !path.contains("\0"), !path.contains("\\"),
              !path.split(separator: "/").contains("..") else {
            send(connection, status: "400 Bad Request", mime: "text/plain", body: Data()); return
        }
        var file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/") || file == root else {
            send(connection, status: "403 Forbidden", mime: "text/plain", body: Data()); return
        }
        if file == root || (!FileManager.default.fileExists(atPath: file.path) && file.pathExtension.isEmpty) {
            file = root.appendingPathComponent("index.html") // Expo Router SPA deep links.
        }
        guard let data = try? Data(contentsOf: file) else {
            send(connection, status: "404 Not Found", mime: "text/plain", body: Data()); return
        }
        let mime = ["html":"text/html; charset=utf-8", "js":"text/javascript", "css":"text/css", "json":"application/json",
                    "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "svg":"image/svg+xml", "ico":"image/x-icon",
                    "ttf":"font/ttf", "woff":"font/woff", "woff2":"font/woff2", "webp":"image/webp"][file.pathExtension] ?? "application/octet-stream"
        send(connection, status: "200 OK", mime: mime, body: data, head: first[0] == "HEAD")
    }
    private func send(_ connection: NWConnection, status: String, mime: String, body: Data, head: Bool = false) {
        let headers = "HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nConnection: close\r\n\r\n"
        var response = Data(headers.utf8)
        if !head { response.append(body) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var server: BundleServer!
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu(), appItem = NSMenuItem(), appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Subloom", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Subloom", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu; menu.addItem(appItem)
        let editItem = NSMenuItem(), editMenu = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            editMenu.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        editItem.submenu = editMenu; menu.addItem(editItem); NSApp.mainMenu = menu
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1200, height: 820), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Subloom — Mac test app"
        window.minSize = NSSize(width: 390, height: 600)
        window.center(); window.setFrameAutosaveName("SubloomMainWindow")
        let config = WKWebViewConfiguration(); config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self; webView.uiDelegate = self
        window.contentView = webView; window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web"), FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            fail("The bundled app files are missing. Rebuild with npm run build:macos."); return
        }
        server = BundleServer(root: root)
        server.start(ready: { [weak self] in self?.webView.load(URLRequest(url: URL(string: "http://127.0.0.1:48187/")!)) },
                     failed: { [weak self] in self?.fail("The local app port is unavailable. Quit other copies of Subloom and reopen this app.") })
    }
    @objc func about() {
        let alert = NSAlert(); alert.messageText = "Subloom for Mac"
        alert.informativeText = "A standalone macOS test shell with the bundled Subloom web app and configured Supabase connection. Mobile push, native SQLite and mobile permissions require the iOS/Android builds. No Metro server is needed."
        alert.runModal()
    }
    func fail(_ message: String) { let alert = NSAlert(); alert.messageText = "Subloom could not open"; alert.informativeText = message; alert.runModal() }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { server?.listener?.cancel() }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if url.scheme == "http", url.host == "127.0.0.1", url.port == 48187 { decisionHandler(.allow); return }
        if url.scheme == "blob" || url.absoluteString == "about:blank" { decisionHandler(.allow); return }
        if ["https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["https", "mailto"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.canChooseFiles = true; panel.canChooseDirectories = false; panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = URL(fileURLWithPath: suggestedFilename).lastPathComponent
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail("The local interface could not load. Quit and reopen Subloom.") }
}
MainActor.assumeIsolated {
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.run()
}
