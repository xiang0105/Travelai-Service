// activityLogger.ts
// 小型 logger，用於將使用者操作記錄到 App 文件目錄下的 Log/activity.log
// 使用 expo-file-system（Expo project）

// Use legacy API to avoid runtime errors from new deprecation checks in some expo-file-system versions
import * as FileSystem from 'expo-file-system/legacy';

const _docDir: string = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') as string;
const LOG_DIR = `${_docDir}Log/`;
const LOG_FILE = `${LOG_DIR}activity.log`;

export type LogEntry = {
  id: string;
  userId?: string | null;
  action: string;
  page?: string | null;
  details?: any;
  timestamp: string; // ISO
};

async function ensureDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(LOG_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn('[activityLogger] ensureDir error', err);
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

export async function appendLog(payload: { userId?: string | null; action: string; page?: string | null; details?: any; }) {
  try {
    await ensureDir();
    const entry: LogEntry = {
      id: makeId(),
      userId: payload.userId ?? null,
      action: payload.action,
      page: payload.page ?? null,
      details: payload.details ?? null,
      timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(entry) + '\n';
    // append by reading existing and writing combined content
    try {
      const info = await FileSystem.getInfoAsync(LOG_FILE);
      if (info.exists) {
        const existing = await FileSystem.readAsStringAsync(LOG_FILE);
        await FileSystem.writeAsStringAsync(LOG_FILE, existing + line);
      } else {
        await FileSystem.writeAsStringAsync(LOG_FILE, line);
      }
    } catch (fsErr) {
      // If FileSystem operations fail (e.g., unexpected deprecation enforcement), log to console and continue.
      console.warn('[activityLogger] filesystem append failed, falling back to console only', fsErr);
    }
    // also output to console so Metro/Expo terminal shows the log
    try { console.log('[activityLogger] appended', entry); } catch (e) { /* ignore */ }
    return entry;
  } catch (err) {
    // avoid throwing from logger to prevent breaking app flows; just report to console
    console.error('[activityLogger] appendLog failed (non-fs)', err);
    return null;
  }
}

// export async function readAllLogs(): Promise<LogEntry[]> {
//   try {
//     const info = await FileSystem.getInfoAsync(LOG_FILE);
//     if (!info.exists) return [];
//     const text = await FileSystem.readAsStringAsync(LOG_FILE);
//     const lines = text.split(/\r?\n/).filter(Boolean);
//     const entries: LogEntry[] = [];
//     for (const l of lines) {
//       try {
//         entries.push(JSON.parse(l));
//       } catch (e) {
//         // ignore parse error
//       }
//     }
//     return entries;
//   } catch (err) {
//     console.error('[activityLogger] readAllLogs failed', err);
//     return [];
//   }
// }

// export function startLogWatcher(onNewEntries: (entries: LogEntry[]) => void, pollMs = 2000) {
//   // 未發現此函式在其他檔案被使用：為安全起見先註解保留原始實作
//   let stopped = false;
//   let lastCount = 0;

//   const intervalId = setInterval(async () => {
//     if (stopped) return;
//     try {
//       const info = await FileSystem.getInfoAsync(LOG_FILE);
//       if (!info.exists) return;
//       const text = await FileSystem.readAsStringAsync(LOG_FILE);
//       const lines = text.split(/\r?\n/).filter(Boolean);
//       if (lines.length > lastCount) {
//         const newLines = lines.slice(lastCount);
//         const entries: LogEntry[] = [];
//         for (const l of newLines) {
//           try { entries.push(JSON.parse(l)); } catch (e) { /* ignore */ }
//         }
//         lastCount = lines.length;
//         if (entries.length) onNewEntries(entries);
//       }
//     } catch (err) {
//       // ignore transient errors
//     }
//   }, pollMs);

//   return () => {
//     stopped = true;
//     clearInterval(intervalId as any);
//   };
// }

export default {
  appendLog,
  // startLogWatcher // 註解：尚未在專案其他處使用
};
