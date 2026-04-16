import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { loadDataSource, DEFAULT_LOCAL_URL, DEFAULT_CLOUD_URL } from '../hooks/useDataSource';

const C = {
  bg:          '#0d1117',
  card:        '#161b22',
  border:      '#30363d',
  textPrimary: '#e6edf3',
  textMuted:   '#8b949e',
  blue:        '#388bfd',
  green:       '#3fb950',
  red:         '#da3633',
};

interface Props {
  onAuthenticated: () => void;
}

type Step = 'email' | 'verifying';

export default function LoginScreen({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const getBaseUrl = async (): Promise<string> => {
    try {
      const ds = await loadDataSource();
      return ds.baseUrl || DEFAULT_LOCAL_URL;
    } catch {
      return DEFAULT_LOCAL_URL;
    }
  };

  const handleLogin = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setBusy(true);
    try {
      const baseUrl = await getBaseUrl();
      const res = await fetch(`${baseUrl}/auth/start-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Sign in with the custom token from backend
      await auth().signInWithCustomToken(data.token);

      // Check if email is already verified
      const currentUser = auth().currentUser;
      if (currentUser && currentUser.emailVerified) {
        onAuthenticated();
        return;
      }

      // Need email verification — send verification email
      if (currentUser) {
        await currentUser.sendEmailVerification();
        setVerificationSent(true);
        setStep('verifying');
      }
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setBusy(true);
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.sendEmailVerification();
        Alert.alert('Sent', 'Verification email sent again. Check your inbox.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send verification email');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    setBusy(true);
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          onAuthenticated();
          return;
        }
      }
      // Also check via backend (Firebase Admin sees the status immediately)
      const baseUrl = await getBaseUrl();
      const res = await fetch(`${baseUrl}/auth/check-verified?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      const data = await res.json();
      if (data.emailVerified) {
        // Reload user to sync the flag
        if (currentUser) {
          await currentUser.reload();
        }
        onAuthenticated();
      } else {
        Alert.alert('Not Yet Verified', 'Please click the verification link in your email first.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not check verification status');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'verifying') {
    return (
      <View style={styles.root}>
        <View style={styles.container}>
          <Text style={styles.logo}>⚓ VXT</Text>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a verification link to:
          </Text>
          <Text style={styles.emailDisplay}>{email.trim().toLowerCase()}</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📧 Open your email and click the verification link to confirm your identity. Then tap the button below.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleCheckVerification}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>✅ I've Verified — Let Me In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleResendVerification}
            disabled={busy}
          >
            <Text style={[styles.buttonText, { color: C.blue }]}>🔄 Resend Verification Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              auth().signOut();
              setStep('email');
              setVerificationSent(false);
            }}
          >
            <Text style={[styles.buttonText, { color: C.textMuted }]}>← Use different email</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.logo}>⚓ VXT</Text>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            Sign in with your invited email address.{'\n'}No password needed.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your-email@example.com"
              placeholderTextColor={C.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, busy && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>🔐 Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ℹ️ You need an invitation from an administrator to access VXT.
              Enter the email address your admin used to invite you.
              We'll send a verification email to confirm you own this address.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    padding: 24,
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: C.blue,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: C.textMuted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: C.blue,
    marginBottom: 20,
  },
  fieldGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: C.textPrimary,
    backgroundColor: C.card,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: C.blue,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.border,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoBox: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoText: {
    fontSize: 13,
    color: C.textMuted,
    lineHeight: 18,
  },
});
