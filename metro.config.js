const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.blockList = [/[/\\]\.tools[/\\].*/, /[/\\]artifacts[/\\].*/, /[/\\]native-legacy[/\\].*/];
module.exports = config;
