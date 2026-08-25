import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const schema = read("prisma/schema.prisma");

function model(name: string): string {
  const m = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!m) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

function migrationSql(): string {
  const dir = path.join(ROOT, "prisma/migrations");
  return fs.readdirSync(dir)
    .filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
    .map((d) => {
      const f = path.join(dir, d, "migration.sql");
      return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
    })
    .join("\n");
}

describe("Auth.js adapter contract", () => {
  it("User has emailVerified, which the adapter writes on every sign-up", () => {
    expect(model("User")).toMatch(/emailVerified\s+DateTime\?/);
  });

  it("a migration creates the emailVerified column", () => {
    expect(migrationSql()).toMatch(/ALTER TABLE "User" ADD COLUMN "emailVerified"/);
  });

  it("the generated Prisma client accepts emailVerified on create", () => {
    const generated = read("src/generated/prisma/models/User.ts");
    expect(generated).toContain("emailVerified");
  });

  it("upstream still passes emailVerified to createUser, so this column is still required", () => {
    const handleLogin = read("node_modules/@auth/core/lib/actions/callback/handle-login.js");
    expect(handleLogin).toMatch(/createUser\(\{\s*\.\.\.profile,\s*emailVerified/);
  });

  it("the adapter keeps only undefined out of the create payload, so null still reaches Prisma", () => {
    const adapter = read("node_modules/@auth/prisma-adapter/index.js");
    expect(adapter).toContain("createUser: ({ id, ...data }) => p.user.create(stripUndefined(data))");
    expect(adapter).toMatch(/if \(obj\[key\] !== undefined\)/);
  });

  it("Account covers every field Auth.js stores for an OAuth account", () => {
    const account = model("Account");
    for (const field of [
      "userId", "type", "provider", "providerAccountId",
      "refresh_token", "access_token", "expires_at",
      "token_type", "scope", "id_token", "session_state",
    ]) {
      expect(account).toContain(field);
    }
  });

  it("Session and VerificationToken cover what the adapter writes", () => {
    const session = model("Session");
    for (const field of ["sessionToken", "userId", "expires"]) {
      expect(session).toContain(field);
    }
    const vt = model("VerificationToken");
    for (const field of ["identifier", "token", "expires"]) {
      expect(vt).toContain(field);
    }
  });
});
