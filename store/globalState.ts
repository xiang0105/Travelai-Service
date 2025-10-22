// 全域狀態管理與類型定義
// 這個文件負責管理整個應用程式的全域狀態、類型定義和常量

import { useEffect, useState } from 'react';
import storage from '../lib/storage';

// ==================== 全域類型定義 ====================

// 用戶資料介面
export interface User {
  id?: string;
  name: string;
  email: string;
  avatar: string;
  memberLevel: string;
  joinDate: string;
  bio?: string;
}

// 旅遊行程介面
export interface Trip {
  id: string; // Supabase trips.id 是 uuid
  title: string;
  location: string;
  rating: number;
  price: number;
  image: string;
  tags: string[];
  description: string;
  duration: string;
  groupSize?: string;
  difficulty?: string;
  highlights?: string[];
  includes?: string[];
  gallery?: string[];
  likes?: number; // 以 likes 表計算
  isLiked?: boolean; // 目前使用者是否已按讚
  isFavorited?: boolean;
  comments?: number;
  author?: {
    name: string;
    avatar: string;
    verified: boolean;
  };
  publishedAt?: string;
  // 收藏頁使用的額外欄位
  saveDate?: string;
  category?: 'trips';
}

// 聊天訊息介面
export interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: string;
}

// 收藏項目介面
export interface FavoriteItem {
  id: string;
  title: string;
  location: string;
  rating: number;
  price: number;
  image: string;
  saveDate: string;
  category: 'trips'; // 可擴充
}

// 篩選標籤介面
export interface FilterTag {
  id: string;
  name: string;
  active: boolean;
}

// 旅行偏好類型
export type TravelPreference = 'culture' | 'scenic' | 'museum' | 'food' | 'nature' | 'temple' | 'mountain' | 'flower';

// 排序類型
export type SortType = '評分' | '價格' | '名稱';
export type SortOrder = 'asc' | 'desc';

// 位置選擇類型
export type LocationType = 'departure' | 'destination';

// ==================== 全域常量定義 ====================

// 篩選標籤常量
export const FILTER_TAGS: FilterTag[] = [
  { id: 'culture', name: '文化', active: false },
  { id: 'scenic', name: '風景', active: false },
  { id: 'museum', name: '博物館', active: false },
  { id: 'food', name: '美食', active: false },
  { id: 'nature', name: '自然', active: false },
  { id: 'temple', name: '寺廟', active: false },
  { id: 'mountain', name: '山岳', active: false },
  { id: 'flower', name: '花卉', active: false },
];

// 會員等級常量
export const MEMBER_LEVELS = {
  GENERAL: '一般會員',
  PREMIUM: '高級會員',
  VIP: 'VIP會員',
} as const;

// 排序選項常量
export const SORT_OPTIONS: SortType[] = ['評分', '價格', '名稱'];

// 收藏分類常量
export const CATEGORY_TYPES = [
  { id: 'all', name: '全部' },
  { id: 'trips', name: '行程' },
  { id: 'attractions', name: '景點' },
  { id: 'food', name: '美食' },
  { id: 'activities', name: '活動' },
] as const;

// 台灣地區資料介面
export interface City {
  id: number;
  name: string;
  icon: string;
}

export interface Region {
  id: number;
  name: string;
  cities: City[];
}

