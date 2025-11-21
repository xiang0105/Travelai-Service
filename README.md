# TravelAI Service

一個使用 **Expo + React Native + TypeScript** 建置的旅遊服務應用程式專案，包含 UI 元件、主題管理、資料 hooks、模組化頁面與 Supabase 等整合功能。

## 專案結構

``` text
├── .expo/ # Expo 設定與快取
├── .vscode/ # VSCode 工作區設定
├── app/ # App 主要路由與頁面
│ ├── (tabs)/ # 分頁(Tab)畫面
│ │ ├── _layout.tsx # 分頁佈局
│ │ ├── modal.tsx # Modal 頁面
│ │ └── plan.tsx # 行程或計畫頁面
│ └── assets/images/ # 圖片素材
├── components/ # 共用元件
│ └── ui/
│ ├── haptic-tab.tsx
│ ├── parallax-scroll-view.tsx
│ ├── themed-text.tsx
│ └── themed-view.tsx
├── constants/
│ └── theme.ts # 主題與顏色設定
├── data/ # 靜態或動態資料
├── hooks/ # 自訂 Hooks
│ ├── use-color-scheme.ts
│ ├── use-color-scheme.web.ts
│ └── use-theme-color.ts
├── lib/ # 工具與外部函式
├── Log/ # 日誌資料
├── PDF/ # PDF 輸出
├── scripts/ # 腳本
├── store/ # 狀態管理
├── .env # 環境變數
├── app.json # Expo 設定
├── eslint.config.js # ESLint 設定
├── expo-env.d.ts # Expo Type 定義
├── install-supabase.bat # Supabase 安裝腳本
├── package.json # 專案依賴
├── tsconfig.json # TypeScript 設定
└── README.md
```

## 使用技術

- **React Native**
- **Expo**
- **TypeScript**
- **Supabase（可選）**
- **Hooks-based Architecture**
- **Light/Dark Theme 支援**
- **Parallax UI / Haptic 回饋元件**

---

## 安裝與啟動

### 1. 安裝依賴

```sh
npm install
```

### 2. 啟動App

```sh
npm start
```

### 3. 手機掃描 QR Code 或使用 Expo Go App

## 環境變數

```sh
SUPABASE_URL=
SUPABASE_ANON_KEY=
API_BASE_URL=
```

### Scripts

- `install-supabase.bat`: 用於快速安裝與初始化 Supabase CLI。

### 🎨 UI 元件

專案包含多個可重複使用的元件：

- `HapticTab`
- `ParallaxScrollView`
- `ThemedText`
- `ThemedView`

### 📚 Hooks

- `use-color-scheme`: 自動偵測系統色系
- `use-theme-color`: 統一管理主題色
