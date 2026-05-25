---
description: 先 pull origin 同步遠端,再 commit 本次對話的改動 + push main(觸發 Vercel)
argument-hint: [commit 訊息(可選)]
---

「pull 先抓最新 → commit 本次改動 → push」一氣呵成,適合「別台已經 push、我這邊也有改、想一次合上去」的場景。照以下步驟做,不要問我確認、直接執行(除非碰到要停下來的情況):

1. **先 stash 本地未提交改動**(不論 staged / unstaged 都暫存):
   ```bash
   git stash push --include-untracked -m "gg-autosave-$(date +%s)"
   ```
   若 `git status --short` 為空就跳過 stash,記錄「無 stash」。

2. **`git pull --rebase origin main`** 同步遠端。
   - 衝突 → `git rebase --abort` 還原、`git stash pop` 還原本地,停下來叫我手解,**不要硬上**。

3. **還原暫存**(若有 stash):`git stash pop`。
   - pop 衝突 → 停下來列衝突檔給我看,不要硬解。

4. `git status --short` 和 `git diff --stat` 看有哪些改動。

5. **只 stage 這次對話實際動到的檔案**。以下一律**不要** stage,可能是別的 session 的半完成 WIP:
   - 這次對話我沒編輯過的檔案
   - 暫存/探查腳本(如 `scripts/_*.ts`)
   - 別份 plan / spec 文件
   若有不確定的檔案 → 停下來列給我看、問我,不要硬收。

6. commit 前快速驗證:`npx tsc --noEmit`,只看**本次改動檔案**有沒有新型別錯誤(其他既有錯誤忽略)。本次檔案有錯就先修好再 commit。

7. 寫一句精簡、講「為什麼」的繁體中文 commit 訊息。指令後面有附訊息(見 $ARGUMENTS)就用它當主旨。訊息結尾加一行:
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

8. 用 heredoc 建立 commit。

9. `git push origin main`(會觸發 designer.woodenren.com 的 Vercel 生產部署)。

10. 回報:pull 抓了幾個 commit、本次 commit SHA、push 結果。一兩句話即可。

若 pull 後無本地改動可 commit → 報「已同步,無新改動可 commit」就停,不要硬湊空 commit。

附加的 commit 訊息(可空):$ARGUMENTS
