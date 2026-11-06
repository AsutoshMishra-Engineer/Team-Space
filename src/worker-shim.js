import * as webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Verified Cryptographic Keypair (ECDH P-256 / prime256v1)
const VAPID_PUBLIC_KEY = 'BKuFBD8j1g_XMZUERp_peqjjDG7goKONB5zNdMooaomsvfrTwkRj6xj611Jbul_9K68rvMLKlz8zvH2b4xDqp2k';
const VAPID_PRIVATE_KEY = 'HJzJyaqBOpd_p94H6fA9Hjmo3fo6TcczWrvmRzIGMK4';
const VAPID_SUBJECT = 'mailto:admin@teamspace.app';

const SUPABASE_URL = 'https://gsmbdlujyfoodoaptdpq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzbWJkbHVqeWZvb2RvYXB0ZHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMDcyMTMsImV4cCI6MjEwNDc4MzIxM30.AOnXe5LDtrGKihekmZkPAwmnFfp0V63oypP036E0Leo';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

/**
 * Worker-native Web Push dispatch using generateRequestDetails + Cloudflare native fetch().
 * Strips forbidden headers (Content-Length) and converts body to standard Uint8Array.
 */
async function sendWebPushToEndpoint(subscription, payloadString) {
  try {
    const details = webpush.generateRequestDetails(subscription, payloadString, {
      TTL: 86400,
      urgency: 'high'
    });

    // Sanitize headers: remove forbidden headers (Content-Length) and stringify numbers
    const headers = new Headers();
    for (const [k, v] of Object.entries(details.headers)) {
      if (k.toLowerCase() !== 'content-length') {
        headers.set(k, String(v));
      }
    }

    const bodyData = new Uint8Array(details.body.buffer, details.body.byteOffset, details.body.byteLength);

    const response = await fetch(details.endpoint, {
      method: 'POST',
      headers: headers,
      body: bodyData
    });

    const responseText = await response.text();

    if (response.status >= 200 && response.status < 300) {
      return { statusCode: response.status, status: 'ok', body: responseText };
    }

    const error = new Error(`FCM error (${response.status}): ${responseText}`);
    error.statusCode = response.status;
    throw error;
  } catch (err) {
    throw err;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Direct Web Push Dispatch Endpoint
    if (url.pathname === '/api/send-push' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { team_id, user_id, title, message, target_url, tag, direct_subscriptions } = body;

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        let subs = [];

        // 1. If direct subscriptions were passed from the client, use them
        if (Array.isArray(direct_subscriptions) && direct_subscriptions.length > 0) {
          subs = direct_subscriptions;
        } else {
          // 2. Try RPC function (bypasses RLS)
          if (team_id) {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_team_push_subscriptions', {
              p_team_id: team_id
            });
            if (!rpcErr && Array.isArray(rpcData)) {
              subs = rpcData;
            }
          }

          // 3. Fallback direct select
          if (subs.length === 0) {
            let query = supabase.from('user_push_subscriptions').select('id, user_id, subscription');
            if (team_id) {
              query = query.eq('team_id', team_id);
            } else if (user_id) {
              query = query.eq('user_id', user_id);
            }
            const { data: selectData } = await query;
            if (selectData) subs = selectData;
          }
        }

        if (!subs || subs.length === 0) {
          return new Response(JSON.stringify({ status: 'no_subscribers', count: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Deduplicate subscriptions by endpoint
        const uniqueSubsMap = new Map();
        for (const item of subs) {
          const subObj = item.subscription || item;
          const endpoint = subObj?.endpoint;
          if (endpoint && !uniqueSubsMap.has(endpoint)) {
            uniqueSubsMap.set(endpoint, subObj);
          }
        }
        const uniqueSubs = Array.from(uniqueSubsMap.values());

        const payload = JSON.stringify({
          title: title || '📢 TeamSpace Alert',
          body: message || 'New team update',
          icon: '/logo.png',
          badge: '/logo.png',
          tag: tag || 'teamspace-general',
          url: target_url || '/'
        });

        // Dispatch via Cloudflare native fetch()
        const results = await Promise.allSettled(
          uniqueSubs.map(async (sub) => {
            return await sendWebPushToEndpoint(sub, payload);
          })
        );

        const sentCount = results.filter((r) => r.status === 'fulfilled').length;

        return new Response(JSON.stringify({
          status: 'success',
          sent: sentCount,
          total: uniqueSubs.length,
          results: results.map((r) => ({
            status: r.status,
            reason: r.status === 'rejected' ? r.reason?.message : undefined
          }))
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Direct Single-Device Test Push Endpoint
    if (url.pathname === '/api/test-push' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { subscription, title, message } = body;

        if (!subscription || !subscription.endpoint) {
          return new Response(JSON.stringify({ error: 'Missing subscription object' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const payload = JSON.stringify({
          title: title || '🔔 TeamSpace Android Push Test',
          body: message || 'If you see this, real background Android Web Push is 100% active on your phone!',
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'teamspace-test',
          url: '/'
        });

        const result = await sendWebPushToEndpoint(subscription, payload);

        return new Response(JSON.stringify({ status: 'success', ...result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Fallback: Serve static assets (Vite SPA)
    return env.ASSETS.fetch(request);
  }
};
