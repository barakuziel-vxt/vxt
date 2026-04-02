const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** @type {import('metro-config').MetroConfig} */
const config = {
  resolver: {
    // Allow importing .ts/.tsx without explicit extensions
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
    // Use package.json "exports" field so Metro picks the react-native / browser
    // condition instead of the Node.js default (which requires url, net, tls, etc.)
    unstable_enablePackageExports: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
