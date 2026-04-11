// Entry point for React Native bundler
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandler } from './src/services/NotificationService';

// Must be called at top-level before AppRegistry
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
