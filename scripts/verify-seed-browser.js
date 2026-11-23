import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:5173";

async function main() {
  console.log("🚀 Launching headless Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const consoleLogs = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === "error") {
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(`[PAGE ERROR] ${err.message}`);
  });

  page.on("response", (res) => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  try {
    // 1. Log in as Alice
    console.log("🔑 Logging in as alice@example.com...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type('input[type="email"]', "alice@example.com");
    await page.type('input[type="password"]', "demo-password-1");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);
    console.log("✓ Logged in successfully. Current URL:", page.url());

    // 2. Click seeded document on dashboard
    console.log("📄 Locating seeded document on dashboard...");
    await page.waitForSelector('a[href^="/d/"]');
    const docLinks = await page.$$('a[href^="/d/"]');
    let targetLink = null;
    for (const link of docLinks) {
      const text = await page.evaluate((el) => el.textContent, link);
      if (text.includes("CollabSpace Product Specification")) {
        targetLink = link;
        break;
      }
    }

    if (!targetLink) {
      throw new Error('Could not find document "CollabSpace Product Specification" on dashboard');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      targetLink.click(),
    ]);
    console.log("✓ Opened document URL:", page.url());

    // 3. Wait for editor to load and connect
    console.log("⏳ Waiting for editor and collaboration connection...");
    await page.waitForSelector('.tiptap[contenteditable="true"]', { timeout: 10000 });
    
    // Wait until save status shows "Saved"
    await page.waitForFunction(
      () => {
        const bodyText = document.body.innerText;
        return bodyText.includes("Saved");
      },
      { timeout: 10000 }
    );

    // Helper to extract structure
    async function getEditorContent() {
      return page.evaluate(() => {
        const editor = document.querySelector('.tiptap[contenteditable="true"]');
        if (!editor) return null;

        const h1s = Array.from(editor.querySelectorAll("h1")).map((el) => el.textContent.trim());
        const h2s = Array.from(editor.querySelectorAll("h2")).map((el) => el.textContent.trim());
        const paragraphs = Array.from(editor.querySelectorAll("p")).map((el) => el.textContent.trim());
        const bullets = Array.from(editor.querySelectorAll("ul > li")).map((el) => el.textContent.trim());

        return {
          h1Count: h1s.length,
          h1s,
          h2Count: h2s.length,
          h2s,
          paragraphCount: paragraphs.length,
          paragraphs,
          bulletCount: bullets.length,
          bullets,
          fullText: editor.innerText.trim(),
        };
      });
    }

    console.log("\n--- Initial Load Extraction ---");
    const initial = await getEditorContent();
    console.log("H1 Headings (" + initial.h1Count + "):", initial.h1s);
    console.log("H2 Headings (" + initial.h2Count + "):", initial.h2s);
    console.log("Paragraphs (" + initial.paragraphCount + "):", initial.paragraphs);
    console.log("Bullet Items (" + initial.bulletCount + "):", initial.bullets);

    // 4. Reload 3 times and verify content does not duplicate
    for (let i = 1; i <= 3; i++) {
      console.log(`\n🔄 Performing Reload ${i}/3...`);
      await page.reload({ waitUntil: "networkidle0" });
      await page.waitForSelector('.tiptap[contenteditable="true"]');
      await page.waitForFunction(
        () => document.body.innerText.includes("Saved"),
        { timeout: 10000 }
      );

      const content = await getEditorContent();
      console.log(`✓ Reload ${i} Content Structure:`);
      console.log(`  - H1 count: ${content.h1Count} (expected: 1)`);
      console.log(`  - H2 count: ${content.h2Count} (expected: 1)`);
      console.log(`  - Bullet count: ${content.bulletCount} (expected: 4)`);

      if (content.h1Count !== initial.h1Count || content.bulletCount !== initial.bulletCount) {
        throw new Error(`Content duplicated on reload ${i}! H1 count: ${content.h1Count}, Bullet count: ${content.bulletCount}`);
      }
    }

    console.log("\n✅ Verified: No content duplication across 3 consecutive reloads!");

    console.log("\n--- Browser Console Errors ---");
    if (consoleErrors.length === 0) {
      console.log("✓ Zero browser console errors recorded during session!");
    } else {
      console.log("Console errors found:", consoleErrors);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
