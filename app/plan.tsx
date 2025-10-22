import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import planJson from '../data/plan.json';
import activityLogger from '../lib/activityLogger';

const formatCurrency = (value: number | string | undefined | null) => {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? Number(value) : Number(value || 0);
  if (Number.isNaN(num)) return String(value);
  return `NT$${num.toLocaleString('zh-TW')}`;
};

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const initialItinerary = (planJson as any)?.itinerary || [];
  const [itineraryState, setItineraryState] = useState<any[]>(initialItinerary);
  const itinerary = itineraryState;
  const params = useLocalSearchParams();

  // Apply updates when returning from reviews (accommodation updated)
  React.useEffect(() => {
    try {
      const updatedIndex = params?.ac_updated_dayIndex as string | undefined;
      const updatedName = params?.ac_updated_name as string | undefined;
      if (updatedIndex && updatedName) {
        const di = Number(updatedIndex);
        setItineraryState(prev => {
          const copy = [...prev];
          if (copy[di]) {
            copy[di] = { ...copy[di], accommodation: { ...(copy[di].accommodation || {}), name: updatedName } };
          }
          return copy;
        });
        try { activityLogger.appendLog({ action: 'accommodation_updated', page: 'plan', details: { dayIndex: updatedIndex, newValue: updatedName } }); } catch (e) {}
      }
    } catch (e) { /* ignore */ }
  }, [params?.ac_updated_dayIndex, params?.ac_updated_name]);

  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const router = useRouter();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [planFavorited, setPlanFavorited] = useState<boolean>(false);
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);

  const getItemKey = (dayIndex: number, activityIndex: number) => `${itinerary[dayIndex].date}-${activityIndex}`;

  const toggleFavorite = async (dayIndex: number, activityIndex: number) => {
    const key = getItemKey(dayIndex, activityIndex);
    const item = itinerary[dayIndex].activities[activityIndex];
    const newVal = !favorites[key];
    setFavorites(prev => ({ ...prev, [key]: newVal }));
    try { await activityLogger.appendLog({ action: newVal ? 'favorite' : 'unfavorite', page: 'plan', details: { item: item.title, date: itinerary[dayIndex].date } }); } catch (e) { /* ignore */ }
  };

  const cancelActivity = async (dayIndex: number, activityIndex: number) => {
    const item = itinerary[dayIndex].activities[activityIndex];
    try { await activityLogger.appendLog({ action: 'cancel_trip_from_plan', page: 'plan', details: { item: item.title, date: itinerary[dayIndex].date } }); } catch (e) { /* ignore */ }
  };

  const openDetail = async (dayIndex: number, activityIndex: number) => {
    const item = itinerary[dayIndex].activities[activityIndex];
    setSelectedDetail({ ...item, date: itinerary[dayIndex].date });
    try { await activityLogger.appendLog({ action: 'ask_activity_detail', page: 'plan', details: { date: itinerary[dayIndex].date, activity: item.title } }); } catch (e) { /* ignore */ }
  };

  const openAccommodationDetail = async (dayIndex: number) => {
    const acc = itinerary[dayIndex].accommodation || { name: '無' };
    try { await activityLogger.appendLog({ action: 'ask_accommodation_detail', page: 'plan', details: { date: itinerary[dayIndex].date, accommodation: acc.name } }); } catch (e) { /* ignore */ }

    // Build init_resp to ask user and suggest Taipei Tech
    const mockInit = {
      session_id: `ac-change-${dayIndex}`,
      reply: `我建議新的地點：台北科技大學。是否接受？（是/否）`,
      questions: [
        { key: 'accept_change', label: `不喜歡 ${acc.name} 嗎? 請告訴我你想要的內容，我會幫你選擇新的地點!` }
      ],
      missing: ['accept_change']
    };

    router.push({ pathname: '/(tabs)/reviews', params: { ac_dayIndex: String(dayIndex), ac_target: '台北科技大學', init_resp: JSON.stringify(mockInit) } });
  };

  const closeDetail = () => setSelectedDetail(null);

  const navigateToReviews = async (dayIndex: number, activityIndex: number) => {
    const item = itinerary[dayIndex].activities[activityIndex];
    try { await activityLogger.appendLog({ action: 'navigate_to_reviews_from_plan', page: 'plan', details: { date: itinerary[dayIndex].date, activity: item.title } }); } catch (e) { /* ignore */ }
    router.push({ pathname: '/(tabs)/reviews', params: { activity_title: item.title, activity_date: itinerary[dayIndex].date, activity_time: item.time } });
  };

  const togglePlanFavorite = async () => {
    const newVal = !planFavorited;
    setPlanFavorited(newVal);
    try { await activityLogger.appendLog({ action: newVal ? 'favorite_plan' : 'unfavorite_plan', page: 'plan' }); } catch (e) { /* ignore */ }
  };

  const cancelPlan = async () => {
    try { await activityLogger.appendLog({ action: 'cancel_entire_plan', page: 'plan' }); } catch (e) { /* ignore */ }
  };

  const days = itinerary.length;
  const nights = Math.max(0, days - 1);

  const sumEstimatedCost = () => {
    let total = 0;
    itinerary.forEach((day: any) => {
      if (Array.isArray(day.activities)) {
        day.activities.forEach((a: any) => { total += Number(a.estimatedCost || 0); });
      }
      total += Number(day.accommodation?.estimatedCost || 0);
    });
    return total;
  };

  // 簡單碳排估算：每人每晚住宿 10kg CO2、每個活動視為 2kg，交通以每人每天 15kg
  const estimateCarbon = (adultsCount: number, childrenCount: number) => {
    const people = adultsCount + childrenCount;
    const activityCount = itinerary.reduce((acc: number, d: any) => acc + (Array.isArray(d.activities) ? d.activities.length : 0), 0);
    const accommodationKg = nights * people * 10; // kg CO2
    const activityKg = activityCount * 2; // kg CO2 total
    const transportKg = days * people * 15; // kg CO2
    const totalKg = accommodationKg + activityKg + transportKg;
    return totalKg; // kg CO2
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 10) }]}> 
      <View style={styles.headerRow}>
        <Text style={styles.header}>行程總覽</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={cancelPlan} style={styles.headerButton}>
            <Text style={{ color: '#d00', fontWeight: '600' }}>取消行程</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlanFavorite} style={styles.headerButton}>
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>確認行程</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
  {itinerary.map((day: any, di: number) => (
          <View key={day.date} style={styles.dayCard}>
            <Text style={styles.dayTitle}>{day.date}</Text>
            {Array.isArray(day.activities) && day.activities.map((act: any, ai: number) => (
              <View key={`${day.date}-${ai}`} style={styles.activityRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openDetail(di, ai)}>
                  <Text style={styles.activityTime}>{act.time}</Text>
                  <Text style={styles.activityTitle}>{act.title}</Text>
                </TouchableOpacity>
                <View style={styles.activityMeta}>
                  <View style={styles.inlineButtons}>
                    <TouchableOpacity style={styles.askButton} onPress={() => navigateToReviews(di, ai)}>
                      <FontAwesome name="chevron-right" size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            {/* Accommodation shown in same row format */}
            <View style={styles.activityRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openAccommodationDetail(di)}>
                <Text style={styles.activityTime}>{day.accommodation?.check_in || ''}</Text>
                <Text style={styles.activityTitle}>{day.accommodation?.name || '無'}</Text>
              </TouchableOpacity>
              <View style={styles.activityMeta}>
                <View style={styles.inlineButtons}>
                  <TouchableOpacity style={styles.askButton} onPress={() => openAccommodationDetail(di)}>
                    <FontAwesome name="chevron-right" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 12 }} />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>行程摘要</Text>
          <View style={styles.summaryRow}>
            <Text>天數 / 晚數</Text>
            <Text>{days} 天 / {nights} 晚</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>旅客</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text>{adults} 大人</Text>
              <Text>{children} 小孩</Text>
              </View>
          </View>
          <View style={styles.summaryRow}>
            <Text>估計總花費</Text>
            <Text>{formatCurrency(sumEstimatedCost())}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>估計碳足跡</Text>
            <Text>{Math.round(estimateCarbon(adults, children)).toLocaleString()} kg CO2</Text>
          </View>
          <TouchableOpacity
            style={styles.summaryButton}
            onPress={async () => {
              // Build a query from itinerary (use activity titles and accommodations)
              const placeTerms: string[] = [];
              itinerary.forEach((d: any) => {
                if (Array.isArray(d.activities)) d.activities.forEach((a: any) => { if (a.title) placeTerms.push(a.title); });
                if (d.accommodation?.name) placeTerms.push(d.accommodation.name);
              });
              const query = encodeURIComponent(placeTerms.slice(0, 6).join(' ')); // limit length

              try {
                await activityLogger.appendLog({ action: 'navigate_to_map_from_plan', page: 'plan', details: { days, nights, adults, children, query } });
              } catch (e) { /* ignore */ }

              // No internal map route found in this project — open external Google Maps search
              const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
              try {
                const { Linking } = require('react-native');
                Linking.openURL(url).catch(() => {});
              } catch (err) {
                // ignore linking errors
              }
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>查看地圖</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={!!selectedDetail} animationType="slide" transparent={false} onRequestClose={closeDetail}>
        <View style={styles.igModalContainer}>
          <View style={styles.igHeader}>
            <TouchableOpacity onPress={closeDetail}>
              <FontAwesome name="arrow-left" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.igHeaderTitle}>行程詳情</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={async () => { try { await activityLogger.appendLog({ action: 'favorite_plan_item_toggle', page: 'plan', details: { item: selectedDetail?.title } }); } catch (e) {} }} style={styles.igActionButtonSimple}>
                <FontAwesome name={selectedDetail?.favorited ? 'bookmark' : 'bookmark-o'} size={20} color={selectedDetail?.favorited ? '#000' : '#666'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.igContent} showsVerticalScrollIndicator={false}>

            <View style={{ paddingHorizontal: 16 }}>
              <View style={{ width: '100%', height: 220, backgroundColor: '#F5F5F5', borderRadius: 12, marginBottom: 12 }} />
              {selectedDetail && (
                <>
                  <Text style={styles.igTripTitle}>{selectedDetail.title}</Text>
                  <Text style={styles.igDescription}>{selectedDetail.description}</Text>
                  {selectedDetail.estimatedCost && (
                    <Text style={[styles.igDescription, { marginTop: 8 }]}>建議花費：{selectedDetail.estimatedCost}</Text>
                  )}
                </>
              )}

              <View style={styles.igDetailsSection}>
                {selectedDetail?.isAccommodation ? (
                  <>
                    <View style={styles.igDetailRow}>
                      <FontAwesome name="clock-o" size={16} color="#666" />
                      <Text style={styles.igDetailText}>{selectedDetail?.check_in ? `入住 ${selectedDetail.check_in}` : '無入住資訊'}</Text>
                    </View>
                    <View style={styles.igDetailRow}>
                      <FontAwesome name="clock-o" size={16} color="#666" />
                      <Text style={styles.igDetailText}>{selectedDetail?.check_out ? `退房 ${selectedDetail.check_out}` : ''}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.igDetailRow}>
                      <FontAwesome name="clock-o" size={16} color="#666" />
                      <Text style={styles.igDetailText}>{selectedDetail?.time}</Text>
                    </View>
                    <View style={styles.igDetailRow}>
                      <FontAwesome name="map-marker" size={16} color="#666" />
                      <Text style={styles.igDetailText}>{selectedDetail?.date}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: '700', padding: 20, color: '#333' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  dayCard: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12, marginBottom: 12 },
  dayTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  activityTime: { fontSize: 13, color: '#666' },
  activityTitle: { fontSize: 16, color: '#222' },
  activityMeta: { width: 74, alignItems: 'flex-end', justifyContent: 'center' },
  activityCost: { fontSize: 14, color: '#666', marginBottom: 6 },
  askButton: { padding: 8 },
  accommodationRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  accomLabel: { fontWeight: '600', marginRight: 8 },
  accomText: { color: '#444' },

  // IG modal styles
  igModalContainer: { flex: 1, backgroundColor: '#fff' },
  igHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#EFEFEF', backgroundColor: '#FFFFFF' },
  igHeaderTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  igActionButtonSimple: { width: 25, height: 25, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  igContent: { flex: 1 , marginTop: 20 },
  igAuthorSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  igAuthorInfo: { flex: 1 },
  igAuthorNameRow: { flexDirection: 'row', alignItems: 'center' },
  igAuthorName: { fontSize: 14, fontWeight: '600', color: '#000' },
  igPublishTime: { fontSize: 12, color: '#999', marginTop: 2 },
  igTripTitle: { paddingTop: 20, fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  igDescription: { fontSize: 14, color: '#333', lineHeight: 20 },
  igDetailsSection: { backgroundColor: '#F8F9FA' , borderRadius: 12, padding: 16, marginTop: 20 },
  igDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  igDetailText: { fontSize: 14, color: '#333', marginLeft: 8 },
  igFooter: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#EEE', justifyContent: 'space-between' },
  igFooterButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 6 },
  igFooterText: { fontWeight: '600' },
  inlineButtons: { flexDirection: 'row', alignItems: 'center' },
  smallButton: { padding: 6, marginHorizontal: 6, borderWidth: 1, borderColor: '#DDD', borderRadius: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 24, borderWidth: 1, borderColor: '#EEE' },
  summaryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryButton: { marginTop: 12, backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { marginLeft: 12 },
  accommodationMeta: { marginTop: 6, paddingHorizontal: 4 },
  accomCost: { fontSize: 13, color: '#666', marginLeft: 6 },
});
