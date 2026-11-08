'use client';

import { useState } from 'react';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Mail, MessageSquare, Globe, Send, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 pt-4">
            <h1 className="text-4xl font-bold text-foreground mb-3">Get in touch</h1>
            <p className="text-muted-foreground">We'd love to hear from you. Our team typically responds within 24 hours.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              {[
                { icon: Mail, title: 'Email us', desc: 'hello@coldfox.io', sub: 'General inquiries' },
                { icon: MessageSquare, title: 'Support', desc: 'support@coldfox.io', sub: 'Technical help' },
                { icon: Globe, title: 'Sales', desc: 'sales@coldfox.io', sub: 'Enterprise & partnerships' },
              ].map(item => (
                <div key={item.title} className="neu-card rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.title}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">{item.desc}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              ))}
              <div className="neu-card rounded-2xl p-5 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Demo only</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">This contact form is for demonstration purposes. No message will actually be sent.</p>
              </div>
            </div>

            <div className="lg:col-span-2 neu-card rounded-3xl p-8">
              {sent ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Message sent!</h3>
                  <p className="text-muted-foreground text-sm">In a real deployment, we'd get back to you within 24 hours. This is a demo — no message was actually sent.</p>
                  <button onClick={() => setSent(false)} className="mt-6 text-sm text-blue-600 hover:underline">Send another message</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-xl font-bold text-foreground mb-2">Send a message</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Full name</label>
                      <input
                        required
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        placeholder="Alex Johnson"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Email address</label>
                      <input
                        required type="email"
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        placeholder="alex@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Subject</label>
                    <input
                      required
                      value={form.subject}
                      onChange={e => setForm({...form, subject: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                      placeholder="How can we help?"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Message</label>
                    <textarea
                      required rows={5}
                      value={form.message}
                      onChange={e => setForm({...form, message: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                      placeholder="Tell us what's on your mind..."
                    />
                  </div>
                  <button type="submit" className="gradient-blue text-white font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity inline-flex items-center gap-2">
                    <Send className="w-4 h-4" /> Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
