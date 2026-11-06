'use client';

import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Mail,MessageSquareWarning,Send,Wallet} from 'lucide-react';
import {buildContactMailto,contactEmail} from '../../lib/contact';

export default function ContactPage(){
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [topic,setTopic]=useState('Bug report');
  const [details,setDetails]=useState('');
  const [error,setError]=useState('');
  const [ready,setReady]=useState(false);

  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const message=details.trim();
    if(message.length<10){
      setError('Please add a few more details so I can understand your message.');
      return;
    }
    setError('');
    setReady(true);
    window.location.href=buildContactMailto({name,email,topic,message});
  }

  return <main className="contact-page">
    <header className="contact-topbar">
      <Link href="/dashboard" className="brand"><span className="brand-icon"><Wallet size={19}/></span> spendwise<span className="brand-dot">.</span></Link>
      <Link href="/dashboard" className="button outline small"><ArrowLeft size={15}/> Back to app</Link>
    </header>
    <section className="card contact-card">
      <span className="contact-icon"><MessageSquareWarning size={21}/></span>
      <span className="eyebrow">WE’RE LISTENING</span>
      <h1>Contact us</h1>
      <p className="contact-intro">Found a bug, have a question, or an idea to improve SpendWise? Send me a message.</p>
      <form className="contact-form" onSubmit={submit}>
        <label>Your name <span className="optional">optional</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={100} autoComplete="name" placeholder="How should I address you?"/></label>
        <label>Your email <span className="optional">optional</span><input type="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} autoComplete="email" placeholder="For a reply"/></label>
        <label>What is this about?<select value={topic} onChange={event=>setTopic(event.target.value)}><option>Bug report</option><option>Account help</option><option>Suggestion</option><option>Other</option></select></label>
        <label>Message<textarea value={details} onChange={event=>setDetails(event.target.value)} required minLength={10} maxLength={5000} rows={6} placeholder="Describe what happened, or how I can help."/></label>
        {error&&<p className="error" role="alert">{error}</p>}
        {ready&&<p className="contact-hint" role="status">Your email app should open with this message ready to send. If it didn’t, email me directly at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>}
        <button className="button" type="submit"><Send size={16}/> Send message <ArrowRight size={16}/></button>
      </form>
      <a className="contact-direct" href={`mailto:${contactEmail}`}><Mail size={15}/> {contactEmail}</a>
      <p className="contact-hint">This form opens your email app; it does not send anything until you press Send there.</p>
    </section>
  </main>;
}
