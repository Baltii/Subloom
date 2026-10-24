import type { Metadata } from "next";
import { ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ExternalLink, Globe2, Laptop2, MonitorDown, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { Brand } from "../../components/brand";
import { Navigation } from "../../components/experience";
import { getLatestRelease, type InstallAsset } from "./release";
import "./download.css";

const webAppUrl = "https://subloom.baltii.tn";
const releasesUrl = "https://github.com/Baltii/Subloom/releases/latest";

export const metadata: Metadata = {
  title: "Download Subloom — Android, macOS, Windows or Web",
  description: "Get the latest Subloom release for Android, macOS or Windows, or open Subloom right in your browser.",
  alternates: { canonical: "/download" },
};

function formatSize(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatReleaseDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function DownloadAction({ asset, label }: { asset: InstallAsset | null; label: string }) {
  if (!asset) return <span className="download-action download-action-unavailable" role="status">Not available in this release</span>;
  return <a className="download-action" href={asset.url} title={asset.name}>
    <span><strong>{label}</strong><small>{formatSize(asset.size)} · Direct download</small></span>
    <ArrowDownToLine size={19} aria-hidden="true"/>
  </a>;
}

export default async function DownloadPage() {
  const release = await getLatestRelease();
  const releaseDate = formatReleaseDate(release?.publishedAt ?? null);
  const androidTest = release?.android && /(?:^|[-_])test(?:[._-]|$)/i.test(release.android.name);

  return <div className="downloads-page" id="top">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header container"><Brand/><Navigation downloadPage/></header>
    <main id="main">
      <section className="download-hero container" aria-labelledby="download-title">
        <div className="download-hero-glow" aria-hidden="true"/>
        <span className="download-eyebrow"><Sparkles size={15} aria-hidden="true"/> Your Subloom, your way</span>
        <h1 id="download-title">A little more calm.<br/><em>Wherever you are.</em></h1>
        <p>Pick your device, get the latest version, or jump straight in online. Your subscriptions, in a calmer place.</p>
        <div className="download-hero-actions">
          <a className="button" href="#download-options">Find your download <ArrowDown size={18} aria-hidden="true"/></a>
          <a className="download-browser-link" href={webAppUrl}>Try in your browser <ArrowUpRight size={18} aria-hidden="true"/></a>
        </div>
        <div className="download-release-line" aria-live="polite">
          <span className="download-live-dot" aria-hidden="true"/>
          {release ? <><span>Latest release <strong>{release.tag}</strong>{releaseDate && <> · {releaseDate}</>}</span><a href={release.url} target="_blank" rel="noopener noreferrer">Release notes <ExternalLink size={13} aria-hidden="true"/></a></>
            : <><span>Latest release is temporarily unavailable</span><a href={releasesUrl} target="_blank" rel="noopener noreferrer">Check GitHub <ExternalLink size={13} aria-hidden="true"/></a></>}
        </div>
      </section>

      <section className="download-options container" id="download-options" aria-labelledby="download-options-title">
        <div className="download-section-heading">
          <div><span className="download-section-kicker">Choose your space</span><h2 id="download-options-title">Feels right on every screen.</h2></div>
          <p>Every installer comes straight from the latest published GitHub release.</p>
        </div>

        <div className="download-grid">
          <article className="download-card">
            <div className="download-card-top"><span className="download-icon"><Smartphone size={27} strokeWidth={1.7} aria-hidden="true"/></span><span className="download-card-type">On the go</span></div>
            <h3>Android</h3>
            <p>Keep renewals and recurring costs close, wherever the day takes you.</p>
            <div className="download-card-bottom">
              {androidTest && <span className="download-asset-notice">Test APK</span>}
              <DownloadAction asset={release?.android ?? null} label="Download APK"/>
              <span className="download-card-hint">Open the APK on your Android device to install.</span>
            </div>
          </article>

          <article className="download-card">
            <div className="download-card-top"><span className="download-icon"><Laptop2 size={29} strokeWidth={1.7} aria-hidden="true"/></span><span className="download-card-type">At your desk</span></div>
            <h3>macOS</h3>
            <p>A quiet overview for your Mac. Choose the version that matches its chip.</p>
            <div className="download-card-bottom">
              <div className="download-mac-options">
                <DownloadAction asset={release?.macArm ?? null} label="Apple Silicon"/>
                <DownloadAction asset={release?.macIntel ?? null} label="Intel Mac"/>
              </div>
              <span className="download-card-hint">Unzip, then move Subloom.app to Applications.</span>
            </div>
          </article>

          <article className="download-card">
            <div className="download-card-top"><span className="download-icon"><MonitorDown size={29} strokeWidth={1.7} aria-hidden="true"/></span><span className="download-card-type">For your PC</span></div>
            <h3>Windows</h3>
            <p>Keep everything in one place with the Windows desktop app.</p>
            <div className="download-card-bottom">
              <DownloadAction asset={release?.windows ?? null} label="Download installer"/>
              <span className="download-card-hint">Run the setup file and follow the prompts.</span>
            </div>
          </article>

          <article className="download-card download-card-web">
            <div className="download-card-top"><span className="download-icon"><Globe2 size={29} strokeWidth={1.7} aria-hidden="true"/></span><span className="download-card-type">Nothing to install</span></div>
            <h3>Just your browser.</h3>
            <p>Want to have a look first? Open Subloom on the web and get started in a moment.</p>
            <div className="download-card-bottom">
              <a className="download-action" href={webAppUrl}><span><strong>Open Subloom online</strong><small>subloom.baltii.tn</small></span><ArrowUpRight size={19} aria-hidden="true"/></a>
              <span className="download-card-hint"><Check size={14} aria-hidden="true"/> No download needed.</span>
            </div>
          </article>
        </div>

        <div className="download-trust-line">
          <ShieldCheck size={20} aria-hidden="true"/>
          <p>Official GitHub release assets, linked directly. No mirrors or third-party installers.</p>
          <a href={release?.url ?? releasesUrl} target="_blank" rel="noopener noreferrer">See all release files <ArrowRight size={16} aria-hidden="true"/></a>
        </div>
      </section>

      <section className="download-last-note container" aria-labelledby="download-last-note-title">
        <span className="download-section-kicker">Make room for the good stuff</span>
        <h2 id="download-last-note-title">Start wherever feels easiest.</h2>
        <p>Install it now or try it online. A clearer picture of your subscriptions is waiting.</p>
        <a href={webAppUrl}>Continue in browser <ArrowUpRight size={17} aria-hidden="true"/></a>
      </section>
    </main>
    <footer className="download-footer container">
      <Brand/>
      <span>© {new Date().getUTCFullYear()} Subloom. A little less admin, a little more life.</span>
      <a href="/">Back to the landing page <ArrowUpRight size={15} aria-hidden="true"/></a>
    </footer>
  </div>;
}
