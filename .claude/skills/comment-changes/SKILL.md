---
name: comment-changes
description: Add or improve code comments in the files David has changed (uncommitted, or since a given commit/branch). Comments only; never changes code.
disable-model-invocation: true
argument-hint: "[optional: commit, branch or file paths]"
---

# Comment David's changed files

David asked for this by running the command, so editing source files is allowed here,
but **only comments**. Never change code, formatting or behavior.

## 1. Find the files

- No argument: files with uncommitted changes plus untracked files
  (`git status --short`, `git diff --name-only HEAD`).
- Argument is a commit or branch (e.g. `main`): `git diff --name-only <arg>...HEAD` plus uncommitted changes.
- Argument is file paths: just those files.

Skip:
- Committed migrations (`apps/server/drizzle/*.sql`). Never edit them, not even comments.
- Lock files, `node_modules`, JSON config, generated files, and Expo starter-template files David hasn't edited.
- Files that aren't code (`.md`, `.env*`).

List the files you'll comment and ask David to **save all open editor tabs** before you start,
so his editor doesn't later overwrite your edits with an older copy.

## 2. Read before editing

Read each file fresh right before editing it (it may have changed since you last saw it).
For files that were already committed before, focus on the changed parts (`git diff`),
but fix clearly wrong or unclear comments anywhere in the file.

## 3. How to write the comments

- Explain the **why**, not the what. Don't comment lines that are obvious from the code.
- This is David's first backend project: explain backend ideas (transactions, HTTP status codes,
  hashing, tokens, indexes, migrations, locking) in plain language, briefly.
- Link to architecture rules where they apply (e.g. "(ARCH-09)"); see CLAUDE.md and `docs/decision-log.md`.
- Keep David's voice: fix comments that are unclear or wrong; leave good ones alone.
- Remove change-history notes such as `// NEW`, `// FIXED: was ...`, `// CHANGED: was ...`. Git records history.
- Short sentences. Comment above the line, not at the end of long lines.
- Match the file's existing indentation and quote style.

## 4. Check that only comments changed

Run, for the edited files:

```bash
git diff -U0 <files> | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]\s*(//.*)?$'
```

Any output must only be removed trailing comments or trailing whitespace. If a code line changed, undo that change.
Then run `npm run typecheck -w @trainapp/server` (and `-w @trainapp/mobile` if app files were touched)
and `npm test -w @trainapp/server`.

## 5. Report

- Don't commit. The comments belong with David's own commit for that feature.
- Summarize per file what you explained, in one line each.
- If you spotted a bug or risk while reading, **don't fix it**. Describe it and give a hint first
  (see "Reviewing David's code" in CLAUDE.md).
