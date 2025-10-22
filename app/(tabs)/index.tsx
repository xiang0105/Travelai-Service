import { FontAwesome } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import activityLogger from '../../lib/activityLogger';
import { InitPayload, buildInitPayload } from '../../lib/index.model';
import { getMockInit } from '../../lib/mockChat';
import { LocationType, TAIWAN_REGIONS, useGlobalState } from '../../store/globalState';

export default function HomeScreen() {
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [budget, setBudget] = useState(0);
  const [departure, setDeparture] = useState('');
  const [destination, setDestination] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedType, setSelectedType] = useState<LocationType | null>(null);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 9)); // October 2025

  const [showLoginModal, setShowLoginModal] = useState(false); // 登入提示模態框
  const insets = useSafeAreaInsets();
  const [globalState] = useGlobalState();

  const incrementAdults = () => setAdults(adults + 1);
  const decrementAdults = () => setAdults(adults > 1 ? adults - 1 : 1);
  const incrementChildren = () => setChildren(children + 1);
  const decrementChildren = () => setChildren(children > 0 ? children - 1 : 0);
  // override with logging versions for UI buttons
  const incAdults = () => setAdultsAndLog(adults + 1);
  const decAdults = () => setAdultsAndLog(adults > 1 ? adults - 1 : 1);
  const incChildren = () => setChildrenAndLog(children + 1);
  const decChildren = () => setChildrenAndLog(children > 0 ? children - 1 : 0);

  // logging wrappers for field changes
  const setDepartureAndLog = (val: string) => {
    setDeparture(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'departure', value: val } }); } catch (e) {}
  };
  const setDestinationAndLog = (val: string) => {
    setDestination(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'destination', value: val } }); } catch (e) {}
  };
  const setStartDateAndLog = (val: string) => {
    setStartDate(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'startDate', value: val } }); } catch (e) {}
  };
  const setEndDateAndLog = (val: string) => {
    setEndDate(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'endDate', value: val } }); } catch (e) {}
  };
  const setAdultsAndLog = (val: number) => {
    setAdults(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'adults', value: val } }); } catch (e) {}
  };
  const setChildrenAndLog = (val: number) => {
    setChildren(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'children', value: val } }); } catch (e) {}
  };
  const setBudgetAndLog = (val: number) => {
    setBudget(val);
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'field_change', page: 'index', details: { field: 'budget', value: val } }); } catch (e) {}
  };

  const openLocationModal = () => {
    setSelectedType(null); // 預設不選中任何按鈕
    setShowLocationModal(true);
    setShowCitySelector(false); // 重設縣市選擇狀態
  };

  const selectTypeInModal = (type: LocationType) => {
    setSelectedType(type);
    setShowCitySelector(true); // 顯示縣市選擇區域
  };

  const selectLocation = (cityName: string) => {
    if (selectedType === 'departure') {
      setDepartureAndLog(cityName);
    } else {
      setDestinationAndLog(cityName);
    }
    // 不自動關閉模態框，讓用戶點擊確認按鈕才關閉
  };

  const closeLocationModal = () => {
    setShowLocationModal(false);
    setShowCitySelector(false);
    setSelectedType(null);
  };

  const swapLocations = () => {
    const temp = departure;
    setDeparture(destination);
    setDestination(temp);
  };

  const openDateModal = () => {
    setShowDateModal(true);
  };

  const closeDateModal = () => {
    setShowDateModal(false);
  };

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const selectDate = (date: Date) => {
    // 不允許選擇今日之前的日期
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (dateOnly < todayOnly) {
      // 可改為 Toast/Alert 提示，這裡暫時忽略
      return;
    }

    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // 選擇開始日期
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setStartDateAndLog(formatDate(date));
      setEndDate('');
    } else if (selectedStartDate && !selectedEndDate) {
      // 選擇結束日期，結束日期也不得早於開始日期
      const startOnly = new Date(selectedStartDate.getFullYear(), selectedStartDate.getMonth(), selectedStartDate.getDate());
      if (dateOnly >= startOnly) {
        setSelectedEndDate(date);
        setEndDateAndLog(formatDate(date));
      } else {
        // 如果選擇的日期早於開始日期，重新設定開始日期（但不得早於今日）
        setSelectedStartDate(date);
        setSelectedEndDate(null);
        setStartDateAndLog(formatDate(date));
        setEndDate('');
      }
    }
  };

  const confirmDateSelection = () => {
    setShowDateModal(false);
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate) return false;
    if (!selectedEndDate) return date.getTime() === selectedStartDate.getTime();
    return date >= selectedStartDate && date <= selectedEndDate;
  };

  const isDateRangeStart = (date: Date) => {
    return selectedStartDate && date.getTime() === selectedStartDate.getTime();
  };

  const isDateRangeEnd = (date: Date) => {
    return selectedEndDate && date.getTime() === selectedEndDate.getTime();
  };

  const calculateDays = () => {
    if (selectedStartDate && selectedEndDate) {
      const timeDiff = selectedEndDate.getTime() - selectedStartDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
      return daysDiff;
    }
    return 0;
  };

  // 登入相關函數
  const checkLoginStatus = (action: string) => {
    if (!globalState.isLoggedIn) {
      setShowLoginModal(true);
      return false;
    }
    return true;
  };

  const handleGoToProfile = () => {
    setShowLoginModal(false);
    router.push('/(tabs)/profile');
  };



  const handleSearchTrip = async () => {
    if (!checkLoginStatus('搜尋旅遊行程')) return;
    // required fields must not be empty
    const missingFields: string[] = [];
    if (!departure || departure.trim() === '') missingFields.push('出發地');
    if (!destination || destination.trim() === '') missingFields.push('抵達地');
    if (!startDate || startDate.trim() === '') missingFields.push('開始日期');
    if (!endDate || endDate.trim() === '') missingFields.push('結束日期');
    if (missingFields.length > 0) {
      Alert.alert('欄位錯誤', `以下欄位不可為空：\n${missingFields.join('\n')}`);
      return;
    }

    // 構建 payload，注意 model 期待的欄位名稱
    const payload: Partial<InitPayload> = {
      origin: departure,
      destination: destination,
      date_start: startDate,
      date_end: endDate,
      adults: adults,
      kids: children,
      budget_twd: budget,
      // session_id 由目前的 globalState session 或一個臨時 uuid 提供
  session_id: (globalState?.user?.id) || ''
    };

    const initPayload = buildInitPayload(payload);

    // 不傳 init；直接跳轉到 reviews，由 reviews 自行從本地 chat.json 啟動問答循環
    try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'navigate_to_reviews', page: 'index', details: { payload: initPayload } }); } catch (e) { /* ignore */ }

    // prepare optional init response for reviews (use local mock if available)
    const mockInit = getMockInit();
    if (mockInit) {
      // ensure session id from our payload if not provided by mock
      mockInit.session_id = mockInit.session_id || initPayload.session_id || '';
    }

    router.push({
      pathname: '/(tabs)/reviews',
      params: {
        departure,
        destination,
        startDate,
        endDate,
        adults,
        children,
        budget,
        ...(mockInit ? { init_resp: JSON.stringify(mockInit) } : {}),
      }
    });
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
  };



  // 跳轉到AI規劃第一階段問答頁面，並組合API需求格式
  const navigateToPlanAskUser = () => {
    // 組合API格式
    const payload = {
      departure,
      destination,
      startDate,
      endDate,
      adults,
      children,
      budget,
    };
    // 暫時跳轉到搜尋頁面，待 plan/ask_user 頁面創建後再修改
    router.push({
      pathname: '/(tabs)/search',
      params: { ...payload }
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
  <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 0) }]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TripMind</Text>
        </View>

        {/* Main Card */}
        <View style={styles.mainCard}>
          {/* Location Inputs */}
          <View style={styles.locationContainer}>
            <TouchableOpacity 
              style={styles.locationInputContainer}
              onPress={() => openLocationModal()}
            >
              <View style={styles.locationInput}>
                <Text style={[styles.locationInputText, !departure && styles.placeholderText]}>
                  {departure || '出發地'}
                </Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.arrowContainer}>
              <FontAwesome name="arrow-right" size={20} color="#333" />
            </View>
            
            <TouchableOpacity 
              style={styles.locationInputContainer}
              onPress={() => openLocationModal()}
            >
              <View style={styles.locationInput}>
                <Text style={[styles.locationInputText, !destination && styles.placeholderText]}>
                  {destination || '抵達地'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>



          {/* Date Input */}
          <View style={styles.dateContainer}>
            <TouchableOpacity 
              style={styles.dateInput} 
              onPress={openDateModal}
            >
              <Text style={[styles.locationInputText, (!startDate && !endDate) && styles.placeholderText]}>
                {startDate && endDate ? `${startDate} - ${endDate}` : 
                 startDate ? `${startDate} - 請選擇結束日期` : 
                 '2025/10/01 - 請選擇結束日期'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* People Counter */}
          <View style={styles.peopleContainer}>
            {/* Adults */}
            <View style={styles.peopleRow}>
              <Text style={styles.peopleLabel}>大人</Text>
              <View style={styles.counter}>
                <TouchableOpacity style={styles.counterButton} onPress={decAdults}>
                  <Text style={styles.counterText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{adults}</Text>
                <TouchableOpacity style={styles.counterButton} onPress={incAdults}>
                  <Text style={styles.counterText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Children */}
            <View style={styles.peopleRow}>
              <Text style={styles.peopleLabel}>小孩</Text>
              <View style={styles.counter}>
                <TouchableOpacity style={styles.counterButton} onPress={decChildren}>
                  <Text style={styles.counterText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{children}</Text>
                <TouchableOpacity style={styles.counterButton} onPress={incChildren}>
                  <Text style={styles.counterText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Budget Section */}
          <View style={styles.budgetSection}>
            <View style={styles.budgetHeader}>
              <View style={styles.budgetTitleContainer}>
                {/* 預算圖示：使用 FontAwesome，如果圖示名稱不可用會 fallback 為文字 */}
                <FontAwesome name="dollar" size={18} color="#FFD700" style={styles.budgetIcon} />
                <Text style={styles.budgetTitle}>旅遊預算</Text>
              </View>
              <View style={styles.budgetAmount}>
                <Text style={styles.budgetCurrency}>NT$</Text>
                  <Text style={styles.budgetValue}>{budget.toLocaleString()}</Text>
              </View>
            </View>

            {/* Budget Slider Area */}
            <View style={styles.budgetSliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={50000}
                step={100}
                value={budget}
                onValueChange={setBudgetAndLog}
                minimumTrackTintColor="#FFD700"
                maximumTrackTintColor="#E0E0E0"
              />
              <View style={styles.budgetLabels}>
                <Text style={styles.budgetLabel}>$0</Text>
                <Text style={styles.budgetLabel}>$50K</Text>
              </View>
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchTrip}>
            <Text style={styles.searchButtonText}>確認</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* 地點選擇模態視窗 */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* 模態視窗標題欄 */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeLocationModal}
            >
              <FontAwesome name="times" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>選擇地點</Text>
            <TouchableOpacity 
              style={styles.confirmButton}
              onPress={closeLocationModal}
            >
              <Text style={styles.confirmButtonText}>確認</Text>
            </TouchableOpacity>
          </View>
          
          {/* 出發地和抵達地選擇區 */}
          <View style={styles.modalLocationContainer}>
            <TouchableOpacity 
              style={[styles.modalLocationItem, selectedType === 'departure' && styles.selectedLocationItem]}
              onPress={() => selectTypeInModal('departure')}
            >
              <View style={styles.locationIconContainer}>
                <FontAwesome name="map-marker" size={16} color="#4CAF50" />
              </View>
              <View style={styles.modalLocationTextContainer}>
                <Text style={styles.modalLocationLabel}>出發地</Text>
                <Text style={styles.modalLocationValue}>
                  {departure || '請選擇出發地'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.modalSwapContainer}>
              <FontAwesome name="exchange" size={20} color="#007AFF" />
            </View>

            <TouchableOpacity 
              style={[styles.modalLocationItem, selectedType === 'destination' && styles.selectedLocationItem]}
              onPress={() => selectTypeInModal('destination')}
            >
              <View style={styles.locationIconContainer}>
                <FontAwesome name="map-marker" size={16} color="#FF5722" />
              </View>
              <View style={styles.modalLocationTextContainer}>
                <Text style={styles.modalLocationLabel}>抵達地</Text>
                <Text style={styles.modalLocationValue}>
                  {destination || '請選擇抵達地'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* 動態內容區域 */}
          <View style={styles.modalContentContainer}>
            {selectedType === null ? (
              <View style={styles.hintContainer}>
                <FontAwesome name="info-circle" size={24} color="#007AFF" style={styles.hintIcon} />
                <Text style={styles.modalHint}>
                  請點擊上方的出發地區或抵達地來選擇縣市
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.selectionTitle}>
                  <FontAwesome name="map-marker" size={16} color="#007AFF" />
                  {' '}選擇{selectedType === 'departure' ? '出發地' : '抵達地'}縣市
                </Text>
                
                <ScrollView style={styles.modalRegionList} showsVerticalScrollIndicator={false}>
                  {TAIWAN_REGIONS.map((region) => (
                    <View key={region.id} style={styles.modalRegionContainer}>
                      <Text style={styles.modalRegionTitle}>{region.name}</Text>
                      <View style={styles.modalCitiesGrid}>
                        {region.cities.map((city) => (
                          <TouchableOpacity
                            key={city.id}
                            style={styles.modalCityButton}
                            onPress={() => selectLocation(city.name)}
                          >
                            <Text style={styles.modalCityIcon}>{city.icon}</Text>
                            <Text style={styles.modalCityText}>{city.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
      
      {/* 日期選擇模態視窗 */}
      <Modal
        visible={showDateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* 模態視窗標題欄 */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={closeDateModal}
            >
              <FontAwesome name="chevron-left" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>日期</Text>
            <View style={styles.closeButton} />
          </View>
          
          {/* 日期顯示區域 */}
          <View style={styles.dateDisplayContainer}>
            <Text style={styles.dateDisplayLabel}>Date</Text>
            <View style={styles.dateDisplayBox}>
              <Text style={styles.dateDisplayText}>
                {startDate && endDate ? `${startDate} - ${endDate}` : 
                 startDate ? `${startDate} - 請選結束日期` : 
                 '2025/10/01 - 請選結束日期'}
              </Text>
            </View>
            
            <TouchableOpacity style={styles.calendarButton}>
              <FontAwesome name="calendar" size={16} color="#FF6B35" />
              <Text style={styles.calendarButtonText}>
                {selectedStartDate && selectedEndDate ? 
                  `您選擇了 ${calculateDays()} 天` : 
                  '請選擇出發日期'
                }
              </Text>
              <FontAwesome name="exclamation" size={12} color="#FF6B35" />
            </TouchableOpacity>
          </View>
          
          {/* 日曆區域 */}
          <View style={styles.calendarContainer}>
            {/* 月份導航 */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity onPress={previousMonth}>
                <FontAwesome name="chevron-left" size={20} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {getMonthName(currentMonth.getMonth())} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={nextMonth}>
                <FontAwesome name="chevron-right" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
            
            {/* 星期標題 */}
            <View style={styles.weekHeader}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                <Text key={day} style={styles.weekHeaderText}>{day}</Text>
              ))}
            </View>
            
            {/* 日期格子 */}
            <View style={styles.daysGrid}>
              {/* 創建完整的日曆網格 (6 rows × 7 days = 42 cells) */}
              {Array.from({ length: 42 }, (_, index) => {
                const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
                const daysInMonth = getDaysInMonth(currentMonth);
                
                // 計算當前格子是第幾天
                const dayNumber = index - firstDayOfMonth + 1;
                
                // 如果是空白格子或超出月份天數
                if (index < firstDayOfMonth || dayNumber > daysInMonth) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }
                
                // 正常日期格子
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber);
                const isInRange = isDateInRange(date);
                const isRangeStart = isDateRangeStart(date);
                const isRangeEnd = isDateRangeEnd(date);
                
                const today = new Date();
                const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const isPast = dateOnly < todayOnly;

                return (
                  <TouchableOpacity
                    key={`day-${dayNumber}`}
                    style={[
                      styles.dayCell,
                      isInRange && styles.selectedDayCell,
                      isRangeStart && styles.rangeStartCell,
                      isRangeEnd && styles.rangeEndCell,
                      isPast && styles.pastDayCell,
                    ]}
                    onPress={() => !isPast && selectDate(date)}
                    disabled={isPast}
                  >
                    <Text style={[
                      styles.dayText,
                      isInRange && styles.selectedDayText,
                      isPast && styles.pastDayText,
                    ]}>
                      {dayNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          
          {/* 確認按鈕 */}
          <View style={styles.dateModalFooter}>
            <TouchableOpacity 
              style={styles.confirmDateButton}
              onPress={confirmDateSelection}
            >
              <Text style={styles.confirmDateButtonText}>確認</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* 登入提示模態框 */}
      <Modal
        visible={showLoginModal}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.loginPromptOverlay}>
          <View style={styles.loginPromptContainer}>
            <View style={styles.loginPromptHeader}>
              <FontAwesome name="lock" size={24} color="#FF6B35" />
              <Text style={styles.loginPromptTitle}>需要登入</Text>
            </View>
            
            <Text style={styles.loginPromptMessage}>
              請登入您的帳號以使用此功能
            </Text>
            
            <View style={styles.loginPromptButtons}>
              <TouchableOpacity 
                style={styles.loginPromptButton}
                onPress={handleGoToProfile}
              >
                <Text style={styles.loginPromptButtonText}>前往登入</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.loginPromptCancel}
              onPress={closeLoginModal}
            >
              <Text style={styles.loginPromptCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 25,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#333',
  },
  mainCard: {
    backgroundColor: '#FFD700',
    borderRadius: 20,
    padding: 20,
    margin: 0,
  },

  dateContainer: {
    marginBottom: 24,
  },
  dateInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  peopleContainer: {
    marginBottom: 24,
  },
  peopleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  peopleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  counterValue: {
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  budgetSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  budgetTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetIcon: {
    // 為 icon 元件設置外邊距和對齊
    marginRight: 8,
    width: 20,
    height: 20,
    textAlign: 'center',
  },
  budgetTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  budgetAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  budgetCurrency: {
    fontSize: 14,
    color: '#F4D03F',
    marginRight: 4,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F4D03F',
  },
  budgetSliderContainer: {
    paddingHorizontal: 8,
    marginTop: 16,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 12,
  },
  budgetSlider: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    position: 'relative',
  },
  sliderThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#007AFF',
    position: 'absolute',
    left: 8,
    top: -6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  budgetLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#666',
  },
  searchButton: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  // 地點選擇樣式
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationInputContainer: {
    flex: 1,
  },
  locationInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInputText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    textAlign: 'center',
  },
  placeholderText: {
    color: '#999',
    fontWeight: 'normal',
    textAlign: 'center',
  },
  arrowContainer: {
    paddingHorizontal: 12,
  },

  // 模態視窗樣式
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalLocationContainer: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  selectedLocationItem: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  locationIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalLocationTextContainer: {
    flex: 1,
  },
  modalLocationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  modalLocationValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  modalSwapContainer: {
    alignSelf: 'center',
    padding: 8,
  },
  modalContentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  modalHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  hintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  hintIcon: {
    marginBottom: 12,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalRegionList: {
    flex: 1,
  },
  modalRegionContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modalRegionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalCitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalCityButton: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  modalCityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modalCityText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  
  // 日期模態框樣式
  dateDisplayContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  dateDisplayLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  dateDisplayBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFD4C4',
  },
  calendarButtonText: {
    fontSize: 14,
    color: '#FF6B35',
    marginHorizontal: 8,
  },
  calendarContainer: {
    flex: 1,
    padding: 20,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days = 14.28%
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedDayCell: {
    backgroundColor: '#FFB84D',
    borderRadius: 8,
  },
  rangeStartCell: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  rangeEndCell: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  pastDayCell: {
    backgroundColor: '#F5F5F5',
  },
  pastDayText: {
    color: '#B0B0B0',
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '600',
  },
  dateModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  confirmDateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmDateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // 登入提示模態框樣式
  loginPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginPromptContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  loginPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  loginPromptMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loginPromptButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  loginPromptButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  registerPromptButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  loginPromptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  registerPromptButtonText: {
    color: '#007AFF',
  },
  loginPromptCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginPromptCancelText: {
    color: '#666',
    fontSize: 14,
  },
  
  // 登入/註冊表單樣式
  authContainer: {
    flex: 1,
  },
  authForm: {
    padding: 24,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  inputPlaceholder: {
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
    flex: 1,
  },
  authSubmitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  authSubmitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  authSwitchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authSwitchText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  authSwitchButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
