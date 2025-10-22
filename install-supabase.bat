@echo off
echo 🚀 開始安裝 Supabase 和相關依賴...

REM 安裝 Supabase 和 AsyncStorage
npm install @supabase/supabase-js @react-native-async-storage/async-storage

REM 如果使用 Expo
if exist "app.json" (
  echo 📱 檢測到 Expo 專案，安裝 Expo 版本的 AsyncStorage...
  npx expo install @react-native-async-storage/async-storage
)

REM 創建環境變數檔案
if not exist ".env" (
  copy ".env.example" ".env"
  echo 📄 已創建 .env 檔案，請填入您的 Supabase 配置
)

echo ✅ 套件安裝完成！
echo.
echo 📋 接下來的步驟：
echo 1. 前往 https://supabase.com 創建新專案
echo 2. 複製 Project URL 和 anon key
echo 3. 編輯 .env 檔案，填入 Supabase 配置
echo 4. 在 Supabase 專案中執行 SQL 創建資料表
echo 5. 啟用 lib/supabase.ts 和相關檔案中的註釋程式碼
echo.
echo ⚠️ 重要：請勿將 .env 檔案提交到版本控制系統
echo 📖 詳細說明請參考 SUPABASE_SETUP.md 檔案
pause