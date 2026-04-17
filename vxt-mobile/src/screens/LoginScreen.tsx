import React, { useState, useEffect } from 'react';
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
import {
  loadDataSource,
  saveDataSource,
  DataSourceType,
  DEFAULT_LOCAL_URL,
  DEFAULT_CLOUD_URL,
} from '../hooks/useDataSource';

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

  // Endpoint settings
  const [showSettings, setShowSettings] = useState(false);
  const [dsType, setDsType] = useState<DataSourceType>('local');
  const [cloudUrl, setCloudUrl] = useState(DEFAULT_CLOUD_URL);
  const [localUrl, setLocalUrl] = useState(DEFAULT_LOCAL_URL);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    loadDataSource().then(ds => {
      setDsType(ds.type);
      setCloudUrl(ds.cloudUrl);
      setLocalUrl(ds.localUrl);
      setSettingsLoaded(true);
    });
  }, []);

  const handleSaveSettings = async () => {
    await saveDataSource(dsType, cloudUrl, localUrl);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

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

          {/* Endpoint settings toggle */}
          <TouchableOpacity
            style={styles.settingsToggle}
            onPress={() => setShowSettings(prev => !prev)}
          >
            <Text style={styles.settingsToggleText}>
              {showSettings ? '▼' : '▶'} ⚙️ API Endpoint Settings
            </Text>
          </TouchableOpacity>

          {showSettings && settingsLoaded && (
            <View style={styles.settingsPanel}>
              <Text style={styles.settingsSectionTitle}>Select API Endpoint</Text>

              {(['cloud', 'local'] as DataSourceType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.settingsOption, dsType === t && styles.settingsOptionActive]}
                  onPress={() => setDsType(t)}
                >
                  <View style={[styles.settingsRadioOuter, dsType === t && { borderColor: C.blue }]}>
                    {dsType === t && <View style={styles.settingsRadioInner} />}
                  </View>
                  <Text style={styles.settingsOptionText}>
                    {t === 'cloud' ? '☁️ Cloud' : '🏠 Local'}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.settingsUrlLabel}>
                {dsType === 'cloud' ? 'Cloud API URL' : 'Local Server URL'}
              </Text>
              <TextInput
                style={styles.settingsUrlInput}
                value={dsType === 'cloud' ? cloudUrl : localUrl}
                onChangeText={dsType === 'cloud' ? setCloudUrl : setLocalUrl}
                placeholder={dsType === 'cloud' ? DEFAULT_CLOUD_URL : DEFAULT_LOCAL_URL}
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <TouchableOpacity
                style={[styles.settingsSaveBtn, settingsSaved && { backgroundColor: C.green }]}
                onPress={handleSaveSettings}
              >
                <Text style={styles.settingsSaveBtnText}>
                  {settingsSaved ? '✓ Saved' : 'Save Endpoint'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
  settingsToggle: {
    width: '100%',
    paddingVertical: 12,
    marginTop: 8,
  },
  settingsToggleText: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: '600',
  },
  settingsPanel: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  settingsSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 6,
  },
  settingsOptionActive: {
    borderColor: C.blue,
    backgroundColor: '#0d1f38',
  },
  settingsRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  settingsRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.blue,
  },
  settingsOptionText: {
    fontSize: 14,
    color: C.textPrimary,
    fontWeight: '600',
  },
  settingsUrlLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsUrlInput: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    color: C.textPrimary,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  settingsSaveBtn: {
    marginTop: 10,
    backgroundColor: C.blue,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  settingsSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
