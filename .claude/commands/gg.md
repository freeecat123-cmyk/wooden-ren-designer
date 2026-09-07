---
description: 先 commit 本次對話的改動,再 pull --rebase 同步遠端,最後 push(會觸發 Vercel 部署)
argument-hint: [commit 訊息(可選)]
---

「commit 本次改動 → pull 同步 → push」一氣呵成。照以下步驟做,不要問我確認、直接執行(除非碰到要停下來的情況)。

> ⚠️ **順序是「先 commit 再 pull」,不是先 stash。**
> 這台機器同時有好幾個 Claude session 在同一個 repo 工作,工作區常態有幾十到幾百個
> 別人未提交的檔。`git stash` 會把那些一起捲走,`stash pop` 衝突就卡在半路,
> 風險遠大於它解決的問題。要處理未提交改動一律用 `--autostash`(git 自己管,失敗會自動還原)。

1. `git status --short` 和 `git diff --stat` 看有哪些改動。
   順便記下 `git branch --show-current`——**分支不一定是 main**(例:wooden-ren-robots 是 `master`),
   後面所有指令都用實際分支名,不要寫死。

2. **只 stage 這次對話實際動到的檔案,逐檔指名**。
   ⛔ 絕對不用目錄層級的 `git add`(`git add .`、`git add src/`)。
   以下一律**不要** stage,那些是別的 session 的半完成 WIP:
   - 這次對話我沒編輯過的檔案
   - 暫存/探查腳本(如 `scripts/_*.ts`)、別份 plan / spec 文件
   - 排程/機器人跑出來的產物(`*.json` 狀態檔、log)
   若有不確定的檔案 → 停下來列給我看、問我,不要硬收。

3. commit 前快速驗證**本次改動的檔案**:
   - `.ts/.tsx` → `npx tsc --noEmit`(只看本次檔案的新錯誤,既有錯誤忽略)
   - `.sh` → `bash -n`
   - `.py` → `python3 -m py_compile`
   - `.json/.plist` → 用 `python3 -c` 實際解析一次
   本次檔案有錯就先修好再 commit。

4. 寫一句精簡、講「為什麼」的繁體中文 commit 訊息。指令後面有附訊息(見 $ARGUMENTS)就用它當主旨。
   訊息結尾加一行:
   `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

5. **用 heredoc + 指名路徑建立 commit**:
   ```bash
   git commit -F - -- <逐個檔名> <<'EOF'
   訊息
   EOF
   ```
   ⭐ 後面那個 `-- <檔名>` 不能省。曾經發生過:`git add` 跟 `git commit` 中間被另一個 session
   插隊改了索引,結果**我的訊息掛上別人的 4 個檔**還被推上遠端。帶 pathspec 就不會。

6. commit 完**立刻驗**:`git show --stat HEAD`,對檔名是不是就是我 stage 的那幾個。
   多出來的立刻處理,不要繼續往下走。

7. **`git pull --rebase --autostash origin <分支>`** 同步遠端。
   - 衝突 → `git rebase --abort`,停下來叫我手解,**不要硬上**。

8. **push 前先看清楚會推走什麼**:`git log --format='%h %an %s' @{u}..HEAD`。
   ⭐ 精準 add 擋得住「別人未提交的檔」,但擋不住「**別人已 commit 沒推的**」——push 一定連帶推走。
   逐顆看:是不是完整的改動?會不會觸發部署?
   有別人的 commit 就照推(不推反而卡住他們),但**推完要主動跟我講推了哪些不是我的**。

9. `git push origin <分支>`。
   ⚠️ 會觸發 Vercel 生產部署的 repo:`wooden-ren-designer`→designer.woodenren.com、
   `CLAUDE`→woodenren.com。

10. **推完回頭驗,不要只看 push 成功**:
    - `git rev-parse HEAD @{u}` 兩邊同值
    - rebase 會改寫 SHA,所以要用 `git show --stat origin/<分支>` 對內容,不是對 SHA
    - 會觸發部署的 repo:實際 curl 幾個網址確認站沒壞
      (woodenren.com 走 ISR,**要打兩次、第二次才算數**,第一次可能拿到冷啟動的假 404)

11. 回報:pull 抓了幾顆、本次 commit SHA、push 結果、有沒有連帶推走別人的東西。一兩句話即可。

若無本次對話的改動可 commit → 報「已同步,無新改動可 commit」就停,不要硬湊空 commit。

附加的 commit 訊息(可空):$ARGUMENTS
