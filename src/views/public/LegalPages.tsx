import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-foreground mb-3">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-4 mb-10">
          <p className="text-xs text-muted-foreground mb-2">Last updated: November 2026 — Sample document, demo only</p>
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        </div>
        <div className="neu-card rounded-3xl p-8">
          <PolicySection title="1. Acceptance of Terms">
            <p>By accessing or using ColdFox, you agree to be bound by these Terms of Service. This is a demonstration document — not a legally binding agreement.</p>
          </PolicySection>
          <PolicySection title="2. Use of the Service">
            <p>ColdFox may only be used for lawful outreach purposes. You are responsible for ensuring your use complies with all applicable laws, including CAN-SPAM, GDPR, and CASL.</p>
            <p>You must not use ColdFox to send spam, harass recipients, or engage in any activity that violates our Acceptable Use Policy.</p>
          </PolicySection>
          <PolicySection title="3. Account Responsibility">
            <p>You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.</p>
          </PolicySection>
          <PolicySection title="4. Deliverability Disclaimer">
            <p>ColdFox does not guarantee inbox delivery. Email placement is determined by recipient email providers and is outside ColdFox's control.</p>
          </PolicySection>
          <PolicySection title="5. Data Ownership">
            <p>You retain full ownership of your lead data, campaign content, and account data. ColdFox does not sell or share your data with third parties.</p>
          </PolicySection>
          <PolicySection title="6. Limitation of Liability">
            <p>ColdFox is not liable for indirect, incidental, or consequential damages arising from your use of the service. This is a sample clause for demonstration only.</p>
          </PolicySection>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-4 mb-10">
          <p className="text-xs text-muted-foreground mb-2">Last updated: November 2026 — Sample document, demo only</p>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        </div>
        <div className="neu-card rounded-3xl p-8">
          <PolicySection title="1. Information We Collect">
            <p>ColdFox collects account registration information (name, email, company), usage data, campaign data, and lead data you upload.</p>
          </PolicySection>
          <PolicySection title="2. How We Use Your Data">
            <p>We use your data to operate the platform, provide customer support, and improve the service. We do not sell your personal data to third parties.</p>
          </PolicySection>
          <PolicySection title="3. Lead Data">
            <p>Lead data you import belongs to you. ColdFox processes it solely to deliver the outreach functionality you've configured. We do not access or use your lead data for any other purpose.</p>
          </PolicySection>
          <PolicySection title="4. Data Security">
            <p>ColdFox uses industry-standard encryption and security practices to protect your data. In the event of a data breach, we will notify affected users promptly.</p>
          </PolicySection>
          <PolicySection title="5. Your Rights">
            <p>You can export or delete your account data at any time from Settings. You may also contact us to request data deletion.</p>
          </PolicySection>
          <PolicySection title="6. Cookies">
            <p>ColdFox uses essential cookies for authentication and session management, and optional analytics cookies to improve the product experience.</p>
          </PolicySection>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

export function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-4 mb-10">
          <p className="text-xs text-muted-foreground mb-2">Last updated: November 2026 — Sample document, demo only</p>
          <h1 className="text-3xl font-bold text-foreground">Acceptable Use Policy</h1>
        </div>
        <div className="neu-card rounded-3xl p-8">
          <PolicySection title="Permitted Uses">
            <p>ColdFox may be used for legitimate B2B outreach, sales development, recruiting, marketing, and business development communications.</p>
          </PolicySection>
          <PolicySection title="Prohibited Uses">
            <p>The following are strictly prohibited:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Sending unsolicited consumer emails (spam)</li>
              <li>Harvesting or purchasing email lists without legitimate basis</li>
              <li>Misleading or deceptive subject lines or sender identities</li>
              <li>Sending to contacts who have previously unsubscribed</li>
              <li>Using ColdFox for phishing, fraud, or illegal activities</li>
              <li>Sending malware, viruses, or harmful content</li>
              <li>Violating CAN-SPAM, GDPR, CASL, or other applicable regulations</li>
            </ul>
          </PolicySection>
          <PolicySection title="Enforcement">
            <p>Violations of this policy may result in immediate account suspension or termination. ColdFox reserves the right to investigate suspected violations and cooperate with law enforcement.</p>
          </PolicySection>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

export function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <PublicNavbar />
      <div className="text-center max-w-md mx-auto px-4 pt-24">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Unsubscribe Successful</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          Your email address has been added to the suppression list. You will not receive further emails from this sender. This is a demonstration — no actual unsubscribe action was processed.
        </p>
        <a href="/" className="text-sm text-blue-600 hover:underline">Return to ColdFox homepage</a>
      </div>
    </div>
  );
}
