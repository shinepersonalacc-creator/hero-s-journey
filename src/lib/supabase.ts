import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bfvhkjzzjexzyazmlbqp.supabase.co";

const supabaseAnonKey = "sb_publishable_eZM3vicW6IO8ABiVixfOHw_yW22ZSIO";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
