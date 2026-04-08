import * as Linking from 'expo-linking';
import React from 'react';
import { Text } from 'react-native';

import LegalScreen, {
  LegalLink,
  LegalList,
  LegalParagraph,
  LegalSection,
} from '../src/features/legal/LegalScreen';

const LAST_UPDATED = 'March 10, 2026';

export default function TermsRoute() {
  return (
    <LegalScreen
      switchHref="/privacy"
      switchLabel="Privacy"
      title="Terms of Service"
      updatedAt={LAST_UPDATED}
    >
      <LegalSection title="1. Acceptance of Terms">
        <LegalParagraph>
          By accessing or using Life tracker, you agree to be bound by these Terms of Service. If you do not agree, do
          not use the service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <LegalParagraph>
          Life tracker is a productivity application that provides habit tracking, task management, and optional Google
          Calendar synchronization.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. User Responsibilities">
        <LegalParagraph>You agree not to:</LegalParagraph>
        <LegalList
          items={[
            'Use the service to violate any law or regulation.',
            'Attempt unauthorized access, disruption, reverse engineering, or abuse of systems.',
            'Automate misuse, spam, or run harmful traffic against the service.',
            'Upload or transmit malicious code or content that harms other users.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Account Rules">
        <LegalParagraph>
          You are responsible for maintaining the confidentiality of your account credentials and all activities
          occurring under your account. You must provide accurate account information and keep it updated.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Termination">
        <LegalParagraph>
          We may suspend or terminate access to Life tracker, with or without notice, if we reasonably believe these
          terms were violated or if required for security, legal, or operational reasons.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Limitation of Liability">
        <LegalParagraph>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of
          any kind. To the maximum extent allowed by law, Life tracker is not liable for indirect, incidental,
          special, consequential, or punitive damages, or for data loss, business interruption, or service
          unavailability.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Changes to Terms">
        <LegalParagraph>
          We may modify these terms from time to time. Updates become effective when posted on this page with a new
          effective date. Continued use of the service means you accept the updated terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Governing Law">
        <LegalParagraph>
          These Terms of Service are governed by and construed under the laws of Georgia, without regard to
          conflict-of-law principles.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalParagraph>
          <Text>For legal questions about these Terms of Service, contact: </Text>
          <LegalLink onPress={() => Linking.openURL('mailto:n.urch.lifetracker@gmail.com')}>
            n.urch.lifetracker@gmail.com
          </LegalLink>
        </LegalParagraph>
      </LegalSection>
    </LegalScreen>
  );
}
