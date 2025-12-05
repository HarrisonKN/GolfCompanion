// supabase/functions/initializeUserToken/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      } 
    });
  }

  try {
    const { userId, deviceToken } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!deviceToken) {
      return new Response(
        JSON.stringify({ error: "Missing deviceToken" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`📝 Initializing push token for user: ${userId}`);
    console.log(`📱 Device token: ${deviceToken.substring(0, 20)}...`);

    // Save the token to profiles table
    const response = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          apikey: supabaseServiceKey!,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fcm_token: deviceToken,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Failed to save token:`, errorData);
      return new Response(
        JSON.stringify({ error: "Failed to save token", details: errorData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Push token initialized successfully for user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Token initialized",
        userId: userId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ Error in initializeUserToken function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});