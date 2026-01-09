#!/usr/bin/env node
/**
 * Code Review Checklist Script
 *
 * Run before committing to ensure code quality.
 * Usage: npm run review
 */

import { execSync } from 'child_process';

const CHECKLIST = [
  'DIFF REVIEWED - every changed line',
  'NO SECRETS - no API keys or tokens',
  'NO DEBUG CODE - no console.log/debugger',
  'ERROR HANDLING - errors caught properly',
  'NAMING - descriptive, follows conventions',
  'SINGLE RESPONSIBILITY - functions do one thing',
  'DRY - no unnecessary duplication',
  'EDGE CASES - handles null/undefined/empty',
  'TESTS - cover behavior and edge cases',
  'DOCS - TSDoc comments updated',
];

console.log('\n========================================');
console.log('       CODE REVIEW CHECKLIST');
console.log('========================================\n');

console.log('Before committing, verify:\n');

for (const item of CHECKLIST) {
  console.log(`[ ] ${item}`);
}

console.log('\n========================================');
console.log('         STAGED CHANGES');
console.log('========================================\n');

try {
  const diff = execSync('git diff --staged --stat', { encoding: 'utf8' });
  if (diff.trim()) {
    console.log(diff);
  } else {
    console.log('(no staged changes - run "git add" first)\n');
  }
} catch {
  console.log('(unable to get staged changes)\n');
}

console.log('========================================');
console.log('           NEXT STEPS');
console.log('========================================\n');

console.log('1. Review detailed diff:  git diff --staged');
console.log('2. For P0/P1 tasks:       Claude review REQUIRED');
console.log('3. Stage changes:         git add .');
console.log('4. Commit with review:    git commit -m "..."');
console.log('');
console.log('Include in commit message:');
console.log('  Review: Self-review checklist completed');
console.log('  Claude: PASS (or N/A for P2/P3)');
console.log('');
