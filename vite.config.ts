import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlifyTanstackStart from "@netlify/vite-plugin-tanstack-start";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Disable the built-in Nitro adapter so the Netlify adapter can take over.
  // Lovable's sandbox preview still works because it uses its own dev-server bridge.
  nitro: false,
  plugins: [netlifyTanstackStart()],
});
