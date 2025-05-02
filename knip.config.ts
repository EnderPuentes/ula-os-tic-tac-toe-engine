import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignore: [],
  ignoreBinaries: [],
  ignoreDependencies: [
    '@commitlint/config-conventional',
    '@commitlint/cli',
    'http',
  ],
  entry: ['src/server.ts', 'src/workers/room.ts'],
};

export default config;
