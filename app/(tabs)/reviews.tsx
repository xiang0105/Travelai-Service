import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import activityLogger from '../../lib/activityLogger';
// tripmind backend disabled for now - use local mock data instead
// import tripmind from '../../lib/tripmindAPIi';
import { resolveMock } from '../../lib/mockChat';
import { Message, useGlobalState } from '../../store/globalState';

export default function ReviewsScreen() {
  const [globalState] = useGlobalState();
  const params = useLocalSearchParams();
  const router = useRouter();
  const [headerHeight , setheaderHeight] = useState(0);
  const sessionFromParams = (params?.session_id as string) || '';
  const [sessionId, setSessionId] = useState<string>(sessionFromParams || '');
  const [message, setMessage] = useState('');
  type QuestionItem = { key: string; label: string };
  const [questionQueue, setQuestionQueue] = useState<QuestionItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionItem | null>(null);
  const [isExpandedInput, setIsExpandedInput] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: '您好！我是 TripMind 智能助手，很高興為您服務！我可以幫助您規劃旅行、推薦景點，回答旅遊相關問題。請問有什麼可以幫助您的嗎？',
      isUser: false,
      timestamp: '下午3:31'
    }
  ]);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const expandedRef = useRef<TextInput | null>(null);
  const animatedBottom = useRef(new Animated.Value(0)).current;
  const KEYBOARD_GAP = 20; // gap between keyboard and modal/input (use safe area offset applied below)
  const BASE_BOTTOM = KEYBOARD_GAP;
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const ADJUST = 0; // fine-tune subtraction to bring input closer (try 0,2,4...)
  
  useEffect(() => {
    // Bind keyboard listeners once (mount). Avoid depending on transient UI state like isExpandedInput
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const rawH = 5;
      const h = rawH; // cap to a reasonable value when available
      // compute move using ADJUST and KEYBOARD_GAP; translateY uses negative to move up
      const move = Math.max(0, h - ADJUST) + BASE_BOTTOM;
      console.log('[Keyboard.anim] show', { height: rawH, used: h, insetBottom: insets.bottom, ADJUST, BASE_BOTTOM, move, duration: (e.duration ?? null), timestamp: Date.now() });

      // mark keyboard visible so header can collapse to top
      setKeyboardVisible(true);

      // animate translateY to negative move so view moves up
      Animated.timing(animatedBottom, {
        toValue: -move,
        duration: (e.duration ?? 200),
        useNativeDriver: true,
      }).start(() => {
        console.log('[Keyboard.anim] show animation done', { move, timestamp: Date.now() });
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      console.log('[Keyboard.anim] hide', { duration: (e?.duration ?? null), timestamp: Date.now() });

      // animate back to zero (no translate)
      Animated.timing(animatedBottom, {
        toValue: 0,
        duration: (e?.duration ?? 200),
        useNativeDriver: true,
      }).start(() => {
        console.log('[Keyboard.anim] hide animation done', { timestamp: Date.now() });
      });

      // Delay collapsing expanded input until after keyboard hide animation completes to avoid layout jitter
      const delay = (e?.duration && typeof e.duration === 'number') ? e.duration + 20 : 220;
      setTimeout(() => {
        if (isExpandedInput) {
          setIsExpandedInput(false);
          setMessage(expandedMessage);
          try { expandedRef.current?.blur(); } catch (err) { /* ignore */ }
        }
        // mark keyboard no longer visible
        setKeyboardVisible(false);
      }, delay);
    });

    // initialize translateY to 0 (visible at base bottom)
    animatedBottom.setValue(0);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const handleLogin = () => {
    // 導向profile頁面進行登入
    router.push('/(tabs)/profile');
  };

  const handleRegister = () => {
    // 導向profile頁面進行註冊
    router.push('/(tabs)/profile');
  };

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (trimmed) {
      const newMessage: Message = {
        id: Date.now(),
        text: trimmed,
        isUser: true,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      // send to TripMind and handle question flow
      (async () => {
        try {
          // log the outgoing user action
          try { await activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'send_message', page: 'reviews', details: { sessionId, text: trimmed } }); } catch (e) { /* ignore logging errors */ }
        } catch (e) { /* noop */ }

        // Use local mock responses from lib/mockChat instead of calling remote API
        try {
          const payload: any = { session_id: sessionId, user_text: trimmed };
          if (currentQuestion && currentQuestion.key) payload.last_question = currentQuestion.key;

          const data = resolveMock(payload, questionQueue);
          if (data?.session_id) setSessionId(data.session_id);

          // Normalize returned questions
          const normalize = (q: any): QuestionItem => {
            if (typeof q === 'string') return { key: q, label: q };
            if (q && typeof q === 'object') {
              const key = q.key || q.name || q.slot || q.id || (q.label ? q.label : JSON.stringify(q));
              const label = q.label || q.text || q.prompt || String(key);
              return { key: String(key), label: String(label) };
            }
            return { key: String(q), label: String(q) };
          };

          const returnedQuestions: QuestionItem[] = Array.isArray(data?.questions) ? data.questions.map(normalize) : [];
          const missing: any = data?.missing;
          const missingEmpty = !missing || (Array.isArray(missing) && missing.length === 0);

          // If missingEmpty and we were in a question flow (there was a currentQuestion or queued questions), treat as plan completion
          const wasInQuestionFlow = !!currentQuestion || (Array.isArray(questionQueue) && questionQueue.length > 0);

          if (missingEmpty && wasInQuestionFlow) {
            setCurrentQuestion(null);
            setQuestionQueue([]);
            setMessages(prev => [...prev, { id: Date.now()+3, text: '計畫已完成！我們已為您準備好初步規劃。', isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
            try {
              activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'plan_ready', page: 'reviews', details: { sessionId } });
            } catch (e) { /* ignore */ }

            // short delay so user sees the completion message, then navigate to plan
            setTimeout(() => {
              try {
                router.push('/plan');
              } catch (e) {
                console.warn('導航至 plan 發生錯誤', e);
              }
            }, 900);
          } else if (returnedQuestions.length) {
            try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'question_received', page: 'reviews', details: { sessionId, questions: returnedQuestions.map((q: QuestionItem) => ({ key: q.key, label: q.label })) } }); } catch (e) { /* ignore */ }
            setCurrentQuestion(returnedQuestions[0]);
            setQuestionQueue(returnedQuestions.slice(1));
            setMessages(prev => [...prev, { id: Date.now()+4, text: String(returnedQuestions[0].label), isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
          } else if (Array.isArray(questionQueue) && questionQueue.length > 0) {
            const next = questionQueue[0];
            try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'question_dequeued', page: 'reviews', details: { sessionId, question: { key: next.key, label: next.label } } }); } catch (e) { /* ignore */ }
            setCurrentQuestion(next);
            setQuestionQueue(q => q.slice(1));
            setMessages(prev => [...prev, { id: Date.now()+5, text: String(next.label), isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
          } else {
            // Generic message (not part of a question/plan flow)
            const autoReply = '收到訊息，晚點有專人為您服務';
            setMessages(prev => [...prev, { id: Date.now()+6, text: autoReply, isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
          }

        } catch (err: any) {
          setMessages(prev => [...prev, { id: Date.now()+6, text: `發送失敗：${String(err)}`, isUser: false, timestamp: new Date().toLocaleTimeString() }]);
        }

      })();
    }
  }, [message]);

  // If params include a session_id but state doesn't, initialize it
  useEffect(() => {
    if (!sessionId && sessionFromParams) setSessionId(sessionFromParams);
  }, [sessionFromParams]);

  // If init response passed via params, parse and start question loop
  useEffect(() => {
    try {
      const initStr = params?.init_resp as string | undefined;
      if (initStr) {
        const initData = JSON.parse(initStr || '{}');
        if (initData?.session_id) setSessionId(initData.session_id);
        if (initData?.reply) {
          setMessages(prev => [...prev, { id: Date.now()+5, text: String(initData.reply), isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
        }
        if (Array.isArray(initData?.questions) && initData.questions.length) {
          const normalize = (q: any): QuestionItem => {
            if (typeof q === 'string') return { key: q, label: q };
            if (q && typeof q === 'object') {
              const key = q.key || q.name || q.slot || q.id || (q.label ? q.label : JSON.stringify(q));
              const label = q.label || q.text || q.prompt || String(key);
              return { key: String(key), label: String(label) };
            }
            return { key: String(q), label: String(q) };
          };
          const qs = initData.questions.map(normalize);
          try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'question_received_init', page: 'reviews', details: { sessionId: initData.session_id || sessionId, questions: qs.map((q: QuestionItem) => ({ key: q.key, label: q.label })) } }); } catch (e) { /* ignore */ }
          setCurrentQuestion(qs[0]);
          setQuestionQueue(qs.slice(1));
          setMessages(prev => [...prev, { id: Date.now()+6, text: String(qs[0].label), isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
        }
        }
    } catch (err) {
      // ignore parse errors
    }
  }, [params?.init_resp]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newMessage: Message = {
      id: Date.now(),
      text: trimmed,
      isUser: true,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    setExpandedMessage('');
    setIsExpandedInput(false);

    // If this conversation was opened for accommodation change, handle acceptance
    try {
      const acDayIndex = params?.ac_dayIndex as string | undefined;
      const acTarget = params?.ac_target as string | undefined;
      if (acDayIndex && acTarget) {
        const normalized = trimmed.toLowerCase();
        if (normalized === '是' || normalized === 'y' || normalized === 'yes') {
          // user accepted the change -> navigate back to plan with updated params
          try { activityLogger.appendLog({ userId: globalState?.user?.id ?? null, action: 'accommodation_change_accept', page: 'reviews', details: { dayIndex: acDayIndex, newValue: acTarget } }); } catch (e) {}
          router.push({ pathname: '/plan', params: { ac_updated_dayIndex: acDayIndex, ac_updated_name: acTarget } });
        } else {
          // not accepted -> reply asking for preference
          setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now()+1, text: '了解，請告訴我您偏好的地點或類型，我會幫您推薦。', isUser: false, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }]);
          }, 300);
        }
      }
    } catch (e) { /* ignore */ }
  }, [params, router, globalState]);

  // 訊息變更時自動滾動到底部
  useEffect(() => {
    // Only react to messages length changes and allow time for keyboard/animation to settle
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length]);

  // 如果未登入，顯示登入提示界面
  if (!globalState.isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, KEYBOARD_GAP) }]}>
        <View style={styles.loginPromptContainer}>
          <View style={styles.loginPromptContent}>
            <FontAwesome5 name="comment-dots" size={64} color="#E5E5E5" style={styles.loginPromptIcon} />
            <Text style={styles.loginPromptTitle}>登入後使用客服</Text>
            <Text style={styles.loginPromptMessage}>
              登入您的帳號來與我們的智能助手交談，獲得個人化的旅遊建議
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
    <View style={[styles.container, { paddingTop: insets.top}]}> 
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: 50 }]}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        setheaderHeight(height);
      }}>
        <Text style={styles.headerTitle}>TripMind 助手</Text>
        
        {/* Divider */}
        <View style={styles.divider} />

      </View>
      
      
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatContainer} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.chatContent, { paddingBottom: KEYBOARD_GAP + 65 }]}
        >
        {messages.map((msg) => (
          <View key={msg.id} style={[styles.messageContainer, { paddingTop: headerHeight / 2 }]}>
            {msg.isUser ? (
              <View style={styles.userMessage}>
                <View style={styles.userMessageContent}>
                  <Text style={styles.userMessageText}>{msg.text}</Text>
                  <Text style={styles.userMessageTime}>{msg.timestamp}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.assistantMessage}>
                <View style={styles.assistantAvatar}>
                  <FontAwesome5 name="robot" size={16} color="#007AFF" />
                </View>
                <View style={styles.messageContent}>
                  <Text style={styles.messageText}>{msg.text}</Text>
                  <Text style={styles.messageTime}>{msg.timestamp}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
        </ScrollView>
        
        {/* Input Area: absolute-positioned so only input moves with keyboard */}
        <Animated.View
          style={[
            styles.absoluteInput,
            { transform: [{ translateY: animatedBottom }] },
          ]}
        >
          {isExpandedInput ? (
            <View style={styles.expandedInner}>
              <TextInput
                ref={(r) => { expandedRef.current = r; }}
                style={[styles.textInput, { maxHeight: 250 }]}
                placeholder="輸入您的問題..."
                placeholderTextColor="#999"
                value={expandedMessage}
                onChangeText={setExpandedMessage}
                multiline
                maxLength={2000}
                autoFocus
                onBlur={() => {
                  setIsExpandedInput(false);
                  setMessage(expandedMessage);
                }}
              />
              <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'flex-end' }}>
                <TouchableOpacity style={[styles.sendButton, { marginRight: 8 }]} onPress={() => sendText(expandedMessage)} disabled={!expandedMessage.trim()}>
                  <FontAwesome5 name="paper-plane" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                  {/* Use a real TextInput in collapsed mode so tapping focuses keyboard without expanding to multiline */}
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="輸入您的問題..."
                    placeholderTextColor="#999"
                    style={{ flex: 1, fontSize: 16, color: message.trim() ? '#333' : '#999' }}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                    multiline={false}
                  />
                <TouchableOpacity 
                  style={[styles.sendButton, { opacity: message.trim() ? 1 : 0.5 }]}
                  onPress={handleSend}
                  disabled={!message.trim()}
                >
                  <FontAwesome5 name="paper-plane" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 20,
    zIndex: 50,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageContainer: {
    paddingVertical: 15,
  },
  assistantMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  messageContent: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    maxWidth: '75%',
    flexShrink: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingHorizontal: 20,
    paddingTop: 15,
    backgroundColor: '#FFFFFF',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingVertical: 0,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chatContent: {
    paddingBottom: 20,
  },
  userMessage: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  userMessageContent: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 12,
    maxWidth: '75%',
    flexShrink: 1,
  },
  userMessageText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'white',
    marginBottom: 6,
  },
  userMessageTime: {
    fontSize: 11,
    color: '#E0E8FF',
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
  // expanded input styles
  expandedInputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
  },
  expandedInner: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 8,
    minHeight: 36,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  absoluteInput: {
    paddingHorizontal: 20,
    zIndex: 50,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
  },
});