import { useState } from "react";
import { savePreferredProfile } from "@/services/supabase/profile";
import { LogoutButton } from "@/features/auth/LogoutButton";

export function DisplayNamePrompt({
  onComplete,
}: {
  onComplete: (displayName: string, gender: string) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    setSaving(true);

    try {
      const displayName = await savePreferredProfile(name, gender);
      onComplete(displayName, gender);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-dvh bg-no-repeat px-6 py-12"
      style={{
        backgroundImage: "url('/Image/swordncloud.png?v=2')",
        backgroundSize: "auto 100%",
        backgroundPosition: "top center",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col justify-center">
        <div className="rounded-3xl border-4 border-black bg-white p-6 text-black shadow-[8px_8px_0_rgba(0,0,0,0.25)]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-black">Before the fire burns low, tell your name.</h1>
              <p className="mt-3 text-base text-black/70">
                Enter your name and choose the pronouns you prefer.
              </p>
            </div>
            <LogoutButton />
          </div>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-6 h-14 w-full rounded-xl border-2 border-black bg-white px-4 text-xl font-bold outline-none"
            placeholder="Your name"
            autoFocus
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { value: "she/her", label: "She / Her" },
              { value: "he/him", label: "He / Him" },
              { value: "they/them", label: "They / Them" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGender(option.value)}
                className={`rounded-2xl border-2 px-4 py-3 text-left font-semibold transition ${
                  gender === option.value
                    ? "border-black bg-black text-white"
                    : "border-black/20 bg-white text-black hover:bg-black/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || name.trim().length < 2 || !gender}
            className="mt-6 rounded-full bg-black px-8 py-3 font-bold text-white hover:bg-black/85 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
