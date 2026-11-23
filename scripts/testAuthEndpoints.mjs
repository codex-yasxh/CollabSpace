const BASE_URL = "http://localhost:5173/api/auth";

async function run() {
  const email = `auth_test_${Date.now()}@example.com`;
  console.log("=== 1. Register Success (201) ===");
  const regRes = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Aditya Auth",
      email: `  ${email}  `,
      password: "strongpassword123",
    }),
  });
  console.log("Status:", regRes.status);
  const cookie = regRes.headers.get("set-cookie");
  console.log("Set-Cookie present:", !!cookie);
  const regData = await regRes.json();
  console.log("Body:", JSON.stringify(regData));

  console.log("\n=== 2. Duplicate Email (409) ===");
  const dupRes = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Aditya Dup",
      email: email.toUpperCase(),
      password: "strongpassword123",
    }),
  });
  console.log("Status:", dupRes.status);
  console.log("Body:", await dupRes.text());

  console.log("\n=== 3. Bad Input (400) ===");
  const badRes = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "",
      email: "not-an-email",
      password: "short",
    }),
  });
  console.log("Status:", badRes.status);
  console.log("Body:", await badRes.text());

  console.log("\n=== 4. Login Wrong Password (401) ===");
  const wrongPassRes = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "incorrect_password",
    }),
  });
  console.log("Status:", wrongPassRes.status);
  console.log("Body:", await wrongPassRes.text());

  console.log("\n=== 5. Login Unknown Email (401, identical error) ===");
  const unknownRes = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nobody_exists_here@example.com",
      password: "some_password",
    }),
  });
  console.log("Status:", unknownRes.status);
  console.log("Body:", await unknownRes.text());

  console.log("\n=== 6. /me With Cookie (200) ===");
  const meRes = await fetch(`${BASE_URL}/me`, {
    headers: { Cookie: cookie },
  });
  console.log("Status:", meRes.status);
  console.log("Body:", await meRes.text());

  console.log("\n=== 7. /me Without Cookie (401) ===");
  const meNoCookieRes = await fetch(`${BASE_URL}/me`);
  console.log("Status:", meNoCookieRes.status);
  console.log("Body:", await meNoCookieRes.text());

  console.log("\n=== 8. Logout (200) ===");
  const logoutRes = await fetch(`${BASE_URL}/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  console.log("Status:", logoutRes.status);
  console.log("Clear-Cookie:", logoutRes.headers.get("set-cookie"));
  console.log("Body:", await logoutRes.text());
}

run().catch((err) => {
  console.error("Auth test error:", err);
  process.exit(1);
});
