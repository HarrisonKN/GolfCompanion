import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper function to create JWT manually
async function createJWT(serviceAccount: any): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  // Base64url encode
  const base64urlEncode = (data: any) => {
    const json = JSON.stringify(data);
    const base64 = btoa(json);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  };

  const encodedHeader = base64urlEncode(header);
  const encodedPayload = base64urlEncode(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the token
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  // Base64url encode signature
  const signatureArray = new Uint8Array(signature);
  let signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  signatureBase64 = signatureBase64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `${unsignedToken}.${signatureBase64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  console.log("📥 Push notification request received");

  try {
    const { userId, token, title, body, data } = await req.json();
    console.log("📋 Request params:", { 
      hasUserId: !!userId, 
      hasToken: !!token, 
      title, 
      body: body.substring(0, 50),
      data: data || {} 
    });

    // We only deal with **FCM** tokens now. The column in `profiles`
    // still happens to be named `fcm_token`, but it stores the
    // raw FCM registration token string.
    let fcmToken = token;

    // If only a userId is provided, look up that user's stored FCM token
    if (userId && !token) {
      console.log(`🔍 Looking up FCM token for user: ${userId}`);
      const supabaseResponse = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=fcm_token`,
        {
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        }
      );

      const profiles = await supabaseResponse.json();
      console.log(`✅ Database query successful. Profiles found: ${profiles?.length || 0}`);
      
      if (profiles.length > 0 && profiles[0].fcm_token) {
        // This value is an FCM registration token, not an Expo token
        fcmToken = profiles[0].fcm_token as string;
        console.log(`✅ Found FCM token: ${fcmToken.substring(0, 20)}...`);
      } else {
        console.error(`❌ No FCM token found for user ${userId}`);
        return new Response(
          JSON.stringify({ error: "User not found or has no FCM token" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!fcmToken) {
      console.error("❌ Missing FCM token in request");
      return new Response(JSON.stringify({ error: "Missing FCM token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("🔐 Authenticating with Firebase...");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT environment variable not set");
      throw new Error("Missing FIREBASE_SERVICE_ACCOUNT secret");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    console.log(`✅ Service account loaded for project: ${serviceAccount.project_id}`);

    // Create JWT for Firebase authentication
    console.log("🔑 Creating JWT...");
    const jwt = await createJWT(serviceAccount);
    console.log("✅ JWT created, exchanging for access token...");

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("❌ Failed to get access token:", error);
      throw new Error(`Failed to authenticate with Firebase: ${error}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log("✅ Access token obtained");

    const projectId = serviceAccount.project_id;
    console.log(`🚀 Preparing to send FCM notification to project: ${projectId}`);

    // 🆕 GAME-SPECIFIC METADATA WITH ANDROID CONFIG
    // Include both notification AND data so it works in all app states:
    // - Foreground: onMessage handler
    // - Background: onNotificationOpenedApp handler
    // - Killed/Closed: System tray shows notification, onNotificationOpenedApp when tapped
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
        // Android-specific config for heads-up display and guaranteed delivery
        android: {
          priority: "high",
          ttl: "86400s",
          direct_boot_ok: true,
          notification: {
            sound: "default",
            channel_id: "golf-companion-alerts",
            color: "#609966",
            icon: "ic_launcher",
            tag: "golf_companion_notification",
            priority: "PRIORITY_MAX", // correct enum for FCM v1 AndroidNotification
            visibility: "PUBLIC",
            default_sound: true,
            default_vibrate_timings: true,
            default_light_settings: true,
          },
        },
      },
    };

    console.log("📤 Sending FCM message:", {
      recipient: fcmToken.substring(0, 20) + "...",
      title,
      body: body.substring(0, 50) + (body.length > 50 ? "..." : ""),
      dataKeys: Object.keys(data || {})
    });

    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    if (!fcmResponse.ok) {
      const errorData = await fcmResponse.text();
      console.error("❌ FCM API error:", errorData);
      throw new Error(`FCM API error: ${errorData}`);
    }

    const fcmResult = await fcmResponse.json();

    console.log("✅ Push notification sent:", {
      messageId: fcmResult.name,
      title,
      recipientToken: fcmToken.substring(0, 20) + "...",
      gameId: data?.gameId || "N/A",
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: fcmResult.name,
        token: fcmToken.substring(0, 20) + "...",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("❌ Error sending notification:");
    console.error("   Message:", err.message);
    console.error("   Stack:", err.stack);
    if (err.response) {
      console.error("   Response status:", err.response.status);
      console.error("   Response data:", err.response.data);
    }
    return new Response(JSON.stringify({ 
      error: err.message,
      details: err.response?.data || null
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});