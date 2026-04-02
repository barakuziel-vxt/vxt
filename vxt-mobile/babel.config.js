module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Path aliases (mirrors tsconfig.json paths)
    ['module-resolver', {
      root: ['./src'],
      alias: {
        '@core':     './src/core',
        '@drivers':  './src/drivers',
        '@services': './src/services',
        '@store':    './src/store',
        '@screens':  './src/screens',
      },
    }],
  ],
};
