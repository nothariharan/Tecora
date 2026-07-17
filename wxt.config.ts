import { defineConfig } from 'wxt';

// only the three chat sites we support — nothing broader, store review gets picky
const platformHosts = [
  'https://claude.ai/*',
  'https://chatgpt.com/*',
  'https://gemini.google.com/*',
];

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // keep the for server alive here — we load unpacked ourselves
  webExt: { disabled: true },
  manifest: {
    name: 'Tecora',
    description:
      'folders, search, bulk cleanup and export for your ai chats — everything stays on your device',
    // storage for dexie + remote selector config later. that's it for now.
    permissions: ['storage', 'sidePanel', 'tabs'],
    action: {},
    host_permissions: platformHosts,
  },
});
