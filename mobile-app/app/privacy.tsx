import * as Linking from 'expo-linking';
import React from 'react';
import { Text } from 'react-native';

import LegalScreen, {
  LegalHighlight,
  LegalLink,
  LegalList,
  LegalParagraph,
  LegalScopeTable,
  LegalSection,
} from '../src/features/legal/LegalScreen';

const LAST_UPDATED = 'March 10, 2026';

export default function PrivacyRoute() {
  return (
    <LegalScreen
      switchHref="/terms"
      switchLabel="Terms"
      title="Privacy Policy"
      updatedAt={LAST_UPDATED}
    >
      <LegalSection title="1. Introduction">
        <LegalParagraph>
          This Privacy Policy explains how Life tracker collects, uses, and protects information when you use our
          services. Life tracker is operated by the Life tracker team.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <LegalParagraph>Depending on how you use the app, we may collect:</LegalParagraph>
        <LegalList
          items={[
            'Account information such as first name, last name, email address, and login credentials.',
            'App content you create: habits, habit categories, habit logs, tasks, task types, and calendar-related entries.',
            'Google account data when you connect Google Calendar: account email, profile picture, OAuth tokens, granted scopes, calendars, and events you choose to sync.',
            'Technical and usage data such as browser/device information, IP address, timestamps, and error logs.',
            'Essential storage and tracking data such as local storage keys required for login sessions, connected Google accounts, and in-app preferences. We do not use advertising cookies.',
          ]}
        />
        <LegalHighlight>We do not sell personal data, including Google user data.</LegalHighlight>
      </LegalSection>

      <LegalSection title="3. How We Use Data">
        <LegalParagraph>We use collected data to:</LegalParagraph>
        <LegalList
          items={[
            'Authenticate users and secure accounts.',
            'Provide habit tracking, task management, and calendar synchronization features.',
            'Improve product performance, reliability, and usability.',
            'Detect abuse, prevent fraud, and maintain service security.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Third-Party Services">
        <LegalParagraph>Life tracker relies on third-party services that may process data on our behalf:</LegalParagraph>
        <LegalList
          items={[
            'Google OAuth and Google Calendar APIs (account connection and calendar operations).',
            'Backend API infrastructure for account and app data processing.',
            'Hosting and operational providers used to run the web app and backend services.',
          ]}
        />
        <LegalParagraph>
          For Google OAuth verification clarity, these scopes are requested only when you connect Google Calendar:
        </LegalParagraph>
        <LegalScopeTable
          rows={[
            {
              label: 'calendar.readonly',
              description: 'Read your calendar events to display them inside Life tracker.',
            },
            {
              label: 'calendar.events',
              description: 'Create, edit, and delete events when you perform those actions.',
            },
            {
              label: 'calendar',
              description: 'Create calendars and manage calendar metadata when requested.',
            },
            {
              label: 'userinfo.email/profile',
              description: 'Identify connected accounts and show profile identity in-app.',
            },
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Data Storage & Security">
        <LegalParagraph>
          Data is stored in backend systems and in your browser local storage where needed for session management and
          Google account linking. We use reasonable technical and organizational safeguards, including authenticated
          access controls and encrypted transport (HTTPS), to protect data.
        </LegalParagraph>
        <LegalParagraph>
          We retain personal data only as long as needed to operate the service, comply with legal obligations, and
          resolve disputes.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. User Rights">
        <LegalParagraph>You may request access, correction, export, or deletion of your personal data.</LegalParagraph>
        <LegalParagraph>Data deletion options include:</LegalParagraph>
        <LegalList
          items={[
            'Disconnect Google accounts in-app (removes locally stored Google tokens from your browser).',
            'Log out to remove your session token from local storage.',
            'Email us to request deletion of your account and associated backend data.',
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Contact Information">
        <LegalParagraph>
          <Text>For privacy questions or deletion requests, contact: </Text>
          <LegalLink onPress={() => Linking.openURL('mailto:n.urch.lifetracker@gmail.com')}>
            n.urch.lifetracker@gmail.com
          </LegalLink>
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Policy Updates">
        <LegalParagraph>
          We may update this Privacy Policy from time to time. Material updates will be posted on this page with a new
          effective date.
        </LegalParagraph>
      </LegalSection>
    </LegalScreen>
  );
}
