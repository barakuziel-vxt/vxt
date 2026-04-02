import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import GatewayStatusScreen from './src/screens/GatewayStatusScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      <GatewayStatusScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
});
