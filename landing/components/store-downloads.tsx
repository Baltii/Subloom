import { ArrowUpRight, Download } from "lucide-react";

// Keep the download choice visible wherever the main landing calls to action appear.
export function StoreDownloads() {
  return <a className="platform-download" href="/download">
    <span className="platform-download-icon"><Download size={21} aria-hidden="true"/></span>
    <span className="platform-download-copy"><small>Available now</small><strong>Android · Mac · Windows · Web</strong></span>
    <ArrowUpRight size={17} aria-hidden="true"/>
  </a>;
}
