import { supabase } from "@/lib/supabase";
import { levelInfo } from "@/lib/storage";

type Profile = {
  id: string;
  xp: number;
  level: number;
  email?: string;
  display_name?: string;
  gender?: string | null;
};

function getSupabaseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

export function hasCompletedOnboardingFromMetadata(metadata?: Record<string, unknown> | null) {
  return metadata?.onboarding_complete === true;
}

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
    .select("id, xp, level, email, display_name, gender")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (selectError) {
    console.error("Could not load profile:", selectError.message);
    return null;
  }

  if (existing) return existing;

  const displayName =
    getDisplayNameFromMetadata(user.user_metadata) ||
    user.email?.split("@")[0] ||
    "Hero";

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      display_name: displayName,
      xp: 0,
      level: 1,
      gender: null,
    })
    .select("id, xp, level, email, display_name, gender")
    .single<Profile>();

  if (insertError) {
    console.error("Could not create profile:", insertError.message);
    return null;
  }

  return created;
}

export async function loadUserProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, xp, level, email, display_name, gender")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error) {
    console.error("Could not load profile:", error.message);
    return null;
  }

  return profile;
}

export async function loadUserXP() {
  const profile = await loadUserProfile();

  if (!profile) return null;

  return {
    xp: profile.xp ?? 0,
    level: profile.level ?? 1,
  };
}

export async function savePreferredProfile(name: string, gender: string) {
  const displayName = name.trim();
  if (!displayName) throw new Error("Enter what you want us to call you.");
  if (!gender) throw new Error("Choose your pronouns.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error("Unable to verify your authentication status.");
  }

  if (!user) {
    throw new Error("You must be signed in to save your profile.");
  }

  const { data: collision, error: collisionError } = await supabase
    .from("profiles")
    .select("id")
    .eq("display_name", displayName)
    .neq("id", user.id)
    .maybeSingle();

  if (collisionError) {
    console.error("Could not validate username uniqueness:", collisionError.message);
    throw new Error("Could not validate username availability. Try again.");
  }

  if (collision) {
    throw new Error("That name is already taken. Choose a different name.");
  }

  const { data, error } = await supabase.auth.updateUser({
    data: {
      preferred_name: displayName,
      name: displayName,
      full_name: displayName,
      gender,
    },
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Could not update your auth profile."));
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        display_name: displayName,
        gender,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (updateError) {
    console.error("Could not save profile:", updateError.message);
    throw new Error(getSupabaseErrorMessage(updateError, "Could not save your profile."));
  }

  return getDisplayNameFromMetadata(data.user.user_metadata);
}

export async function loadPreferredDisplayName() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "";

  return getDisplayNameFromMetadata(user.user_metadata);
}

export async function markOnboardingComplete() {
  const { error } = await supabase.auth.updateUser({
    data: {
      onboarding_complete: true,
    },
  });

  if (error) {
    console.error("Could not mark onboarding complete:", error.message);
  }
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: updateError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user?.id,
        display_name: displayName,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single();

  if (updateError) {
    console.error("Could not save profile:", updateError.message);
  }

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
