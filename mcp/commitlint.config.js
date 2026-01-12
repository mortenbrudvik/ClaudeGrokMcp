export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only
        'refactor', // Code restructure
        'test', // Adding tests
        'chore', // Maintenance
        'perf', // Performance improvement
        'ci', // CI/CD changes
        'revert', // Revert previous commit
        'merge', // Merge commits from worktree workflow
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'tools', // MCP tool implementations
        'services', // Service implementations (cache, cost-tracker, rate-limiter)
        'server', // MCP server / index.ts
        'client', // xAI API client
        'types', // TypeScript types
        'skill', // SKILL.md
        'cmd', // /grok command
        'readme', // README.md
        'backlog', // BACKLOG.md
        'ci', // CI/CD configuration
        'deps', // Dependencies
        'test', // Test infrastructure
        'config', // Configuration files
        'worktree', // Worktree workflow commands/skills
        'hooks', // Git and Claude hooks
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'body-max-line-length': [1, 'always', 100],
  },
};
