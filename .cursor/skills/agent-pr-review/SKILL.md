---
name: agent-pr-review
description: Review pull requests in plugin-agent using GitHub CLI. Use for "review PR", "code review", or "gh pr view".
---

# Agent PR Review (plugin-agent)

## Required

- `gh` CLI
- `git` (PR branch must be checked out locally for authoritative diff)

## Working directory

- repo root (parent of this `.cursor`)

## Commands

Run all three together:

- `gh pr view <PR_NUMBER> --json title,number,body,files,commits,additions,deletions,changedFiles,baseRefName,headRefName,author,labels`
- `gh pr diff <PR_NUMBER>` — GitHub API diff (may be stale)
- `git diff $(gh pr view <PR_NUMBER> --json baseRefName --jq '.baseRefName') -- $(gh pr view <PR_NUMBER> --json files --jq '[.files[].path] | join(" ")')` — authoritative local diff

## Diff precedence

- `gh pr diff` can be stale after a recent push
- cross-check with local `git diff <base>` and `Read` tool on changed files
- local git diff + file contents win any disagreement

## Review checklist

- correctness, security, regressions
- error handling, edge cases
- tests cover changes or note gaps
- input validation, API misuse
- command messages have entries in messages dir
- errors not swallowed; rethrown errors set original as cause
- suggest code reuse
- suggest output improvements for agent use (esp. `--json`)

## Output format

- Findings first, severity order (Critical → High → Medium → Low)
- cite files/snippets
- Questions/Assumptions if needed
- Summary last, brief
