#!/usr/bin/env bash
# 把截圖 → rembg 去背 → 320×240 webp 透明底 → public/thumbs/v2/{cat}.webp
# 用法:./scripts/make-thumb.sh <截圖路徑> <category>
# 例:  ./scripts/make-thumb.sh ~/Downloads/foo.png stool
set -e

SRC="$1"
CAT="$2"
if [[ -z "$SRC" || -z "$CAT" ]]; then
  echo "Usage: $0 <screenshot-path> <category-id>"
  exit 1
fi

REMBG="$HOME/Library/Python/3.14/bin/rembg"
TMP="/tmp/wrd-thumb-$CAT.png"
DST="public/thumbs/v2/$CAT.webp"

"$REMBG" i "$SRC" "$TMP" >/dev/null 2>&1

python3 <<PYEOF
from PIL import Image
im = Image.open("$TMP").convert("RGBA")
bbox = im.getbbox()
if bbox: im = im.crop(bbox)
TARGET = (320, 240)
im.thumbnail(TARGET, Image.LANCZOS)
canvas = Image.new("RGBA", TARGET, (0,0,0,0))
canvas.paste(im, ((TARGET[0]-im.width)//2, (TARGET[1]-im.height)//2), im)
canvas.save("$DST", "WEBP", quality=92, method=6)
print(f"saved $DST {canvas.size}")
PYEOF
