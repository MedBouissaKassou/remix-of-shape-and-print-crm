import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateUserCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        username: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
        password: z.string().trim().min(1).max(200).optional(),
      })
      .refine((d) => d.username || d.password, { message: "Aucun changement" })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper, error: rerr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (rerr) throw new Error(rerr.message);
    if (!isSuper) throw new Error("Accès refusé : Super Admin requis");

    const { error } = await (supabase as any).rpc("update_user_credentials", {
      target_user_id: data.userId,
      new_username: data.username ? data.username.toLowerCase() : null,
      new_password: data.password ? data.password.trim() : null,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });