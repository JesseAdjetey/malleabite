import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function TermsOfService() {
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
          <h1>Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: December 20, 2025</p>

          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using Malleabite ("Service," "App," "we," or "us"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Malleabite is a productivity and calendar management application that provides:
          </p>
          <ul>
            <li>Calendar event management and scheduling</li>
            <li>Todo lists and task management</li>
            <li>Productivity modules (Eisenhower Matrix, Pomodoro Timer, Time Tracking)</li>
            <li>AI-powered scheduling assistant (Mally AI)</li>
            <li>Analytics and productivity insights</li>
            <li>Team collaboration features (Pro and Teams plans)</li>
          </ul>

          <h2>3. Account Registration</h2>
          
          <h3>3.1 Eligibility</h3>
          <p>
            You must be at least 13 years old (or 16 in the EU) to use this Service. By registering, you represent that you meet this age requirement.
          </p>

          <h3>3.2 Account Security</h3>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your password</li>
            <li>You are responsible for all activities under your account</li>
            <li>Notify us immediately of any unauthorized access</li>
            <li>We are not liable for losses from unauthorized use of your account</li>
          </ul>

          <h3>3.3 Accurate Information</h3>
          <p>
            You agree to provide accurate, current, and complete information during registration and to update it as necessary.
          </p>

          <h2>4. Subscription Plans and Billing</h2>
          
          <h3>4.1 Plan Types</h3>
          <ul>
            <li><strong>Free Plan:</strong> Limited features (50 events/month, 3 modules, 10 AI requests/month)</li>
            <li><strong>Pro Plan:</strong> $9.99/month - Unlimited features, advanced analytics, priority support</li>
            <li><strong>Teams Plan:</strong> $7/user/month - All Pro features plus team collaboration</li>
          </ul>

          <h3>4.2 Billing</h3>
          <ul>
            <li>Subscriptions are billed monthly or annually in advance</li>
            <li>Payment is processed through Stripe</li>
            <li>Prices are in USD unless otherwise stated</li>
            <li>You authorize us to charge your payment method on a recurring basis</li>
          </ul>

          <h3>4.3 Cancellation and Refunds</h3>
          <ul>
            <li>You may cancel your subscription at any time from Settings → Billing</li>
            <li>Cancellation takes effect at the end of the current billing period</li>
            <li>No refunds for partial months or unused features</li>
            <li>30-day money-back guarantee for first-time annual subscribers</li>
          </ul>

          <h3>4.4 Price Changes</h3>
          <p>
            We reserve the right to modify subscription prices with 30 days' notice. Existing subscribers will be grandfathered at their current price for 12 months.
          </p>

          <h2>5. Acceptable Use Policy</h2>
          
          <h3>5.1 You Agree NOT to:</h3>
          <ul>
            <li>Use the Service for any illegal purpose</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Upload malware, viruses, or malicious code</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Use automated systems (bots, scrapers) without permission</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Share your account with others (except within Teams plans)</li>
            <li>Resell or redistribute the Service</li>
          </ul>

          <h3>5.2 Enforcement</h3>
          <p>
            Violation of these terms may result in account suspension or termination without refund.
          </p>

          <h2>6. Intellectual Property</h2>
          
          <h3>6.1 Our Rights</h3>
          <p>
            The Service, including its original content, features, and functionality, is owned by Malleabite and is protected by international copyright, trademark, and other intellectual property laws.
          </p>

          <h3>6.2 Your Rights</h3>
          <p>
            You retain ownership of all content you create or upload to the Service (events, todos, notes). You grant us a license to use this content solely to provide the Service.
          </p>

          <h3>6.3 Feedback</h3>
          <p>
            Any feedback, suggestions, or ideas you provide may be used by us without compensation or attribution.
          </p>

          <h2>7. AI Assistant (Mally AI)</h2>
          
          <h3>7.1 AI Limitations</h3>
          <ul>
            <li>Mally AI is powered by third-party AI models (Anthropic Claude, Google Gemini)</li>
            <li>AI responses may not always be accurate or appropriate</li>
            <li>You are responsible for verifying AI-created calendar events</li>
            <li>We are not liable for errors or omissions in AI-generated content</li>
          </ul>

          <h3>7.2 AI Usage Limits</h3>
          <p>
            AI request limits are enforced per subscription tier. Excessive usage may result in temporary rate limiting.
          </p>

          <h2>8. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our <a href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</a>. By using the Service, you consent to our data practices as described in the Privacy Policy.
          </p>

          <h2>9. Service Availability</h2>
          
          <h3>9.1 Uptime</h3>
          <p>
            We strive for 99.9% uptime but do not guarantee uninterrupted access. We may suspend the Service for maintenance with reasonable notice.
          </p>

          <h3>9.2 Changes to Service</h3>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Service at any time with 30 days' notice for paid features.
          </p>

          <h2>10. Disclaimers and Limitations of Liability</h2>
          
          <h3>10.1 "As Is" Provision</h3>
          <p>
            THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>

          <h3>10.2 Limitation of Liability</h3>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, MALLEABITE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION.
          </p>

          <h3>10.3 Maximum Liability</h3>
          <p>
            Our total liability to you for any claims arising from these Terms shall not exceed the amount you paid us in the 12 months preceding the claim.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold Malleabite harmless from any claims, damages, or expenses arising from your use of the Service, violation of these Terms, or infringement of third-party rights.
          </p>

          <h2>12. Termination</h2>
          
          <h3>12.1 By You</h3>
          <p>
            You may close your account at any time through Settings → Account → Delete Account.
          </p>

          <h3>12.2 By Us</h3>
          <p>
            We may suspend or terminate your account for violations of these Terms, non-payment, or at our discretion with 30 days' notice for paid accounts.
          </p>

          <h3>12.3 Effect of Termination</h3>
          <p>
            Upon termination, your right to use the Service ceases immediately. You may export your data within 30 days; after that, data will be permanently deleted.
          </p>

          <h2>13. Dispute Resolution</h2>
          
          <h3>13.1 Informal Resolution</h3>
          <p>
            Before filing any claim, you agree to contact us at support@malleabite.com to resolve the dispute informally.
          </p>

          <h3>13.2 Arbitration</h3>
          <p>
            Any disputes not resolved informally will be settled through binding arbitration in accordance with the American Arbitration Association rules.
          </p>

          <h3>13.3 Class Action Waiver</h3>
          <p>
            You agree to resolve disputes individually and waive the right to participate in class actions.
          </p>

          <h2>14. Governing Law</h2>
          <p>
            These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles.
          </p>

          <h2>15. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Material changes will be notified via email 30 days in advance. Continued use after changes constitutes acceptance.
          </p>

          <h2>16. Miscellaneous</h2>
          
          <h3>16.1 Entire Agreement</h3>
          <p>
            These Terms constitute the entire agreement between you and Malleabite.
          </p>

          <h3>16.2 Severability</h3>
          <p>
            If any provision is found unenforceable, the remaining provisions continue in effect.
          </p>

          <h3>16.3 No Waiver</h3>
          <p>
            Our failure to enforce any right does not waive that right.
          </p>

          <h2>17. Contact Information</h2>
          <p>For questions about these Terms:</p>
          <ul>
            <li><strong>Email:</strong> legal@malleabite.com</li>
            <li><strong>Support:</strong> support@malleabite.com</li>
            <li><strong>In-App:</strong> Settings → Help & Support</li>
          </ul>

          <div className="bg-muted p-6 rounded-lg mt-8">
            <h3 className="text-lg font-semibold mb-2">Key Points</h3>
            <ul className="space-y-1 text-sm">
              <li>✅ You must be 13+ years old to use Malleabite</li>
              <li>✅ Subscriptions billed monthly with 30-day cancellation notice</li>
              <li>✅ You own your data; we just host it</li>
              <li>✅ AI features may not be 100% accurate - always verify</li>
              <li>✅ We can modify service with reasonable notice</li>
              <li>✅ Disputes resolved through arbitration</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
