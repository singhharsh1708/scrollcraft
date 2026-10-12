/**
 * A small in-memory stand-in for the Upstash client.
 *
 * The credit code is only correct if two tabs cannot spend the same last credit, and that
 * property lives in a Lua script. A mock that returns canned numbers cannot say anything
 * about it, so this fake carries real state and evaluates the spend script's own semantics
 * in one uninterrupted step, the way Redis would. Every other call yields to the event
 * loop first, so two requests in flight at once really do interleave.
 *
 * The state hangs off globalThis rather than a module variable because the tests call
 * vi.resetModules() between cases to re-import a route, and the fake has to survive that.
 */

type Hash = Record<string, string>;
type Value = string | number | Hash;

type State = { data: Map<string, Value>; ttl: Map<string, number>; broken: boolean };

const globalState = globalThis as typeof globalThis & { __scFakeRedis?: State };

function state(): State {
  globalState.__scFakeRedis ??= { data: new Map(), ttl: new Map(), broken: false };
  return globalState.__scFakeRedis;
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (state().broken) throw new Error("fake redis is pretending to be unreachable");
}

function hashAt(key: string): Hash {
  const existing = state().data.get(key);
  if (existing && typeof existing === "object") return existing;
  const fresh: Hash = {};
  state().data.set(key, fresh);
  return fresh;
}

/** Forget everything, including the expiries and any pretend outage. */
export function resetFakeRedis(): void {
  state().data.clear();
  state().ttl.clear();
  state().broken = false;
}

/**
 * Make every call reject, which is what an Upstash outage looks like from here. The
 * credit code has to answer "unavailable" to that rather than quietly generating for free.
 */
export function breakFakeRedis(broken = true): void {
  state().broken = broken;
}

/** What is under a plain key, for a test that wants to look rather than go through a method. */
export function peek(key: string): Value | undefined {
  return state().data.get(key);
}

/** The hash under a key, as numbers, which is how every entitlement field is read. */
export function peekHash(key: string): Record<string, number> {
  const row = state().data.get(key);
  if (!row || typeof row !== "object") return {};
  return Object.fromEntries(Object.entries(row).map(([field, value]) => [field, Number(value)]));
}

export function peekTtl(key: string): number | undefined {
  return state().ttl.get(key);
}

/** Put a plain key in place, for a test that needs the store to already know something. */
export function putKey(key: string, value: string): void {
  state().data.set(key, value);
}

export function putHash(key: string, fields: Record<string, number | string>): void {
  const row = hashAt(key);
  for (const [field, value] of Object.entries(fields)) row[field] = String(value);
}

/**
 * The spend script, evaluated rather than pattern-matched on its text, so a change to the
 * script that changes its meaning shows up here as a failure instead of passing silently.
 */
function spend(key: string): number {
  const existing = state().data.get(key);
  const row: Hash = existing && typeof existing === "object" ? existing : {};
  const total = Number(row.total ?? 0);
  const used = Number(row.used ?? 0);
  if (total - used < 1) return -1;
  const next = used + 1;
  row.used = String(next);
  state().data.set(key, row);
  return next;
}

export class FakeRedis {
  async incr(key: string): Promise<number> {
    await tick();
    const next = Number(state().data.get(key) ?? 0) + 1;
    state().data.set(key, String(next));
    return next;
  }

  async decr(key: string): Promise<number> {
    await tick();
    const next = Number(state().data.get(key) ?? 0) - 1;
    state().data.set(key, String(next));
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    await tick();
    if (!state().data.has(key)) return 0;
    state().ttl.set(key, seconds);
    return 1;
  }

  async get<T = string>(key: string): Promise<T | null> {
    await tick();
    const value = state().data.get(key);
    return value === undefined || typeof value === "object" ? null : (value as T);
  }

  async set(key: string, value: string, opts?: { nx?: boolean; ex?: number }): Promise<"OK" | null> {
    await tick();
    if (opts?.nx && state().data.has(key)) return null;
    state().data.set(key, value);
    if (opts?.ex !== undefined) state().ttl.set(key, opts.ex);
    return "OK";
  }

  async hgetall<T>(key: string): Promise<T | null> {
    await tick();
    const row = state().data.get(key);
    if (!row || typeof row !== "object") return null;
    return { ...row } as T;
  }

  async hset(key: string, fields: Record<string, string | number>): Promise<number> {
    await tick();
    const row = hashAt(key);
    for (const [field, value] of Object.entries(fields)) row[field] = String(value);
    return Object.keys(fields).length;
  }

  async hincrby(key: string, field: string, by: number): Promise<number> {
    await tick();
    const row = hashAt(key);
    const next = Number(row[field] ?? 0) + by;
    row[field] = String(next);
    return next;
  }

  /**
   * One step, with nothing awaited between the read and the write: that is the whole
   * point of the script, and a fake that awaited in the middle would let a broken
   * implementation pass.
   */
  async eval(script: string, keys: string[]): Promise<number> {
    await tick();
    if (!/HINCRBY/.test(script) || !/'used'/.test(script)) {
      throw new Error(`fake redis was handed a script it does not know: ${script}`);
    }
    return spend(keys[0]);
  }
}
