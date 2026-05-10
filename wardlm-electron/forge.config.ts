import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
  },
  rebuildConfig: {},
  hooks: {
    // Stage every produced .deb into ./dist/ under its native filename
    // (wardlm_<version>_<arch>.deb) so the manual GitHub-release upload
    // is just "drag dist/* into the release UI".
    postMake: async (_forgeConfig, makeResults) => {
      const distDir = path.resolve(__dirname, 'dist');
      mkdirSync(distDir, { recursive: true });
      for (const result of makeResults) {
        for (const artifact of result.artifacts) {
          if (!artifact.endsWith('.deb')) continue;
          copyFileSync(artifact, path.join(distDir, path.basename(artifact)));
        }
      }
      return makeResults;
    },
  },
  makers: [
    new MakerDeb({
      options: {
        maintainer: 'Daniel Salmun <salmundani@gmail.com>',
        homepage: 'https://wardlm.vercel.app',
        productName: 'wardlm',
        description: 'Real-time desktop viewer for the wardlm audit log.',
        productDescription:
          'Real-time viewer for the wardlm audit log (/var/log/wardlm/wardlm.log).',
        section: 'admin',
        categories: ['System', 'Utility'],
        icon: './assets/icon.png',
        scripts: {
          postinst: './assets/linux/postinst',
          postrm: './assets/linux/postrm',
        },
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
