import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Sparkles, Users, Shield, Target, Globe } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 pt-4">
            <h1 className="text-4xl font-bold text-foreground mb-4">Built for serious outreach</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">ColdFox was built by sales practitioners who were frustrated with tools that sacrificed deliverability for volume.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              { icon: Users, label: 'Sample Metric', value: '12,000+', sub: 'Active users (demo)' },
              { icon: Globe, label: 'Sample Metric', value: '60+', sub: 'Countries (demo)' },
              { icon: Target, label: 'Sample Metric', value: '98M+', sub: 'Emails sent (demo)' },
              { icon: Shield, label: 'Sample Metric', value: '99.9%', sub: 'Platform uptime (demo)' },
            ].map(stat => (
              <div key={stat.value} className="neu-card rounded-2xl p-6 text-center">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Our mission</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Cold outreach works when it's done right — with relevant, personalized messages sent to the right people at the right time. ColdFox exists to make that the default, not the exception.</p>
              <p className="text-muted-foreground leading-relaxed">We believe that great outreach is about quality over quantity. Our platform is designed to help teams send fewer, better emails — and get more replies as a result.</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Our values</h2>
              <div className="space-y-3">
                {[
                  { title: 'Deliverability-first', desc: 'We prioritize sustainable sending practices over short-term volume.' },
                  { title: 'Transparency', desc: 'We clearly communicate what our metrics mean and what they don\'t.' },
                  { title: 'Privacy respect', desc: 'We never sell or share customer data. You own your leads.' },
                ].map(v => (
                  <div key={v.title} className="flex gap-3 p-4 neu-card rounded-xl">
                    <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gradient-navy rounded-3xl p-10 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Join the ColdFox community</h2>
            <p className="text-blue-200 mb-6 text-sm">Start your free account today.</p>
            <a href="/signup" className="inline-block bg-white text-blue-900 font-semibold px-8 py-3 rounded-2xl hover:bg-blue-50 transition-colors">
              Get Started Free
            </a>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
