const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Enterprise Groq LPU models ordered by reasoning & performance
export const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

export const WORK_CULTURE_SYSTEM_PROMPT = `You are the TeamSpace AI Assistant — an expert technical, engineering, and agile operations intelligence engine.

CRITICAL OPERATIONAL RULES:
1. ANSWER ONLY WHAT IS ASKED:
   - Answer the user's specific prompt or question directly without unnecessary filler, theoretical lectures, or essay padding.
   - Do NOT produce overly verbose multi-page dumps unless explicitly requested. Give people clear, digestible, immediately actionable answers.
   - Match the depth of your answer to the user's question: short questions get concise answers; technical problems get sharp, structured solutions.

2. SHARP CRITICAL THINKING:
   - Apply deep critical thinking: identify potential risks, bugs, performance bottlenecks, or architectural flaws.
   - Present critical observations clearly in crisp, organized bullet points.
   - Always prioritize production stability, security, and clean code.

3. CLEAN & PROFESSIONAL FORMATTING:
   - Use concise markdown: bold key concepts, bulleted lists for multiple items, and syntax-highlighted code blocks with language tags.
   - Never use pseudocode or "// TODO: implement here". Provide exact working solutions.
   - Keep paragraphs short (1-3 sentences).

4. IDENTITY & SCOPE:
   - Refer to yourself only as "AI Assistant" or "TeamSpace AI". Never mention any third-party model, vendor, or corporate name in your output.
   - Professional work only: Software engineering, database design, PostgreSQL/Supabase, API integrations, agile sprint workflows, technical documentation, and workplace productivity.
   - If a query is purely casual, personal, or entertainment-focused, politely decline:
     "🛡️ **Work-Only Protocol Enforced:** TeamSpace AI is dedicated to engineering, database architecture, team deliverables, and workplace productivity. Please submit a work- or code-related query."`;

/**
 * Fast client-side guardrail to filter casual/personal/time-pass questions
 * SAVES 100% OF GROQ TOKENS AND AVOIDS UNNECESSARY NETWORK LATENCY
 */
export function checkWorkRelevance(text) {
  const lower = text.toLowerCase().trim();

  // Pattern check for purely personal, casual, or entertainment questions
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

  // Trivial greetings without any technical or work content
  if (/^(hi|hello|hey|sup|yo|wassup|good morning|good night|gm|gn|k|ok|hlo)[\s!.]*$/i.test(lower)) {
    return {
      isWork: false,
      reason: 'Please provide a technical, code, or project-related question.'
    };
  }

  return { isWork: true };
}

/**
 * Dispatches prompt to Groq LPU with automatic model fallback
 */
export async function callGroqWorkEngine(messages, temperature = 0.2) {
  if (!GROQ_KEY) {
    throw new Error('AI Engine Key is not configured. Please check your workspace configuration.');
  }

  const formattedMessages = [
    { role: 'system', content: WORK_CULTURE_SYSTEM_PROMPT },
    ...messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  ];

  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature,
          max_tokens: 3000
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `AI service responded with status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response received from AI service');
      }

      return {
        content,
        model: model.replace('openai/', '').replace('qwen/', '')
      };
    } catch (err) {
      console.warn(`AI model ${model} fallback:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All intelligence models failed. Last error: ${lastError?.message || 'Unknown network error'}`);
}
