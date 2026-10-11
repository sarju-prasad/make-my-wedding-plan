/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'auth',
        'weddings',
        'members',
        'events',
        'guests',
        'invitations',
        'rsvp',
        'photos',
        'tasks',
        'vendors',
        'expenses',
        'website',
        'announcements',
        'emails',
        'core',
        'db',
        'config',
        'security',
        'openapi',
        'ci',
        'deps',
      ],
    ],
  },
};
