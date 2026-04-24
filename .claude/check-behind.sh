#!/usr/bin/env bash
# On each prompt: fetch, auto-pull if safe, warn otherwise.
# Safe = no uncommitted changes AND local not ahead of origin.

set -e
cd "$(dirname "$0")/.."

# Quick background fetch; don't block the prompt.
timeout 3 git fetch --quiet origin main 2>/dev/null || exit 0

behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
dirty=$(git status --porcelain 2>/dev/null | head -1)

# Warn on big deletions (stale-snapshot signature).
del=$(git diff --shortstat 2>/dev/null | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)
if [ "${del:-0}" -gt 1000 ]; then
  echo "⚠️  工作樹有 $del 行刪除——先確認不是舊快照污染再 commit"
fi

if [ "$behind" -eq 0 ]; then
  exit 0
fi

# Behind origin/main. Decide: auto-pull or warn.
if [ -z "$dirty" ] && [ "$ahead" -eq 0 ]; then
  # Clean tree, not ahead: safe to fast-forward.
  if git pull --ff-only --quiet 2>/dev/null; then
    echo "✅ 自動 pull 完成（+$behind commit from origin/main）"
  else
    echo "⚠️  落後 $behind commit，自動 pull 失敗，請手動處理"
  fi
else
  echo "⚠️  main 落後 origin/main $behind commit（本地超前 $ahead，dirty=$([ -n "$dirty" ] && echo yes || echo no)）"
  echo "    先 commit 或 stash，再 git pull --rebase"
fi
