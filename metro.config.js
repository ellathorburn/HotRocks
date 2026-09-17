const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SQLite's SDK 57 web implementation imports its WASM runtime as an asset.
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts.push('sql');

module.exports = config;
