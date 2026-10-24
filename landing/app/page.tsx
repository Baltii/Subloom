import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, Check, CheckCheck, Leaf, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { FeatureBento } from "../components/feature-bento";
import { StoreDownloads } from "../components/store-downloads";
import { Brand } from "../components/brand";
import { FaqList, HeroPreview, Motion, Navigation, SubscriptionDemo } from "../components/experience";

const downloadUrl = "/download";
const questions = [
  ["What does Subloom do?", "Subloom brings your subscription records, recurring-cost estimates, and upcoming renewals into one place. Add the services you use, set renewal dates, and choose the reminders that work for you."],
  ["Do I need to connect my bank?", "No. You can add subscriptions yourself and start tracking without connecting a bank account. Subloom also supports reviewing imported statements; it does not need direct access to your bank."],
  ["Can I start without an account?", "Yes. Create a personal guest space and your changes are saved on your current device. You can create an account later if you want to sync across devices. Guest data is imported only when you choose."],
  ["Will Subloom cancel a subscription for me?", "You handle cancellation directly with the service provider. Subloom helps you track renewals and record a cancellation afterward. Pausing or deleting a record in Subloom does not stop merchant billing."],
  ["How are different currencies handled?", "Your subscription prices stay in their original currencies. Where Subloom shows a converted estimate, it labels that estimate separately. Reference-rate estimates may differ from the amount charged by your bank."],
  ["How do renewal reminders work?", "Set your renewal dates and reminder preferences in the app. Available delivery options depend on your device, permissions, and service configuration. The app’s upcoming-renewal view is always there for a quick check."],
];

