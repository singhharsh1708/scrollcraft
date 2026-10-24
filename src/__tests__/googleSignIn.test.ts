import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

type Config = {
  providers: ((options?: unknown) => { id: string })[];
  callbacks: {
    jwt: (args: { token: Record<string, unknown>; account?: Record<string, unknown> | null }) => Record<string, unknown>;
    session: (args: { session: { user: Record<string, unknown> }; token: Record<string, unknown> }) => { user: Record<string, unknown> };
  };
};

const nextAuth = vi.hoisted(() => ({
  config: null as Config | null,
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: (config: Config) => {
    nextAuth.config = config;
    return { auth: nextAuth.auth, signIn: nextAuth.signIn, signOut: nextAuth.signOut, handlers: {} };
  },
}));

vi.mock("@/components/Navbar", () => ({ default: () => createElement("nav", { "aria-label": "Main" }) }));
vi.mock("@/components/SiteFooter", () => ({ default: () => createElement("footer") }));

const ENV = {
  AUTH_SECRET: "test-secret",
  AUTH_GOOGLE_ID: "google-id",
  AUTH_GOOGLE_SECRET: "google-secret",
  AUTH_GITHUB_ID: "github-id",
  AUTH_GITHUB_SECRET: "github-secret",
};

function env(set: Partial<Record<keyof typeof ENV, string>>) {
  for (const name of Object.keys(ENV) as (keyof typeof ENV)[]) vi.stubEnv(name, set[name] ?? "");
}

const GOOGLE_ONLY = { AUTH_SECRET: ENV.AUTH_SECRET, AUTH_GOOGLE_ID: ENV.AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET: ENV.AUTH_GOOGLE_SECRET };
const GITHUB_ONLY = { AUTH_SECRET: ENV.AUTH_SECRET, AUTH_GITHUB_ID: ENV.AUTH_GITHUB_ID, AUTH_GITHUB_SECRET: ENV.AUTH_GITHUB_SECRET };

let auth: typeof import("../auth");

async function load() {
  vi.resetModules();
  nextAuth.config = null;
  auth = await import("../auth");
}

beforeEach(async () => {
  vi.clearAllMocks();
  env(ENV);
  await load();
});

describe("providers come from the environment, each one optional", () => {
  it.each([
    ["nothing set", {}, []],
    ["GitHub only", GITHUB_ONLY, ["github"]],
    ["Google only", GOOGLE_ONLY, ["google"]],
    ["both", ENV, ["google", "github"]],
    ["a Google id with no secret", { ...GITHUB_ONLY, AUTH_GOOGLE_ID: "google-id" }, ["github"]],
    ["a GitHub secret with no id", { ...GOOGLE_ONLY, AUTH_GITHUB_SECRET: "github-secret" }, ["google"]],
  ])("with %s", async (_name, set, expected) => {
    env(set);
    expect(auth.configuredProviders()).toEqual(expected);
    if (expected.length) {
      await auth.authInstance();
      expect(nextAuth.config!.providers.map((p) => p().id)).toEqual(expected);
    }
  });

  it("is configured only with a secret and at least one provider", () => {
    env({});
    expect(auth.authConfigured()).toBe(false);
    env({ ...ENV, AUTH_SECRET: "" });
    expect(auth.authConfigured()).toBe(false);
    env(GITHUB_ONLY);
    expect(auth.authConfigured()).toBe(true);
    env(GOOGLE_ONLY);
    expect(auth.authConfigured()).toBe(true);
    env(ENV);
    expect(auth.authConfigured()).toBe(true);
  });

  it("names the providers this deployment offers, and none when sign-in is off", () => {
    expect(auth.providerNames()).toBe("Google or GitHub");
    env(GITHUB_ONLY);
    expect(auth.providerNames()).toBe("GitHub");
    env(GOOGLE_ONLY);
    expect(auth.providerNames()).toBe("Google");
    env({ AUTH_GOOGLE_ID: "x", AUTH_GOOGLE_SECRET: "y" });
    expect(auth.providerNames()).toBe("");
  });
});

describe("the session keeps the provider and its account number, nothing else of the person", () => {
  it("stores provider and account id, and drops the email and name", async () => {
    await auth.authInstance();
    const token = nextAuth.config!.callbacks.jwt({
      token: { name: "A Buyer", email: "buyer@gmail.com", picture: "https://lh3.googleusercontent.com/a/x", sub: "107691503500061507150" },
      account: { provider: "google", providerAccountId: "107691503500061507150" },
    });
    expect(token).toMatchObject({ provider: "google", accountId: "107691503500061507150" });
    expect(token).not.toHaveProperty("email");
    expect(token).not.toHaveProperty("name");
  });

  it("reads a session issued before Google existed as the same GitHub account", async () => {
    await auth.authInstance();
    const session = nextAuth.config!.callbacks.session({ session: { user: {} }, token: { githubId: "583231" } });
    expect(auth.identityFor(session.user.provider as string, session.user.accountId as string)).toBe("gh:583231");
  });
});

