import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: December 20, 2025</p>

          <h2>1. Introduction</h2>
          <p>
            Welcome to Malleabite ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile and web application.
          </p>

          <h2>2. Information We Collect</h2>
          
          <h3>2.1 Information You Provide</h3>
          <ul>
            <li><strong>Account Information:</strong> Email address, name, password (encrypted)</li>
            <li><strong>Calendar Data:</strong> Events, todos, reminders, alarms, recurring events</li>
            <li><strong>Productivity Data:</strong> Eisenhower matrix items, Pomodoro sessions, time tracking</li>
            <li><strong>AI Interactions:</strong> Your conversations with Mally AI assistant</li>
            <li><strong>Payment Information:</strong> Processed securely through Stripe (we never store full credit card details)</li>
          </ul>

          <h3>2.2 Automatically Collected Information</h3>
          <ul>
            <li><strong>Usage Data:</strong> Feature usage, session duration, interaction patterns</li>
            <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
            <li><strong>Analytics:</strong> Anonymous usage statistics via Google Analytics</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
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

          <h2>4. Data Storage and Security</h2>
          
          <h3>4.1 Where We Store Data</h3>
          <p>
            Your data is stored in Firebase Cloud Firestore, hosted on Google Cloud Platform servers. Data is encrypted in transit (TLS/SSL) and at rest.
          </p>

          <h3>4.2 Security Measures</h3>
          <ul>
            <li>Firebase Authentication with industry-standard encryption</li>
            <li>Firestore security rules enforcing user-level access control</li>
            <li>Regular security audits and updates</li>
            <li>HTTPS encryption for all data transmission</li>
          </ul>

          <h2>5. Data Sharing and Third Parties</h2>
          
          <h3>5.1 Service Providers</h3>
          <p>We share data with trusted service providers:</p>
          <ul>
            <li><strong>Google Firebase:</strong> Database, authentication, cloud functions</li>
            <li><strong>Anthropic/Google:</strong> AI processing for Mally AI (prompts and responses only)</li>
            <li><strong>Stripe:</strong> Payment processing (PCI DSS compliant)</li>
            <li><strong>Google Analytics:</strong> Anonymous usage analytics</li>
          </ul>

          <h3>5.2 We Never Sell Your Data</h3>
          <p>
            We do not sell, rent, or trade your personal information to third parties for marketing purposes.
          </p>

          <h2>6. Your Rights and Choices</h2>
          
          <h3>6.1 Access and Control</h3>
          <ul>
            <li><strong>Access:</strong> View all your data in Settings → Data & Privacy</li>
            <li><strong>Export:</strong> Download your data in JSON or ICS format</li>
            <li><strong>Delete:</strong> Request account deletion (processed within 30 days)</li>
            <li><strong>Correct:</strong> Update your information at any time</li>
          </ul>

          <h3>6.2 Cookie Preferences</h3>
          <p>
            You can manage cookie preferences in your browser settings. Note that disabling cookies may limit functionality.
          </p>

          <h2>7. Data Retention</h2>
          <ul>
            <li><strong>Active Accounts:</strong> Data retained while account is active</li>
            <li><strong>Deleted Accounts:</strong> Data permanently deleted within 30 days</li>
            <li><strong>Legal Requirements:</strong> Some data may be retained longer to comply with legal obligations</li>
          </ul>

          <h2>8. International Data Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for such transfers, including compliance with GDPR for EU users and CCPA for California residents.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Our service is not directed to children under 13 (or 16 in the EU). We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us immediately.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Your continued use after changes constitutes acceptance.
          </p>

          <h2>11. California Privacy Rights (CCPA)</h2>
          <p>California residents have additional rights:</p>
          <ul>
            <li>Right to know what personal information is collected</li>
            <li>Right to delete personal information</li>
            <li>Right to opt-out of data sales (we don't sell data)</li>
            <li>Right to non-discrimination for exercising rights</li>
          </ul>

          <h2>12. GDPR Rights (EU Users)</h2>
          <p>EU residents have these rights:</p>
          <ul>
            <li>Right to access your personal data</li>
            <li>Right to rectification of inaccurate data</li>
            <li>Right to erasure ("right to be forgotten")</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
            <li>Right to withdraw consent</li>
          </ul>

          <h2>13. Contact Us</h2>
          <p>For privacy questions or to exercise your rights:</p>
          <ul>
            <li><strong>Email:</strong> privacy@malleabite.com</li>
            <li><strong>In-App:</strong> Settings → Help & Support → Privacy Request</li>
            <li><strong>Response Time:</strong> We aim to respond within 48 hours</li>
          </ul>

          <div className="bg-muted p-6 rounded-lg mt-8">
            <h3 className="text-lg font-semibold mb-2">Quick Summary</h3>
            <ul className="space-y-1 text-sm">
              <li>✅ We collect only data necessary to provide our service</li>
              <li>✅ Your data is encrypted and stored securely</li>
              <li>✅ We never sell your personal information</li>
              <li>✅ You can export or delete your data anytime</li>
              <li>✅ We comply with GDPR, CCPA, and international privacy laws</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
