// Expo config plugin to remove the RN Gradle `enableBundleCompression` assignment
// which is not supported on older React Native Gradle Plugin versions.
// This avoids build failures like:
// "Could not set unknown property 'enableBundleCompression' for extension 'react'".

const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function removeEnableBundleCompression(config) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults?.contents ?? '';
    // Remove any line that assigns `enableBundleCompression = ...`
    const updated = gradle.replace(/\n\s*enableBundleCompression\s*=.*\n/, '\n    // enableBundleCompression removed via config plugin to support RN < 0.79\n');
    cfg.modResults.contents = updated;
    return cfg;
  });
};