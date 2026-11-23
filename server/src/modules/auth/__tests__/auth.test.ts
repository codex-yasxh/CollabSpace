import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../app.js";
import { pool, closePool } from "../../../database/db.js";
import { AUTH_COOKIE_NAME } from "../authService.js";

const app = createApp();

describe("Auth Endpoints & Middleware (Vitest + Supertest)", () => {
  const testUser = {
    name: "Auth Test User",
    email: `test_auth_${Date.now()}@example.com`,
    password: "Password123!",
  };

  let authCookie: string;

  beforeAll(async () => {
    // Clean test database users table
    await pool.query("DELETE FROM users");
  });

  afterAll(async () => {
    await closePool();
  });

  describe("POST /api/auth/register", () => {
    it("successfully registers a new user, sets httpOnly cookie, and omits password_hash & JWT from body", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.name).toBe(testUser.name);
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.token).toBeUndefined();

      const rawCookies = res.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies) ? rawCookies : typeof rawCookies === "string" ? [rawCookies] : [];
      expect(cookies.length).toBeGreaterThan(0);
      const tokenCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain("HttpOnly");

      authCookie = tokenCookie!.split(";")[0]!;
    });

    it("rejects duplicate email with 409 conflict and exact message", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Duplicate User",
          email: testUser.email.toUpperCase(),
          password: "AnotherPassword123",
        })
        .expect(409);

      expect(res.body.error).toEqual({
        code: "CONFLICT",
        message: "An account already exists with that email.",
      });
    });

    it("rejects invalid inputs with 400 validation error", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "",
          email: "invalid-email",
          password: "short",
        })
        .expect(400);

      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/login", () => {
    it("successfully logs in and sets auth cookie", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.token).toBeUndefined();

      const rawCookies = res.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies) ? rawCookies : typeof rawCookies === "string" ? [rawCookies] : [];
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`))).toBe(true);
    });

    it("returns 401 with exact message on wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword",
        })
        .expect(401);

      expect(res.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Email or password is incorrect.",
      });
    });

    it("returns 401 with IDENTICAL message on unknown email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "unknown_person@example.com",
          password: "somepassword",
        })
        .expect(401);

      expect(res.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Email or password is incorrect.",
      });
    });
  });

  describe("GET /api/auth/me (requireAuth middleware)", () => {
    it("returns 200 and user info when valid auth cookie is provided", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [authCookie])
        .expect(200);

      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it("returns 401 unauthorized when cookie is missing", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .expect(401);

      expect(res.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    });

    it("returns 401 unauthorized when cookie contains malformed token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [`${AUTH_COOKIE_NAME}=bad_token_value`])
        .expect(401);

      expect(res.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      });
    });
  });

  describe("POST /api/auth/logout", () => {
    it("returns 200 and clears the auth cookie", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [authCookie])
        .expect(200);

      expect(res.body).toEqual({ ok: true });
      const rawCookies = res.headers["set-cookie"];
      const cookies = Array.isArray(rawCookies) ? rawCookies : typeof rawCookies === "string" ? [rawCookies] : [];
      expect(cookies.some((c) => c.includes(`${AUTH_COOKIE_NAME}=;`))).toBe(true);
    });
  });
});
