import { supabase } from "@/lib/supabase";
import { levelInfo } from "@/lib/storage";

type Profile = {
  id: string;
  xp: number;
  level: number;
};

export function getDisplayNameFromMetadata(metadata?: Record<string, unknown> | null) {
  const preferredName = metadata?.preferred_name;
  if (typeof preferredName === "string" && preferredName.trim()) return preferredName.trim();

  const fullName = metadata?.full_name ?? metadata?.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  return "";
}

export async function ensureUserProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id, xp, level")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (selectError) {
    console.error("Could not load profile:", selectError.message);
    return null;
  }

  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, xp: 0, level: 1 })
    .select("id, xp, level")
    .single<Profile>();

  if (insertError) {
    console.error("Could not create profile:", insertError.message);
    return null;
  }

  return created;
}

export async function loadUserXP() {
  const profile = await ensureUserProfile();

  if (!profile) return null;

  return {
    xp: profile.xp ?? 0,
    level: profile.level ?? 1,
  };
}

export async function loadPreferredDisplayName() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "";

  return getDisplayNameFromMetadata(user.user_metadata);
}

export async function savePreferredDisplayName(name: string) {
  const displayName = name.trim();
  if (!displayName) throw new Error("Enter what you want us to call you.");

  const { data, error } = await supabase.auth.updateUser({
    data: {
      preferred_name: displayName,
      name: displayName,
      full_name: displayName,
    },
  });

  if (error) throw error;

  return getDisplayNameFromMetadata(data.user.user_metadata);
}

export async function saveUserXP(xp: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const safeXP = Math.max(0, Math.round(xp));
  const { level } = levelInfo(safeXP);

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, xp: safeXP, level }, { onConflict: "id" })
    .select("id, xp, level")
    .single<Profile>();

  if (error) {
    console.error("Could not save XP:", error.message);
    return null;
  }

  return data;
}

export async function addUserXP(amount: number) {
  const profile = await ensureUserProfile();

  if (!profile) return null;

  return saveUserXP((profile.xp ?? 0) + amount);
}
