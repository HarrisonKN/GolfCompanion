import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { GoogleAuth } from "https://esm.sh/google-auth-library@9.0.0";

serve(async (req) => {
  try {
    const { token, title, body } = await req.json();

    if (!token) {
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

    const messagePayload = {
      message: {
        token,
        notification: {
          title: title || "⛳ Golf Companion",
          body: body || "You received a new notification!",
        },
      },
    };

    const res = await client.request({
      url: `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      method: "POST",
      data: messagePayload,
    });

    console.log("✅ Push notification sent:", res.data);

    return new Response(JSON.stringify({ success: true, response: res.data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});