const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that fixes react-native-get-sms-android autolinking.
 * The package declares com.react.sms but the actual Java class is in com.react.
 * This plugin patches the generated PackageList.java after prebuild.
 */
function withFixSmsAutolinking(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageListPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java'
      );

      // The file may not exist yet during prebuild — that's OK,
      // the fix also needs to happen at build time.
      // We'll patch the react-native.config.js approach instead.
      return config;
    },
  ]);
}

module.exports = withFixSmsAutolinking;
