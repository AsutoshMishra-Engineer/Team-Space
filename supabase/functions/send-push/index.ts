// Supabase Edge Function: send-push
// Sends Web Push Notifications (WhatsApp-style) to all team members even when Chrome/Mobile is closed!

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BNkVSelh9jtKhCUPlXiy5IKLQDMFYaCMexwwXF1ohjbx_Qx9B2_nOwQrJRIaY4ITC0dbxC62pqmfQ8Kip7uELVY";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "eX_gM6L2yYn1oA879t2t5mCqBvW98mQh9J6XqB6_G_E"; // Configurable in Supabase secrets
const VAPID_SUBJECT = "mailto:admin@teamspace.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { team_id, title, message, url } = await req.json();

    if (!team_id || !message) {
      return new Response(JSON.stringify({ error: "Missing team_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active push subscriptions for this team
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

    const payload = JSON.stringify({
      title: title || "📢 TeamSpace Announcement",
      body: message,
      icon: "/logo.png",
      badge: "/logo.png",
      tag: "team-announcement",
      url: url || "/"
    });

    // Send push notification to every subscriber
    const results = await Promise.allSettled(
      subs.map(async (item) => {
        try {
          return await webpush.sendNotification(item.subscription, payload);
        } catch (err: any) {
          // If subscription expired or unsubscribed (404/410), delete it
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("user_push_subscriptions").delete().eq("id", item.id);
          }
          throw err;
        }
      })
    );

    const sentCount = results.filter((r) => r.status === "fulfilled").length;

    return new Response(JSON.stringify({ status: "success", sent: sentCount, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
