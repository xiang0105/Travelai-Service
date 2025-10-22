import chatJson from '../data/chat.json';

type Payload = { session_id?: string; user_text?: string; last_question?: string; [k:string]: any };

/**
 * Return init_with_front_data mock if available
 */
export function getMockInit() {
  const explicit = (chatJson as any)?.mock?.init_with_front_data;
  if (explicit) return explicit;

  // Fallback: if we have followup question definitions, synthesize an init payload
  const follow = (chatJson as any)?.mock_followups;
  if (follow && Array.isArray(follow.questions) && follow.questions.length) {
    const sessionFromExample = follow.example_flow?.request?.session_id || `demo-session-local`;
    const qs = follow.questions.map((q: any) => ({ key: q.key, label: q.label }));
    return {
      session_id: sessionFromExample,
      reply: '您好！我們將使用本地模擬問答來蒐集旅遊偏好，請依序回答。',
      questions: qs,
      missing: qs.length ? [qs[0].key] : [],
    };
  }

  return undefined;
}

/**
 * Resolve a mock response based on payload and optional question queue.
 * This is intentionally simple — expand rules here for richer simulation.
 */
export function resolveMock(payload: Payload, questionQueue: any[] = []) {
  try {
    const main = (chatJson as any)?.mock?.message?.example_with_last_question;
    if (main && main.request_example && main.request_example.last_question === payload.last_question) {
      const resp = { ...main.response_example };
      resp.reply = resp.reply || `收到 ${payload.last_question}：${payload.user_text || ''}`;
      return resp;
    }

    const follow = (chatJson as any)?.mock_followups?.example_flow;
    if (follow && follow.request && follow.request.last_question === payload.last_question) {
      const resp = { ...follow.response };
      return resp;
    }

    // fallback: if questionQueue has items, return next
    if (Array.isArray(questionQueue) && questionQueue.length > 0) {
      const next = questionQueue[0];
      return { reply: String(next.label), questions: [], missing: [next.key] };
    }

    // default: complete
    return { reply: '感謝您的回覆，我們的問答已完成。', questions: [], missing: [] };
  } catch (err) {
    return { reply: '模擬回應失敗', questions: [], missing: [] };
  }
}

export default { getMockInit, resolveMock };
