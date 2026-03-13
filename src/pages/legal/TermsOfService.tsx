import { ArrowLeft, FileText, Shield, UserCheck, Scale, AlertTriangle, BrainCircuit, Clock, Ban, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
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
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-sm">Terms of Service</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/25 mb-4">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-900 to-purple-600 dark:from-white dark:to-purple-300">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Last Updated: March 13, 2026</p>
        </div>

        {/* Quick Summary Card */}
        <div className="mb-10 p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 to-violet-500/5 border border-purple-200/50 dark:border-purple-500/20 dark:from-purple-500/10 dark:to-violet-500/10">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-purple-500" />
            Key Points
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> You must be 13+ years old to use Malleabite
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> You own your data; we just host it
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> Cancel your subscription anytime
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> AI features may not be 100% accurate
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> We modify service with reasonable notice
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-green-500">✓</span> Disputes resolved through arbitration
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Section icon={<Scale className="h-4 w-4" />} title="1. Agreement to Terms">
            <p>
              By accessing or using Malleabite ("Service," "App," "we," or "us"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </Section>

          <Section icon={<FileText className="h-4 w-4" />} title="2. Description of Service">
            <p>Malleabite is a productivity and calendar management application that provides:</p>
            <ul>
              <li>Calendar event management and scheduling</li>
              <li>Todo lists and task management</li>
              <li>Productivity modules (Eisenhower Matrix, Pomodoro Timer, Time Tracking)</li>
              <li>AI-powered scheduling assistant (Mally AI)</li>
              <li>Analytics and productivity insights</li>
              <li>Team collaboration features</li>
            </ul>
          </Section>

          <Section icon={<UserCheck className="h-4 w-4" />} title="3. Account Registration">
            <h4 className="font-semibold text-sm mt-4 mb-2">3.1 Eligibility</h4>
            <p>
              You must be at least 13 years old (or 16 in the EU) to use this Service. By registering, you represent that you meet this age requirement.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">3.2 Account Security</h4>
            <ul>
              <li>You are responsible for maintaining the confidentiality of your password</li>
              <li>You are responsible for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>We are not liable for losses from unauthorized use of your account</li>
            </ul>

            <h4 className="font-semibold text-sm mt-4 mb-2">3.3 Accurate Information</h4>
            <p>
              You agree to provide accurate, current, and complete information during registration and to update it as necessary.
            </p>
          </Section>

          <Section icon={<Clock className="h-4 w-4" />} title="4. Subscription Plans and Billing">
            <h4 className="font-semibold text-sm mt-4 mb-2">4.1 Plan Types</h4>
            <p>
              Malleabite offers both free and paid subscription plans. The features and limits available vary by plan. Current plan details, pricing, and feature comparisons are available on our <Link to="/pricing" className="text-purple-600 dark:text-purple-400 hover:underline">Pricing page</Link>.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">4.2 Billing</h4>
            <ul>
              <li>Subscriptions are billed monthly or annually in advance</li>
              <li>Payment is processed through Stripe</li>
              <li>Prices are in USD unless otherwise stated</li>
              <li>You authorize us to charge your payment method on a recurring basis</li>
            </ul>

            <h4 className="font-semibold text-sm mt-4 mb-2">4.3 Cancellation and Refunds</h4>
            <ul>
              <li>You may cancel your subscription at any time from Settings → Billing</li>
              <li>Cancellation takes effect at the end of the current billing period</li>
              <li>No refunds for partial months or unused features</li>
            </ul>

            <h4 className="font-semibold text-sm mt-4 mb-2">4.4 Price Changes</h4>
            <p>
              We reserve the right to modify subscription prices with 30 days' notice. Existing subscribers will be notified in advance of any changes to their plan pricing.
            </p>
          </Section>

          <Section icon={<Ban className="h-4 w-4" />} title="5. Acceptable Use Policy">
            <h4 className="font-semibold text-sm mt-4 mb-2">5.1 You Agree NOT to:</h4>
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

            <h4 className="font-semibold text-sm mt-4 mb-2">5.2 Enforcement</h4>
            <p>
              Violation of these terms may result in account suspension or termination without refund.
            </p>
          </Section>

          <Section icon={<Shield className="h-4 w-4" />} title="6. Intellectual Property">
            <h4 className="font-semibold text-sm mt-4 mb-2">6.1 Our Rights</h4>
            <p>
              The Service, including its original content, features, and functionality, is owned by Malleabite and is protected by international copyright, trademark, and other intellectual property laws.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">6.2 Your Rights</h4>
            <p>
              You retain ownership of all content you create or upload to the Service (events, todos, notes). You grant us a license to use this content solely to provide the Service.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">6.3 Feedback</h4>
            <p>
              Any feedback, suggestions, or ideas you provide may be used by us without compensation or attribution.
            </p>
          </Section>

          <Section icon={<BrainCircuit className="h-4 w-4" />} title="7. AI Assistant (Mally AI)">
            <h4 className="font-semibold text-sm mt-4 mb-2">7.1 AI Limitations</h4>
            <ul>
              <li>Mally AI is powered by third-party AI models (Anthropic Claude, Google Gemini)</li>
              <li>AI responses may not always be accurate or appropriate</li>
              <li>You are responsible for verifying AI-created calendar events</li>
              <li>We are not liable for errors or omissions in AI-generated content</li>
            </ul>

            <h4 className="font-semibold text-sm mt-4 mb-2">7.2 AI Usage Limits</h4>
            <p>
              AI request limits are enforced per subscription tier. Excessive usage may result in temporary rate limiting.
            </p>
          </Section>

          <Section title="8. Data and Privacy">
            <p>
              Your use of the Service is also governed by our <Link to="/legal/privacy" className="text-purple-600 dark:text-purple-400 hover:underline">Privacy Policy</Link>. By using the Service, you consent to our data practices as described in the Privacy Policy.
            </p>
          </Section>

          <Section title="9. Service Availability">
            <h4 className="font-semibold text-sm mt-4 mb-2">9.1 Uptime</h4>
            <p>
              We strive for 99.9% uptime but do not guarantee uninterrupted access. We may suspend the Service for maintenance with reasonable notice.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">9.2 Changes to Service</h4>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time with 30 days' notice for paid features.
            </p>
          </Section>

          <Section icon={<AlertTriangle className="h-4 w-4" />} title="10. Disclaimers and Limitations of Liability">
            <h4 className="font-semibold text-sm mt-4 mb-2">10.1 "As Is" Provision</h4>
            <p className="uppercase text-xs tracking-wide">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">10.2 Limitation of Liability</h4>
            <p className="uppercase text-xs tracking-wide">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, MALLEABITE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">10.3 Maximum Liability</h4>
            <p>
              Our total liability to you for any claims arising from these Terms shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </Section>

          <Section title="11. Indemnification">
            <p>
              You agree to indemnify and hold Malleabite harmless from any claims, damages, or expenses arising from your use of the Service, violation of these Terms, or infringement of third-party rights.
            </p>
          </Section>

          <Section title="12. Termination">
            <h4 className="font-semibold text-sm mt-4 mb-2">12.1 By You</h4>
            <p>You may close your account at any time through Settings → Account → Delete Account.</p>

            <h4 className="font-semibold text-sm mt-4 mb-2">12.2 By Us</h4>
            <p>
              We may suspend or terminate your account for violations of these Terms, non-payment, or at our discretion with 30 days' notice for paid accounts.
            </p>

            <h4 className="font-semibold text-sm mt-4 mb-2">12.3 Effect of Termination</h4>
            <p>
              Upon termination, your right to use the Service ceases immediately. You may export your data within 30 days; after that, data will be permanently deleted.
            </p>
          </Section>

          <Section title="13. Dispute Resolution">
            <h4 className="font-semibold text-sm mt-4 mb-2">13.1 Informal Resolution</h4>
            <p>Before filing any claim, you agree to contact us at support@malleabite.com to resolve the dispute informally.</p>

            <h4 className="font-semibold text-sm mt-4 mb-2">13.2 Arbitration</h4>
            <p>Any disputes not resolved informally will be settled through binding arbitration in accordance with the American Arbitration Association rules.</p>

            <h4 className="font-semibold text-sm mt-4 mb-2">13.3 Class Action Waiver</h4>
            <p>You agree to resolve disputes individually and waive the right to participate in class actions.</p>
          </Section>

          <Section icon={<Globe className="h-4 w-4" />} title="14. Governing Law">
            <p>These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.</p>
          </Section>

          <Section title="15. Changes to Terms">
            <p>
              We may modify these Terms at any time. Material changes will be notified via email 30 days in advance. Continued use after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="16. Miscellaneous">
            <h4 className="font-semibold text-sm mt-4 mb-2">16.1 Entire Agreement</h4>
            <p>These Terms constitute the entire agreement between you and Malleabite.</p>

            <h4 className="font-semibold text-sm mt-4 mb-2">16.2 Severability</h4>
            <p>If any provision is found unenforceable, the remaining provisions continue in effect.</p>

            <h4 className="font-semibold text-sm mt-4 mb-2">16.3 No Waiver</h4>
            <p>Our failure to enforce any right does not waive that right.</p>
          </Section>

          <Section title="17. Contact Information">
            <p>For questions about these Terms:</p>
            <ul>
              <li><strong>Email:</strong> legal@malleabite.com</li>
              <li><strong>Support:</strong> support@malleabite.com</li>
              <li><strong>In-App:</strong> Settings → Help & Support</li>
            </ul>
          </Section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-purple-200/50 dark:border-purple-500/10 text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <Link to="/legal/terms" className="text-purple-600 dark:text-purple-400 font-medium">
              Terms of Service
            </Link>
            <span>·</span>
            <Link to="/legal/privacy" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
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
