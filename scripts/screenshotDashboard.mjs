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

  const email = `dash_user_${Date.now()}@example.com`;
  try {
    const page = await browser.newPage();

    // 1. Register a dedicated dashboard user
    console.log("Registering user:", email);
    await page.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
    await page.type("input[type='text']", "Aditya Sharma");
    await page.type("input[type='email']", email);
    await page.type("input[type='password']", "password123");
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0" });

  // 2. Empty Dashboard Screenshot
  console.log("Capturing Empty dashboard...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/?state=empty", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-empty-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-empty-390x844.png") });

  // 3. Loading Dashboard Screenshot
  console.log("Capturing Loading dashboard...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/?state=loading", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-loading-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-loading-390x844.png") });

  // 4. Error Dashboard Screenshot
  console.log("Capturing Error dashboard...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/?state=error", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-error-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-error-390x844.png") });

  // 5. Create 5 documents via API
  console.log("Creating 5 documents...");
  const docTitles = [
    "Project report draft",
    "Viva notes",
    "Architecture RFC",
    "Sprint roadmap",
    "Meeting notes with examiners",
  ];

  for (const title of docTitles) {
    await page.evaluate(async (t) => {
      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
    }, title);
  }

  // 6. 5-Rows Dashboard Screenshot
  console.log("Capturing 5-rows dashboard...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-5rows-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, "dashboard-5rows-390x844.png") });

  } finally {
    await browser.close();
    // Clean up test user so dev database remains completely unpolluted
    try {
      const { default: pg } = await import("pg");
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL || "postgresql://collabspace:collabspace_dev@localhost:5432/collabspace",
      });
      await client.connect();
      await client.query("DELETE FROM users WHERE email = $1", [email]);
      await client.end();
      console.log("Cleaned up test user from dev database:", email);
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
  }
  console.log("All dashboard screenshots captured successfully.");
}

run().catch((err) => {
  console.error("Dashboard screenshot error:", err);
  process.exit(1);
});
