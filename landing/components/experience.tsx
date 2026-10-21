"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check, ChevronRight, Github, Home, LayoutGrid, Menu, Pause, Play, Plus, X } from "lucide-react";

import { ThemeControl } from "./theme";

const subscriptions = [
  { name: "Spotify", detail: "Individual plan", amount: 10.99, renews: "Oct 24", icon: "spotify", glyph: "S" },
  { name: "Netflix", detail: "Standard plan", amount: 13.49, renews: "Oct 26", icon: "netflix", glyph: "N" },
  { name: "iCloud+", detail: "200 GB storage", amount: 2.99, renews: "Oct 28", icon: "icloud", glyph: "iC" },
];
const money = (value: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);

export function Navigation() {
  const [open, setOpen] = useState(false);
  return <div className="header-actions"><button className="menu-toggle" aria-expanded={open} aria-controls="main-nav" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <nav id="main-nav" className={open ? "nav-links is-open" : "nav-links"} aria-label="Main navigation">
      <a href="#features" onClick={() => setOpen(false)}>Why Subloom</a><a href="#preview" onClick={() => setOpen(false)}>Take a look</a><a href="#questions" onClick={() => setOpen(false)}>FAQs</a>
      <div className="nav-utilities"><a className="button button-small" href="https://subloom.baltii.tn">Open Subloom <ArrowUpRight size={16} /></a><ThemeControl/><a className="icon-link" href="https://github.com/Baltii/Subloom" target="_blank" rel="noopener noreferrer" aria-label="View Subloom on GitHub (opens in a new tab)" title="Subloom on GitHub"><Github size={21} aria-hidden="true"/></a></div>
    </nav></div>;
}

export function HeroPreview() {
  return <div className="overview-fragment" data-ui aria-label="Illustrative Subloom subscription overview">
    <div className="preview-topline"><span className="workspace-symbol"><LayoutGrid size={17}/></span><span>Your little overview</span><Bell size={18}/></div>
    <div className="overview-heading"><div><p>Good morning, Alex</p><h2>All looking clear.</h2></div><span className="avatar">A</span></div>
    <div className="balance-panel"><span>Monthly subscriptions</span><strong>€27.47<span> / month</span></strong><div><span className="balance-status"><Check size={13}/> 3 subscriptions</span><span>Your monthly view <ArrowDownLeft size={15}/></span></div></div>
    <div className="upcoming-title"><strong>Coming up next</strong><span>October <ChevronRight size={13}/></span></div>
    {subscriptions.map(item => <div className="subscription-row" key={item.name}><ServiceIcon kind={item.icon} glyph={item.glyph}/><div><strong>{item.name}</strong><span>{item.detail}</span></div><div className="subscription-price"><strong>{money(item.amount)}</strong><span>{item.renews}</span></div></div>)}
    <div className="preview-bottom"><span><Home size={18}/> Overview</span><CalendarDays size={19}/><Plus size={19}/><LayoutGrid size={19}/></div>
  </div>;
}