// 台灣縣市資料 - 按地區分類
export const TAIWAN_REGIONS: Region[] = [
  {
    id: 1,
    name: '北部地區',
    cities: [
      { id: 1, name: '台北市', icon: '🏢' },
      { id: 2, name: '新北市', icon: '🏞️' },
      { id: 3, name: '桃園市', icon: '✈️' },
      { id: 4, name: '新竹市', icon: '🏛️' },
      { id: 5, name: '新竹縣', icon: '🗻' },
      { id: 6, name: '基隆市', icon: '🚢' },
    ]
  },
  {
    id: 2,
    name: '中部地區',
    cities: [
      { id: 7, name: '台中市', icon: '🏙️' },
      { id: 8, name: '苗栗縣', icon: '🎋' },
      { id: 9, name: '彰化縣', icon: '🌾' },
      { id: 10, name: '南投縣', icon: '⛰️' },
      { id: 11, name: '雲林縣', icon: '🌸' },
    ]
  },
  {
    id: 3,
    name: '南部地區',
    cities: [
      { id: 12, name: '嘉義市', icon: '🌅' },
      { id: 13, name: '嘉義縣', icon: '🌳' },
      { id: 14, name: '台南市', icon: '🏮' },
      { id: 15, name: '高雄市', icon: '🌆' },
      { id: 16, name: '屏東縣', icon: '🏝️' },
    ]
  },
  {
    id: 4,
    name: '東部地區',
    cities: [
      { id: 17, name: '宜蘭縣', icon: '🏔️' },
      { id: 18, name: '花蓮縣', icon: '🌺' },
      { id: 19, name: '台東縣', icon: '🏖️' },
    ]
  },
  {
    id: 5,
    name: '離島地區',
    cities: [
      { id: 20, name: '澎湖縣', icon: '🏖️' },
      { id: 21, name: '金門縣', icon: '🏰' },
      { id: 22, name: '連江縣', icon: '⚓' },
    ]
  },
];

// ==================== 全域狀態介面 ====================

export interface GlobalState {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  supabaseSession: any | null;
  // 應用程式狀態
  currentLocation: {
    departure?: string;
    destination?: string;
  };
  // UI 狀態
  theme: 'light' | 'dark';
  // 快取狀態
  tripsCache: {
    data: Trip[];
    lastUpdated: number;
    needsRefresh: boolean;
    currentPage: number;
    hasMore: boolean;
    isPreloaded: boolean;
  };
  favoritesCache: {
    data: Trip[];
    lastUpdated: number;
    needsRefresh: boolean;
    isPreloaded: boolean;
    currentPage: number;
    hasMore: boolean;
  };
}

// ==================== 初始狀態定義 ====================

const initialState: GlobalState = {
  isLoggedIn: false,
  isLoading: true,
  user: null,
  supabaseSession: null,
  currentLocation: {
    departure: undefined,
    destination: undefined,
  },
  theme: 'light',
  tripsCache: {
    data: [],
    lastUpdated: 0,
    needsRefresh: true,
    currentPage: 0,
    hasMore: true,
    isPreloaded: false,
  },
  favoritesCache: {
    data: [],
    lastUpdated: 0,
    needsRefresh: true,
    isPreloaded: false,
    currentPage: 0,
    hasMore: true,
  },
};

// 全域狀態變數
let globalState: GlobalState = { ...initialState };

// 訂閱者列表（用於通知狀態變化）
const subscribers: Array<() => void> = [];

// 訂閱狀態變化
const subscribe = (callback: () => void) => {
  subscribers.push(callback);
  
  // 返回取消訂閱函式
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
};

// 通知所有訂閱者狀態已變化
const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

// 更新全域狀態
export const updateGlobalState = (newState: Partial<GlobalState>) => {
  globalState = { ...globalState, ...newState };
  notifySubscribers();
};

// 獲取全域狀態
export const getGlobalState = (): GlobalState => {
  return { ...globalState };
};

// ==================== 全域狀態操作函式 ====================

// 登入函式
export const login = (userData: Partial<User> & { name: string; email: string }) => {
  updateGlobalState({
    isLoggedIn: true,
    user: {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      avatar: userData.avatar || 'https://via.placeholder.com/80',
      memberLevel: userData.memberLevel || MEMBER_LEVELS.GENERAL,
      joinDate: userData.joinDate || new Date().toLocaleDateString('zh-TW'),
      bio: userData.bio,
    },
  });
};

// 登出函式
export const logout = () => {
  updateGlobalState({
    isLoggedIn: false,
    user: null,
  });
};

// 檢查登入狀態
export const isLoggedIn = (): boolean => {
  return globalState.isLoggedIn;
};

