import Image from "next/image";
import { ArrowRight, Bell, Check, FileText, ReceiptText } from "lucide-react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const days = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1];

export function FeatureBento() {
  return <section className="feature-bento container section-space" id="possibilities" aria-labelledby="bento-title">
    <div className="bento-intro"><h2 id="bento-title">Find <em className="heading-accent heading-underline">the forgotten.</em><br/>Keep what matters.</h2><p>An old trial. A second streaming plan. The subscription you meant to cancel. Bring the details together, so you can make room for the things you actually use.</p></div>
    <div className="bento-grid">
      <article className="bento-card bento-cost" data-reveal="panel" data-motion-scene>
        <div className="bento-heading-with-art"><div><h3>Small charges.<br/>Real money.</h3><p>A subscription you haven’t opened in months can keep charging. Seeing its full-year cost makes “I’ll look at it later” worth a second look.</p></div><BentoArt name="cost-coins"/></div>
        <figure className="cost-example" aria-label="An illustrative unused subscription costing 9.99 euros each month adds up to 119.88 euros over twelve payments">
          <div className="cost-comparison"><div><span>One unused subscription</span><strong>€9.99<small>/ month</small></strong></div><ArrowRight size={24} aria-hidden="true"/><div><span>Twelve monthly payments</span><strong>€119.88<small>/ year</small></strong></div></div>
          <div className="repeat-months" aria-hidden="true">{months.map((month, index) => <span key={month}><i style={{ transitionDelay: `${index * 18}ms` }}/>{month}</span>)}</div>
          <figcaption>Illustrative cost. You choose what to cancel with the provider.</figcaption>
        </figure>
      </article>
      <article className="bento-card bento-renewals" data-reveal="panel" data-motion-scene>
        <div className="bento-heading-with-art"><div><h3>Know what’s next.</h3><p>See renewals on your calendar and choose reminders before the next date comes around.</p></div><BentoArt name="renewal-bell"/></div>
        <div className="mini-calendar" aria-label="Illustrative calendar with a renewal on October 24, 2026" data-ui>
          <div className="calendar-month"><strong>October <span>2026</span></strong><Bell size={18} aria-hidden="true"/></div>
          <div className="calendar-week" aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={index}>{day}</span>)}</div>
          <div className="calendar-dates" aria-hidden="true">{days.map((day, index) => <span key={index} className={day === 24 ? "renewal-day" : day === 1 ? "next-month" : ""}>{day}{day === 24 ? <i/> : null}</span>)}</div>
          <div className="calendar-event"><span className="calendar-event-dot"/><span>Renewal coming up</span><strong>24 Oct</strong></div>
        </div>
        <span className="bento-example-label">Illustrative calendar</span>
      </article>
      <article className="bento-card bento-statements" data-reveal="panel" data-motion-scene>
        <div className="bento-visual-row"><BentoArt name="statement-papers"/><div className="statement-preview" aria-label="Illustrative recurring-charge review" data-ui><div><FileText size={20} aria-hidden="true"/><span>Statement review</span></div><div className="statement-match"><span><strong>Streaming service</strong><small>Monthly · EUR 9.99</small></span><span className="review-status">Needs review</span></div><p>Illustrative recurring payment candidate</p></div></div>
        <div><h3>Find the repeat payments.</h3><p>Import a bank statement, review recurring charges, and confirm the subscription matches. No direct bank connection needed.</p></div>
      </article>
      <article className="bento-card bento-receipts" data-reveal="panel" data-motion-scene>
        <div className="bento-visual-row"><BentoArt name="receipt-review"/><div className="receipt-preview" aria-label="Illustrative receipt details for review" data-ui><ReceiptText size={25} aria-hidden="true"/><div><span>Receipt details · example</span><strong>Monthly plan</strong></div><dl><div><dt>Amount</dt><dd>EUR 9.99</dd></div><div><dt>Next step</dt><dd><Check size={13} aria-hidden="true"/>Your review</dd></div></dl></div></div>
        <div><h3>A receipt, a useful clue.</h3><p>Review receipt candidates and check the details before accepting them. Every suggestion stays yours to confirm.</p></div>
      </article>
      <article className="bento-card bento-currencies" data-reveal="panel" data-motion-scene>
        <div className="bento-visual-row"><BentoArt name="currency-coins"/><div className="currency-preview" aria-label="Illustrative original prices in euros and US dollars" data-ui><span>Original prices · example</span><div><span>EUR</span><strong>10.99</strong></div><div><span>USD</span><strong>4.99</strong></div><small>Separate currencies. Clear labels.</small></div></div>
        <div><h3>Keep the real numbers.</h3><p>Prices stay in their original currencies. Converted estimates are labeled separately, so you know what you’re looking at.</p></div>
      </article>
    </div>
    <p className="bento-outcome">Notice it. Decide if it stays. <span>Subloom helps you see the cost; cancellation happens with the service provider.</span></p>
  </section>;
}

function BentoArt({ name }: { name: string }) {
  return <span className={`bento-art bento-art-${name}`} aria-hidden="true"><Image src={`/illustrations/${name}.webp`} alt="" width={420} height={420} sizes="(max-width: 600px) 112px, (max-width: 1000px) 100px, 140px"/></span>;
}
