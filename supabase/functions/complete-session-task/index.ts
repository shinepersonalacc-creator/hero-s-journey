import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SITE_ORIGIN") ?? "https://example.invalid",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

type CompleteSessionTaskBody = {
  taskId?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

function sanitizeCompletedTask(task: Record<string, unknown> | null | undefined) {
  if (!task) return null;

  return {
    id: task.id,
    sessionId: task.session_id,
    title: task.title,
    completed: task.completed,
    awardedXp: task.awarded_xp,
    profileXp: task.profile_xp,
    profileLevel: task.profile_level,
  };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorResponse("Content-Type must be application/json", 415);
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Authentication required", 401);
  }

  let body: CompleteSessionTaskBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body || Array.isArray(body) || typeof body !== "object") {
    return errorResponse("Request body must be an object", 400);
  }

  const bodyKeys = Object.keys(body);
  if (bodyKeys.length !== 1 || bodyKeys[0] !== "taskId") {
    return errorResponse("Unexpected request fields", 400);
  }

  if (typeof body.taskId !== "string" || !body.taskId.match(/^[0-9a-f-]{36}$/i)) {
    return errorResponse("Invalid task id", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse("Server is not configured", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.rpc("complete_session_task_secure", {
    task_id: body.taskId,
  });

  if (error) {
    const status = error.message.includes("Too many requests")
      ? 429
      : error.message.includes("Authentication")
        ? 401
        : error.message.includes("not found")
          ? 404
          : 400;

    return errorResponse(error.message, status);
  }

  return jsonResponse({ task: sanitizeCompletedTask(Array.isArray(data) ? data[0] : data) });
});
