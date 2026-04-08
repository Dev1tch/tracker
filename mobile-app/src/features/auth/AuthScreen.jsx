import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import zxcvbn from 'zxcvbn';

import ParticleNetworkBackground from '../../components/ParticleNetworkBackground';
import Wordmark from '../../components/Wordmark';
import { useAuth } from '../../providers/AuthProvider';
import { theme } from '../../theme';
import { EMAIL_REGEX } from '../../utils/validation';

function AuthField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  autoComplete,
  autoCorrect = false,
  keyboardType,
  textContentType,
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <View style={[styles.inputAccent, isFocused ? styles.inputAccentActive : null]} />
      {!value ? <Text style={styles.inputPlaceholder}>{placeholder}</Text> : null}
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onBlur={() => setIsFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        secureTextEntry={secureTextEntry}
        selectionColor="#ffffff"
        style={styles.input}
        textContentType={textContentType}
        value={value}
      />
    </View>
  );
}

function LegalLinks({ onPrivacyPress, onTermsPress }) {
  return (
    <View style={styles.legalLinks}>
      <Pressable onPress={onPrivacyPress}>
        <Text style={styles.legalLinkLabel}>Privacy Policy</Text>
      </Pressable>
      <Text style={styles.legalLinkSeparator}>•</Text>
      <Pressable onPress={onTermsPress}>
        <Text style={styles.legalLinkLabel}>Terms of Service</Text>
      </Pressable>
    </View>
  );
}

export default function AuthScreen() {
  const router = useRouter();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [interactionPoint, setInteractionPoint] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleTouch = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    setInteractionPoint({ x: locationX, y: locationY, active: true });
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const validate = () => {
    if (!EMAIL_REGEX.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }

    if (mode === 'login') {
      return '';
    }

    if (form.password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }

    if (form.password.length > 128) {
      return 'Password cannot exceed 128 characters.';
    }

    const evaluation = zxcvbn(form.password);

    if (evaluation.score < 2) {
      return `Password is too weak. ${evaluation.feedback.warning || 'Please choose a less common password.'}`;
    }

    return '';
  };

  const handleSubmit = async () => {
    if (loading) return;

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
      } else {
        await signup({
          email: form.email.trim(),
          password: form.password,
          first_name: form.firstName,
          last_name: form.lastName,
        });
      }
    } catch (authError) {
      setError(authError?.message || (mode === 'login' ? 'Login failed' : 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      onTouchEnd={() => setInteractionPoint(null)}
      onTouchMove={handleTouch}
      onTouchStart={handleTouch}
      style={styles.root}
    >
      <ParticleNetworkBackground interactionPoint={interactionPoint} />
      <View pointerEvents="none" style={styles.panelBackdrop} />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.panel}>
            <Wordmark pulseMark style={styles.wordmark} />

            <View style={styles.tabs}>
              {['login', 'signup'].map((value) => {
                const active = mode === value;

                return (
                  <Pressable key={value} onPress={() => handleModeChange(value)} style={styles.tab}>
                    <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>
                      {value === 'login' ? 'Sign in' : 'Register'}
                    </Text>
                    <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
                  </Pressable>
                );
              })}
            </View>

            <Animated.View entering={FadeInDown.duration(350)} key={mode} style={styles.formFade}>
              {mode === 'login' ? (
                <View>
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(value) => setField('email', value)}
                    placeholder="Email address"
                    textContentType="emailAddress"
                    value={form.email}
                  />
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="current-password"
                    onChangeText={(value) => setField('password', value)}
                    placeholder="Password"
                    secureTextEntry
                    textContentType="password"
                    value={form.password}
                  />
                </View>
              ) : (
                <View>
                  <View style={styles.nameRow}>
                    <View style={styles.nameField}>
                      <AuthField
                        autoCapitalize="words"
                        autoComplete="given-name"
                        onChangeText={(value) => setField('firstName', value)}
                        placeholder="First name"
                        textContentType="givenName"
                        value={form.firstName}
                      />
                    </View>
                    <View style={styles.nameField}>
                      <AuthField
                        autoCapitalize="words"
                        autoComplete="family-name"
                        onChangeText={(value) => setField('lastName', value)}
                        placeholder="Last name"
                        textContentType="familyName"
                        value={form.lastName}
                      />
                    </View>
                  </View>
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    onChangeText={(value) => setField('email', value)}
                    placeholder="Email address"
                    textContentType="emailAddress"
                    value={form.email}
                  />
                  <AuthField
                    autoCapitalize="none"
                    autoComplete="new-password"
                    onChangeText={(value) => setField('password', value)}
                    placeholder="Create password"
                    secureTextEntry
                    textContentType="newPassword"
                    value={form.password}
                  />
                </View>
              )}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorIcon}>⚠</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable disabled={loading} onPress={handleSubmit} style={styles.submitButton}>
                <Text style={styles.submitButtonLabel}>
                  {loading
                    ? mode === 'login'
                      ? 'Verifying...'
                      : 'Processing...'
                    : mode === 'login'
                      ? 'Initialize'
                      : 'Create identity'}
                </Text>
              </Pressable>

              <LegalLinks
                onPrivacyPress={() => router.push('/privacy')}
                onTermsPress={() => router.push('/terms')}
              />
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboard: {
    flex: 1,
  },
  panelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    padding: 20,
  },
  wordmark: {
    marginBottom: 60,
  },
  tabs: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 50,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    paddingBottom: 12,
  },
  tab: {
    position: 'relative',
  },
  tabLabel: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 2.75,
    opacity: 0.4,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    opacity: 1,
  },
  tabUnderline: {
    height: 1,
    width: 0,
    backgroundColor: theme.colors.text,
    marginTop: 13,
  },
  tabUnderlineActive: {
    width: '100%',
  },
  formFade: {
    gap: 0,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameField: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 28,
    position: 'relative',
  },
  inputAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 6,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    zIndex: 2,
  },
  inputAccentActive: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  inputPlaceholder: {
    position: 'absolute',
    left: 0,
    top: 17,
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 16,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 0.65,
  },
  errorBox: {
    marginTop: 10,
    marginBottom: -15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 77, 77, 0.4)',
    backgroundColor: 'rgba(255, 77, 77, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorIcon: {
    color: theme.colors.danger,
    fontSize: 12,
  },
  errorText: {
    flex: 1,
    color: theme.colors.danger,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  submitButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 44,
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  submitButtonLabel: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 3.5,
    textTransform: 'uppercase',
  },
  legalLinks: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  legalLinkLabel: {
    color: theme.colors.secondary,
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
  },
  legalLinkSeparator: {
    color: theme.colors.muted,
    fontSize: 9,
  },
});
