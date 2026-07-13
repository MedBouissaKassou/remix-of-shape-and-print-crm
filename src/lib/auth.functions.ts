import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMAIL_DOMAIN = "shapeandprint.local";
const usernameToEmail = (u: string) => `${u.toLowerCase()}@${EMAIL_DOMAIN}`;

export const resolveLogin = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        username: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9._-]+$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const email = usernameToEmail(data.username);
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Identifiant inconnu");
    return { email };
  });