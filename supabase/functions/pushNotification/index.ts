import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { GoogleAuth } from "https://esm.sh/google-auth-library@9.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { userId, token, title, body, data } = await req.json();

    let fcmToken = token;
    if (userId && !token) {
      const supabaseResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=expo_push_token`,
        {
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        }
      );

      const profiles = await supabaseResponse.json();
      if (profiles.length > 0 && profiles[0].expo_push_token) {
        fcmToken = profiles[0].expo_push_token;
      } else {
        return new Response(
          JSON.stringify({ error: "User not found or has no push token" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!fcmToken) {
      return new Response(JSON.stringify({ error: "Missing FCM token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });

    const client = await auth.getClient();
    const projectId = serviceAccount.project_id;

    // 🆕 GAME-SPECIFIC METADATA
    const messagePayload = {
      message: {
        token: fcmToken,
        notification: {
          title: title || "⛳ Golf Companion",
          body: body || "You received a new notification!",
        },
        data: {
          ...(data || {}),
          timestamp: new Date().toISOString(),
          source: "golf-companion",
        },
      },
    };

    const res = await client.request({
      url: `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      method: "POST",
      data: messagePayload,
    });

    console.log("✅ Push notification sent:", {
      messageId: res.data.name,
      title,
      recipientToken: fcmToken.substring(0, 20) + "...",
      gameId: data?.gameId || "N/A",
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: res.data.name,
        token: fcmToken.substring(0, 20) + "...",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});