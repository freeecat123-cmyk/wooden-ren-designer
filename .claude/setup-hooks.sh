#!/usr/bin/env bash
# Run once after cloning this repo on a new machine.
# Installs the local-only post-commit auto-push hook.

set -e
cd "$(dirname "$0")/.."

cat > .git/hooks/post-commit <<'EOF'
#!/usr/bin/env bash
# Auto-push after every commit, in the background.
(
  if ! git push --quiet 2>/tmp/post-commit-push.log; then
    echo "⚠️  auto-push failed — run 'git push' manually"
    cat /tmp/post-commit-push.log >&2
  fi
) &
exit 0
EOF

chmod +x .git/hooks/post-commit
echo "✅ post-commit auto-push hook installed"

# Also set recommended git config (idempotent).
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global push.autoSetupRemote true
echo "✅ global git config updated (pull.rebase, rebase.autoStash, push.autoSetupRemote)"
