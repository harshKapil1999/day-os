import Link from "next/link";
import { ArrowRight, Check, Clock3, Droplets, MoveRight, Sparkles } from "lucide-react";
import { GlassCard, GlassPill } from "@/components/glass/glass";

export default function LandingPage() {
  return <main className="landing ambient-page">
    <nav className="landing-nav"><Link href="/" className="brand"><span className="brand-mark">D</span><span>DayOS</span></Link><div className="landing-links"><a href="#how">How it works</a><a href="#principles">Principles</a></div><Link className="button button-secondary button-sm" href="/sign-in">Sign in</Link></nav>
    <section className="hero">
      <GlassPill className="eyebrow"><Sparkles size={14}/> Your day, adapted to reality</GlassPill>
      <h1>Know what matters.<br/><em>Do it now.</em></h1>
      <p>DayOS turns your priorities, energy, and commitments into a balanced plan—then reshapes what remains when life changes.</p>
      <div className="hero-actions"><Link className="button button-primary button-lg" href="/onboarding">Build my first day <ArrowRight size={17}/></Link><Link className="button button-ghost button-lg" href="/app/today">Explore the demo</Link></div>
      <div className="hero-note"><Check size={15}/> Deterministic planning. No black box.</div>
    </section>
    <section className="product-stage" aria-label="DayOS product preview">
      <div className="stage-glow"/>
      <GlassCard className="preview-shell">
        <header><div><span className="overline">THURSDAY, AUGUST 20</span><h2>Good morning, Alex.</h2></div><GlassPill className="calm-pill"><span/> Balanced day</GlassPill></header>
        <div className="preview-grid">
          <div className="preview-now"><span className="overline">RIGHT NOW</span><div className="preview-icon"><Clock3/></div><h3>Build authentication flow</h3><p>Deep Work · 09:00–11:00</p><strong>01:18:32</strong><button className="button button-primary">Start focus <MoveRight size={16}/></button></div>
          <div className="preview-timeline"><div className="time-row"><time>09:00</time><div className="mini-block active"><b>Deep Work</b><span>Build authentication flow</span></div></div><div className="time-row"><time>11:00</time><div className="mini-block"><b>Reset break</b><span>Water + move</span></div></div><div className="time-row"><time>11:15</time><div className="mini-block learning"><b>Learning</b><span>Systems design course</span></div></div></div>
          <div className="preview-side"><div><span className="overline">NEXT</span><h4>Water + short break</h4><p>11:00</p></div><div className="water-visual"><Droplets size={17}/><span>Water</span><strong>1.25 / 3.0 L</strong><i><b style={{width:"42%"}}/></i></div></div>
        </div>
      </GlassCard>
    </section>
    <section id="how" className="landing-section"><span className="overline">A CALMER CONTROL CENTER</span><h2>Plans that leave room for a life.</h2><div className="principle-grid"><article><span>01</span><h3>Start with reality</h3><p>Your available time, fixed events, sleep, meals, exercise, and energy form the edges of the plan.</p></article><article><span>02</span><h3>Protect what matters</h3><p>Focused work fits alongside learning, health, relationships, recovery, and unstructured time.</p></article><article><span>03</span><h3>Adapt with context</h3><p>When work runs long or finishes early, only future flexible blocks move. Commitments stay fixed.</p></article></div></section>
    <footer><span>DayOS</span><p>Intentional time, one day at a time.</p><Link href="/onboarding">Begin <ArrowRight size={15}/></Link></footer>
  </main>;
}
