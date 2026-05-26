import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/services/supabase/supabase";

export function LogoutButton({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      onLoggedOut?.();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
      void router.navigate({ to: "/" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2 font-bold text-black hover:bg-black/5 disabled:opacity-50"
    >
      <LogOut className="size-4" />
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
