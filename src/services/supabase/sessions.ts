import { supabase } from "@/services/supabase/supabase";

// Action helpers: the frontend requests these operations, but all authority checks
// should be enforced by Supabase RLS and backend/database validation.
export type SharedSession = {
  id: string;
  name: string;
  created_by: string;
  created_at?: string;
};

export type SessionTask = {
  id: string;
  session_id: string;
  user_id: string;
  title: string;
  points: number;
  completed: boolean;
  rewardable?: boolean;
  created_at?: string;
};

type CompletedSessionTaskResponse = SessionTask & {
  awarded_xp: number;
  profile_xp: number;
  profile_level: number;
};

export async function createSharedSession(name: string) {
  const sessionName = name.trim();

  if (!sessionName) throw new Error("Enter a session name first.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Please sign in with Google before creating a session.");

  const { data, error } = await supabase.rpc("create_shared_session_secure", {
    session_name: sessionName,
  });

  if (error) throw error;

  return data as SharedSession;
}

export async function loadSharedSession(id: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, name, created_by, created_at")
    .eq("id", id)
    .single<SharedSession>();

  if (error) throw error;

  return data;
}

export async function loadMySessionTasks(sessionId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("session_tasks")
    .select("id, session_id, user_id, title, points, completed, rewardable, created_at")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<SessionTask[]>();

  if (error) throw error;

  return data ?? [];
}

export async function addSessionTask(sessionId: string, title: string, points: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Please sign in with Google before adding a task.");

  const safeTitle = title.trim();
  const safePoints = Math.max(1, Math.min(10, Math.round(points)));
  if (!safeTitle) throw new Error("Enter a task title first.");

  const { data, error } = await supabase
    .from("session_tasks")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      title: safeTitle,
      points: safePoints,
      completed: false,
    })
    .select("id, session_id, user_id, title, points, completed, rewardable, created_at")
    .single<SessionTask>();

  if (error) throw error;

  return data;
}

export async function toggleSessionTask(taskId: string) {
  const { data, error } = await supabase.functions.invoke<{
    task?: CompletedSessionTaskResponse;
    error?: string;
  }>("complete-session-task", {
    body: { taskId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.task) throw new Error("Task completion failed.");

  return data.task;
}

export async function deleteSessionTask(taskId: string) {
  const { data: task, error: fetchError } = await supabase
    .from("session_tasks")
    .select("id, session_id, user_id, title, points, completed, rewardable")
    .eq("id", taskId)
    .single<SessionTask>();

  if (fetchError) throw fetchError;
  if (!task) throw new Error("Task not found.");

  const { error } = await supabase.from("session_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function endSharedSession(sessionId: string) {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

  if (error) throw error;
}
