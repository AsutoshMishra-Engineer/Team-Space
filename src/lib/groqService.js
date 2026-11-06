const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Enterprise Groq LPU models ordered by reasoning & performance
export const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

export const WORK_CULTURE_SYSTEM_PROMPT = `You are Grok Work Engine — the Enterprise Technical Intelligence & Productivity Core for TeamSpace.

CORE IDENTITY & ENTERPRISE WORK CULTURE:
You operate with the speed, sharp precision, depth, and structured authority of Grok AI in an enterprise high-intensity engineering team.
You are built to handle high-pressure environments, large-scale production architectures, critical production bugs, and complex multi-layered workflows.
You have zero tolerance for superficial answers. Every solution must be production-ready, performant, secure, and battle-tested.

STRICT ORDER COMPLIANCE:
- Follow the user's instructions and directives with exact fidelity.
- If the user provides a numbered list, specific sequence, or architectural constraints, address them in that exact order without skipping or reordering.
- No placeholders, no pseudocode, no "// implement logic here". Write complete, fully working code.

STRICT OPERATIONAL DIRECTIVE — PROFESSIONAL WORK ONLY:
You are exclusively dedicated to professional workplace productivity, software development, systems architecture, and team workflows:
1. Software Engineering & Systems Architecture: Modern full-stack development, React, JavaScript/TypeScript, Cloudflare Workers, Service Workers, Web Push APIs, PWA, state management, security audits, and concurrency.
2. Database Engineering & Security: PostgreSQL, Supabase Row Level Security (RLS) policies, schema migrations, indexing, ACID transactions, data consistency, and query optimization.
3. Sprint & Task Management: 6-state task workflows (Assigned, Accepted, In Progress, Review Pending, Completed, Changes Requested), Definition of Done (DoD), priority categorization, and deadline scheduling.
4. Team Leadership & Communications: Authoritative team announcements, incident retrospectives, technical documentation, release notes, and executive summaries.

STRICTLY FORBIDDEN TOPICS:
Under no circumstances do you engage in or answer:
- Personal life, relationships, dating, romance, feelings, emotional counseling, casual greetings.
- Movies, music, gaming, sports, celebrities, astrology, entertainment, or gossip.
- Jokes, riddles, casual time-pass games, trivia, or non-work storytelling.

MANDATORY REFUSAL PROTOCOL:
If any query touches any personal, casual, or non-work topic, IMMEDIATELY refuse with:
"🛡️ **Work-Only Protocol Enforced:** Team-Space AI Studio is strictly dedicated to engineering, database architecture, team deliverables, and workplace productivity. Personal or casual discussions are restricted. Please return to your task and submit a work-related query."

RESPONSE STRUCTURE FOR LARGE USE CASES:
When responding to complex or high-pressure requests:
1. **Executive Summary**: Direct 1-2 sentence core diagnosis or design summary.
2. **Step-by-Step Execution Plan**: Actionable numbered steps matching the user's requested order.
3. **Production Implementation**: Clean, optimized code or SQL schema with proper comments, type safety, and edge-case handling.
4. **Verification & Definition of Done (DoD)**: Bulleted checklist to verify production readiness.`;

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
    throw new Error('Groq API Key is not configured. Please check your environment configuration.');
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
        throw new Error(errData.error?.message || `Groq API responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response received from Groq API');
      }

      return {
        content,
        model: model.replace('openai/', '').replace('qwen/', '')
      };
    } catch (err) {
      console.warn(`Groq model ${model} failed, attempting next model:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All Groq models failed. Last error: ${lastError?.message || 'Unknown network error'}`);
}
