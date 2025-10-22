import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthService, supabase } from '../../lib/supabase';
import { loadLocalAvatarForCurrentUser, setLocalAvatar, updateGlobalState, updateUserProfile, useGlobalState } from '../../store/globalState';
import PlanScreen from '../plan';

export default function ProfileScreen() {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editAvatar, setEditAvatar] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editUploading, setEditUploading] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // 當 user 資料變動時，更新編輯欄位
  const [globalState] = useGlobalState();
  useEffect(() => {
    if (globalState?.user) {
      setEditAvatar(globalState.user.avatar ?? '');
      setEditBio(globalState.user.bio ?? '');
    }
  }, [globalState?.user]);

  // 本地儲存頭像：使用 setLocalAvatar 將選取的 local URI 儲存到 local storage 並更新 globalState

  // 編輯個人資料儲存
  const handleSaveProfile = async () => {
  setEditUploading(true);
  try {
    if (!globalState.user) throw new Error('尚未登入');
    // 如果 avatar 改變：先以本地方式儲存
    let localAvatar: string | null = null;
    if (editAvatar && editAvatar !== globalState.user.avatar) {
      setEditUploading(true);
      const saved = await setLocalAvatar(editAvatar);
      setEditUploading(false);
      if (saved) {
        localAvatar = editAvatar;
      }
    }

    // 使用 AuthService.updateUserProfile 以取得 server 回傳的最新資料，避免 race condition
    const { data: updatedProfile, error: updateError } = await AuthService.updateUserProfile({ bio: editBio, name: globalState.user.name });
    if (updateError) {
      throw updateError;
    }

    // 儲存成功：更新 local state（avatar 優先使用 localAvatar）
    setEditModalVisible(false);
    try {
      // 合併回傳的資料到 global state 的 user（只更新變動欄位）
      const merged = {
        ...(globalState.user || {}),
        avatar: localAvatar || globalState.user?.avatar || updatedProfile?.avatar_url || '',
        bio: updatedProfile?.bio ?? editBio ?? globalState.user?.bio ?? '',
        name: updatedProfile?.name ?? globalState.user?.name ?? '',
        email: updatedProfile?.email ?? globalState.user?.email ?? '',
        joinDate: updatedProfile?.created_at ? new Date(updatedProfile.created_at).toLocaleDateString() : globalState.user?.joinDate || '',
      };
      // 使用 updateUserProfile helper 以保留其他欄位並只更新必要欄位
      updateUserProfile({
        avatar: merged.avatar,
        bio: merged.bio,
        name: merged.name,
        email: merged.email,
        joinDate: merged.joinDate,
      });
    } catch (err) {
      console.warn('更新本地使用者資料時發生錯誤:', err);
    }
    Alert.alert('儲存成功', '個人資料已更新');
  } catch (err) {
    Alert.alert('儲存失敗', String(err));
  } finally {
    setEditUploading(false);
  }
};

  // 顯示頭貼選擇選項
  const showAvatarOptions = () => {
    Alert.alert(
      '更換頭貼',
      '請選擇圖片來源',
      [
        {
          text: '相機拍攝',
          onPress: () => pickAvatarFromCamera()
        },
        {
          text: '從相簿選擇',
          onPress: () => pickAvatarFromLibrary()
        },
        {
          text: '取消',
          style: 'cancel'
        }
      ]
    );
  };

  // 從相機拍攝頭貼
  const pickAvatarFromCamera = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      
      // 請求相機權限
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要權限', '請授權相機權限以拍攝頭貼');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        // 直接將 local uri 儲存到 local storage
        setEditUploading(true);
        const saved = await setLocalAvatar(uri);
        setEditUploading(false);
        if (saved) {
          setEditAvatar(uri);
        } else {
          Alert.alert('錯誤', '儲存頭像失敗');
        }
      }
    } catch (err) {
      console.error('相機拍攝錯誤:', err);
      Alert.alert('拍攝失敗', '無法使用相機，請稍後再試');
    }
  };

  // 從相簿選擇頭貼
  const pickAvatarFromLibrary = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      
      // 請求媒體庫權限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('需要權限', '請授權相簿權限以選擇頭貼');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
        base64: false,
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
            setEditUploading(true);
            const saved = await setLocalAvatar(uri);
            setEditUploading(false);
            if (saved) {
              setEditAvatar(uri);
            } else {
              Alert.alert('錯誤', '儲存頭像失敗');
            }
      }
    } catch (err) {
      console.error('選擇圖片錯誤:', err);
      Alert.alert('選擇失敗', '無法選擇圖片，請稍後再試');
    }
  };
  const insets = useSafeAreaInsets();
  const [showLogin, setShowLogin] = useState(true); // true for login, false for register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Supabase 診斷函數
  const diagnoseSupabase = async () => {
    try {
      console.log('=== Supabase Diagnosis Started ===');
      
      // 檢查環境變數
      console.log('Environment Check:');
      console.log('- URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
      console.log('- Key exists:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
      
      // 檢查資料庫連接
      console.log('Database Connection Check:');
      const { supabase } = await import('../../lib/supabase');
      
        // 修正：使用簡單的 select 而不是 count
        const { data: tableData, error: tableError } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
      
        if (tableError) {
          console.error('- Table access error:', tableError);
          console.log('- Error details:', {
            code: tableError.code,
            message: tableError.message,
            details: tableError.details
          });
        } else {
          console.log('- Table accessible ✓');
          console.log('- Sample data found:', tableData?.length || 0, 'records');
        }
      
      // 檢查特定用戶
      if (email) {
        console.log(`User Check for: ${email}`);
        const { data: userData, error: userError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', email);
        
        console.log('- User profile data:', userData);
        console.log('- User profile error:', userError);
      }
      
      console.log('=== Diagnosis Complete ===');
      Alert.alert('診斷完成', '請檢查控制台的詳細結果');
      
    } catch (error) {
      console.error('Diagnosis Error:', error);
      Alert.alert('診斷錯誤', `錯誤: ${error}`);
    }
  };

  // 監聽 Supabase 認證狀態變化
  useEffect(() => {
    console.log('=== Supabase Auth Service Initialized ===');
    console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
    console.log('Supabase Key exists:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    
  const { data: { subscription } } = AuthService.onAuthStateChange(async (event, session) => {
      console.log('=== Auth State Changed ===');
      console.log('Event:', event);
      console.log('Session:', session);
      console.log('User ID:', session?.user?.id);
      console.log('User Email:', session?.user?.email);
      
      if (session?.user) {
        // 嘗試優先從本地載入 avatar（如果有），否則再向 server 查詢 profile
        const localAvatar = await loadLocalAvatarForCurrentUser(session.user.id);
        const { data: profile } = await AuthService.getCurrentUserProfile();
        
        updateGlobalState({
          isLoggedIn: true,
          isLoading: false,
          user: {
            id: session.user.id,
            name: profile?.name || session.user.user_metadata?.name || '用戶',
            email: session.user.email || '',
            avatar: localAvatar || profile?.avatar_url || 'https://via.placeholder.com/80',
            memberLevel: 'Premium會員',
            joinDate: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '今天加入',
            bio: profile?.bio || ''
          },
          supabaseSession: session
        });
      } else {
        updateGlobalState({
          isLoggedIn: false,
          isLoading: false,
          user: null,
          supabaseSession: null
        });
      }
    });

    // 啟動時主動同步一次目前 session，避免 UI 卡在 loading 或誤判
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // 優先嘗試從本地載入 avatar
        const localAvatar = await loadLocalAvatarForCurrentUser(session.user.id);
        const { data: profile } = await AuthService.getCurrentUserProfile();
        updateGlobalState({
          isLoggedIn: true,
          isLoading: false,
          user: {
            id: session.user.id,
            name: profile?.name || session.user.user_metadata?.name || '用戶',
            email: session.user.email || '',
            avatar: localAvatar || profile?.avatar_url || 'https://via.placeholder.com/80',
            memberLevel: 'Premium會員',
            joinDate: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '今天加入',
            bio: profile?.bio || ''
          },
          supabaseSession: session,
        });
      } else {
        updateGlobalState({ isLoading: false });
      }
    })();

    return () => subscription?.unsubscribe();
  }, []);

  function isValidEmail(email: string) {
    // 標準 email 格式驗證
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function sanitizeEmail(email: string) {
    // 去除前後空格並轉小寫
    return email.trim().toLowerCase();
  }

  const handleLogin = async () => {
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail || !password) {
      Alert.alert('錯誤', '請輸入電子郵件和密碼');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      Alert.alert('錯誤', '請輸入正確的電子郵件格式');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await AuthService.signIn(cleanEmail, password);
      if (error) {
        const errorMessage = (error as any)?.message || '無法登入，請檢查您的電子郵件和密碼';
        Alert.alert('登入失敗', errorMessage);
        return;
      }
      Alert.alert('成功', '登入成功！');
    } catch (error) {
      Alert.alert('錯誤', '登入過程中發生錯誤');
    } finally {
      setIsLoading(false);
      setEmail('');
      setPassword('');
    }
  };

  // 註冊流程
  const handleRegister = async () => {
    const cleanEmail = sanitizeEmail(email);
    if (!name || !cleanEmail || !password) {
      Alert.alert('錯誤', '請填寫使用者名稱、電子郵件和密碼');
      return;
    }
    if (!isValidEmail(cleanEmail)) {
      Alert.alert('錯誤', '請輸入正確的電子郵件格式');
      return;
    }
    if (password.length < 6) {
      Alert.alert('錯誤', '密碼長度至少憉6個字元');
      return;
    }
    setIsLoading(true);
    try {
      // Supabase 註冊
      const { data, error } = await AuthService.signUp(cleanEmail, password, name);
      if (error) {
        const errorMessage = (error as any)?.message || '註冊失敗，請稍後再試';
        Alert.alert('註冊失敗', errorMessage);
        return;
      }
      // 註冊成功後，寫入 user_profiles 所有欄位（包含明文 password）
      if (data?.user) {
        const now = new Date().toISOString();
        await supabase
          .from('user_profiles')
          .insert([
            {
              local_user_id: data.user.id,
              name: name,
              email: cleanEmail,
              bio: '',
              avatar_url: '',
              created_at: now,
              last_login: now,
              updated_at: now,
              password: password
            }
          ]);
      }
      Alert.alert('註冊成功');
    } catch (error) {
      Alert.alert('錯誤', '註冊過程中發生錯誤');
    } finally {
      setIsLoading(false);
      setEmail('');
      setPassword('');
      setName('');
    }
  };

  // 已停用登出功能：登入後不提供登出

  // 忘記密碼函數
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('錯誤', '請輸入您的電子郵件地址');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await AuthService.resetPassword(email);
      
      if (error) {
        console.error('Reset password error:', error);
        const errorMessage = (error as any)?.message || '無法傳送重設密碼郵件';
        Alert.alert('錯誤', errorMessage);
        return;
      }
      
      console.log('Reset password email sent successfully');
      
      Alert.alert(
        '郵件已傳送', 
        `重設密碼的郵件已傳送至 ${email}\n請檢查您的郵件信箱。`
      );
      
      setShowForgotPassword(false);
    } catch (error) {
      Alert.alert('錯誤', '傳送重設郵件時發生錯誤');
      console.error('Reset password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (globalState.isLoggedIn && globalState.user) {
    // 已登入狀態 - 顯示個人資料頁面與編輯 modal
    return (
  <View style={[styles.loggedInContainer, { paddingTop: insets.top + 30, paddingBottom: Math.max(insets.bottom, 10) }]}> 
        <ScrollView style={styles.loggedInScrollView} showsVerticalScrollIndicator={false}>
          {/* App Title */}
          <Text style={styles.loggedInTitle}>TripMind</Text>

          {/* User Profile Section */}
          <View style={styles.loggedInProfileSection}>
            {/* Avatar with Status */}
            <View style={styles.loggedInAvatarContainer}>
              <Image 
                source={{ uri: globalState.user.avatar || 'https://via.placeholder.com/80' }} 
                style={styles.loggedInAvatar} 
              />
            </View>
            <Text style={styles.loggedInUserName}>{globalState.user.name}</Text>
            <Text style={styles.loggedInUserEmail}>{globalState.user.email}</Text>
            {/* 顯示自我介紹 (bio) */}
            {globalState.user?.bio ? (
              <Text style={styles.loggedInBio}>{globalState.user.bio}</Text>
            ) : (
              <Text style={[styles.loggedInBio, { color: '#999' }]}>尚未填寫自我介紹</Text>
            )}
            <Text style={styles.loggedInJoinDate}>{globalState.user.joinDate || ''}</Text>
          </View>

          {/* Menu Items */}
          <View style={styles.loggedInMenuContainer}>
            <TouchableOpacity style={styles.loggedInMenuItem} onPress={() => {
              setEditAvatar(globalState.user?.avatar ?? '');
              setEditBio(globalState.user?.bio ?? '');
              setEditModalVisible(true);
            }}>
              <View style={styles.loggedInMenuLeft}>
                <FontAwesome name="user" size={20} color="#4A90E2" />
                <Text style={styles.loggedInMenuText}>編輯個人資料</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.loggedInMenuItem} onPress={() => setShowPlanModal(true)}>
              <View style={styles.loggedInMenuLeft}>
                <FontAwesome name="plane" size={20} color="#FFD700" />
                <Text style={styles.loggedInMenuText}>查看行程</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#C7C7CC" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.loggedInMenuItem}>
              <View style={styles.loggedInMenuLeft}>
                <FontAwesome name="info-circle" size={20} color="#34495E" />
                <Text style={styles.loggedInMenuText}>關於我們</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#C7C7CC" />
            </TouchableOpacity>
          </View>

          {/* Separator before logout */}
          <View style={styles.logoutSeparator} />

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.loggedInLogoutButton}
            onPress={() => {
              Alert.alert(
                '登出',
                '確定要登出嗎？',
                [
                  { text: '取消', style: 'cancel' },
                  { 
                    text: '登出', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const { error } = await AuthService.signOut();
                        if (error) {
                          Alert.alert('錯誤', '登出失敗，請稍後再試');
                          return;
                        }
                      } catch (e) {
                        // 忽略非致命錯誤，仍將本地狀態重置
                      } finally {
                        updateGlobalState({
                          isLoggedIn: false,
                          isLoading: false,
                          user: null,
                          supabaseSession: null,
                        });
                      }
                    }
                  }
                ]
              );
            }}
          >
            <FontAwesome name="sign-out" size={18} color="white" />
            <Text style={styles.loggedInLogoutText}>登出</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 編輯個人資料 Modal */}
        {editModalVisible && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', zIndex: 99 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>編輯個人資料</Text>
                <TouchableOpacity 
                  onPress={showAvatarOptions} 
                  style={{ 
                    alignItems: 'center', 
                    marginBottom: 16,
                    opacity: editUploading ? 0.6 : 1 
                  }}
                  disabled={editUploading}
                >
                  <View style={{ position: 'relative' }}>
                    <Image 
                      source={{ uri: editAvatar || 'https://via.placeholder.com/80' }} 
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 40, 
                        marginBottom: 8,
                        borderWidth: 2,
                        borderColor: '#4A90E2'
                      }} 
                    />
                    {editUploading && (
                      <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 8,
                        borderRadius: 40,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>上傳中...</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ 
                    color: editUploading ? '#999' : '#4A90E2',
                    fontWeight: '500'
                  }}>
                    {editUploading ? '上傳中...' : '更換頭貼'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 }}
                  placeholder="自我介紹..."
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  numberOfLines={3}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                  <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ padding: 10 }}>
                    <Text style={{ color: '#666' }}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveProfile} style={{ backgroundColor: '#4A90E2', borderRadius: 8, padding: 10 }} disabled={editUploading}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{editUploading ? '儲存中...' : '儲存'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
          </View>
        )}
        {/* Plan modal (open from profile) */}
        <Modal visible={showPlanModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPlanModal(false)}>
          <View style={{ flex: 1 }}>
            <PlanScreen />
            <View style={{ position: 'absolute', top: 40, right: 16 }}>
            </View>
          </View>
        </Modal>
      </View>
      
    );
  }

  // 未登入狀態 - 顯示登入/註冊畫面
  return (
  <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 10) }]}> 
      <View style={styles.authContainer}>
        {/* App Title */}
        <Text style={styles.authTitle}>TripMind</Text>



        {/* Auth Form Section */}
        <KeyboardAvoidingView keyboardVerticalOffset={Math.max(insets.bottom, 20)} style={styles.authContent}>
          <Text style={styles.createAccountTitle}>
            {showLogin ? 'Welcome back' : 'Create an account'}
          </Text>
          <Text style={styles.createAccountSubtitle}>
            {showLogin ? 'Enter your credentials to sign in' : 'Enter your email to sign up for this app'}
          </Text>

          {/* Form Inputs */}
          {/* Username - only show for register */}
          {!showLogin && (
            <TextInput
              style={styles.emailInput}
              placeholder="使用者名稱"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />
          )}

          {/* Email Input */}
          <TextInput
            style={styles.emailInput}
            placeholder={showLogin ? "email@domain.com" : "帳號 (email@domain.com)"}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password Input */}
          <TextInput
            style={styles.emailInput}
            placeholder="密碼"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={showLogin ? handleLogin : handleRegister}
          >
            <Text style={styles.continueButtonText}>
              {showLogin ? 'Sign In' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By clicking continue, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>

          {/* Switch between Login/Register */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {showLogin ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <TouchableOpacity onPress={() => setShowLogin(!showLogin)}>
              <Text style={styles.switchLink}>
                {showLogin ? 'Sign up' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // 認證頁面樣式
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 60,
  },
  authContent: {
    alignItems: 'stretch',
  },
  createAccountTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  createAccountSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 24,
  },
  testButton: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0C674',
  },
  testButtonText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
  },
  diagnosisButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  diagnosisButtonText: {
    color: '#1565C0',
    fontSize: 14,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  socialButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  termsContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#000',
    textDecorationLine: 'underline',
  },
  // 登入/註冊切換連結樣式
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  switchText: {
    fontSize: 14,
    color: '#666',
  },
  switchLink: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // 已登入個人資料頁面樣式
  profileContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  profileTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
  },
  userProfileSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    borderWidth: 3,
    borderColor: 'white',
  },
  profileUserName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  profileUserEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  profileMemberType: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  profileJoinDate: {
    fontSize: 12,
    color: '#999',
  },
  profileMenuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 40,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  profileMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileMenuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  profileLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  profileLogoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  // 新的已登入頁面樣式（符合圖片設計）
  loggedInContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 40,
    paddingBottom: 0,
  },
  loggedInScrollView: {
    flex: 1,
    paddingBottom: 20,
  },
  loggedInTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  loggedInProfileSection: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 30,
    marginHorizontal: 0,
    marginBottom: 20,
    borderRadius: 12,
  },
  loggedInAvatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  loggedInAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  loggedInStatusDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    borderWidth: 3,
    borderColor: 'white',
  },
  loggedInUserName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  loggedInUserEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  loggedInBio: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    lineHeight: 20,
  },
  loggedInMemberType: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  loggedInJoinDate: {
    fontSize: 12,
    color: '#999',
  },
  loggedInMenuContainer: {
    backgroundColor: 'white',
    marginHorizontal: 0,
    marginBottom: 20,
  },
  loggedInMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  loggedInMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loggedInMenuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 52,
  },
  logoutSeparator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
  },
  loggedInLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 40,
  },
  loggedInLogoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  // 原有樣式
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: 'white',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  memberBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  joinDate: {
    fontSize: 14,
    color: '#999',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  inputContainer: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // Supabase 相關樣式
  disabledButton: {
    opacity: 0.6,
  },
  forgotPasswordButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
});