// 設置當前位置
export const setCurrentLocation = (location: Partial<{ departure: string; destination: string }>) => {
  updateGlobalState({
    currentLocation: {
      ...globalState.currentLocation,
      ...location,
    },
  });
};

// 清除當前位置
export const clearCurrentLocation = () => {
  updateGlobalState({
    currentLocation: {
      departure: undefined,
      destination: undefined,
    },
  });
};

// 更新旅程快取
export const updateTripsCache = (
  trips: Trip[], 
  needsRefresh = false, 
  currentPage = 0, 
  hasMore = true, 
  isPreloaded = false
) => {
  updateGlobalState({
    tripsCache: {
      data: trips,
      lastUpdated: Date.now(),
      needsRefresh,
      currentPage,
      hasMore,
      isPreloaded,
    },
  });
};

// 更新收藏快取
export const updateFavoritesCache = (cacheUpdate: {
  data?: Trip[];
  needsRefresh?: boolean;
  isPreloaded?: boolean;
  currentPage?: number;
  hasMore?: boolean;
}) => {
  updateGlobalState({
    favoritesCache: {
      ...globalState.favoritesCache,
      ...cacheUpdate,
      lastUpdated: Date.now(),
    },
  });
};

// 標記旅程需要刷新
export const markTripsNeedsRefresh = () => {
  updateGlobalState({
    tripsCache: {
      ...globalState.tripsCache,
      needsRefresh: true,
    },
  });
};

// 標記收藏需要刷新
export const markFavoritesNeedsRefresh = () => {
  updateGlobalState({
    favoritesCache: {
      ...globalState.favoritesCache,
      needsRefresh: true,
    },
  });
};

// 預載入常量
export const PRELOAD_CONFIG = {
  ITEMS_PER_PAGE: 20,
  PRELOAD_PAGES: 1, // 預載入 1 頁
  MAX_CACHE_AGE: 10 * 60 * 1000, // 10分鐘快取
} as const;

// 預載入旅程資料
export const preloadTripsData = async () => {
  if (globalState.tripsCache.isPreloaded) {
    return globalState.tripsCache.data;
  }

  try {
    const { supabase } = await import('../lib/supabase');
    const limit = PRELOAD_CONFIG.ITEMS_PER_PAGE * PRELOAD_CONFIG.PRELOAD_PAGES;
    
    const { data, error } = await supabase
      .from('trips')
      .select('id,title,subtitle,description,icon,image,price,duration,rating,tags,location,departure_location,destination,created_at,updated_at,status,featured')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;

    // 處理資料格式...
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

    updateTripsCache(mapped, false, 0, data.length === limit, true);
    return mapped;
  } catch (error) {
    console.error('預載入旅程資料失敗:', error);
    return [];
  }
};

