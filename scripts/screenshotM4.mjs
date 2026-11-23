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

  const page = await browser.newPage();

  // Register an authenticated user
  const email = `m4_user_${Date.now()}@example.com`;
  console.log("Registering user:", email);
  await page.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
  await page.type("input[type='text']", "Aditya Sharma");
  await page.type("input[type='email']", email);
  await page.type("input[type='password']", "password123");
  await page.click("button[type='submit']");
  await page.waitForNavigation({ waitUntil: "networkidle0" });

  // 1. Capture Share Dialog (Owner View)
  console.log("Capturing Share dialog (Owner view)...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/d/preview-doc-1?dialog=share-owner", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "share-dialog-owner-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "share-dialog-owner-390x844.png") });

  // 2. Capture Share Dialog (Viewer View)
  console.log("Capturing Share dialog (Viewer view)...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/d/preview-doc-1?dialog=share-viewer", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "share-dialog-viewer-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "share-dialog-viewer-390x844.png") });

  // 3. Capture No-Access Screen
  console.log("Capturing No-access screen...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/d/preview-doc-1?state=no-access", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, "no-access-1440x900.png") });

  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: path.join(outDir, "no-access-390x844.png") });

  await browser.close();
  console.log("All M4 screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
