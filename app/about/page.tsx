import Link from 'next/link';
import Image from 'next/image';
import {ArrowLeft,ArrowRight,Wallet} from 'lucide-react';

export default function AboutPage(){
  return <main className="about-page"><div className="about-shell">
    <header className="about-topbar">
      <Link href="/dashboard" className="brand"><span className="brand-icon"><Wallet size={19}/></span> spendwise<span className="brand-dot">.</span></Link>
      <Link href="/dashboard" className="button outline small"><ArrowLeft size={15}/> Back to app</Link>
    </header>
    <section className="card about-hero">
      <div className="about-copy">
        <span className="eyebrow">MY STORY</span>
        <h1>Hi, I’m <span>Tamim Ahmed.</span></h1>
        <p>I’m a first-year BBA honours student at Government Debendra College in Manikganj, where I’m learning how ideas, people, and businesses come together. My studies are one part of my journey; another is a dream I’m determined to pursue: becoming a developer.</p>
        <p>I’m inspired by the chance to turn curiosity into skills and ideas into useful digital experiences. Every new thing I learn is a step forward. I know the road takes patience and practice, but I believe that steady effort can turn a dream into something real.</p>
        <p>This is only the beginning of my story. I’m excited to keep learning, keep building, and see where this journey leads.</p>
        <div className="about-signoff">Learning today. Building tomorrow.</div>
      </div>
      <figure className="about-photo-panel">
        <Image className="about-main-photo" src="/images/tamim-ahmed.jpg" alt="Tamim Ahmed wearing a brown traditional outfit" width={768} height={1024} priority unoptimized sizes="(max-width: 760px) 90vw, 320px"/>
        <figcaption className="about-photo-caption">Tamim Ahmed</figcaption>
      </figure>
    </section>
    <section className="card about-education">
      <span className="about-education-icon" aria-hidden="true">BBA</span>
      <div><span className="eyebrow">MY EDUCATION</span><h2>BBA Honours</h2><p>Government Debendra College · Manikganj</p></div>
    </section>
    <section className="card about-photo-story">
      <Image className="about-second-photo" src="/images/tamim-ahmed-second.jpg" alt="Tamim Ahmed in a black jacket" width={768} height={1024} unoptimized sizes="(max-width: 760px) 90vw, 250px"/>
      <div><span className="eyebrow">THE JOURNEY AHEAD</span><h2>One step at a time.</h2><p>Every new experience brings a chance to learn, grow, and get closer to the developer I hope to become.</p></div>
    </section>
    <section className="card about-motto">
      <span className="about-motto-mark" aria-hidden="true">“</span>
      <div><h2>Big dreams begin with small steps.</h2><p>Thank you for taking a moment to learn about me.</p></div>
      <Link href="/dashboard" className="about-return">Back to your workspace <ArrowRight size={16}/></Link>
    </section>
  </div></main>;
}
