import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Check } from 'lucide-react';

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[15px] font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-[13px] leading-[1.75] text-muted-foreground">{children}</div>
    </section>
  );
}

function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="px-6 pb-16 pt-28 sm:px-8 lg:pt-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-[12px] text-muted-foreground">Last updated: {updated}</p>
          <h1 className="mt-1 text-[32px] font-semibold text-foreground">{title}</h1>
          <div className="neu-card mt-8 rounded-[16px] p-7 sm:p-8">
            {children}
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of service" updated="November 2026">
      <PolicySection title="1. Service">
        <p>ColdFox provides lead import, email templates, campaign sequences, unified inbox tools and deliverability checks. You connect your own email accounts and contact lists.</p>
      </PolicySection>
      <PolicySection title="2. Lawful use">
        <p>You must comply with applicable law when you use ColdFox, including CAN-SPAM, GDPR and CASL. Send only to recipients you have a lawful basis to contact.</p>
        <p>You must not use ColdFox for spam, harassment, phishing, fraud or deceptive content.</p>
      </PolicySection>
      <PolicySection title="3. Account responsibility">
        <p>You are responsible for keeping your account credentials secure and for activity under your account. Tell us about unauthorized access.</p>
      </PolicySection>
      <PolicySection title="4. Deliverability">
        <p>ColdFox does not guarantee inbox placement. Placement is decided by the receiving provider, based on your domain reputation, content and sending history.</p>
      </PolicySection>
      <PolicySection title="5. Your data">
        <p>You keep ownership of the leads, templates and campaign content you add. We do not sell your data. You can export or delete it from Settings.</p>
      </PolicySection>
      <PolicySection title="6. Liability">
        <p>To the extent permitted by law, ColdFox is not liable for indirect or consequential damage arising from use of the service.</p>
      </PolicySection>
      <PolicySection title="7. Changes">
        <p>We may update these terms. Material changes appear on this page with a new last updated date.</p>
      </PolicySection>
      <PolicySection title="8. Contact">
        <p>Use the Contact page for questions about these terms.</p>
      </PolicySection>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="November 2026">
      <PolicySection title="1. Data we collect">
        <p>Account information you provide such as name, email and company, your workspace settings, the leads and templates you add, and the logs needed to run campaigns and support.</p>
      </PolicySection>
      <PolicySection title="2. How we use it">
        <p>We use data to operate the workspace, send the email you configure, handle replies, provide support and keep the service secure. We do not sell personal data.</p>
      </PolicySection>
      <PolicySection title="3. Lead data">
        <p>Lead data you import is processed only to provide the outreach functions you configure. We do not use lead data for advertising.</p>
      </PolicySection>
      <PolicySection title="4. Mailbox access">
        <p>Credentials you enter for SMTP or IMAP are encrypted at rest and used only to send or sync the email you ask for.</p>
      </PolicySection>
      <PolicySection title="5. Security">
        <p>We use encryption and access controls to protect stored data. Account access requires authentication.</p>
      </PolicySection>
      <PolicySection title="6. Your choices">
        <p>Export leads and campaign data from Settings. Disconnect a mailbox or request account deletion at any time.</p>
      </PolicySection>
      <PolicySection title="7. Cookies">
        <p>We use essential cookies for sign-in and session handling. Analytics are aggregate and do not identify you personally.</p>
      </PolicySection>
      <PolicySection title="8. Contact">
        <p>Use the Contact page for privacy questions or data requests.</p>
      </PolicySection>
    </LegalShell>
  );
}

export function AcceptableUsePage() {
  return (
    <LegalShell title="Acceptable use policy" updated="November 2026">
      <PolicySection title="Permitted use">
        <p>ColdFox may be used for lawful B2B outreach, sales development, recruiting and business development communication with recipients you have a basis to contact.</p>
      </PolicySection>
      <PolicySection title="Prohibited use">
        <p>The following are not permitted:</p>
        <ul className="list-disc space-y-1 pl-5">
          {[
            'Sending unsolicited consumer email',
            'Harvesting or buying email lists without a lawful basis',
            'Misleading subject lines or sender identities',
            'Sending to contacts who have unsubscribed',
            'Phishing, fraud or illegal activity',
            'Sending malware or harmful content',
            'Breaking CAN-SPAM, GDPR, CASL or other applicable rules',
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-1 w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              {item}
            </li>
          ))}
        </ul>
      </PolicySection>
      <PolicySection title="Enforcement">
        <p>Violations may lead to account suspension or termination. We may investigate suspected violations and cooperate with lawful requests.</p>
      </PolicySection>
    </LegalShell>
  );
}

export function UnsubscribePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <PublicNavbar />
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full neu-inset-sm">
          <Check className="w-6 h-6 text-accent-foreground" />
        </div>
        <h1 className="text-[24px] font-semibold text-foreground">Unsubscribe</h1>
        <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
          To stop emails from a ColdFox user, open the unsubscribe link at the bottom of their email. That link processes your request directly.
        </p>
        <a href="/" className="mt-6 inline-block text-[13px] text-accent-foreground hover:underline">Return to ColdFox</a>
      </div>
    </div>
  );
}
