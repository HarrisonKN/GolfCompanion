import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { token, title, body, data } = await req.json();

  const serverKey = Deno.env.get("FCM_SERVER_KEY");
  if (!serverKey) {
    return new Response("Missing FCM server key", { status: 500 });
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: token,
      notification: {
        title,
        body,
      },
      data: data || {},
    }),
  });

  const result = await response.json();

  return new Response(JSON.stringify({ success: true, result }), {
    headers: { "Content-Type": "application/json" },
  });
});