import puppeteer from "puppeteer-core";
import path from "node:path";
import fs from "node:fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = path.resolve("design/screenshots");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const testEmail = `auth_test_${Date.now()}@example.com`;
  try {
    const page = await browser.newPage();

    // Test 1: Redirect from /d/test-doc-123 to /login?next=%2Fd%2Ftest-doc-123
    console.log("Navigating to /d/test-doc-123 while logged out...");
    await page.goto("http://localhost:5173/d/test-doc-123", { waitUntil: "networkidle0" });
    const currentUrl = page.url();
    console.log("Current URL after redirect:", currentUrl);
    if (!currentUrl.includes("/login?next=%2Fd%2Ftest-doc-123")) {
      throw new Error(`Expected redirect to /login?next=%2Fd%2Ftest-doc-123, but got ${currentUrl}`);
    }
    console.log("Verified: /d/:id redirects to /login?next= correctly!");

  // Screenshot Login at 1440x900
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/login", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const login1440 = path.join(outDir, "login-1440x900.png");
  await page.screenshot({ path: login1440 });
  console.log("Saved:", login1440);

  // Screenshot Login at 390x844
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const login390 = path.join(outDir, "login-390x844.png");
  await page.screenshot({ path: login390 });
  console.log("Saved:", login390);

  // Screenshot Register at 1440x900
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const register1440 = path.join(outDir, "register-1440x900.png");
  await page.screenshot({ path: register1440 });
  console.log("Saved:", register1440);

  // Screenshot Register at 390x844
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const register390 = path.join(outDir, "register-390x844.png");
  await page.screenshot({ path: register390 });
  console.log("Saved:", register390);

  // Test 2: Register user and verify login redirect lands on /d/test-doc-123
  console.log("Testing login redirect back to /d/test-doc-123...");
  const testEmail = `test_ui_${Date.now()}@example.com`;
  await page.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
  await page.type("input[type='text']", "UI Tester");
  await page.type("input[type='email']", testEmail);
  await page.type("input[type='password']", "password123");
  await page.click("button[type='submit']");
  await page.waitForNavigation({ waitUntil: "networkidle0" });

  // Now logout via POST /api/auth/logout
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));

  // Go to /d/my-doc-target
  await page.goto("http://localhost:5173/d/my-doc-target", { waitUntil: "networkidle0" });
  console.log("Redirected to:", page.url());

  // Fill in login
  await page.type("input[type='email']", testEmail);
  await page.type("input[type='password']", "password123");
  await page.click("button[type='submit']");
  await page.waitForNavigation({ waitUntil: "networkidle0" });

  const finalUrl = page.url();
  console.log("Final URL after login:", finalUrl);
  if (!finalUrl.includes("/d/my-doc-target")) {
    throw new Error(`Expected login to return to /d/my-doc-target, but got ${finalUrl}`);
  }
  console.log("Verified: login from /d/my-doc-target lands back on /d/my-doc-target!");

  } finally {
    await browser.close();
    // Clean up test user so dev database remains completely unpolluted
    try {
      const { default: pg } = await import("pg");
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL || "postgresql://collabspace:collabspace_dev@localhost:5432/collabspace",
      });
      await client.connect();
      await client.query("DELETE FROM users WHERE email = $1", [testEmail]);
      await client.end();
      console.log("Cleaned up test user from dev database:", testEmail);
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
  }
  console.log("All auth screen tests and screenshots completed successfully.");
}

run().catch((err) => {
  console.error("Error in screenshotAuth:", err);
  process.exit(1);
});
