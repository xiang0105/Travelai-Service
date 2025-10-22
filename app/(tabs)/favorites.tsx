import storage from '@/lib/storage';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import activityLogger from '../../lib/activityLogger';
import { supabase } from '../../lib/supabase';
import { CATEGORY_TYPES, PRELOAD_CONFIG, syncFavoriteStatus, Trip, useFavoritesCache, useGlobalState } from '../../store/globalState';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const [globalState] = useGlobalState();
  const { favoritesCache, updateFavoritesCache } = useFavoritesCache();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [items, setItems] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false); // 追蹤是否已載入過
  const [needsRefresh, setNeedsRefresh] = useState(false); // 追蹤是否需要刷新

  // 載入使用者收藏（favorites join trips）
  const loadFavorites = useCallback(async (forceRefresh = false, loadMore = false) => {
      if (!globalState.isLoggedIn) {
        setHasLoaded(false);
        setItems([]);
        return;
      }
      
      // 如果有預載入資料且不是強制刷新或載入更多，使用快取資料
      if (favoritesCache.isPreloaded && !forceRefresh && !loadMore && !needsRefresh) {
        setItems(favoritesCache.data);
        setHasLoaded(true);
        setNeedsRefresh(false);
        return;
      }
      
      // 如果已經載入過且不是強制刷新，則跳過
      if (hasLoaded && !forceRefresh && !needsRefresh && !loadMore) {
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1) 取使用者 favorites 列表（trip_id + created_at），支援分頁
        const currentPage = loadMore ? favoritesCache.currentPage + 1 : 0;
        const offset = currentPage * PRELOAD_CONFIG.ITEMS_PER_PAGE;
        
        const { data: favRows, error: favErr } = await supabase
          .from('favorites')
          .select('trip_id, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(offset, offset + PRELOAD_CONFIG.ITEMS_PER_PAGE - 1); // 使用分頁範圍
        if (favErr) throw favErr;

  const tripIds: string[] = (favRows || []).map(r => r.trip_id).filter(Boolean);
        if (!tripIds.length) {
          setItems([]);
          setHasLoaded(true);
          setNeedsRefresh(false);
          return;
        }

        // 2) 根據 tripIds 批次取回 trips 詳細資料
        const { data: tripsRows, error: tripsErr } = await supabase
          .from('trips')
          .select('id, title, description, image, price, rating, location, departure_location, destination')
          .in('id', tripIds);
        if (tripsErr) throw tripsErr;

        const tripMap = new Map<string, any>();
        for (const t of tripsRows || []) tripMap.set(t.id, t);

        const mapped: Trip[] = (favRows || [])
          .map(row => {
            const t = tripMap.get(row.trip_id);
            if (!t) return null;
            const location = t.location || (t.departure_location && t.destination ? `${t.departure_location} → ${t.destination}` : '');
            const createdAt = row.created_at ? new Date(row.created_at) : null;
            const publishedAt = createdAt ? `${Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))}天前` : undefined;
            return {
              id: t.id,
              title: t.title || '',
              location,
              rating: Number(t.rating) || 0,
              price: Number(t.price) || 0,
              image: t.image || 'https://picsum.photos/300/200?blur=2',
              tags: Array.isArray(t.tags) ? t.tags : [],
              description: t.description || '',
              duration: t.duration || '',
              saveDate: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined,
              category: 'trips',
              groupSize: '6-12人',
              difficulty: '中等',
              highlights: [],
              includes: [],
              gallery: [],
              likes: 0,
              isLiked: false,
              isFavorited: true,
              comments: 0,
              author: { name: 'TripMind', avatar: 'https://picsum.photos/50/50?blur=1', verified: true },
              publishedAt,
            } as Trip;
          })
          .filter(Boolean) as Trip[];
        
        if (loadMore) {
          setItems(prevItems => [...prevItems, ...mapped]);
        } else {
          setItems(mapped);
        }
        
        setHasLoaded(true);
        setNeedsRefresh(false);
        
        // 更新快取
        updateFavoritesCache({
          data: loadMore ? [...favoritesCache.data, ...mapped] : mapped,
          currentPage: currentPage,
          hasMore: mapped.length === PRELOAD_CONFIG.ITEMS_PER_PAGE,
          isPreloaded: !loadMore && currentPage === 0 ? true : favoritesCache.isPreloaded
        });
      } catch (e: any) {
        console.error('load favorites error:', e);
        setError(e?.message || '載入收藏失敗');
      } finally {
        setLoading(false);
      }
  }, [globalState.isLoggedIn, hasLoaded, needsRefresh, favoritesCache.isPreloaded, favoritesCache.data, updateFavoritesCache]);

  // 監聽快取狀態變化，當快取標記需要刷新時自動重新載入
  useEffect(() => {
    const handleCacheRefresh = async () => {
      if (favoritesCache.needsRefresh && globalState.isLoggedIn && hasLoaded) {
        console.log('檢測到收藏快取需要刷新，正在重新載入...');
        // 設置本地需要刷新標記
        setNeedsRefresh(true);
        
        try {
          await loadFavorites(true);
          // 載入完成後重置快取的 needsRefresh 標記
          updateFavoritesCache({
            needsRefresh: false
          });
          console.log('收藏列表重新載入完成');
        } catch (error) {
          console.error('自動重新載入收藏失敗:', error);
        }
      }
    };
    
    handleCacheRefresh();
  }, [favoritesCache.needsRefresh, globalState.isLoggedIn, hasLoaded, loadFavorites, updateFavoritesCache]);

  // 只在首次載入時執行
  useEffect(() => {
    if (!hasLoaded) {
      loadFavorites();
    }
  }, [loadFavorites, hasLoaded]);

  // 載入更多收藏
  const loadMoreFavorites = async () => {
    if (!favoritesCache.hasMore || loading) return;
    await loadFavorites(false, true); // forceRefresh = false, loadMore = true
  };

  // 頁面聚焦時檢查是否需要刷新
  useFocusEffect(
    useCallback(() => {
      const checkForUpdates = async () => {
        try {
          // 檢查是否有來自其他頁面的收藏更新
          const needUpdate = await storage.getItem('favoritesNeedUpdate');
          
          if (needUpdate === 'true' || needsRefresh) {
            loadFavorites(true);
            // 清除更新標記
            await storage.removeItem('favoritesNeedUpdate');
          } else if (globalState.isLoggedIn && !hasLoaded) {
            // 首次載入
            loadFavorites();
          }
        } catch (error) {
          console.error('檢查更新失敗:', error);
          // 如果檢查失敗，仍然根據本地狀態決定是否刷新
          if (needsRefresh) {
            loadFavorites(true);
          } else if (globalState.isLoggedIn && !hasLoaded) {
            loadFavorites();
          }
        }
      };
      
      checkForUpdates();
    }, [loadFavorites, globalState.isLoggedIn, hasLoaded, needsRefresh])
  );

  const handleToggleFavorite = async (tripId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('trip_id', tripId);
      if (error) throw error;
      // 直接更新本地狀態，不需要重新載入
      setItems(prev => prev.filter(x => x.id !== tripId));
      
      // 使用全局同步函數更新快取
      syncFavoriteStatus(tripId, false);

  // log action
  try { await activityLogger.appendLog({ userId: user.id, action: 'unfavorite', page: 'favorites', details: { tripId } }); } catch (e) { /* ignore */ }
      
      // 標記其他頁面需要刷新
      setNeedsRefresh(true);
      
      // 設置跨頁面更新標記，通知 search 頁面需要更新
      try {
        await storage.setItem('favoritesNeedUpdate', 'true');
        await storage.setItem('favoritesLastUpdate', Date.now().toString());
      } catch (error) {
        console.error('設置更新標記失敗:', error);
      }
    } catch (e: any) {
      console.error('remove favorite error:', e);
    }
  };

  const handleLogin = () => {
    // 導向profile頁面進行登入
    router.push('/(tabs)/profile');
  };

  const handleRegister = () => {
    // 導向profile頁面進行註冊
    router.push('/(tabs)/profile');
  };

  // Modal 相關函數
  const openModal = (item: Trip) => {
    setSelectedTrip(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedTrip(null);
    setModalVisible(false);
  };

  const handleLike = async () => {
    if (!selectedTrip) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('需要登入', '請先登入以按愛心');
        return;
      }
      if (!selectedTrip.isLiked) {
        const { error } = await supabase
          .from('likes')
          .insert([{ user_id: user.id, trip_id: selectedTrip.id }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('trip_id', selectedTrip.id);
        if (error) throw error;
      }

      const updatedTrip = {
        ...selectedTrip,
        isLiked: !selectedTrip.isLiked,
        likes: (selectedTrip.likes ?? 0) + (!selectedTrip.isLiked ? 1 : -1),
      };
      setSelectedTrip(updatedTrip);
    } catch (e: any) {
      console.error('toggle like error:', e);
      Alert.alert('按讚失敗', e?.message || '請稍後再試');
    }
  };

  const handleModalFavorite = async () => {
    if (!selectedTrip) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('需要登入', '請先登入以收藏行程');
        return;
      }

      const wasInitiallyFavorited = selectedTrip.isFavorited;

      if (!selectedTrip.isFavorited) {
        const { error } = await supabase
          .from('favorites')
          .upsert(
            [{ user_id: user.id, trip_id: selectedTrip.id }],
            { onConflict: 'user_id,trip_id', ignoreDuplicates: true }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('trip_id', selectedTrip.id);
        if (error) throw error;
      }

      const updatedTrip = {
        ...selectedTrip,
        isFavorited: !selectedTrip.isFavorited,
      };
      setSelectedTrip(updatedTrip);
      
      // 使用全局同步函數更新快取
      syncFavoriteStatus(selectedTrip.id, updatedTrip.isFavorited);
      
      // 同步更新收藏列表
      if (!updatedTrip.isFavorited) {
        // 直接更新本地狀態，不需要重新載入
        setItems(prev => prev.filter(item => item.id !== selectedTrip.id));
        
        // 關閉模態框，因為已經從收藏列表中移除
        closeModal();
        
        // 如果是取消收藏，顯示提示訊息
        Alert.alert('已取消收藏', '已從我的收藏中移除此行程');
      } else {
        Alert.alert('已收藏', '行程已加入我的收藏');
      }
      
      // 標記需要刷新（通知其他頁面）
      setNeedsRefresh(true);

    // log action
    try { await activityLogger.appendLog({ userId: user.id, action: updatedTrip.isFavorited ? 'favorite' : 'unfavorite', page: 'favorites', details: { tripId: selectedTrip.id } }); } catch (e) { /* ignore */ }
      
      // 設置跨頁面更新標記，通知 search 頁面需要更新
      try {
        await storage.setItem('favoritesNeedUpdate', 'true');
        await storage.setItem('favoritesLastUpdate', Date.now().toString());
      } catch (error) {
        console.error('設置更新標記失敗:', error);
      }
      
    } catch (e: any) {
      console.error('toggle favorite error:', e);
      Alert.alert('收藏失敗', e?.message || '請稍後再試');
    }
  };

  // 留言功能 (目前未開發，已註解)
  /*
  const handleComment = () => {
    Alert.alert('提示', '留言功能未開發');
  };
  */

  const handleShare = async () => {
    if (!selectedTrip) {
      Alert.alert('錯誤', '無法分享，請選擇行程');
      return;
    }

    try {
      const highlightsText = (selectedTrip.highlights ?? []).length
        ? `行程精華：\n${(selectedTrip.highlights ?? []).map(h => `• ${h}`).join('\n')}\n\n`
        : '';
      const shareContent = {
        message: `🌍 精彩行程推薦：${selectedTrip.title}\n\n` +
                 `📍 地點：${selectedTrip.location}\n` +
                 `⭐ 評分：${selectedTrip.rating}/5.0\n` +
                 `💰 價格：NT$ ${selectedTrip.price.toLocaleString()}\n` +
                 `⏱️ 時長：${selectedTrip.duration}\n\n` +
                 `${selectedTrip.description}\n\n` +
                 highlightsText +
                 `快來加入我們的旅程吧！ 🚀`,
        title: `分享行程: ${selectedTrip.title}`,
      };
      
      const result = await Share.share(shareContent);
      
      if (result.action === Share.sharedAction) {
        console.log('分享成功');
      } else if (result.action === Share.dismissedAction) {
        console.log('用戶取消分享');
      }
    } catch (error) {
      Alert.alert('分享失敗', '無法分享此行程，請稍後再試');
      console.error('Share error:', error);
    }
  };

  // 根據選中的分類篩選收藏項目
  const filteredFavorites = React.useMemo(() => {
    const base = items;
    return selectedCategory === 'all'
      ? base
      : base.filter(item => item.category === selectedCategory);
  }, [selectedCategory, items]);

  // 更新分類計數
  const categoryCountMap = React.useMemo(() => {
    const map: Record<string, number> = { all: items.length } as Record<string, number>;
    for (const item of items) {
      const cat = item.category ?? 'trips';
      map[cat] = (map[cat] || 0) + 1;
    }
    return map;
  }, [items]);

  const getCategoryCount = (categoryId: string) => categoryCountMap[categoryId] ?? 0;

  // 如果未登入，顯示登入提示界面
  if (!globalState.isLoggedIn) {
    return (
  <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.loginPromptContainer}>
          <View style={styles.loginPromptContent}>
            <FontAwesome name="heart-o" size={64} color="#E5E5E5" style={styles.loginPromptIcon} />
            <Text style={styles.loginPromptTitle}>登入後查看收藏</Text>
            <Text style={styles.loginPromptMessage}>
              登入您的帳號來查看和管理您的收藏內容
            </Text>
            
            <View style={styles.loginPromptButtons}>
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleLogin}
              >
                <Text style={styles.loginButtonText}>登入</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.registerButton}
                onPress={handleRegister}
              >
                <Text style={styles.registerButtonText}>註冊</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
  <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>我的收藏</Text>
              <Text style={styles.subtitle}>已收藏 {filteredFavorites.length} 項內容 {items.length >= 20 ? '（限制20筆）' : ''}</Text>
              {!!error && <Text style={{ color: '#d00', marginTop: 6 }}>錯誤：{error}</Text>}
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Category Tabs */}
        <View style={styles.categoryContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORY_TYPES.map((category) => {
              const count = getCategoryCount(category.id);
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryTab,
                    selectedCategory === category.id && styles.categoryTabActive
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <View style={styles.categoryContent}>
                    <Text style={[
                      styles.categoryText,
                      selectedCategory === category.id && styles.categoryTextActive
                    ]}>
                      {category.name}
                    </Text>
                    {count > 0 && category.id !== 'all' && (
                      <Text style={[
                        styles.categoryCount,
                        selectedCategory === category.id && styles.categoryCountActive
                      ]}>
                        {count}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Favorites List */}
        <View style={styles.favoritesContainer}>
          {filteredFavorites.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.favoriteCard}
              onPress={() => openModal(item)}
            >
              <View style={styles.cardContent}>
                {/* Image */}
                <Image source={{ uri: item.image }} style={styles.favoriteImage} />
                
                {/* Content */}
                <View style={styles.cardInfo}>
                  {/* 標題行：標題 + 圖標 + 愛心 */}
                  <View style={styles.titleRow}>
                    <Text style={styles.favoriteTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <TouchableOpacity 
                      style={styles.heartButton}
                      onPress={() => handleToggleFavorite(item.id)}
                    >
                      <FontAwesome name="heart" size={16} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* 地點 */}
                  <Text style={styles.favoriteLocation}>{item.location}</Text>
                  
                  {/* 評分和價格行 */}
                  <View style={styles.ratingPriceRow}>
                    <View style={styles.ratingContainer}>
                      <FontAwesome name="star" size={12} color="#FFD700" />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                    <Text style={styles.priceText}>NT${item.price.toLocaleString()}</Text>
                  </View>
                  
                  {/* 收藏時間 */}
                  <Text style={styles.saveDate}>收藏於 {item.saveDate}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          
          {/* 載入更多按鈕 */}
          {favoritesCache.hasMore && filteredFavorites.length >= PRELOAD_CONFIG.ITEMS_PER_PAGE && (
            <TouchableOpacity 
              style={styles.loadMoreButton} 
              onPress={loadMoreFavorites}
              disabled={loading}
            >
              <Text style={styles.loadMoreText}>
                {loading ? '載入中...' : '載入更多'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modal for Trip Details - IG Style */}
      {selectedTrip && (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeModal}
        >
          <View style={styles.igModalContainer}>
            {/* Header */}
            <View style={styles.igHeader}>
              <TouchableOpacity onPress={closeModal}>
                <FontAwesome name="arrow-left" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.igHeaderTitle}>行程詳情</Text>
              <TouchableOpacity onPress={handleModalFavorite} style={styles.igActionButtonSimple}>
                <FontAwesome 
                  name={selectedTrip.isFavorited ? "bookmark" : "bookmark-o"} 
                  size={20} 
                  color={selectedTrip.isFavorited ? "#000" : "#666"} 
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.igContent} showsVerticalScrollIndicator={false}>
              {/* Author Info */}
              <View style={styles.igAuthorSection}>
                <Image source={{ uri: selectedTrip.author?.avatar || 'https://picsum.photos/50/50?blur=1' }} style={styles.igAuthorAvatar} />
                <View style={styles.igAuthorInfo}>
                  <View style={styles.igAuthorNameRow}>
                    <Text style={styles.igAuthorName}>{selectedTrip.author?.name || 'TripMind'}</Text>
                    {selectedTrip.author?.verified && (
                      <FontAwesome name="check-circle" size={14} color="#007AFF" style={styles.igVerified} />
                    )}
                  </View>
                  <Text style={styles.igPublishTime}>{selectedTrip.publishedAt || ''}</Text>
                </View>
              </View>

              {/* Main Image */}
              <Image source={{ uri: selectedTrip.image }} style={styles.igMainImage} />

              {/* Trip Title and Description */}
              <View style={styles.igDescriptionSection}>
                <Text style={styles.igTripTitle}>{selectedTrip.title}</Text>
                <Text style={styles.igDescription}>{selectedTrip.description}</Text>
              </View>

              {/* Trip Details */}
              <View style={styles.igDetailsSection}>
                <View style={styles.igDetailRow}>
                  <FontAwesome name="map-marker" size={16} color="#666" />
                  <Text style={styles.igDetailText}>{selectedTrip.location}</Text>
                </View>
                <View style={styles.igDetailRow}>
                  <FontAwesome name="clock-o" size={16} color="#666" />
                  <Text style={styles.igDetailText}>{selectedTrip.duration}</Text>
                </View>
                <View style={styles.igDetailRow}>
                  <FontAwesome name="users" size={16} color="#666" />
                  <Text style={styles.igDetailText}>{selectedTrip.groupSize}</Text>
                </View>
                <View style={styles.igDetailRow}>
                  <FontAwesome name="signal" size={16} color="#666" />
                  <Text style={styles.igDetailText}>難度: {selectedTrip.difficulty}</Text>
                </View>
                <View style={styles.igDetailRow}>
                  <FontAwesome name="star" size={16} color="#FFD700" />
                  <Text style={styles.igDetailText}>{selectedTrip.rating} 分</Text>
                </View>
                <View style={styles.igDetailRow}>
                  <FontAwesome name="dollar" size={16} color="#666" />
                  <Text style={styles.igDetailText}>NT$ {selectedTrip.price.toLocaleString()}</Text>
                </View>
              </View>

              {/* Highlights */}
              {!!(selectedTrip.highlights && selectedTrip.highlights.length) && (
                <View style={styles.igSection}>
                  <Text style={styles.igSectionTitle}>行程精華</Text>
                  {(selectedTrip.highlights ?? []).map((highlight, index) => (
                    <View key={index} style={styles.igHighlightItem}>
                      <FontAwesome name="check" size={14} color="#007AFF" />
                      <Text style={styles.igHighlightText}>{highlight}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Includes */}
              {!!(selectedTrip.includes && selectedTrip.includes.length) && (
                <View style={styles.igSection}>
                  <Text style={styles.igSectionTitle}>包含項目</Text>
                  {(selectedTrip.includes ?? []).map((item, index) => (
                    <View key={index} style={styles.igIncludeItem}>
                      <FontAwesome name="plus-circle" size={14} color="#28a745" />
                      <Text style={styles.igIncludeText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Tags */}
              <View style={styles.igSection}>
                <View style={styles.igTagsContainer}>
                  {selectedTrip.tags.map((tag, index) => (
                    <View key={index} style={styles.igTag}>
                      <Text style={styles.igTagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  header: {
    paddingVertical: 20,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  categoryContainer: {
    marginBottom: 24,
  },
  categoryScroll: {
    paddingVertical: 4,
  },
  categoryTab: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  categoryTabActive: {
    backgroundColor: '#FFD700',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#333',
    fontWeight: '600',
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryCount: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  categoryCountActive: {
    color: '#333',
  },
  favoritesContainer: {
    flex: 1,
  },
  favoriteCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  favoriteImage: {
    width: 70,
    height: 70,
    borderRadius: 6,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  favoriteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  linkIcon: {
    marginLeft: 4,
    marginRight: 6,
  },
  heartButton: {
    padding: 0,
  },
  favoriteLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  ratingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginLeft: 2,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  saveDate: {
    fontSize: 10,
    color: '#999',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginBottom: 24,
  },
  
  // 登入提示樣式
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPromptContent: {
    alignItems: 'center',
    maxWidth: 280,
  },
  loginPromptIcon: {
    marginBottom: 24,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  loginPromptMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  loginPromptButtons: {
    flexDirection: 'row',
    width: '100%',
  },
  loginButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    marginRight: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    marginLeft: 8,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // IG Style Modal Styles
  igModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  igHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    backgroundColor: '#FFFFFF',
  },
  igHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  igContent: {
    flex: 1,
  },
  igAuthorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  igAuthorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  igAuthorInfo: {
    flex: 1,
  },
  igAuthorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  igAuthorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  igVerified: {
    marginLeft: 4,
  },
  igPublishTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  igMainImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#F5F5F5',
  },
  igActionButtonSimple: {
    width: 25,
    height: 25,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  igDescriptionSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  igTripTitle: {
    paddingTop: 20,
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  igDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  igDetailsSection: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  igDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  igDetailText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  igSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  igSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  igHighlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  igHighlightText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  igIncludeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  igIncludeText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  igTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  igTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  igTagText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  loadMoreButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginVertical: 20,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});