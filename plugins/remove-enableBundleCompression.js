// Expo config plugin to remove the RN Gradle `enableBundleCompression` assignment
// which is not supported on older React Native Gradle Plugin versions.
// This avoids build failures like:
// "Could not set unknown property 'enableBundleCompression' for extension 'react'".

const { withAppBuildGradle, withProjectBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

module.exports = function removeEnableBundleCompression(config) {
  // 1) Strip unsupported property from app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults?.contents ?? '';
    const updated = gradle.replace(/\n\s*enableBundleCompression\s*=.*\n/, '\n    // enableBundleCompression removed via config plugin to support RN < 0.79\n');
    cfg.modResults.contents = updated;
    return cfg;
  });

  // 2) Remove project-level repositories block from android/build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    const contents = cfg.modResults?.contents ?? '';
    const withoutRepos = contents.replace(/\nallprojects\s*\{[\s\S]*?\n}\n/g, '\n');
    cfg.modResults.contents = withoutRepos;
    return cfg;
  });

  // 3) Ensure repositories are declared in settings.gradle via dependencyResolutionManagement
  config = withSettingsGradle(config, (cfg) => {
    const txt = cfg.modResults?.contents ?? '';
    const hasDepMgmt = /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{[\s\S]*?}\s*}/.test(txt);
    if (!hasDepMgmt) {
      const block = `
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }
}
`;
      cfg.modResults.contents = txt + '\n' + block;
    }
    return cfg;
  });

  return config;
};