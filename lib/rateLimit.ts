import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Upstash-Konfiguration aus den Env-Variablen lesen.
// Fehlen sie (z. B. noch nicht eingerichtet), wird NICHT limitiert (fail-open),
// statt die Route abstuerzen zu lassen.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

// Drei Stufen je nach Sensibilitaet/Kosten der Route:
// - strict:    teuer/missbrauchsanfaellig (E-Mail-Versand) -> wenige pro Minute
// - standard:  normale geschuetzte Routen
// - translate: wird beim Sprachwechsel STOSSWEISE (viele parallel) aufgerufen -> grosszuegig.
//              In der translate-Route zaehlt das Limit nur echte OpenAI-Aufrufe (Cache-Treffer sind frei).
const strictLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "60 s"), prefix: "rl:strict", analytics: false })
  : null;

const standardLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 s"), prefix: "rl:standard", analytics: false })
  : null;

const translateLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(600, "60 s"), prefix: "rl:translate", analytics: false })
  : null;

export type RateLimitKind = "strict" | "standard" | "translate";

// Aufrufer anhand der IP identifizieren (Vercel setzt x-forwarded-for).
export function getClientId(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim();
  return ip || request.headers.get("x-real-ip") || "anonymous";
}

// Gibt eine fertige 429-Response zurueck, wenn das Limit ueberschritten ist.
// Gibt null zurueck, wenn die Anfrage erlaubt ist ODER Upstash nicht konfiguriert ist.
export async function rateLimit(request: Request, kind: RateLimitKind = "standard"): Promise<Response | null> {
  const limiter =
    kind === "strict" ? strictLimiter : kind === "translate" ? translateLimiter : standardLimiter;

  // Nicht konfiguriert -> nicht limitieren (fail-open).
  if (!limiter) return null;

  const id = getClientId(request);

  try {
    const { success, limit, remaining, reset } = await limiter.limit(id);
    if (success) return null;

    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return Response.json(
      { error: "Zu viele Anfragen. Bitte einen Moment warten und erneut versuchen." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  } catch {
    // Wenn Redis kurz nicht erreichbar ist, lieber durchlassen als blockieren.
    return null;
  }
}