function ServiceIcon({ kind, glyph }: { kind: string; glyph: string }) {
  return <span className={`service-icon ${kind}`} aria-hidden="true">{kind === "spotify" ? <svg width="25" height="25" viewBox="0 0 28 28" fill="none"><path d="M5 9c6-3 13-2 18 1M7 14c5-2 10-1 14 1M9 19c4-1 7-1 10 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg> : glyph}</span>;
}

export function SubscriptionDemo() {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState([true, true, true]);
  const total = subscriptions.reduce((sum, item, index) => sum + (selected[index] ? item.amount : 0), 0);
  return <div className="demo" data-ui>
    <div className="demo-heading"><div><span className="sample-label">Interactive sample</span><h3>Your subscriptions</h3></div><div className="segmented" data-period={period} aria-label="Cost period"><button aria-pressed={period === "monthly"} onClick={() => setPeriod("monthly")}>Monthly</button><button aria-pressed={period === "yearly"} onClick={() => setPeriod("yearly")}>Yearly</button></div></div>
    <div className="demo-total" aria-live="polite" aria-atomic="true"><strong><span className="total-value" key={`${period}-${total}`}>{money(total * (period === "yearly" ? 12 : 1))}</span></strong><span>per {period === "monthly" ? "month" : "year"}</span></div>
    <p className="demo-hint">Choose what you keep. See the difference.</p>
    <div className="demo-subscriptions">{subscriptions.map((item, index) => <label className={`demo-row${selected[index] ? "" : " is-excluded"}`} key={item.name}>
      <ServiceIcon kind={item.icon} glyph={item.glyph}/><span className="demo-name"><strong>{item.name}</strong><span>{item.detail}</span></span><strong>{money(item.amount * (period === "yearly" ? 12 : 1))}</strong>
      <input type="checkbox" checked={selected[index]} onChange={() => setSelected(current => current.map((value, i) => i === index ? !value : value))} aria-label={`Include ${item.name} in sample total`}/><span className="custom-check"><Check size={14}/></span>
    </label>)}</div>
    <p className="demo-note">Sample prices only. Changing this demo does not cancel a subscription.</p>
  </div>;
}

export function FaqList({ questions }: { questions: string[][] }) {
  const [active, setActive] = useState<number | null>(0);
  const [enhanced, setEnhanced] = useState(false);
  useEffect(() => setEnhanced(true), []);
  if (!enhanced) return <div className="faq-list">{questions.map(([question, answer], index) => <details className="faq-item" name="subloom-faq" open={index === 0} key={question}><summary className="faq-trigger">{question}<span className="faq-plus" aria-hidden="true"/></summary><p className="faq-fallback">{answer}</p></details>)}</div>;
  return <div className="faq-list">{questions.map(([question, answer], index) => {
    const open = active === index;
    return <div className="faq-item" data-open={open} key={question}>
      <h3><button className="faq-trigger" id={`question-${index}`} aria-expanded={open} aria-controls={`answer-${index}`} onClick={() => setActive(open ? null : index)}>{question}<span className="faq-plus" aria-hidden="true"/></button></h3>
      <div className="faq-answer" id={`answer-${index}`} role="region" aria-labelledby={`question-${index}`} aria-hidden={!open} inert={!open}><div><p>{answer}</p></div></div>
    </div>;
  })}</div>;
}

export function Motion() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(preference.matches);
    sync();
    setReady(true);
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      root.dataset.motion = ready && !paused && !reduced && !document.hidden ? "on" : "off";
      root.dataset.motionPreference = reduced ? "reduced" : paused ? "paused" : "full";
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [paused, reduced, ready]);

  useEffect(() => {
    const scenes = document.querySelectorAll<HTMLElement>("[data-motion-scene]");
    const reveals = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const node = entry.target as HTMLElement;
        if (node.hasAttribute("data-motion-scene")) node.dataset.inView = String(entry.isIntersecting);
        if (entry.isIntersecting && node.hasAttribute("data-reveal")) node.classList.add("revealed");
      });
    }, { threshold: 0.12 });
    new Set([...scenes, ...reveals]).forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || reduced || !ready) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!finePointer.matches) return;
    const nodes = document.querySelectorAll<HTMLElement>("[data-depth]");
    const cleanups = Array.from(nodes, node => {
      let frame = 0;
      let x = 0;
      let y = 0;
      const update = () => {
        node.style.setProperty("--pointer-x", `${x.toFixed(2)}px`);
        node.style.setProperty("--pointer-y", `${y.toFixed(2)}px`);
        frame = 0;
      };
      const move = (event: PointerEvent) => {
        if (event.pointerType !== "mouse" || document.hidden || node.dataset.inView !== "true") return;
        const rect = node.getBoundingClientRect();
        x = Math.max(-8, Math.min(8, ((event.clientX - rect.left) / rect.width - 0.5) * 16));
        y = Math.max(-6, Math.min(6, ((event.clientY - rect.top) / rect.height - 0.5) * 12));
        if (!frame) frame = requestAnimationFrame(update);
      };
      const reset = () => {
        cancelAnimationFrame(frame);
        x = 0; y = 0; update();
      };
      node.addEventListener("pointermove", move, { passive: true });
      node.addEventListener("pointerleave", reset);
      return () => {
        reset();
        node.removeEventListener("pointermove", move);
        node.removeEventListener("pointerleave", reset);
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [paused, reduced, ready]);

  if (!ready || reduced) return null;
  return <button className="motion-control" onClick={() => setPaused(value => !value)} aria-label={paused ? "Play website motion" : "Pause website motion"}>{paused ? <Play size={15}/> : <Pause size={15}/>}<span>{paused ? "Play motion" : "Pause motion"}</span></button>;
}
