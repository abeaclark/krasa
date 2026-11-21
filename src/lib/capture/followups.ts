import { brandFor, unsubscribeUrl, type Brand } from "@/lib/email/brands";
import { shell, textFooter } from "@/lib/email/kit";
import { activeCampaigns, campaignEdition, CAMPAIGNS, type Campaign } from "./campaigns";
import { LATE_HOURS, SEQUENCES, stepInput, type Built, type SequenceStep } from "./sequences";
import type { SendFn } from "./service";
import type { CaptureStore, SubscriberRow } from "./store";

/**
 * The follow-up cron's work: due sequence steps first, then any campaign in
 * its send window. Storage and sending are injected (tests use the in-memory
 * store and a fake sender).
 *
 * Each email is claimed in capture_sends before it is sent and released if
 * the send fails, so overlapping runs never double-send and a failed send is
 * retried next run. `skipped` (the builder returned null, e.g. they already
 * bought the book) is recorded so it isn't reconsidered every hour.
 *
 * Throttled to stay under Resend's default 2 requests/second, and bounded by
 * a time budget so a run always finishes inside the function's limit; what's
 * left goes out on the next run.
 */

export interface RunOptions {
  budgetMs?: number;
  /** Pause between sends (ms). */
  gapMs?: number;
  /** Most recipients fetched per step / campaign per run. */
  batch?: number;
  sequences?: Record<string, SequenceStep[]>;
  campaigns?: Campaign[];
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}

export interface RunSummary {
  sent: Record<string, number>;
  skipped: Record<string, number>;
  failed: Record<string, number>;
  outOfTime: boolean;
}

const HOUR = 3_600_000;

export function wrap(brand: Brand, sub: SubscriberRow, built: Built) {
  const unsub = unsubscribeUrl(brand, sub.token);
  return {
    subject: built.subject,
    html: shell(brand, { preheader: built.preheader, bodyHtml: built.html, unsub }),
    text: built.text.join("\n") + textFooter(brand, unsub),
    unsubscribeUrl: unsub,
  };
}

export async function runFollowups(
  store: CaptureStore,
  send: SendFn,
  now: Date = new Date(),
  o: RunOptions = {},
): Promise<RunSummary> {
  const clock = o.clock ?? Date.now;
  const started = clock();
  const budget = o.budgetMs ?? 240_000;
  const gap = o.gapMs ?? 550;
  const batch = o.batch ?? 200;
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const sum: RunSummary = { sent: {}, skipped: {}, failed: {}, outOfTime: false };
  const bump = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);
  const mailedThisRun = new Set<string>();
  let first = true;

  /** Claim, build, send, record. Returns false when the run is out of time. */
  async function deliver(sub: SubscriberRow, key: string, brand: Brand, build: () => Built | null): Promise<boolean> {
    if (clock() - started > budget) {
      sum.outOfTime = true;
      return false;
    }
    if (!(await store.claimSend(sub.id, key))) return true;
    let built: Built | null;
    try {
      built = build();
    } catch (err) {
      console.error("[capture/followups] build failed", key, sub.id, err);
      await store.releaseSend(sub.id, key);
      bump(sum.failed, key);
      return true;
    }
    if (!built) {
      await store.finishSend(sub.id, key, "skipped");
      bump(sum.skipped, key);
      return true;
    }
    if (!first) await sleep(gap);
    first = false;
    const mail = wrap(brand, sub, built);
    const res = await send({ brand, to: sub.email, ...mail });
    if (res.ok) {
      await store.finishSend(sub.id, key, res.id ?? null);
      mailedThisRun.add(sub.id);
      bump(sum.sent, key);
    } else {
      await store.releaseSend(sub.id, key);
      bump(sum.failed, key);
      if (res.skipped) return false; // no API key for this brand: stop, nothing will work
    }
    return true;
  }

  // 1. Sequence steps that are due (and not too late).
  for (const [site, steps] of Object.entries(o.sequences ?? SEQUENCES)) {
    const brand = brandFor(site);
    if (!brand) continue;
    for (const step of steps) {
      const key = `seq:${step.key}`;
      const due = new Date(now.getTime() - step.afterHours * HOUR);
      const subs = await store.recipients({
        site,
        createdFrom: new Date(due.getTime() - LATE_HOURS * HOUR),
        createdTo: due,
        withoutKey: key,
        requireContext: true,
        limit: batch,
      });
      for (const sub of subs) {
        if (mailedThisRun.has(sub.id)) continue; // at most one email per person per run
        const paid = await store.paidBookIds(sub.email);
        const ok = await deliver(sub, key, brand, () => {
          const input = stepInput(brand, sub, paid);
          return input ? step.build(input) : null;
        });
        if (!ok) return sum;
      }
    }
  }

  // 2. Campaigns in their send window.
  for (const c of activeCampaigns(now, o.campaigns ?? CAMPAIGNS)) {
    const brand = brandFor(c.site);
    if (!brand) continue;
    const key = `camp:${c.id}`;
    const subs = await store.recipients({ site: c.site, createdTo: c.sendAt, withoutKey: key, limit: batch });
    for (const sub of subs) {
      if (mailedThisRun.has(sub.id)) continue;
      const paid = await store.paidBookIds(sub.email);
      const ok = await deliver(sub, key, brand, () =>
        c.build({ brand, sub, edition: campaignEdition(brand, sub, paid), paid }),
      );
      if (!ok) return sum;
    }
  }
  return sum;
}