// 預載入收藏資料
export const preloadFavoritesData = async () => {
  if (globalState.favoritesCache.isPreloaded || !globalState.isLoggedIn) {
    return globalState.favoritesCache.data;
  }

  try {
    const { supabase } = await import('../lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return [];

    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        trip_id,
        trips (
          id, title, subtitle, description, icon, image, price, duration, rating, tags, 
          location, departure_location, destination, created_at, updated_at, status, featured
        )
      `)
      .eq('user_id', user.id);

    if (error) throw error;

    const mapped: Trip[] = (favorites || []).map((fav: any) => {
      const trip = fav.trips;
      if (!trip) return null;
      
      const location = trip.location || (trip.departure_location && trip.destination
        ? `${trip.departure_location} → ${trip.destination}`
        : '');
      const createdAt = trip.created_at ? new Date(trip.created_at) : null;
      const publishedAt = createdAt
        ? `${Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))}天前`
        : undefined;
        
      return {
        id: trip.id,
        title: trip.title || '',
        location,
        rating: Number(trip.rating) || 0,
        price: Number(trip.price) || 0,
        image: trip.image || 'https://picsum.photos/300/200?blur=2',
        tags: Array.isArray(trip.tags) ? trip.tags : [],
        description: trip.description || '',
        duration: trip.duration || '',
        // 收藏頁可能需要額外顯示欄位
        saveDate: fav.created_at ? new Date(fav.created_at).toLocaleDateString() : undefined,
        category: 'trips',
        groupSize: '6-12人',
        difficulty: '中等',
        highlights: [],
        includes: [],
        gallery: [],
        likes: 0,
        isLiked: false,
        isFavorited: true, // 收藏頁面的項目都是已收藏的
        comments: 0,
        author: { name: 'TripMind', avatar: 'https://picsum.photos/50/50?blur=1', verified: true },
        publishedAt,
      } as Trip;
    }).filter(Boolean) as Trip[];

    // 轉換為 FavoriteItem 格式
    const favoriteItems = mapped.map(trip => ({
      id: trip.id,
      title: trip.title,
      location: trip.location,
      rating: trip.rating,
      price: trip.price,
      image: trip.image,
      saveDate: trip.publishedAt || '最近',
      category: 'trips' as const,
    } as FavoriteItem));

    // 將完整的 Trip[] 存入 favoritesCache
    updateFavoritesCache({
      data: mapped,
      needsRefresh: false,
      isPreloaded: true,
      currentPage: 0,
      hasMore: mapped.length === PRELOAD_CONFIG.ITEMS_PER_PAGE
    });
    return mapped;
  } catch (error) {
    console.error('預載入收藏資料失敗:', error);
    return [];
  }
};

// 切換主題
export const toggleTheme = () => {
  updateGlobalState({
    theme: globalState.theme === 'light' ? 'dark' : 'light',
  });
};

// 設置載入狀態
export const setLoading = (isLoading: boolean) => {
  updateGlobalState({ isLoading });
};

// 更新用戶資料
export const updateUserProfile = (userData: Partial<User>) => {
  if (globalState.user) {
    updateGlobalState({
      user: {
        ...globalState.user,
        ...userData,
      },
    });
  }
};

// ---------------- Avatar (local) ----------------
// 使用本地 storage 儲存與讀取頭像 URI，避免依賴 Supabase Storage
const getAvatarStorageKey = (userId?: string) => {
  return userId ? `avatar_${userId}` : 'avatar_guest';
};

// 將頭像 URI 存到本地 storage，並更新 globalState.user.avatar
export const setLocalAvatar = async (uri: string) => {
  try {
    const key = getAvatarStorageKey(globalState.user?.id);
    await storage.setItem(key, uri);
    // 更新全域使用者資料
    updateUserProfile({ avatar: uri });
    return true;
  } catch (err) {
    console.error('setLocalAvatar error:', err);
    return false;
  }
};

// 從本地 storage 載入目前使用者的頭像（若有）並更新 globalState
export const loadLocalAvatarForCurrentUser = async (userId?: string) => {
  try {
    const key = getAvatarStorageKey(userId || globalState.user?.id);
    const uri = await storage.getItem(key);
    if (uri) {
      if (globalState.user) {
        updateUserProfile({ avatar: uri });
      }
    }
    return uri;
  } catch (err) {
    console.error('loadLocalAvatarForCurrentUser error:', err);
    return null;
  }
};

// ==================== React Hooks ====================

// 主要的全域狀態 Hook
export const useGlobalState = (): [GlobalState, (newState: Partial<GlobalState>) => void] => {
  const [state, setState] = useState<GlobalState>(globalState);
  
  useEffect(() => {
    // 同步當前狀態
    setState({ ...globalState });
    
    // 訂閱狀態變化
    const unsubscribe = subscribe(() => {
      setState({ ...globalState });
    });
    
    // 清理訂閱
    return unsubscribe;
  }, []);
  
  return [state, updateGlobalState];
};

// 用戶狀態 Hook
export const useUser = () => {
  const [globalState] = useGlobalState();
  return {
    user: globalState.user,
    isLoggedIn: globalState.isLoggedIn,
    isLoading: globalState.isLoading,
  };
};

// 旅程快取 Hook
export const useTripsCache = () => {
  const [globalState] = useGlobalState();
  return {
    trips: globalState.tripsCache.data,
    lastUpdated: globalState.tripsCache.lastUpdated,
    needsRefresh: globalState.tripsCache.needsRefresh,
    currentPage: globalState.tripsCache.currentPage,
    hasMore: globalState.tripsCache.hasMore,
    isPreloaded: globalState.tripsCache.isPreloaded,
    updateCache: updateTripsCache,
    markNeedsRefresh: markTripsNeedsRefresh,
    preloadData: preloadTripsData,
  };
};

// 收藏快取 Hook
export const useFavoritesCache = () => {
  const [globalState] = useGlobalState();
  return {
    favoritesCache: globalState.favoritesCache,
    updateFavoritesCache,
    markNeedsRefresh: markFavoritesNeedsRefresh,
    preloadData: preloadFavoritesData,
  };
};

// 位置狀態 Hook
export const useLocation = () => {
  const [globalState] = useGlobalState();
  return {
    currentLocation: globalState.currentLocation,
    setLocation: setCurrentLocation,
    clearLocation: clearCurrentLocation,
  };
};

// 主題 Hook
export const useTheme = () => {
  const [globalState] = useGlobalState();
  return {
    theme: globalState.theme,
    toggleTheme,
  };
};

// ==================== 工具函式 ====================

// 獲取用戶資料
export const getUserData = () => globalState.user;

// 獲取登入狀態
export const getLoginStatus = () => globalState.isLoggedIn;

// 獲取當前主題
export const getCurrentTheme = () => globalState.theme;

// 獲取位置資料
export const getLocationData = () => globalState.currentLocation;

// 檢查旅程快取是否需要刷新
export const shouldRefreshTrips = () => {
  const cache = globalState.tripsCache;
  const cacheAge = Date.now() - cache.lastUpdated;
  const maxAge = 5 * 60 * 1000; // 5分鐘
  return cache.needsRefresh || cacheAge > maxAge;
};

// 格式化用戶顯示名稱
export const formatUserDisplayName = (user: User | null): string => {
  if (!user) return '訪客';
  return user.name || user.email || '未知用戶';
};

// 重置全域狀態到初始值
export const resetGlobalState = () => {
  globalState = { ...initialState };
  notifySubscribers();
};

// ==================== 類型保護函式 ====================

// 檢查是否為有效的旅程
export const isValidTrip = (trip: any): trip is Trip => {
  return trip &&
    typeof trip.id === 'string' &&
    typeof trip.title === 'string' &&
    typeof trip.location === 'string' &&
    typeof trip.rating === 'number' &&
    typeof trip.price === 'number';
};

// 檢查是否為有效的用戶
export const isValidUser = (user: any): user is User => {
  return user &&
    typeof user.name === 'string' &&
    typeof user.email === 'string';
};

// ==================== 全局收藏同步 ====================

// 同步更新收藏狀態到兩個快取
export const syncFavoriteStatus = (tripId: string, isFavorited: boolean) => {
  // 更新 trips 快取中的收藏狀態
  const updatedTripsData = globalState.tripsCache.data.map(trip => 
    trip.id === tripId ? { ...trip, isFavorited } : trip
  );
  
  updateTripsCache(
    updatedTripsData,
    globalState.tripsCache.needsRefresh,
    globalState.tripsCache.currentPage,
    globalState.tripsCache.hasMore,
    globalState.tripsCache.isPreloaded
  );

  // 如果是取消收藏，從 favorites 快取中移除，並標記需要刷新
  if (!isFavorited) {
    const updatedFavoritesData = globalState.favoritesCache.data.filter(item => item.id !== tripId);
    updateFavoritesCache({
      data: updatedFavoritesData,
      needsRefresh: true,
      isPreloaded: globalState.favoritesCache.isPreloaded,
      currentPage: globalState.favoritesCache.currentPage,
      hasMore: globalState.favoritesCache.hasMore
    });
  }
  // 如果是新增收藏，標記 favorites 快取需要刷新以載入新項目
  else {
    updateFavoritesCache({
      needsRefresh: true
    });
  }
};