import LegalScreen from '@/components/legal/LegalScreen';

export const metadata = {
  title: 'Terms of Service | Life tracker',
  description: 'Terms and conditions for using Life tracker.',
};

const LAST_UPDATED = 'March 10, 2026';

export default function TermsPage() {
  return (
    <LegalScreen
      title="Terms of Service"
      updatedAt={LAST_UPDATED}
      side="right"
      switchHref="/privacy"
      switchLabel="Privacy"
    >
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using Life tracker, you agree to be bound by these Terms of Service. If you do not agree, do
          not use the service.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          Life tracker is a productivity application that provides habit tracking, task management, and optional Google
          Calendar synchronization.
        </p>
      </section>

      <section>
        <h2>3. User Responsibilities</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service to violate any law or regulation.</li>
          <li>Attempt unauthorized access, disruption, reverse engineering, or abuse of systems.</li>
          <li>Automate misuse, spam, or run harmful traffic against the service.</li>
          <li>Upload or transmit malicious code or content that harms other users.</li>
        </ul>
      </section>

      <section>
        <h2>4. Account Rules</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and all activities
          occurring under your account. You must provide accurate account information and keep it updated.
        </p>
      </section>

      <section>
        <h2>5. Termination</h2>
        <p>
          We may suspend or terminate access to Life tracker, with or without notice, if we reasonably believe these
          terms were violated or if required for security, legal, or operational reasons.
        </p>
      </section>

      <section>
        <h2>6. Limitation of Liability</h2>
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. To
          the maximum extent allowed by law, Life tracker is not liable for indirect, incidental, special,
          consequential, or punitive damages, or for data loss, business interruption, or service unavailability.
        </p>
      </section>

      <section>
        <h2>7. Changes to Terms</h2>
        <p>
          We may modify these terms from time to time. Updates become effective when posted on this page with a new
          effective date. Continued use of the service means you accept the updated terms.
        </p>
      </section>

      <section>
        <h2>8. Governing Law</h2>
        <p>
          These Terms of Service are governed by and construed under the laws of Georgia, without regard to
          conflict-of-law principles.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For legal questions about these Terms of Service, contact:{' '}
          <a href="n.urch.lifetracker@gmail.com">n.urch.lifetracker@gmail.com</a>
        </p>
      </section>
    </LegalScreen>
  );
}
