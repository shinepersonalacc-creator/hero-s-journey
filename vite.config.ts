// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
process.env.WRANGLER_WRITE_LOGS ??= "false";

const { defineConfig } = await import("@lovable.dev/vite-tanstack-config");
const isVercelBuild = process.env.VERCEL === "1";
const plugins = [];

if (isVercelBuild) {
  const { nitro } = await import("nitro/vite");
  plugins.push(nitro({ preset: "vercel" }));
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  cloudflare: isVercelBuild ? false : undefined,
  plugins,
  tanstackStart: {
    server: { entry: "server" },
  },
});
