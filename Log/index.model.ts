import api from '../lib/tripmindAPIi';

export interface InitPayload {
  origin: string;
  destination: string;
  date_start: string;
  date_end: string;
  adults: number;
  kids: number;
  budget_twd: number;
  session_id: string;
}

export const buildInitPayload = (data: Partial<InitPayload>): InitPayload => {
  // 使用簡單的預設值保護
  return {
    origin: data.origin || '',
    destination: data.destination || '',
    date_start: data.date_start || '',
    date_end: data.date_end || '',
    adults: typeof data.adults === 'number' ? data.adults : 0,
    kids: typeof data.kids === 'number' ? data.kids : 0,
    budget_twd: typeof data.budget_twd === 'number' ? data.budget_twd : 0,
    session_id: data.session_id || '',
  };
};

export const logPayload = (payload: InitPayload) => {
  // 簡單 log（之後可改為上傳到 analytics）
  console.log('[index.model] init payload:', JSON.stringify(payload));
};

export const sendInitWithFrontData = async (payload: InitPayload) => {
  logPayload(payload);
  const res = await api.initChat(payload);
  if (!res.ok) {
    console.error('[index.model] initChat failed:', res.error || res.status);
    return res;
  }
  console.log('[index.model] initChat response:', res.data);
  return res;
};

export default {
  buildInitPayload,
  logPayload,
  sendInitWithFrontData,
};
