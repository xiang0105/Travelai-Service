import storage from '@/lib/storage';
import { FontAwesome } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import activityLogger from '../../lib/activityLogger';
import { supabase } from '../../lib/supabase';
import { FILTER_TAGS, PRELOAD_CONFIG, syncFavoriteStatus, Trip, useGlobalState, useTripsCache } from '../../store/globalState';

const { width } = Dimensions.get('window');

export default function SearchScreen() {
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('評分');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // 排序順序：升序或降序
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [globalState, setGlobalState] = useGlobalState();
  const isAuthenticated = globalState.isLoggedIn || false;
  const tripsCache = useTripsCache();
  const insets = useSafeAreaInsets();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false); // 追蹤是否已載入過
  const [needsRefresh, setNeedsRefresh] = useState(false); // 追蹤是否需要刷新

  // 卸載時清理 debounce 計時器
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // 載入 Supabase trips
  const fetchTrips = useCallback(async (forceRefresh = false, loadMore = false) => {
    // 如果有預載入資料且不是強制刷新或載入更多，使用快取資料
    if (tripsCache.isPreloaded && !forceRefresh && !loadMore && !needsRefresh) {
      setTrips(tripsCache.trips);
      setHasLoaded(true);
      setNeedsRefresh(false);
      setTimeout(() => {
        filterTrips('', [], '評分', 'desc', tripsCache.trips);
      }, 0);
      return;
    }
    
    // 如果已經載入過且不是強制刷新，則跳過
    if (hasLoaded && !forceRefresh && !needsRefresh && !loadMore) {
      return;
    }
    
    try {
      setLoading(true);
      setLoadError(null);
      
      const currentPage = loadMore ? tripsCache.currentPage + 1 : 0;
      const offset = currentPage * PRELOAD_CONFIG.ITEMS_PER_PAGE;
      
      const { data, error } = await supabase
        .from('trips')
        .select('id,title,subtitle,description,icon,image,price,duration,rating,tags,location,departure_location,destination,created_at,updated_at,status,featured')
        .order('created_at', { ascending: false })
        .range(offset, offset + PRELOAD_CONFIG.ITEMS_PER_PAGE - 1); // 使用分頁範圍
      if (error) throw error;

      // 將資料表列映射到 UI 需要的 Trip 型別
      const mapped: Trip[] = (data || []).map((row: any) => {
        const location = row.location || (row.departure_location && row.destination
          ? `${row.departure_location} → ${row.destination}`
          : '');
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        const publishedAt = createdAt
          ? `${Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))}天前`
          : undefined;
        return {
          id: row.id,
          title: row.title || '',
          location,
          rating: Number(row.rating) || 0,
          price: Number(row.price) || 0,
          image: row.image || 'https://picsum.photos/300/200?blur=2',
          tags: Array.isArray(row.tags) ? row.tags : [],
          description: row.description || '',
          duration: row.duration || '',
          // 以下欄位資料表沒有，給預設值避免 UI 破版
          groupSize: '6-12人',
          difficulty: '中等',
          highlights: [],
          includes: [],
          gallery: [],
          likes: 0,
          isLiked: false,
          isFavorited: false,
          comments: 0,
          author: { name: 'TripMind', avatar: 'https://picsum.photos/50/50?blur=1', verified: true },
          publishedAt,
        } as Trip;
      });

      // 補上 likes 計數
      const { data: likeCounts, error: likeCountErr } = await supabase
        .from('trip_likes_counts')
        .select('trip_id, likes_count');
      // 若 view 尚未建立或發生錯誤，忽略計數（維持 0）
      const likeCountMap = new Map<string, number>(
        (likeCounts || []).map((r: any) => [r.trip_id, r.likes_count])
      );

      // 若使用者已登入，載入 favorites 與 likes
      const { data: { user } } = await supabase.auth.getUser();
      let mappedDecorated = mapped.map(t => ({
        ...t,
        likes: likeCountMap.get(t.id) ?? 0,
      }));
      if (user) {
        const [favsRes, likesRes] = await Promise.all([
          supabase.from('favorites').select('trip_id').eq('user_id', user.id),
          supabase.from('likes').select('trip_id').eq('user_id', user.id),
        ]);
        if (favsRes.error) throw favsRes.error;
        if (likesRes.error) throw likesRes.error;
        const favoriteIds = new Set((favsRes.data || []).map((f: any) => f.trip_id));
        const likedIds = new Set((likesRes.data || []).map((l: any) => l.trip_id));
        mappedDecorated = mappedDecorated.map(t => ({
          ...t,
          isFavorited: favoriteIds.has(t.id),
          isLiked: likedIds.has(t.id),
        }));
      }

      if (loadMore) {
        setTrips(prevTrips => [...prevTrips, ...mappedDecorated]);
      } else {
        setTrips(mappedDecorated);
        // 只在非載入更多時初始化過濾/排序
        setTimeout(() => {
          filterTrips('', [], '評分', 'desc', mappedDecorated);
        }, 0);
      }
      
      setHasLoaded(true);
      setNeedsRefresh(false);
      
      // 更新快取
      const updatedTrips = loadMore ? [...tripsCache.trips, ...mappedDecorated] : mappedDecorated;
      tripsCache.updateCache(
        updatedTrips,
        false,
        currentPage,
        mappedDecorated.length === PRELOAD_CONFIG.ITEMS_PER_PAGE,
        !loadMore && currentPage === 0 ? true : tripsCache.isPreloaded
      );
    } catch (e: any) {
      console.error('Load trips error:', e);
      setLoadError(e?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [hasLoaded, needsRefresh]);

  // 只在首次載入時執行
  useEffect(() => {
    if (!hasLoaded) {
      fetchTrips();
    }
  }, [fetchTrips, hasLoaded]);

  // 頁面聚焦時檢查是否需要刷新
  useFocusEffect(
    useCallback(() => {
      const checkForUpdates = async () => {
        try {
          // 檢查是否有來自其他頁面的收藏更新
          const needUpdate = await storage.getItem('favoritesNeedUpdate');
          
          if (needUpdate === 'true' || needsRefresh) {
            fetchTrips(true);
            // 清除更新標記
            await storage.removeItem('favoritesNeedUpdate');
          }
        } catch (error) {
          console.error('檢查更新失敗:', error);
          // 如果檢查失敗，仍然根據本地狀態決定是否刷新
          if (needsRefresh) {
            fetchTrips(true);
          }
        }
      };
      
      checkForUpdates();
    }, [fetchTrips, needsRefresh])
  );

  // 載入更多行程
  const loadMoreTrips = async () => {
    if (!tripsCache.hasMore || loading) return;
    await fetchTrips(false, true); // forceRefresh = false, loadMore = true
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    // 防抖處理：延遲觸發過濾，降低重算頻率
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      filterTrips(text, activeTags, sortBy);
    }, 250);
  };

  const toggleTag = (tagId: string) => {
    const newActiveTags = activeTags.includes(tagId)
      ? activeTags.filter(id => id !== tagId)
      : [...activeTags, tagId];
    setActiveTags(newActiveTags);
    filterTrips(searchText, newActiveTags, sortBy);
  };

  const handleSort = (newSortBy: string) => {
    setSortBy(newSortBy);
    filterTrips(searchText, activeTags, newSortBy, sortOrder);
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    filterTrips(searchText, activeTags, sortBy, newOrder);
  };

  const filterTrips = (
    text: string,
    tags: string[],
    currentSortBy: string = sortBy,
    currentOrder: 'asc' | 'desc' = sortOrder,
    base: Trip[] = trips,
  ) => {
    let filtered = [...base]; // 以目前資料集為基礎

    // 文字搜尋
    if (text) {
      filtered = filtered.filter(trip =>
        trip.title.toLowerCase().includes(text.toLowerCase()) ||
        trip.location.toLowerCase().includes(text.toLowerCase())
      );
    }

    // 標籤篩選
    if (tags.length > 0) {
      filtered = filtered.filter(trip =>
        tags.some(tag => {
          const filterTag = FILTER_TAGS.find(f => f.id === tag);
          return filterTag && trip.tags.includes(filterTag.name);
        })
      );
    }

    // 排序 - 確保每次都正確排序
    const sortedFiltered = [...filtered];
    if (currentSortBy === '評分') {
      sortedFiltered.sort((a, b) => currentOrder === 'desc' ? b.rating - a.rating : a.rating - b.rating);
    } else if (currentSortBy === '價格') {
      sortedFiltered.sort((a, b) => currentOrder === 'asc' ? a.price - b.price : b.price - a.price);
    } else if (currentSortBy === '名稱') {
      sortedFiltered.sort((a, b) => {
        const result = a.title.localeCompare(b.title, 'zh-TW');
        return currentOrder === 'asc' ? result : -result;
      });
    }

    setFilteredTrips(sortedFiltered);
  };

  // 當全域 trips cache 被其他頁面更新（例如收藏變更時），同步本地狀態與篩選結果
  useEffect(() => {
    try {
      if (tripsCache && tripsCache.trips && tripsCache.trips.length) {
        setTrips(tripsCache.trips);
        filterTrips(searchText, activeTags, sortBy, sortOrder, tripsCache.trips);
      }
    } catch (err) {
      console.error('sync trips from cache error:', err);
    }
  }, [tripsCache.lastUpdated, tripsCache.trips]);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<FontAwesome key={i} name="star" size={12} color="#FFD700" />);
    }

    if (hasHalfStar) {
      stars.push(<FontAwesome key="half" name="star-half-o" size={12} color="#FFD700" />);
    }

    return stars;
  };

  const openModal = (trip: Trip) => {
    setSelectedTrip(trip);
    setModalVisible(true);
  };

  const closeModal = () => {
    setSelectedTrip(null);
    setModalVisible(false);
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      Alert.alert('需要登入', '請先登入以按愛心');
      return;
    }
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
      const updatedTrips = filteredTrips.map(trip =>
        trip.id === selectedTrip.id ? updatedTrip : trip
      );
      setFilteredTrips(updatedTrips);
    } catch (e: any) {
      console.error('toggle like error:', e);
      Alert.alert('按讚失敗', e?.message || '請稍後再試');
    }
  };

  const handleFavorite = async () => {
    if (!selectedTrip) return;
    try {
      // 取得目前使用者 ID（以 Supabase session 為準）
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('需要登入', '請先登入以收藏行程');
        return;
      }

      if (!selectedTrip.isFavorited) {
          // 新增收藏（用 upsert 避免重複點擊造成唯一鍵錯誤）
          const { error } = await supabase
            .from('favorites')
            .upsert(
              [{ user_id: user.id, trip_id: selectedTrip.id }],
              { onConflict: 'user_id,trip_id', ignoreDuplicates: true }
            );
          if (error) throw error;
          
      } else {
        // 取消收藏（依 user_id + trip_id 刪除）
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('trip_id', selectedTrip.id);
        if (error) throw error;
      }

      // 本地同步 UI 狀態
      const updatedTrip = {
        ...selectedTrip,
        isFavorited: !selectedTrip.isFavorited,
      };
      setSelectedTrip(updatedTrip);
      
      // 更新所有相關的 trips 狀態
      const updatedTrips = trips.map(trip => 
        trip.id === selectedTrip.id ? updatedTrip : trip
      );
      setTrips(updatedTrips);
      
      const updatedFilteredTrips = filteredTrips.map(trip => 
        trip.id === selectedTrip.id ? updatedTrip : trip
      );
      setFilteredTrips(updatedFilteredTrips);
      
      // 使用全局同步函數更新快取
      syncFavoriteStatus(selectedTrip.id, updatedTrip.isFavorited);
      
      // 標記需要通知其他頁面刷新
      setNeedsRefresh(true);
      
      // 設置跨頁面更新標記，通知 favorites 頁面需要更新
      try {
        await storage.setItem('favoritesNeedUpdate', 'true');
        await storage.setItem('favoritesLastUpdate', Date.now().toString());
      } catch (error) {
        console.error('設置更新標記失敗:', error);
      }
      
      // 提供用戶反饋，但不跳轉頁面
      if (updatedTrip.isFavorited) {
        Alert.alert('已收藏', '行程已加入我的收藏');
        try { activityLogger.appendLog({ action: 'favorite', page: 'search', details: { tripId: selectedTrip.id, title: selectedTrip.title } }); } catch (e) { /* ignore */ }
      } else {
        Alert.alert('已取消收藏', '已從我的收藏中移除此行程');
        try { activityLogger.appendLog({ action: 'unfavorite', page: 'search', details: { tripId: selectedTrip.id, title: selectedTrip.title } }); } catch (e) { /* ignore */ }
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
        // 分享成功
        console.log('分享成功');
      } else if (result.action === Share.dismissedAction) {
        // 用戶取消分享
        console.log('用戶取消分享');
      }
    } catch (error) {
      Alert.alert('分享失敗', '無法分享此行程，請稍後再試');
      console.error('Share error:', error);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: 0, paddingBottom: Math.max(insets.bottom, 10) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.title}>搜尋行程</Text>
                <Text style={styles.subtitle}>共 {filteredTrips.length} 個行程 {trips.length >= 50 ? '（限制50筆）' : ''}</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <FontAwesome name="search" size={16} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="搜尋行程、地點、標題..."
                placeholderTextColor="#999"
                value={searchText}
                onChangeText={handleSearch}
              />
            </View>
          </View>

          {/* Filter and Sort Bar */}
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={[styles.filterButton, showFilters && styles.filterButtonActive]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <FontAwesome name="filter" size={16} color={showFilters ? '#007AFF' : '#333'} />
              <Text style={[styles.filterText, showFilters && styles.filterTextActive]}>篩選</Text>
            </TouchableOpacity>

            <View style={styles.sortContainer}>
              <TouchableOpacity 
                style={styles.sortButton}
                onPress={toggleSortOrder}
              >
                <FontAwesome 
                  name={sortOrder === 'desc' ? 'sort-amount-desc' : 'sort-amount-asc'} 
                  size={16} 
                  color="#007AFF" 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.sortOptionButton, sortBy === '評分' && styles.sortOptionButtonActive]}
                onPress={() => handleSort('評分')}
              >
                <Text style={[styles.sortOptionText, sortBy === '評分' && styles.sortOptionTextActive]}>評分</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.sortOptionButton, sortBy === '價格' && styles.sortOptionButtonActive]}
                onPress={() => handleSort('價格')}
              >
                <Text style={[styles.sortOptionText, sortBy === '價格' && styles.sortOptionTextActive]}>價格</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.sortOptionButton, sortBy === '名稱' && styles.sortOptionButtonActive]}
                onPress={() => handleSort('名稱')}
              >
                <Text style={[styles.sortOptionText, sortBy === '名稱' && styles.sortOptionTextActive]}>名稱</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hot Search Tags */}
          <View style={styles.hotSearchSection}>
            <Text style={styles.hotSearchTitle}>熱門搜尋</Text>
            <View style={styles.tagsContainer}>
              {FILTER_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tag,
                    activeTags.includes(tag.id) && styles.activeTag
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Text style={[
                    styles.tagText,
                    activeTags.includes(tag.id) && styles.activeTagText
                  ]}>
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 載入 / 錯誤 提示 */}
          {loading && (
            <View style={{ paddingHorizontal: 24, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#007AFF" />
              <Text style={{ marginLeft: 10, color: '#666' }}>載入中…</Text>
            </View>
          )}
          {!!loadError && (
            <View style={{ paddingHorizontal: 24, paddingVertical: 10 }}>
              <Text style={{ color: '#d00' }}>載入失敗：{loadError}</Text>
            </View>
          )}

          {/* Results */}
          <View style={styles.resultsContainer}>
            {filteredTrips.map((trip, index) => (
              <TouchableOpacity
                key={trip.id}
                style={[
                  styles.tripCard,
                  index % 2 === 0 ? styles.leftCard : styles.rightCard
                ]}
                onPress={() => openModal(trip)}
              >
                <View style={styles.imageContainer}>
                  <Image source={{ uri: trip.image }} style={styles.tripImage} />
                  <View style={styles.tripInfo}>
                    <Text style={styles.tripTitle} numberOfLines={2}>
                      {trip.title}
                    </Text>

                    {/* <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}> */}
                      <Text style={styles.tripLocation}>{trip.location}</Text>
                      <Text style={styles.ratingContainer}>
                        <FontAwesome name="star" size={12} color="#FFD700" />
                          <Text style={styles.ratingText}>{trip.rating}</Text>
                      </Text>
                    {/* </View> */}
                    
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            
            {/* 載入更多按鈕 */}
            {tripsCache.hasMore && filteredTrips.length >= PRELOAD_CONFIG.ITEMS_PER_PAGE && (
              <TouchableOpacity 
                style={styles.loadMoreButton} 
                onPress={loadMoreTrips}
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

                
                  <TouchableOpacity onPress={handleFavorite} style={styles.igActionButtonSimple}>
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

                {/* Action Buttons */}
                {/* <View style={styles.igActionButtons}>
                  
                  
                </View> */}

              </ScrollView>
            </View>
          </Modal>
        )}
  </View>
    </KeyboardAvoidingView>
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
    alignItems: 'flex-start',
    paddingVertical: 20,
    paddingBottom: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
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
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    marginTop: 4,
  },
  searchContainer: {
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  filterButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  filterText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
  },
  filterTextActive: {
    color: '#007AFF',
  },
  sortButton: {
    padding: 8,
    marginRight: 8,
  },
  sortOptionButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sortOptionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortOptionText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: 'white',
  },
  sortOptionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortOrderButton: {
    marginLeft: 4,
    padding: 4,
  },
  hotSearchSection: {
    marginBottom: 24,
  },
  hotSearchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E8F0',
  },
  activeTag: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tagText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  activeTagText: {
    color: 'white',
    fontWeight: '600',
  },
  resultsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tripCard: {
    width: (width - 64) / 2,
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
  },
  leftCard: {
    marginRight: 8,
  },
  rightCard: {
    marginLeft: 8,
  },
  tripImage: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  tripInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
  },
  tripTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  tripLocation: {
    fontSize: 11,
    color: '#E0E0E0',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    marginLeft: 4,
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
  igActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  igActionButtonSimple: {
    width: 25,
    height: 25,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  igActionButtonLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  igLeftActions: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  igActionButton: {
    marginRight: 16,
  },
  igStats: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  igLikesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  igCommentsCount: {
    fontSize: 14,
    color: '#999',
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
  igGallery: {
    marginTop: 8,
  },
  igGalleryImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
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