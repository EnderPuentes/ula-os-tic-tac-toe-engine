import type { Config } from "release-it";

export default {
  hooks: {
    "before:release": "pnpm knip && pnpm lint",
  },
  plugins: {
    "@release-it/conventional-changelog": {
      preset: "angular",
      infile: "CHANGELOG.md",
    },
  },
  npm: {
    publish: false,
  },
  git: {
    commitMessage: "chore(release): ${version}",
    commit: true,
    tag: true,
    push: true,
  },
  github: {
    release: true,
    releaseName: "${version}",
  },
} satisfies Config;
