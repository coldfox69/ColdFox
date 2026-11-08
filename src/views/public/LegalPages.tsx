import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Check } from 'lucide-react';

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
          <p className="text-xs text-muted-foreground mb-2">Last updated: November 2026</p>
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        </div>
        <div className="border border-border bg-card rounded-2xl p-8">
          <PolicySection title="1. Service">
            <p>ColdFox provides lead import, email templates, campaign sequences, unified inbox tools, and deliverability checks. You connect your own email accounts and contact lists.</p>
          </PolicySection>
          <PolicySection title="2. Lawful use">
            <p>You must comply with applicable laws when you use ColdFox, including CAN-SPAM, GDPR, and CASL. Send only to recipients you have a lawful basis to contact.</p>
            <p>You must not use ColdFox for spam, harassment, phishing, fraud, or deceptive content.</p>
          </PolicySection>
          <PolicySection title="3. Account responsibility">
            <p>You are responsible for keeping your account credentials secure and for activity under your account. Notify us of unauthorized access.</p>
          </PolicySection>
          <PolicySection title="4. Deliverability">
            <p>ColdFox does not guarantee inbox placement. Placement is decided by recipient email providers based on your domain reputation, content, and sending history.</p>
          </PolicySection>
          <PolicySection title="5. Your data">
            <p>You retain ownership of leads, templates, and campaign content you add. We do not sell your data. You can export or delete data from Settings.</p>
          </PolicySection>
          <PolicySection title="6. Liability">
            <p>To the extent permitted by law, ColdFox is not liable for indirect or consequential damages from use of the service.</p>
          </PolicySection>
          <PolicySection title="7. Changes">
            <p>We may update these terms. Material changes will be posted on this page with a new last updated date.</p>
          </PolicySection>
          <PolicySection title="8. Contact">
            <p>Contact us through the Contact page with questions about these terms.</p>
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
          <p className="text-xs text-muted-foreground mb-2">Last updated: November 2026</p>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        </div>
        <div className="border border-border bg-card rounded-2xl p-8">
          <PolicySection title="1. Data we collect">
            <p>Account information you provide (name, email, company), workspace settings, leads and templates you add, and logs needed to run campaigns and support.</p>
          </PolicySection>
          <PolicySection title="2. How we use data">
            <p>We use data to operate the workspace, send email you configure, handle replies, provide support, and keep the service secure. We do not sell personal data.</p>
          </PolicySection>
          <PolicySection title="3. Lead data">
            <p>Lead data you import is processed only to provide the outreach functions you configure. We do not use lead data for advertising.</p>
          </PolicySection>
          <PolicySection title="4. Mailbox access">
            <p>Mailbox credentials you enter for SMTP or IMAP are encrypted at rest and used only to send or sync email you request.</p>
          </PolicySection>
          <PolicySection title="5. Security">
            <p>We use encryption and access controls to protect stored data. Account access requires authentication.</p>
          </PolicySection>
          <PolicySection title="6. Your choices">
            <p>You can export leads and campaign data from Settings. You can disconnect a mailbox or request account deletion at any time.</p>
          </PolicySection>
          <PolicySection title="7. Cookies">
            <p>We use essential cookies for sign-in and session handling. Analytics are aggregate and do not identify you personally.</p>
          </PolicySection>
          <PolicySection title="8. Contact">
            <p>Contact us through the Contact page with privacy questions or data requests.</p>
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
          <p className="text-xs text-muted-foreground mb-2">Last updated: November 2026</p>
          <h1 className="text-3xl font-bold text-foreground">Acceptable Use Policy</h1>
        </div>
        <div className="border border-border bg-card rounded-2xl p-8">
          <PolicySection title="Permitted uses">
            <p>ColdFox may be used for lawful B2B outreach, sales development, recruiting, and business development communications to recipients you have a basis to contact.</p>
          </PolicySection>
          <PolicySection title="Prohibited uses">
            <p>The following are prohibited:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Sending unsolicited consumer email (spam)</li>
              <li>Harvesting or purchasing email lists without a lawful basis</li>
              <li>Misleading subject lines or sender identities</li>
              <li>Sending to contacts who have unsubscribed</li>
              <li>Phishing, fraud, or illegal activity</li>
              <li>Sending malware or harmful content</li>
              <li>Violating CAN-SPAM, GDPR, CASL, or other applicable rules</li>
            </ul>
          </PolicySection>
          <PolicySection title="Enforcement">
            <p>Violations may result in account suspension or termination. We may investigate suspected violations and cooperate with lawful requests.</p>
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
      <div className="max-w-md mx-auto px-4 pt-24 text-center">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Unsubscribe</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          To unsubscribe from emails sent by a ColdFox user, open the unsubscribe link at the bottom of their email. That link processes your request directly.
        </p>
        <a href="/" className="text-sm text-blue-600 hover:underline">Return to ColdFox homepage</a>
      </div>
    </div>
  );
}
