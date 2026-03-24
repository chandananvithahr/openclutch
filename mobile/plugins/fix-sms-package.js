/**
 * Expo config plugin to fix react-native-get-sms-android package path.
 *
 * The module declares namespace "com.react.sms" in build.gradle but its
 * Java files use "package com.react". This creates a mismatch when Expo's
 * autolinking generates PackageList.java (it imports com.react.sms.SmsPackage
 * but the class is actually in com.react.SmsPackage).
 *
 * This plugin copies the Java files to the correct package directory
 * after npm install via the postinstall script in package.json.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function fixSmsPackagePath() {
  const baseDir = path.join(
    __dirname, '..', 'node_modules', 'react-native-get-sms-android',
    'android', 'src', 'main', 'java', 'com', 'react'
  );
  const targetDir = path.join(baseDir, 'sms');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const file of ['SmsPackage.java', 'SmsModule.java']) {
    const src = path.join(baseDir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      let content = fs.readFileSync(src, 'utf8');
      content = content.replace(/^package com\.react;/m, 'package com.react.sms;');
      fs.writeFileSync(dest, content, 'utf8');
    }
  }
}

function writeLocalProperties(platformProjectRoot) {
  const localPropsPath = path.join(platformProjectRoot, 'local.properties');
  const sdkDir = process.env.ANDROID_HOME
    || process.env.ANDROID_SDK_ROOT
    || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  const sdkDirForward = sdkDir.replace(/\\/g, '/');
  fs.writeFileSync(localPropsPath, `sdk.dir=${sdkDirForward}\n`, 'utf8');
}

function withFixSmsPackage(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      fixSmsPackagePath();
      writeLocalProperties(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
}

module.exports = withFixSmsPackage;
