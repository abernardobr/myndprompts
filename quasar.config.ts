import { configure } from 'quasar/wrappers';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default configure(() => {
  return {
    boot: ['i18n', 'error-handler', 'file-sync'],

    css: ['app.scss'],

    extras: ['roboto-font', 'material-icons', 'mdi-v7'],

    build: {
      target: {
        browser: ['es2022', 'chrome100', 'firefox100', 'safari15'],
        node: 'node20',
      },

      typescript: {
        strict: true,
        vueShim: true,
      },

      vueRouterMode: 'hash',

      vitePlugins: [
        // Note: unplugin-vue-i18n removed - we use TypeScript locale files
        // imported directly in boot/i18n.ts
        [
          'vite-plugin-monaco-editor',
          {
            languageWorkers: ['editorWorkerService', 'json', 'css', 'html', 'typescript'],
            customWorkers: [],
          },
        ],
      ],

      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@composables': path.resolve(__dirname, './src/composables'),
        '@services': path.resolve(__dirname, './src/services'),
        '@stores': path.resolve(__dirname, './src/stores'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },

      env: {
        APP_VERSION: process.env.npm_package_version || '0.0.0',
      },
    },

    devServer: {
      open: false,
    },

    framework: {
      config: {
        dark: 'auto',
        brand: {
          primary: '#7c3aed',
          secondary: '#26A69A',
          accent: '#9C27B0',
          dark: '#1d1d1d',
          'dark-page': '#121212',
          positive: '#21BA45',
          negative: '#C10015',
          info: '#31CCEC',
          warning: '#F2C037',
        },
      },

      plugins: ['Dialog', 'Loading', 'LocalStorage', 'Notify', 'Dark'],
    },

    animations: ['fadeIn', 'fadeOut', 'slideInLeft', 'slideInRight'],

    ssr: {
      pwa: false,
      prodPort: 3000,
      middlewares: ['render'],
    },

    pwa: {
      workboxMode: 'GenerateSW',
    },

    capacitor: {
      hideSplashscreen: true,
    },

    electron: {
      inspectPort: 5858,

      bundler: 'builder',

      builder: {
        appId: 'com.myndprompts.app',
        productName: 'MyndPrompts',
        copyright: 'Copyright (c) MyndPrompt Contributors',

        mac: {
          category: 'public.app-category.developer-tools',
          target: ['dmg', 'zip'],
          icon: 'src-electron/icons/icon.icns',
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: 'build/entitlements.mac.plist',
          entitlementsInherit: 'build/entitlements.mac.plist',
          // Notarization - uses APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID env vars
          notarize: {
            teamId: process.env.APPLE_TEAM_ID || 'CD298B4H7M',
          },
        },

        win: {
          target: 'nsis',
          icon: 'src-electron/icons/icon.ico',
          executableName: 'MyndPrompts',
        },

        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: 'MyndPrompts',
          runAfterFinish: false,
        },

        linux: {
          category: 'Development',
          target: [
            { target: 'AppImage', arch: ['x64', 'arm64'] },
            { target: 'deb', arch: ['x64', 'arm64'] },
          ],
          icon: 'src-electron/icons/icon.png',
          executableName: 'myndprompts',
          artifactName: '${productName}-${version}-${arch}.${ext}',
        },
      },

      preloadScripts: ['electron-preload'],
    },
  };
});
