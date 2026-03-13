import { ArrowLeft, Shield, Lock, Eye, Globe, UserCheck, Database, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-100/50 dark:from-black dark:via-purple-950/20 dark:to-black">
      {/* Header */}
      <div className="border-b border-purple-200/50 dark:border-purple-500/10 bg-white/60 dark:bg-black/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-sm">Privacy Policy</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/25 mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-900 to-purple-600 dark:from-white dark:to-purple-300">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last Updated: March 13, 2026</p>
        </div>

        {/* Quick Summary Card */}
        <div className="mb-10 p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 to-violet-500/5 border border-purple-200/50 dark:border-purple-500/20 dark:from-purple-500/10 dark:to-violet-500/10">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-purple-500" />
            Quick Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> We collect only data necessary for our service
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> Your data is encrypted and stored securely
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> We never sell your personal information
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> You can export or delete your data anytime
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> GDPR & CCPA compliant
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> Google API Limited Use compliant
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Section icon={<Globe className="h-4 w-4" />} title="1. Introduction">
            <p>
              Welcome to Malleabite ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile and web application.
            </p>
          </Section>

          <Section icon={<Database className="h-4 w-4" />} title="2. Information We Collect">
            <h4 className="font-semibold text-sm mt-4 mb-2">2.1 Information You Provide</h4>
            <ul>
              <li><strong>Account Information:</strong> Email address, name, password (encrypted)</li>
              <li><strong>Calendar Data:</strong> Events, todos, reminders, alarms, recurring events</li>
              <li><strong>Productivity Data:</strong> Eisenhower matrix items, Pomodoro sessions, time tracking</li>
              <li><strong>AI Interactions:</strong> Your conversations with Mally AI assistant</li>
              <li><strong>Payment Information:</strong> Processed securely through Stripe (we never store full credit card details)</li>
            </ul>

            <h4 className="font-semibold text-sm mt-4 mb-2">2.2 Automatically Collected Information</h4>
            <ul>
              <li><strong>Usage Data:</strong> Feature usage, session duration, interaction patterns</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
              <li><strong>Analytics:</strong> Anonymous usage statistics via Google Analytics</li>
            </ul>
          </Section>

          <Section icon={<Eye className="h-4 w-4" />} title="3. How We Use Your Information">
            <p>We use your information to:</p>
            <ul>
              <li>Provide, operate, and maintain our services</li>
              <li>Process your calendar events and productivity workflows</li>
              <li>Power Mally AI to provide intelligent scheduling assistance</li>
              <li>Process subscription payments and manage billing</li>
              <li>Send you service updates and important notifications</li>
              <li>Improve our services through analytics and user feedback</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </Section>

          <Section icon={<Lock className="h-4 w-4" />} title="4. Data Storage and Security">
            <h4 className="font-semibold text-sm mt-4 mb-2">4.1 Where We Store Data</h4>
            <p>
              Your data is stored in Firebase Cloud Firestore, hosted on Google Cloud Platform servers. Data is encrypted in transit (TLS/SSL) and at rest.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">4.2 Security Measures</h4>
            <ul>
              <li>Firebase Authentication with industry-standard encryption</li>
              <li>Firestore security rules enforcing user-level access control</li>
              <li>Regular security audits and updates</li>
              <li>HTTPS encryption for all data transmission</li>
            </ul>
          </Section>

          <Section icon={<Shield className="h-4 w-4" />} title="5. Data Sharing and Third Parties">
            <h4 className="font-semibold text-sm mt-4 mb-2">5.1 Service Providers</h4>
            <p>We share data with trusted service providers:</p>
            <ul>
              <li><strong>Google Firebase:</strong> Database, authentication, cloud functions</li>
              <li><strong>Anthropic/Google:</strong> AI processing for Mally AI (prompts and responses only)</li>
              <li><strong>Stripe:</strong> Payment processing (PCI DSS compliant)</li>
              <li><strong>Google Analytics:</strong> Anonymous usage analytics</li>
            </ul>

            {/* Google Calendar API Disclosure - required for OAuth verification */}
            <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-200/50 dark:border-blue-500/20 dark:bg-blue-500/10">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                5.2 Google Calendar Integration
              </h4>
              <p className="text-sm mb-3">
                When you connect your Google Calendar account, Malleabite accesses and processes the following data through the Google Calendar API:
              </p>
              <ul className="text-sm">
                <li><strong>Calendar list:</strong> Names and identifiers of your Google calendars</li>
                <li><strong>Calendar events:</strong> Event titles, descriptions, times, locations, and attendee lists</li>
                <li><strong>Account information:</strong> Your Google account email address and display name</li>
              </ul>

              <p className="text-sm font-medium mt-3 mb-2">How we use this data:</p>
              <ul className="text-sm">
                <li>Display your Google Calendar events within the Malleabite interface</li>
                <li>Create, update, and delete events in your Google Calendar when you make changes in Malleabite</li>
                <li>Keep your calendars synchronized between Malleabite and Google Calendar</li>
              </ul>

              <p className="text-sm font-medium mt-3 mb-2">How we store and protect this data:</p>
              <ul className="text-sm">
                <li>Google OAuth tokens are encrypted using AES-256-GCM and stored in Firebase Cloud Firestore</li>
                <li>Access tokens are short-lived (1 hour) and refresh tokens are stored server-side only</li>
                <li>Calendar event data displayed in Malleabite is synced periodically and cached securely</li>
                <li>We do not share your Google Calendar data with any third parties beyond what is described in this policy</li>
              </ul>

              <p className="text-sm font-medium mt-3 mb-2">Revoking access:</p>
              <ul className="text-sm">
                <li>You can disconnect your Google Calendar at any time in Settings → Integrations</li>
                <li>You can also revoke access from your <a href="https://myaccount.google.com/permissions" className="text-blue-600 dark:text-blue-400 hover:underline">Google Account permissions page</a></li>
                <li>Upon disconnection, all stored Google tokens and synced calendar data are deleted from our servers</li>
              </ul>

              <p className="text-xs text-muted-foreground mt-3">
                Malleabite's use and transfer of information received from Google APIs adheres to the{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </p>
            </div>

            <h4 className="font-semibold text-sm mt-4 mb-2">5.3 We Never Sell Your Data</h4>
            <p>
              We do not sell, rent, or trade your personal information to third parties for marketing purposes.
            </p>
          </Section>

          <Section icon={<UserCheck className="h-4 w-4" />} title="6. Your Rights and Choices">
            <h4 className="font-semibold text-sm mt-4 mb-2">6.1 Access and Control</h4>
            <ul>
              <li><strong>Access:</strong> View all your data in Settings → Data & Privacy</li>
              <li><strong>Export:</strong> Download your data in JSON or ICS format</li>
              <li><strong>Delete:</strong> Request account deletion (processed within 30 days)</li>
              <li><strong>Correct:</strong> Update your information at any time</li>
            </ul>

            <h4 className="font-semibold text-sm mt-4 mb-2">6.2 Cookie Preferences</h4>
            <p>
              You can manage cookie preferences in your browser settings. Note that disabling cookies may limit functionality.
            </p>
          </Section>

          <Section icon={<Trash2 className="h-4 w-4" />} title="7. Data Retention">
            <ul>
              <li><strong>Active Accounts:</strong> Data retained while account is active</li>
              <li><strong>Deleted Accounts:</strong> Data permanently deleted within 30 days</li>
              <li><strong>Legal Requirements:</strong> Some data may be retained longer to comply with legal obligations</li>
            </ul>
          </Section>

          <Section icon={<Globe className="h-4 w-4" />} title="8. International Data Transfers">
            <p>
              Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers, including compliance with GDPR for EU users and CCPA for California residents.
            </p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>
              Our service is not directed to children under 13 (or 16 in the EU). We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us immediately.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Your continued use after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="11. California Privacy Rights (CCPA)">
            <p>California residents have additional rights:</p>
            <ul>
              <li>Right to know what personal information is collected</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of data sales (we don't sell data)</li>
              <li>Right to non-discrimination for exercising rights</li>
            </ul>
          </Section>

          <Section title="12. GDPR Rights (EU Users)">
            <p>EU residents have these rights:</p>
            <ul>
              <li>Right to access your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent</li>
            </ul>
          </Section>

          <Section title="13. Contact Us">
            <p>For privacy questions or to exercise your rights:</p>
            <ul>
              <li><strong>Email:</strong> privacy@malleabite.com</li>
              <li><strong>In-App:</strong> Settings → Help & Support → Privacy Request</li>
              <li><strong>Response Time:</strong> We aim to respond within 48 hours</li>
            </ul>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-purple-200/50 dark:border-purple-500/10 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <Link to="/legal/terms" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              Terms of Service
            </Link>
            <span>·</span>
            <Link to="/legal/privacy" className="text-purple-600 dark:text-purple-400 font-medium">
              Privacy Policy
            </Link>
          </div>
          <p className="mt-2">© {new Date().getFullYear()} Malleabite. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

/** Reusable section component for consistent styling */
function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 md:p-6 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-purple-200/40 dark:border-purple-500/10 shadow-sm">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3 text-purple-900 dark:text-purple-200">
        {icon && <span className="text-purple-500">{icon}</span>}
        {title}
      </h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mt-2 [&_strong]:text-foreground [&_strong]:font-medium [&_h4]:text-foreground">
        {children}
      </div>
    </div>
  );
}
