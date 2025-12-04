# Working with Jules (AI Colleague)

Jules is an AI teammate (via GitHub Copilot) that researches the codebase, opens issues, and ships fixes through PRs. Use this guide to keep the loop fast and reliable.

## Core Principles

- Treat Jules like a peer: clear asks, direct feedback, quick iterations.
- Always address feedback to Jules explicitly.
- Keep work flowing: review/merge promptly, minimize conflicts.
- **Capacity:** Jules supports a maximum of 15 concurrent tasks at any time; keep the queue trimmed.

## Kickoff: Create the Backlog

Ask Jules to scan the repo and open issues labeled `jules`:

```text
Can you analyze the codebase, find gaps/bugs/risks, and create GitHub issues in EVE-KILL/edk labeled `jules`? Be thorough—nothing is too big or small.
```

Expected: 30–50+ labeled issues with priorities and cross-references.

## Daily Loop: PR Review and Merge

1. Check for new/updated PRs labeled `jules`.
2. Review for correctness, tests, security, performance, and scope fit.
3. Comment **to Jules** with concrete asks:
   - ✅ “Jules, please add input validation for …”
   - ❌ “We should fix this…”
4. Approve and merge when ready; otherwise request changes with specifics.
5. Pull `main` after merges to reduce drift.

## Handling Conflicts

When conflicts appear, instruct Jules with order and commands. Example:

````markdown
## 🔄 Hey Jules – merge conflicts detected

1. Rebase PR #88 onto main, then force-with-lease.
2. Rebase the remaining PRs after #88 merges.

```
git fetch origin main
git rebase origin/main
git push --force-with-lease
```
````

## Communication Patterns

- Be specific: cite files/lines, describe the why, provide examples.
- Prioritize: blockers first, suggestions second.
- Keep comments actionable and concise.

## Merge Strategy

- Merge critical/test-fix/security PRs first.
- Land formatting/structural PRs early to avoid churn.
- Group related PRs; consider a combined PR if many conflicts arise.

## Tracking

```bash
gh issue list --label jules
gh pr list --label jules
gh pr list --state merged --label jules --limit 20
```

Monitor: issue closure rate, PR merge rate without major edits, review turnaround, conflict frequency.

## Troubleshooting

- No PRs? Confirm issues exist, repo access works, and prompts are clear.
- Slow reviews? Triage by severity; automate checks where possible.
- Misunderstandings? Add code snippets, name files/lines, restate the goal.
- Too many conflicts? Merge more often, enforce order, or ask Jules for a consolidated PR.

_Last Updated: 2025-11-22_
