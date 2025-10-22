import { FontAwesome } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { AuthService, supabase } from '@/lib/supabase';
import { loadLocalAvatarForCurrentUser, preloadFavoritesData, preloadTripsData, updateGlobalState } from '@/store/globalState';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // 啟動時同步一次目前 session 並預載入資料
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
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
              memberLevel: 'Test',
              joinDate: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '今天加入',
              bio: profile?.bio || ''
            },
            supabaseSession: session,
          });
          
          // 已登入用戶，預載入收藏資料
          await preloadFavoritesData();
        } else {
          updateGlobalState({ isLoading: false });
        }
        
        // 不管是否登入，都預載入旅程資料
        await preloadTripsData();
        
      } catch (e) {
        console.error('初始化失敗:', e);
        updateGlobalState({ isLoading: false });
        
        // 即使初始化失敗，也嘗試預載入旅程資料
        try {
          await preloadTripsData();
        } catch (preloadError) {
          console.error('預載入失敗:', preloadError);
        }
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5E7',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 20),
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '400',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '搜尋',
          tabBarIcon: ({ color }) => <FontAwesome name="search" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: '客服',
          tabBarIcon: ({ color }) => <FontAwesome name="comment-o" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: '收藏',
          tabBarIcon: ({ color }) => <FontAwesome name="heart-o" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '個人',
          tabBarIcon: ({ color }) => <FontAwesome name="user-o" size={24} color={color} />,
        }}
      />
    </Tabs>
    </SafeAreaProvider>
  );
}
