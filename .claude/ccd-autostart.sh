#!/bin/bash
# Fires on SessionStart. If CCD_AUTOSTART_DEV=1, tell Claude to start npm run dev in background.
if [ "$CCD_AUTOSTART_DEV" = "1" ]; then
  cat <<'EOF'
The user launched this session via `ccd` — start the Next.js dev server in background NOW (do not ask first).

Run this as your very first action, in a single Bash tool call with run_in_background=true:

  npm run dev

Then briefly confirm to the user that the dev server is starting in background, and proceed with whatever they ask.
EOF
fi
