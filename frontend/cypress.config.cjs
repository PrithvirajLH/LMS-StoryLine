const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:5173',
    specPattern: 'test/e2e/**/*.cy.{js,jsx}',
    supportFile: 'test/support/e2e.js',
    fixturesFolder: 'test/fixtures',
    setupNodeEvents(on) {
      on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args.push('--disable-gpu');
          launchOptions.args.push('--disable-software-rasterizer');
        }
        return launchOptions;
      });
    }
  },
  video: false,
  screenshotOnRunFailure: false
});