export default function Home() {
  return <><a className="skip-link" href="#main">Skip to content</a>
    <div className="hero-field" id="top">
      <header className="header container"><Brand/><Navigation/></header>
      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy"><h1 id="hero-title"><span>Less money admin.</span><span>More <em className="heading-accent heading-underline">peace of mind.</em></span></h1>
            <p>All your subscriptions, in one calm place. Spot forgotten costs, see renewals coming, and keep more room in your budget.</p>
            <div className="hero-actions"><a className="button" href={downloadUrl}>Get Subloom <ArrowUpRight size={19}/></a><a className="text-link" href="#preview">Take a little look <span className="round-arrow"><ArrowDown size={15}/></span></a></div>
            <StoreDownloads/>
            <div className="hero-reassurance"><ShieldCheck size={16}/><span>No bank connection. Start without an account.</span></div><div className="motion-tools"><Motion/></div>
          </div>
          <div className="hero-art" data-motion-scene data-depth><div className="hero-stage"/><div className="hero-ui-wrap"><HeroPreview/></div>
            <div className="renewal-note" data-ui><span className="note-icon"><Bell size={20}/></span><div><strong>A little heads-up</strong><span>Spotify renews in 3 days</span></div><span className="note-check"><Check size={14}/></span></div>
            <div className="hero-wallet"><Image src="/illustrations/wallet-coins.webp" width={500} height={405} alt="A soft green wallet and a few gold coins" priority sizes="(max-width: 600px) 180px, 260px"/></div>
            <span className="hero-art-caption">A little preview, with sample subscriptions</span>
          </div>
        </section>
        <div className="principles container"><span><LayoutMark/>One clear overview</span><span><Bell size={18}/>Renewals, remembered</span><span><LockKeyhole size={18}/>Your data, your choice</span><a href="#features">A little more breathing room <ArrowDown size={16}/></a></div>
        <section className="features container section-space" id="features" aria-labelledby="features-title">
          <div className="feature-picture" data-reveal="picture" data-motion-scene data-depth><div className="calendar-stage"><Image src="/illustrations/clarity-organizer.webp" alt="An organized forest-green tray holding subscription papers, a check tile and gold coins" width={900} height={900} sizes="(max-width: 700px) 85vw, 500px"/></div><div className="calendar-caption"><CheckCheck size={18}/><span>A clearer month starts here.</span></div></div>
          <div className="feature-copy"><h2 id="features-title">A little <em className="heading-accent">clarity.</em><br/>A lot less juggling.</h2><p className="section-intro">Free trials end. Habits change. Small renewals can keep going long after you stop using a service. Give them all a place where you can see them.</p>
            <div className="feature-line"><span className="feature-symbol"><LayoutMark/></span><div><h3>Everything, together</h3><p>Keep your subscriptions and recurring costs in one easy overview.</p></div></div>
            <div className="feature-line"><span className="feature-symbol"><Bell size={21}/></span><div><h3>Time to think ahead</h3><p>See upcoming renewals and choose reminders before the next date comes around.</p></div></div>
            <div className="feature-line"><span className="feature-symbol"><Leaf size={22}/></span><div><h3>Keep what feels worth it</h3><p>Find the subscriptions you no longer use. Cancel with the provider, then update your record in Subloom.</p></div></div>
          </div>
        </section>
        <FeatureBento/>
        <section className="preview-section section-space" id="preview" aria-labelledby="preview-title"><div className="container preview-layout"><div className="preview-copy"><h2 id="preview-title">Small subscriptions.<br/>A <em className="heading-accent">clearer picture.</em></h2><p>A subscription can feel small each month.<br/>Switch to yearly to see its full cost, or uncheck one you no longer need.</p><div className="try-note"><span className="round-arrow"><ArrowRight size={18}/></span><span>Try switching the view<br/>or unchecking a subscription.</span></div><p className="currency-note">One currency in this example.<br/>Original currencies in your real overview.</p></div><div data-reveal="panel"><SubscriptionDemo/></div></div></section>
        <section className="privacy container section-space" id="your-space" aria-labelledby="privacy-title"><div className="privacy-panel" data-reveal="surface"><div className="privacy-copy"><h2 id="privacy-title">Your space.<br/>At <em className="heading-accent heading-underline">your pace.</em></h2><p>Money is personal. Getting organized should feel comfortable, from the very first tap.</p><a className="button button-light" href={downloadUrl}>Get Subloom <ArrowUpRight size={18}/></a></div><div className="privacy-details"><div><LockKeyhole size={24}/><h3>Start with just you</h3><p>No account needed for guest tracking. Your changes are saved on your device.</p></div><div><ShieldCheck size={24}/><h3>You’re in control</h3><p>Add the details you choose. No bank connection required. Sync only when you’re ready.</p></div><div className="privacy-footnote"><Check size={16}/><span>A simple start. Room to grow.</span></div></div></div></section>
        <section className="faq container section-space" id="questions" aria-labelledby="faq-title"><div><h2 id="faq-title">Good questions.<br/>Clear answers.</h2><p>A few things you might<br/>be wondering about.</p></div><FaqList questions={questions}/></section>
        <section className="closing section-space" aria-labelledby="closing-title"><div className="container closing-inner"><div><h2 id="closing-title">Make room<br/>for <em className="heading-accent">the good stuff.</em></h2><p>See what you’ve forgotten. Choose what’s worth paying for.</p><a className="button" href={downloadUrl}>Get Subloom <ArrowUpRight size={19}/></a><StoreDownloads/><span className="closing-note">Your subscriptions. A fresh perspective.</span></div><div className="closing-art" data-reveal="picture" data-motion-scene data-depth><Image src="/illustrations/wallet-coins.webp" width={500} height={405} alt="Subloom’s green wallet and gold coins" sizes="(max-width: 700px) 75vw, 440px"/><div className="all-set" data-ui><span><Sparkles size={20}/></span><div><strong>That’s a little lighter.</strong><span>Everything in its place.</span></div></div></div></div></section>
      </main>
      <footer className="footer"><div className="container"><div className="footer-top"><div><Brand/><p>A little less admin.<br/>A little more life.</p></div><div className="footer-links"><a href="#features">Why Subloom</a><a href="#preview">Take a look</a><a href="#your-space">Your space</a><a href="#questions">FAQs</a><a href={downloadUrl}>Downloads & browser <ArrowUpRight size={14}/></a></div></div><div className="footer-bottom"><span>© {new Date().getUTCFullYear()} Subloom</span><span>Made for a little peace of mind. <Leaf size={15}/></span><a href="#top">Back to the top <ArrowUpRight size={15}/></a></div></div></footer>
    </div></>;
}

function LayoutMark() { return <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="2" y="2" width="6" height="6" rx="2" stroke="currentColor" strokeWidth="1.6"/><rect x="12" y="2" width="6" height="6" rx="2" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="12" width="6" height="6" rx="2" stroke="currentColor" strokeWidth="1.6"/><rect x="12" y="12" width="6" height="6" rx="2" stroke="currentColor" strokeWidth="1.6"/></svg>; }
