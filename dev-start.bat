@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   木頭仁 家具設計生成器 - Dev Server
echo ============================================
echo.
echo [1/3] 同步另一台電腦的更新 (git pull)...
git pull
if errorlevel 1 (
  echo.
  echo *** git pull 失敗 ***  可能有衝突或本地有未 commit 改動
  echo 請先解決後再執行此檔，或叫 Claude 處理
  pause
  exit /b 1
)
echo.
echo [2/3] 啟動 dev server...
start "" "http://localhost:3000"
echo [3/3] 開瀏覽器: http://localhost:3000
echo.
echo === 關閉此視窗即停止伺服器 ===
echo.
npm run dev
pause
