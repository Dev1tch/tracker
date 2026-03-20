import LegalScreen from '@/components/legal/LegalScreen';

export const metadata = {
  title: 'Privacy Policy | Life tracker',
  description: 'How Life tracker collects, uses, and protects your data.',
};

const LAST_UPDATED = 'March 10, 2026';

export default function PrivacyPage() {
  return (
    <LegalScreen
      title="Privacy Policy"
      updatedAt={LAST_UPDATED}
      side="left"
      switchHref="/terms"
      switchLabel="Terms"
    >
      <section>
        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy explains how Life tracker collects, uses, and protects information when you use our
          services. Life tracker is operated by the Life tracker team.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>Depending on how you use the app, we may collect:</p>
        <ul>
          <li>Account information such as first name, last name, email address, and login credentials.</li>
          <li>
            App content you create: habits, habit categories, habit logs, tasks, task types, and calendar-related
            entries.
          </li>
          <li>
            Google account data when you connect Google Calendar: account email, profile picture, OAuth tokens,
            granted scopes, calendars, and events you choose to sync.
          </li>
          <li>Technical and usage data such as browser/device information, IP address, timestamps, and error logs.</li>
          <li>
            Essential storage and tracking data such as local storage keys required for login sessions, connected
            Google accounts, and in-app preferences. We do not use advertising cookies.
          </li>
        </ul>
        <div className="legalHighlight">
          <p>We do not sell personal data, including Google user data.</p>
        </div>
      </section>

      <section>
        <h2>3. How We Use Data</h2>
        <p>We use collected data to:</p>
        <ul>
          <li>Authenticate users and secure accounts.</li>
          <li>Provide habit tracking, task management, and calendar synchronization features.</li>
          <li>Improve product performance, reliability, and usability.</li>
          <li>Detect abuse, prevent fraud, and maintain service security.</li>
        </ul>
      </section>

      <section>
        <h2>4. Third-Party Services</h2>
        <p>Life tracker relies on third-party services that may process data on our behalf:</p>
        <ul>
          <li>Google OAuth and Google Calendar APIs (account connection and calendar operations).</li>
          <li>Backend API infrastructure for account and app data processing.</li>
          <li>Hosting and operational providers used to run the web app and backend services.</li>
        </ul>
        <p>For Google OAuth verification clarity, these scopes are requested only when you connect Google Calendar:</p>
        <div className="legalScopeTable">
          <div className="legalScopeRow">
            <span>calendar.readonly</span>
            <span>Read your calendar events to display them inside Life tracker.</span>
          </div>
          <div className="legalScopeRow">
            <span>calendar.events</span>
            <span>Create, edit, and delete events when you perform those actions.</span>
          </div>
          <div className="legalScopeRow">
            <span>calendar</span>
            <span>Create calendars and manage calendar metadata when requested.</span>
          </div>
          <div className="legalScopeRow">
            <span>userinfo.email/profile</span>
            <span>Identify connected accounts and show profile identity in-app.</span>
          </div>
        </div>
      </section>

      <section>
        <h2>5. Data Storage &amp; Security</h2>
        <p>
          Data is stored in backend systems and in your browser local storage where needed for session management and
          Google account linking. We use reasonable technical and organizational safeguards, including authenticated
          access controls and encrypted transport (HTTPS), to protect data.
        </p>
        <p>
          We retain personal data only as long as needed to operate the service, comply with legal obligations, and
          resolve disputes.
        </p>
      </section>

      <section>
        <h2>6. User Rights</h2>
        <p>You may request access, correction, export, or deletion of your personal data.</p>
        <p>Data deletion options include:</p>
        <ul>
          <li>Disconnect Google accounts in-app (removes locally stored Google tokens from your browser).</li>
          <li>Log out to remove your session token from local storage.</li>
          <li>Email us to request deletion of your account and associated backend data.</li>
        </ul>
      </section>

      <section>
        <h2>7. Contact Information</h2>
        <p>
          For privacy questions or deletion requests, contact:{' '}
          <a href="mailto:n.urch.lifetracker@gmail.com">n.urch.lifetracker@gmail.com</a>
        </p>
      </section>

      <section>
        <h2>8. Policy Updates</h2>
        <p>
          We may update this Privacy Policy from time to time. Material updates will be posted on this page with a new
          effective date.
        </p>
      </section>
    </LegalScreen>
  );
}
