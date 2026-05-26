// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
process.env.WRANGLER_WRITE_LOGS ??= "false";

const { defineConfig } = await import("@lovable.dev/vite-tanstack-config");
const plugins: any[] = [];
const isVercelBuild = process.env.VERCEL === "1";

if (isVercelBuild) {
  const { nitro } = await import("nitro/vite");
  plugins.push(nitro({ preset: "vercel" }));
}

export default defineConfig({
  cloudflare: false,
  plugins,
  tanstackStart: {
    start: { entry: "app/start" },
    server: { entry: "app/server" },
    router: { entry: "app/router" },
  },
});