describe("an account's identity", () => {
  it("is gh:<id> for GitHub, exactly as before", async () => {
    nextAuth.auth.mockResolvedValue({ user: { provider: "github", accountId: "583231" } });
    expect(await auth.accountIdentity()).toBe("gh:583231");
  });

  it("is go:<sub> for Google", async () => {
    nextAuth.auth.mockResolvedValue({ user: { provider: "google", accountId: "107691503500061507150" } });
    expect(await auth.accountIdentity()).toBe("go:107691503500061507150");
  });

  it.each([
    ["a Google email", "google", "buyer@gmail.com"],
    ["a Google subject with letters", "google", "10769150350006150715a"],
    ["a Google subject longer than 32 digits", "google", "1".repeat(33)],
    ["a GitHub login", "github", "octocat"],
    ["an unknown provider", "facebook", "583231"],
    ["no account id", "google", ""],
  ])("is refused for %s", async (_name, provider, accountId) => {
    nextAuth.auth.mockResolvedValue({ user: { provider, accountId } });
    expect(await auth.accountIdentity()).toBeNull();
  });

  it("is null when nobody is signed in", async () => {
    nextAuth.auth.mockResolvedValue(null);
    expect(await auth.accountIdentity()).toBeNull();
  });

  it("checks a Google subject is digits", async () => {
    const { googleIdentity } = await import("../lib/credits");
    expect(googleIdentity("107691503500061507150")).toBe("go:107691503500061507150");
    for (const value of ["", "abc", " 1076", "1076 ", "-1", "1".repeat(33), "../1076"]) {
      expect(googleIdentity(value), value).toBeNull();
    }
  });
});

describe("signInWith", () => {
  let actions: typeof import("../app/signin/actions");

  beforeEach(async () => {
    actions = await import("../app/signin/actions");
  });

  it("signs in with a configured provider and comes back to the page that asked", async () => {
    await actions.signInWith("google", "/pricing");
    expect(nextAuth.signIn).toHaveBeenCalledWith("google", { redirectTo: "/pricing" });
    await actions.signInWith("github", "/describe?x=1");
    expect(nextAuth.signIn).toHaveBeenCalledWith("github", { redirectTo: "/describe?x=1" });
  });

  it.each(["facebook", "credentials", "", "Google"])("refuses the provider %j", async (provider) => {
    await actions.signInWith(provider, "/pricing");
    expect(nextAuth.signIn).not.toHaveBeenCalled();
  });

  it("refuses a provider this deployment does not offer", async () => {
    env(GITHUB_ONLY);
    await actions.signInWith("google", "/pricing");
    expect(nextAuth.signIn).not.toHaveBeenCalled();
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "pricing", "/a b"])(
    "sends an off-site return path %j home instead",
    async (next) => {
      await actions.signInWith("google", next);
      expect(nextAuth.signIn).toHaveBeenCalledWith("google", { redirectTo: "/" });
    }
  );

  it("does nothing when sign-in is not configured", async () => {
    env({});
    await actions.signInWith("google", "/pricing");
    expect(nextAuth.signIn).not.toHaveBeenCalled();
  });
});

describe("the /signin page", () => {
  async function render(next?: string) {
    const { default: SignInPage } = await import("../app/signin/page");
    return renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve(next ? { next } : {}) }));
  }

  it("lists Google first, then GitHub, under one heading", async () => {
    const html = await render("/pricing");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("<main");
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
    expect(buttons).toEqual(["Continue with Google", "Continue with GitHub"]);
  });

  it("offers only the providers this deployment has", async () => {
    env(GITHUB_ONLY);
    const html = await render();
    expect(html).toContain("Continue with GitHub");
    expect(html).not.toContain("Continue with Google");
  });

  it("offers no buttons when sign-in is off", async () => {
    env({});
    const html = await render();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).not.toContain("<button");
    expect(html).toMatch(/not offered on this deployment/);
  });
});

describe("links to /signin carry the page to come back to", () => {
  it("encodes an on-site path and drops anything else", async () => {
    const { signInHref } = await import("../app/signin/next");
    expect(signInHref("/pricing")).toBe("/signin?next=%2Fpricing");
    expect(signInHref("/")).toBe("/signin");
    expect(signInHref("/signin")).toBe("/signin");
    expect(signInHref("//evil.example")).toBe("/signin");
  });
});
