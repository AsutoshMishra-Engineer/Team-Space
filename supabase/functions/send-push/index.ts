// Supabase Edge Function: send-push
// Sends authenticated Web Push Notifications to active team members.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://teamspace204.asutoshm359.workers.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@teamspace.app";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ error: "VAPID secrets are not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.slice(7).trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { team_id, title, message, url } = await req.json();

    if (!team_id || !message) {
      return new Response(JSON.stringify({ error: "Missing team_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify caller is an active member of team_id
    const { data: membership } = await supabase
      .from("team_members")
      .select("id")
      .eq("team_id", team_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden: active team membership required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: subs, error: subError } = await supabase
      .from("user_push_subscriptions")
      .select("id, user_id, subscription")
      .eq("team_id", team_id);

    if (subError) throw subError;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ status: "no_subscribers", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const safeUrl = typeof url === "string" && url.startsWith("/") ? url : "/";
    const payload = JSON.stringify({
      title: String(title || "📢 TeamSpace Announcement").slice(0, 120),
      body: String(message).slice(0, 500),
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "team-announcement",
      url: safeUrl
    });

    const results = await Promise.allSettled(
      subs.map(async (item) => {
        try {
          if (!item.subscription?.keys?.p256dh || !item.subscription?.keys?.auth) {
            return null;
          }
          return await webpush.sendNotification(item.subscription, payload);
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("user_push_subscriptions").delete().eq("id", item.id);
          }
          throw err;
        }
      })
    );

    const sentCount = results.filter((r) => r.status === "fulfilled" && r.value !== null).length;

    return new Response(JSON.stringify({ status: "success", sent: sentCount, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ error: "Push dispatch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
