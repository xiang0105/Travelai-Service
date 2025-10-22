import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// 從環境變數讀取 Supabase 配置
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 驗證環境變數是否存在
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少 Supabase 環境變數！請檢查 .env 檔案中的 EXPO_PUBLIC_SUPABASE_URL 和 EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// 是否持久化登入狀態，可用環境變數關閉（預設為開啟）
const persistSession = process.env.EXPO_PUBLIC_AUTH_PERSIST_SESSION !== 'false';

console.log('[Supabase] 初始化', {
  urlDefined: !!supabaseUrl,
  anonKeyDefined: !!supabaseAnonKey,
  persistSession,
});

// 根據平台選擇適當的存儲
const getStorage = () => {
  if (Platform.OS === 'web') {
    // 在 Web 環境中使用 localStorage
    return {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    };
  }
  return AsyncStorage;
};

// 創建 Supabase 客戶端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession,
    detectSessionInUrl: false,
  },
});

// 監聽應用程式狀態變化，以處理自動刷新
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// 定義用戶檔案類型
export interface UserProfile {
  id: string;
  local_user_id: string;
  name: string;
  email: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
  last_login?: string;
  updated_at: string;
}

// 認證功能類
export class AuthService {
  // 註冊新用戶
  static async signUp(email: string, password: string, name: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) throw error;

      // 如果註冊成功，創建用戶檔案（包含明文密碼）
      if (data.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([
            {
              local_user_id: data.user.id,
              name,
              email,
              password,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // 登入用戶
  static async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 更新最後登入時間
      if (data.user) {
        await supabase
          .from('user_profiles')
          .update({ 
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('local_user_id', data.user.id);
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // 登出用戶
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  // 獲取當前用戶檔案
  static async getCurrentUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return { data: null, error: 'No authenticated user' };

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('local_user_id', user.id)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  // 更新用戶檔案
  static async updateUserProfile(updates: Partial<UserProfile>) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return { data: null, error: 'No authenticated user' };

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('local_user_id', user.id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  // 重設密碼
  static async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'your-app://reset-password', // 可以自定義重導向 URL
      });

      return { error };
    } catch (error) {
      return { error };
    }
  }

  // 監聽認證狀態變化
  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}