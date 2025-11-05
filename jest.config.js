module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|react-native-gesture-handler|react-native-reanimated|expo(nent)?|@expo|@react-native|react-clone-referenced-element|@react-navigation)/)'
  ],
};