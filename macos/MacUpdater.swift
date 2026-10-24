import AppKit
import WebKit
import Sparkle

@MainActor final class MacUpdater: NSObject, SPUUpdaterDelegate {
    weak var webView: WKWebView?
    var controller: SPUStandardUpdaterController!
    var timer: Timer?
    var hasDraft = true
    var postponedInstallation: (() -> Void)?
    var phase = "idle"
    var available: String?
    var failure: String?
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"

    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
        do { try controller.updater.start() }
        catch { phase = "error"; failure = "Update checks could not start. Reopen Subloom and try again." }
        if phase != "error" {
            DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in _ = self?.check() }
            timer = Timer.scheduledTimer(withTimeInterval: 24 * 3600, repeats: true) { [weak self] _ in
                Task { @MainActor in _ = self?.check() }
            }
        }
    }
    var state: [String: Any] {
        ["supported": true, "status": phase, "currentVersion": version,
         "availableVersion": available as Any? ?? NSNull(), "progress": NSNull(), "error": failure as Any? ?? NSNull()]
    }
    func publish() {
        guard let webView else { return }
        let snapshot = state
        Task { @MainActor in
            _ = try? await webView.callAsyncJavaScript("window.dispatchEvent(new CustomEvent('subloom-update-state', {detail: state}))",
                                                      arguments: ["state": snapshot], in: nil, contentWorld: .page)
        }
    }
    func check() -> [String: Any] {
        guard controller.updater.canCheckForUpdates, phase != "ready" else { return state }
        phase = "checking"; failure = nil; publish()
        controller.updater.checkForUpdateInformation()
        return state
    }
    @objc func showUpdates() {
        guard !hasDraft else {
            let alert = NSAlert(); alert.messageText = "Save your changes first"; alert.informativeText = "Save or discard the open draft before updating Subloom."; alert.runModal(); return
        }
        if let install = postponedInstallation { postponedInstallation = nil; install(); return }
        guard controller.updater.canCheckForUpdates else { return }
        failure = nil
        controller.checkForUpdates(nil)
    }
    func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem, untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        guard hasDraft else { return false }
        postponedInstallation = installHandler; phase = "ready"
        failure = "Save or discard your changes, then continue the update from Settings."; publish()
        return true
    }
    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        available = item.displayVersionString; phase = "available"; failure = nil; publish()
    }
    func updaterDidNotFindUpdate(_ updater: SPUUpdater) {
        phase = "current"; available = nil; failure = nil; publish()
    }
    func updater(_ updater: SPUUpdater, didDownloadUpdate item: SUAppcastItem) {
        phase = "ready"; publish()
    }
    func updater(_ updater: SPUUpdater, willInstallUpdate item: SUAppcastItem) {
        phase = "installing"; publish()
    }
    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        let reason = error as NSError
        if reason.domain == SUSparkleErrorDomain && reason.code == Int(SUError.noUpdateError.rawValue) {
            phase = "current"; available = nil; failure = nil; publish(); return
        }
        if reason.domain == SUSparkleErrorDomain && reason.code == Int(SUError.installationCanceledError.rawValue) {
            phase = available == nil ? "idle" : "available"; failure = nil; publish(); return
        }
        phase = "error"; failure = "The update could not be completed. Your installed app and saved data are unchanged. Try again later."; publish()
    }
    func updater(_ updater: SPUUpdater, didFinishUpdateCycleFor updateCheck: SPUUpdateCheck, error: Error?) {
        if phase == "checking" { phase = error == nil ? "current" : "error"; publish() }
    }
}
