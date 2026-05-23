import { supabase } from "@/lib/supabase";
import { addUserXP } from "@/lib/profile";
import { uid } from "@/lib/storage";

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
  created_at?: string;
};

export async function createSharedSession(name: string) {
  const sessionName = name.trim();

  if (!sessionName) throw new Error("Enter a session name first.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Please sign in with Google before creating a session.");

  const id = uid();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ id, name: sessionName, created_by: user.id })
    .select("id, name, created_by, created_at")
    .single<SharedSession>();

  if (error) throw error;

  return data;
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
    .select("id, session_id, user_id, title, points, completed, created_at")
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

  const { data, error } = await supabase
    .from("session_tasks")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      title: title.trim(),
      points,
      completed: false,
    })
    .select("id, session_id, user_id, title, points, completed, created_at")
    .single<SessionTask>();

  if (error) throw error;

  return data;
}

export async function toggleSessionTask(task: SessionTask) {
  const completed = !task.completed;
  const { data, error } = await supabase
    .from("session_tasks")
    .update({ completed })
    .eq("id", task.id)
    .select("id, session_id, user_id, title, points, completed, created_at")
    .single<SessionTask>();

  if (error) throw error;

  await addUserXP(completed ? task.points : -task.points);

  return data;
}

export async function deleteSessionTask(task: SessionTask) {
  const { error } = await supabase.from("session_tasks").delete().eq("id", task.id);

  if (error) throw error;

  if (task.completed) await addUserXP(-task.points);
}

export async function endSharedSession(sessionId: string) {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

  if (error) throw error;
}
