import puppeteer from "puppeteer-core";
import path from "node:path";
import fs from "node:fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = path.resolve("design/screenshots");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log("Launching Chrome at:", chromePath);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // 1440x900
  console.log("Capturing 1440x900...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173/_kit", { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  const path1440 = path.join(outDir, "kit-1440x900.png");
  await page.screenshot({ path: path1440 });
  console.log("Saved:", path1440);

  const path1440Full = path.join(outDir, "kit-1440x900-full.png");
  await page.screenshot({ path: path1440Full, fullPage: true });
  console.log("Saved:", path1440Full);

  // AvatarStack focused screenshot
  const avatarSection = await page.$("#avatar-section");
  if (avatarSection) {
    const pathAvatar = path.join(outDir, "avatar-stack-fixed.png");
    await avatarSection.screenshot({ path: pathAvatar });
    console.log("Saved:", pathAvatar);
  }

  // 390x844
  console.log("Capturing 390x844...");
  await page.setViewport({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);

  const path390 = path.join(outDir, "kit-390x844.png");
  await page.screenshot({ path: path390 });
  console.log("Saved:", path390);

  const path390Full = path.join(outDir, "kit-390x844-full.png");
  await page.screenshot({ path: path390Full, fullPage: true });
  console.log("Saved:", path390Full);

  await browser.close();
  console.log("All screenshots captured successfully.");
}

run().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
