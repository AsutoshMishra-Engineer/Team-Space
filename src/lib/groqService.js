import { supabase } from './supabase';

// Enterprise AI models ordered by reasoning & performance
export const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

/**
 * Fast client-side guardrail to filter casual/personal/time-pass questions
 * Saves tokens and avoids unnecessary network latency (also enforced server-side).
 */
export function checkWorkRelevance(text) {
  const lower = text.toLowerCase().trim();

  const nonWorkPatterns = [
    /\b(who is your (favorite|favourite) (actor|actress|singer|movie|hero|song))\b/,
    /\b(tell me a (joke|riddle|funny story|bedtime story|fairy tale))\b/,
    /\b(do you (love|like) me)\b/,
    /\b(what is your name|are you single|will you marry me|who made you)\b/,
    /\b(what movie should i watch|best netflix show|movie recommendation|song recommendation)\b/,
    /\b(how are you feeling|are you happy|are you sad|i am bored|entertain me)\b/,
    /\b(relationship advice|my girlfriend|my boyfriend|my crush|dating advice|breakup)\b/,
    /\b(astrology|horoscope|zodiac sign|tarot|future prediction)\b/,
    /\b(sing a song|write a poem about love|romantic letter|flirt with me)\b/,
    /\b(roast me|insult me|tell me something funny|make me laugh)\b/,
    /\b(cricket score|football match|who won the match|ipl score|fifa)\b/,
    /\b(weather today|what is the weather in)\b/
  ];

  for (const pattern of nonWorkPatterns) {
    if (pattern.test(lower)) {
      return {
        isWork: false,
        reason: 'Personal or casual entertainment query detected.'
      };
    }
  }

  if (/^(hi|hello|hey|sup|yo|wassup|good morning|good night|gm|gn|k|ok|hlo)[\s!.]*$/i.test(lower)) {
    return {
      isWork: false,
      reason: 'Please provide a technical, code, or project-related question.'
    };
  }

  return { isWork: true };
}

/**
 * Dispatches prompt securely through the authenticated TeamSpace Worker AI Proxy (/api/ai)
 */
export async function callGroqWorkEngine(messages, temperature = 0.2) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Authentication required to use the AI Assistant.');
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      temperature
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `AI service responded with status ${res.status}`);
  }

  if (!data.content) {
    throw new Error('Empty response received from AI service');
  }

  return {
    content: data.content,
    model: data.model || 'Active'
  };
}
