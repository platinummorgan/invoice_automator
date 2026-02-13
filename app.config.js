module.exports = function (config) {
  // Force billing library 6.2.1 in all android builds
  if (!config.android) {
    config.android = {};
  }
  
  return config;
};
