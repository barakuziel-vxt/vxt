import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useUserProfile } from '../hooks/useUserProfile';
import { DrawerContext } from '../context/DrawerContext';

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

export default function UserProfileScreen() {
  const [profile, updateProfile] = useUserProfile();
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [isSaving, setIsSaving] = useState(false);
  const { openDrawer } = useContext(DrawerContext);

  // Sync local state when AsyncStorage finishes loading the saved profile
  React.useEffect(() => {
    if (profile.loaded) {
      setFullName(profile.fullName);
      setEmail(profile.email);
      setPhone(profile.phone);
    }
  }, [profile.loaded]);

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Validation Error', 'All fields are required');
      return;
    }

    setIsSaving(true);
    try {
      // updateProfile now properly awaits the async save to AsyncStorage
      await updateProfile({ fullName, email, phone, loaded: true });
      Alert.alert('Success', 'User profile saved successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Profile', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset to Defaults',
        style: 'destructive',
        onPress: () => {
          setFullName('');
          setEmail('');
          setPhone('');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root}>
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuBtn}>
          <Text style={styles.menuBtnText}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>👤 User Profile</Text>
          <Text style={styles.subtitle}>Manage your account information</Text>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={C.textMuted}
            editable={!isSaving}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor={C.textMuted}
            keyboardType="email-address"
            editable={!isSaving}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 123-4567"
            placeholderTextColor={C.textMuted}
            keyboardType="phone-pad"
            editable={!isSaving}
          />
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>{isSaving ? 'Saving...' : '💾 Save Profile'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>🔄 Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ About Your Profile</Text>
          <Text style={styles.infoText}>
            Your profile is used to identify you in the VXT IoT system.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  menuBtn: {
    padding: 8,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  menuBtnText: {
    color: C.textPrimary,
    fontSize: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: C.textMuted,
  },
  form: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: C.textPrimary,
  },
  buttonGroup: {
    marginTop: 24,
    gap: 10,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: C.green,
  },
  resetButton: {
    backgroundColor: C.blue,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: C.card,
    borderLeftWidth: 4,
    borderLeftColor: C.blue,
    borderRadius: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.blue,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    color: C.textMuted,
    lineHeight: 18,
  },
});
