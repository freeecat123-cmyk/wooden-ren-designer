---
description: 快速 commit 本次對話的改動並 push main(觸發 Vercel 上線)
argument-hint: [commit 訊息(可選)]
---

把「這次對話脈絡產生的改動」commit 後 push 到 `main`。照以下步驟做,不要問我確認、直接執行(除非碰到下面寫明要停下來的情況):

1. 跑 `git status --short` 和 `git diff --stat` 看有哪些改動。

2. **只 stage 這次對話實際動到的檔案**。以下一律**不要** stage,因為可能是別的 session 的半完成 WIP:
   - 這次對話我沒編輯過的檔案
   - 暫存/探查腳本(如 `scripts/_*.ts`)
   - 別份 plan / spec 文件(如 `docs/superpowers/plans/*`)
   若有不確定該不該收的檔案 → 停下來列給我看、問我,不要硬收。

3. commit 前快速驗證:`npx tsc --noEmit`,只看**本次改動檔案**有沒有新型別錯誤(其他檔案的既有錯誤忽略)。本次檔案有錯就先修好再 commit。

4. 寫一句精簡、講「為什麼」的繁體中文 commit 訊息。若指令後面有附訊息(見下方 $ARGUMENTS),用它當主旨。訊息結尾加一行:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

5. 用 heredoc 建立 commit。

6. `git pull --rebase origin main` 同步遠端。若有衝突 → `git rebase --abort` 還原,停下來叫我到 Mac 手解,**不要硬上**。

7. `git push origin main`(會觸發 designer.woodenren.com 的 Vercel 生產部署)。

8. 回報:commit SHA、push 結果。一兩句話即可。

如果沒有屬於本次對話的改動可 commit,直接說「沒有東西要 commit」,不要硬湊空 commit。

附加的 commit 訊息(可空):$ARGUMENTS
