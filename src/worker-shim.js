import * as webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

const WORK_CULTURE_SYSTEM_PROMPT = `You are the TeamSpace AI Assistant — an expert technical, engineering, and agile operations intelligence engine.

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

const NON_WORK_PATTERNS = [
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

function checkWorkRelevance(text) {
  const lower = String(text || '').toLowerCase().trim();
  for (const pattern of NON_WORK_PATTERNS) {
    if (pattern.test(lower)) {
      return { isWork: false, reason: 'Personal or casual entertainment query detected.' };
    }
  }
  if (/^(hi|hello|hey|sup|yo|wassup|good morning|good night|gm|gn|k|ok|hlo)[\s!.]*$/i.test(lower)) {
    return { isWork: false, reason: 'Please provide a technical, code, or project-related question.' };
  }
  return { isWork: true };
}

const PRODUCTION_ORIGINS = [
  'https://teamspace204.asutoshm359.workers.dev'
];

function getAllowedCorsOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;

  const url = new URL(request.url);
  const allowed = new Set(PRODUCTION_ORIGINS);
  if (env.ALLOWED_ORIGIN) {
    for (const item of String(env.ALLOWED_ORIGIN).split(',')) {
      const trimmed = item.trim();
      if (trimmed) allowed.add(trimmed);
    }
  }

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
    allowed.add(url.origin);
  }

  return allowed.has(origin) ? origin : null;
}

function buildCorsHeaders(request, env) {
  const allowedOrigin = getAllowedCorsOrigin(request, env);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
    'Vary': 'Origin'
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    }
  });
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co",
      "media-src 'self' blob: https://res.cloudinary.com https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://res.cloudinary.com",
      "frame-src 'self' https://*.supabase.co https://res.cloudinary.com blob:",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isAllowedPushEndpoint(endpoint) {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'fcm.googleapis.com' ||
      host.endsWith('.push.services.mozilla.com') ||
      host.endsWith('.notify.windows.com') ||
      host === 'web.push.apple.com' ||
      host.endsWith('.push.apple.com')
    );
  } catch {
    return false;
  }
}

function sanitizeTargetUrl(rawUrl, requestOrigin) {
  if (!rawUrl || typeof rawUrl !== 'string') return '/';
  try {
    const resolved = new URL(rawUrl, requestOrigin);
    if (resolved.origin === requestOrigin) {
      return resolved.pathname + resolved.search + resolved.hash;
    }
  } catch {
    // ignore malformed URL
  }
  return '/';
}

function getPreferenceKeyForTag(tag) {
  const t = String(tag || '').toLowerCase();
  if (t.includes('ack-reminder')) return 'notify_reminders';
  if (t.includes('announcement')) return 'notify_announcements';
  if (t.includes('task')) return 'notify_tasks';
  if (t.includes('attendance')) return 'notify_attendance';
  return null;
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getFirebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signingInput = new TextEncoder().encode(`${header}.${claim}`);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signingInput);
  const jwt = `${header}.${claim}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth token error (${tokenRes.status})`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function sendNativeFcmPush(fcmToken, payloadObj, serviceAccount, accessToken) {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: {
          title: payloadObj.title,
          body: payloadObj.body
        },
        data: {
          title: payloadObj.title,
          body: payloadObj.body,
          url: payloadObj.fullUrl
        },
        android: {
          priority: 'high'
        }
      }
    })
  });

  if (res.ok) {
    return { statusCode: res.status, status: 'ok' };
  }

  const errText = await res.text();
  const error = new Error(`Native FCM error (${res.status}): ${errText.slice(0, 200)}`);
  error.statusCode = res.status;
  error.isUnregistered = res.status === 404 || errText.includes('UNREGISTERED');
  throw error;
}

async function authenticateRequest(request, env) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { error: 'Server authentication service is not configured.', status: 503 };
  }

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: missing session token.', status: 401 };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: 'Unauthorized: empty session token.', status: 401 };
  }

  const authClient = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) {
    return { error: 'Unauthorized: invalid or expired session.', status: 401 };
  }

  const userSupabase = createClient(supabaseUrl, env.SUPABASE_ANON_KEY || supabaseKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });

  const adminSupabase = env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

  return { user, userSupabase, adminSupabase };
}

async function sendWebPushToEndpoint(subscription, payloadString) {
  if (!subscription?.endpoint || !isAllowedPushEndpoint(subscription.endpoint)) {
    throw new Error('Rejected unsupported push endpoint');
  }

  const details = webpush.generateRequestDetails(subscription, payloadString, {
    TTL: 86400,
    urgency: 'high'
  });

  const headers = new Headers();
  for (const [k, v] of Object.entries(details.headers)) {
    if (k.toLowerCase() !== 'content-length') {
      headers.set(k, String(v));
    }
  }

  const bodyData = new Uint8Array(details.body.buffer, details.body.byteOffset, details.body.byteLength);

  const response = await fetch(details.endpoint, {
    method: 'POST',
    headers,
    body: bodyData
  });

  const responseText = await response.text();

  if (response.status >= 200 && response.status < 300) {
    return { statusCode: response.status, status: 'ok' };
  }

  const error = new Error(`Push gateway error (${response.status}): ${responseText.slice(0, 200)}`);
  error.statusCode = response.status;
  throw error;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { headers: corsHeaders });
    }

    // Public VAPID public key endpoint
    if (url.pathname === '/api/push-config' && request.method === 'GET') {
      return jsonResponse({ vapidPublicKey: env.VAPID_PUBLIC_KEY || '' }, 200, corsHeaders);
    }

    // Authenticated AI Gateway Proxy
    if (url.pathname === '/api/ai' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }

      if (!env.GROQ_API_KEY) {
        return jsonResponse({ error: 'AI service secret is not configured.' }, 503, corsHeaders);
      }

      try {
        const body = await request.json();
        const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
        const temperature = typeof body?.temperature === 'number'
          ? Math.min(1, Math.max(0, body.temperature))
          : 0.2;

        const sanitizedMessages = rawMessages
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-20)
          .map((m) => ({
            role: m.role,
            content: m.content.slice(0, 8000)
          }));

        if (sanitizedMessages.length === 0) {
          return jsonResponse({ error: 'No valid messages provided.' }, 400, corsHeaders);
        }

        const lastUserMsg = [...sanitizedMessages].reverse().find((m) => m.role === 'user');
        if (!lastUserMsg) {
          return jsonResponse({ error: 'User prompt is required.' }, 400, corsHeaders);
        }

        const relevance = checkWorkRelevance(lastUserMsg.content);
        if (!relevance.isWork) {
          return jsonResponse({
            content: '🛡️ **Work-Only Protocol Enforced:** TeamSpace AI is dedicated to engineering, database architecture, team deliverables, and workplace productivity. Please submit a work- or code-related query.',
            model: 'guardrail'
          }, 200, corsHeaders);
        }

        const formattedMessages = [
          { role: 'system', content: WORK_CULTURE_SYSTEM_PROMPT },
          ...sanitizedMessages
        ];

        let lastError = null;
        for (const model of GROQ_MODELS) {
          try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.GROQ_API_KEY}`
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
              throw new Error(errData.error?.message || `Upstream AI status ${res.status}`);
            }

            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
              throw new Error('Empty response received from AI service');
            }

            return jsonResponse({
              content,
              model: model.replace('openai/', '').replace('qwen/', '')
            }, 200, corsHeaders);
          } catch (err) {
            lastError = err;
          }
        }

        return jsonResponse(
          { error: lastError?.message || 'AI gateway temporarily unavailable.' },
          502,
          corsHeaders
        );
      } catch {
        return jsonResponse({ error: 'Invalid AI request payload.' }, 400, corsHeaders);
      }
    }

    // Authenticated Push Dispatch Endpoint (Web Push + Native FCM HTTP v1 + Preferences)
    if (url.pathname === '/api/send-push' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }

      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        return jsonResponse({ error: 'Push VAPID secrets are not configured.' }, 503, corsHeaders);
      }

      webpush.setVapidDetails(
        env.VAPID_SUBJECT || 'mailto:admin@teamspace.app',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      try {
        const body = await request.json();
        const { team_id, user_id, title, message, target_url, tag } = body || {};

        if (!team_id && !user_id) {
          return jsonResponse({ error: 'Missing team_id or user_id.' }, 400, corsHeaders);
        }

        const dbClient = auth.adminSupabase || auth.userSupabase;

        // Verify caller authorization
        if (team_id) {
          const { data: membership } = await dbClient
            .from('team_members')
            .select('id')
            .eq('team_id', team_id)
            .eq('user_id', auth.user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (!membership) {
            return jsonResponse({ error: 'Forbidden: active team membership required.' }, 403, corsHeaders);
          }
        } else if (user_id && user_id !== auth.user.id) {
          return jsonResponse({ error: 'Forbidden: cannot push to arbitrary user without team context.' }, 403, corsHeaders);
        }

        // Resolve subscriptions from DB only
        let subs = [];
        if (team_id) {
          let query = dbClient
            .from('user_push_subscriptions')
            .select('id, user_id, subscription, endpoint, device_type')
            .eq('team_id', team_id);
          if (user_id) {
            query = query.eq('user_id', user_id);
          }
          const { data: selectData } = await query;
          if (Array.isArray(selectData)) subs = selectData;
        } else {
          const { data: selectData } = await dbClient
            .from('user_push_subscriptions')
            .select('id, user_id, subscription, endpoint, device_type')
            .eq('user_id', auth.user.id);
          if (Array.isArray(selectData)) subs = selectData;
        }

        if (!subs || subs.length === 0) {
          return jsonResponse({ status: 'no_subscribers', count: 0 }, 200, corsHeaders);
        }

        // Exclude sender on team-wide broadcasts (keep when explicitly targeting a specific user_id)
        const isTeamBroadcast = Boolean(team_id && !user_id);
        let filteredSubs = isTeamBroadcast
          ? subs.filter((item) => item.user_id !== auth.user.id)
          : subs;

        // Enforce per-user notification_preferences when service role client is available
        const prefKey = getPreferenceKeyForTag(tag);
        if (prefKey && auth.adminSupabase && filteredSubs.length > 0) {
          const recipientIds = [...new Set(filteredSubs.map((s) => s.user_id).filter(Boolean))];
          const { data: prefsRows } = await auth.adminSupabase
            .from('notification_preferences')
            .select(`user_id, ${prefKey}`)
            .in('user_id', recipientIds);

          if (Array.isArray(prefsRows) && prefsRows.length > 0) {
            const optedOutUsers = new Set(
              prefsRows.filter((r) => r[prefKey] === false).map((r) => r.user_id)
            );
            filteredSubs = filteredSubs.filter((item) => !optedOutUsers.has(item.user_id));
          }
        }

        if (filteredSubs.length === 0) {
          return jsonResponse({ status: 'no_eligible_subscribers', count: 0 }, 200, corsHeaders);
        }

        const safeUrl = sanitizeTargetUrl(target_url, url.origin);
        const fullSafeUrl = url.origin + safeUrl;
        const cleanTitle = String(title || '📢 TeamSpace Alert').slice(0, 120);
        const cleanBody = String(message || 'New team update').slice(0, 500);

        const webPayload = JSON.stringify({
          title: cleanTitle,
          body: cleanBody,
          icon: '/logo.png',
          badge: '/logo.png',
          tag: String(tag || 'teamspace-general').slice(0, 64),
          url: safeUrl
        });

        // Separate Web Push vs Native Android FCM targets & deduplicate
        const webSubsMap = new Map();
        const nativeSubsMap = new Map();

        for (const item of filteredSubs) {
          const subObj = item.subscription || {};
          if (item.device_type === 'android_native' || subObj.fcm_token) {
            const token = subObj.fcm_token;
            if (token && !nativeSubsMap.has(token)) {
              nativeSubsMap.set(token, { id: item.id, token });
            }
          } else if (subObj.endpoint && subObj.keys?.p256dh && subObj.keys?.auth) {
            if (!webSubsMap.has(subObj.endpoint)) {
              webSubsMap.set(subObj.endpoint, { id: item.id, sub: subObj });
            }
          }
        }

        const staleIds = [];
        const dispatchPromises = [];

        // 1. Web Push dispatch
        for (const entry of webSubsMap.values()) {
          dispatchPromises.push(
            sendWebPushToEndpoint(entry.sub, webPayload).catch((err) => {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                staleIds.push(entry.id);
              }
              throw err;
            })
          );
        }

        // 2. Native Android FCM HTTP v1 dispatch (when FIREBASE_SERVICE_ACCOUNT_JSON is set)
        if (nativeSubsMap.size > 0 && env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          try {
            const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
            const fcmAccessToken = await getFirebaseAccessToken(serviceAccount);
            for (const entry of nativeSubsMap.values()) {
              dispatchPromises.push(
                sendNativeFcmPush(
                  entry.token,
                  { title: cleanTitle, body: cleanBody, fullUrl: fullSafeUrl },
                  serviceAccount,
                  fcmAccessToken
                ).catch((err) => {
                  if (err?.isUnregistered) {
                    staleIds.push(entry.id);
                  }
                  throw err;
                })
              );
            }
          } catch {
            // Skip native FCM if service account secret is invalid
          }
        }

        if (dispatchPromises.length === 0) {
          return jsonResponse({ status: 'no_active_channels', sent: 0, total: 0 }, 200, corsHeaders);
        }

        const results = await Promise.allSettled(dispatchPromises);
        const sentCount = results.filter((r) => r.status === 'fulfilled').length;

        // Clean up expired/uninstalled subscriptions
        if (staleIds.length > 0 && auth.adminSupabase) {
          await auth.adminSupabase
            .from('user_push_subscriptions')
            .delete()
            .in('id', staleIds)
            .catch(() => {});
        }

        return jsonResponse({
          status: 'success',
          sent: sentCount,
          total: dispatchPromises.length
        }, 200, corsHeaders);
      } catch {
        return jsonResponse({ error: 'Failed to process push dispatch.' }, 500, corsHeaders);
      }
    }

    // Authenticated Single-Device Test Push Endpoint
    if (url.pathname === '/api/test-push' && request.method === 'POST') {
      const auth = await authenticateRequest(request, env);
      if (auth.error) {
        return jsonResponse({ error: auth.error }, auth.status, corsHeaders);
      }

      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        return jsonResponse({ error: 'Push VAPID secrets are not configured.' }, 503, corsHeaders);
      }

      webpush.setVapidDetails(
        env.VAPID_SUBJECT || 'mailto:admin@teamspace.app',
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      try {
        const body = await request.json();
        const { subscription, title, message } = body || {};

        if (!subscription || !subscription.endpoint || !isAllowedPushEndpoint(subscription.endpoint)) {
          return jsonResponse({ error: 'Invalid or unsupported push subscription endpoint.' }, 400, corsHeaders);
        }

        const payload = JSON.stringify({
          title: String(title || '🔔 TeamSpace Android Push Test').slice(0, 120),
          body: String(message || 'If you see this, real background Android Web Push is 100% active on your phone!').slice(0, 500),
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'teamspace-test',
          url: '/'
        });

        const result = await sendWebPushToEndpoint(subscription, payload);
        return jsonResponse({ status: 'success', ...result }, 200, corsHeaders);
      } catch {
        return jsonResponse({ error: 'Test push failed.' }, 500, corsHeaders);
      }
    }

    // Fallback: Serve static assets (Vite SPA) with security headers
    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse);
  }
};
