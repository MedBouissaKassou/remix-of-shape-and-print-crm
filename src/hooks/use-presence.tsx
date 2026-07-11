import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

const CHANNEL_NAME = "platform-presence";
type PresenceListener = (entries: PresenceEntry[]) => void;

let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
let subscribeStarted = false;
let channelReady = false;
const readyCallbacks: Array<() => void> = [];
const listeners = new Set<PresenceListener>();

// One stable session start per browser session — used to dedupe DB rows.
let sessionStart: { userId: string; onlineAt: string } | null = null;

export type PresenceEntry = {
  user_id: string;
  full_name: string;
  email: string | null;
  roles: AppRole[];
  online_at: string;
};

function getPresenceChannel() {
  if (presenceChannel) return presenceChannel;

  presenceChannel = supabase.channel(CHANNEL_NAME);
  presenceChannel
    .on("presence", { event: "sync" }, emitPresenceState)
    .on("presence", { event: "join" }, emitPresenceState)
    .on("presence", { event: "leave" }, emitPresenceState);

  return presenceChannel;
}

/**
 * Ensures the shared channel is subscribed exactly once.
 * `onReady` runs immediately if already subscribed, otherwise once SUBSCRIBED.
 */
function ensureSubscribed(onReady?: () => void) {
  const channel = getPresenceChannel();
  if (channelReady) {
    onReady?.();
    return channel;
  }
  if (onReady) readyCallbacks.push(onReady);
  if (!subscribeStarted) {
    subscribeStarted = true;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelReady = true;
        const cbs = readyCallbacks.splice(0, readyCallbacks.length);
        for (const cb of cbs) cb();
        emitPresenceState();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[presence] channel status:", status);
      } else if (status === "CLOSED") {
        // Allow a future re-subscribe attempt
        channelReady = false;
        subscribeStarted = false;
        presenceChannel = null;
      }
    });
  }
  return channel;
}

function emitPresenceState() {
  if (!presenceChannel) return;
  const state = presenceChannel.presenceState<PresenceEntry>();
  const flat: PresenceEntry[] = [];
  for (const key of Object.keys(state)) {
    for (const meta of state[key]) flat.push(meta);
  }
  for (const listener of listeners) listener(flat);
}

/**
 * Joins a global Supabase Realtime presence channel and broadcasts the current
 * user's identity + roles. Mount once inside the authenticated layout.
 */
export function PresenceTracker() {
  const { user, roles } = useAuth();
  const rolesKey = roles.join(",");

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    // Stable session start (one DB row per session thanks to upsert on
    // user_id + connected_at in record_observed_presence).
    if (!sessionStart || sessionStart.userId !== userId) {
      sessionStart = { userId, onlineAt: new Date().toISOString() };
    }
    const onlineAt = sessionStart.onlineAt;

    const touchPresence = () => {
      void supabase
        .rpc("record_observed_presence", { _user_id: userId, _online_at: onlineAt })
        .then(({ error }) => {
          if (error) console.error("[presence] failed to record connection", error);
        });
    };

    touchPresence();
    const heartbeatId = setInterval(touchPresence, 30_000);
    const onBeforeUnload = () => touchPresence();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") touchPresence();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);

    const trackCurrentUser = () => {
      const channel = getPresenceChannel();
      void channel.track({
        user_id: userId,
        full_name:
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split("@")[0] ||
          "—",
        email: user.email ?? null,
        roles,
        online_at: onlineAt,
      } satisfies PresenceEntry);
    };

    const channel = ensureSubscribed(trackCurrentUser);

    return () => {
      clearInterval(heartbeatId);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      touchPresence();
      void channel.untrack();
    };
    // Intentionally narrow deps: user object/roles array identities change on
    // every auth re-render and previously caused track/untrack thrashing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, rolesKey]);

  return null;
}

/**
 * Subscribes to the presence channel and calls `onSync` with the current
 * flattened list of present users whenever it changes.
 */
export function subscribeToPresence(onSync: (entries: PresenceEntry[]) => void) {
  listeners.add(onSync);
  ensureSubscribed();
  emitPresenceState();
  return () => {
    listeners.delete(onSync);
  };
}
