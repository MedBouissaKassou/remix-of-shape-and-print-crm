import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";

// Netlify / Node < 22 runtimes lack a global WebSocket; supabase-js Realtime
// throws at construction time without one. Polyfill via `ws` before any
// server-side supabase client is created. Guarded so it's a no-op in the
// browser (which has a native WebSocket) and on Cloudflare Workers.
if (typeof window === "undefined" && typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const ws = require("ws");
    (globalThis as { WebSocket?: unknown }).WebSocket = ws.WebSocket ?? ws;
  } catch {
    // ignore — runtime has no `ws` and no native WebSocket; realtime will be unavailable.
  }
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
