#!/bin/sh
# 把 scripts/hooks/* link 到 .git/hooks/，npm install 時會自動跑。
# 不在 git repo（例如 npm install 從 tarball）時直接 skip。
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0
[ -z "$GIT_DIR" ] && exit 0

mkdir -p "$GIT_DIR/hooks"
for hook in scripts/hooks/*; do
  name=$(basename "$hook")
  target="$GIT_DIR/hooks/$name"
  ln -sf "../../$hook" "$target"
  chmod +x "$hook"
done
echo "✅ Git hooks installed (pre-commit: overlap audit)"
