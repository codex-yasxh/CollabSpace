import puppeteer from "puppeteer-core";
import path from "node:path";
import fs from "node:fs";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outDir = path.resolve("design/screenshots");
const artifactDir = "C:\\Users\\ACER\\.gemini\\antigravity\\brain\\b4ce02e5-b1d6-40fd-92d0-4103c252d163";

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const timestamp = Date.now();
  const aliceEmail = `m6_alice_${timestamp}@collabspace.dev`;
  const bobEmail = `m6_bob_${timestamp}@collabspace.dev`;
  const carolEmail = `m6_carol_${timestamp}@collabspace.dev`;
  let testDocId = null;

  try {
    // ----------------------------------------------------
    // Context 1: Alice (Owner)
    // ----------------------------------------------------
    console.log("1. Setting up Alice (Owner)...");
    const alicePage = (await browser.pages())[0];
    alicePage.on("console", (msg) => console.log("[Alice console]:", msg.text()));
    alicePage.on("pageerror", (err) => console.log("[Alice error]:", err));
    await alicePage.setViewport({ width: 1440, height: 900 });

    await alicePage.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
    await alicePage.type("input[type='text']", "Alice Chen");
    await alicePage.type("input[type='email']", aliceEmail);
    await alicePage.type("input[type='password']", "password123");
    await alicePage.click("button[type='submit']");
    await alicePage.waitForNavigation({ waitUntil: "networkidle0" });

    // Create document directly via API in Alice's authenticated session
    console.log("Alice creating new document via API...");
    const docData = await alicePage.evaluate(async () => {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Design System & Architecture" }),
      });
      return await res.json();
    });
    testDocId = docData.document.id;
    console.log("Created test document ID:", testDocId);

    // Share with link access: EDITOR (before opening document, so no eviction occurs mid-session)
    console.log("Setting link access to EDITOR so collaborators can join...");
    await alicePage.evaluate(async (docId) => {
      await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_access: "EDITOR" }),
      });
    }, testDocId);

    // Alice opens the document page
    console.log("Alice opening document page...");
    await alicePage.goto(`http://localhost:5173/d/${testDocId}`, { waitUntil: "domcontentloaded" });
    await alicePage.waitForSelector(".ProseMirror", { timeout: 10000 });

    // ----------------------------------------------------
    // Context 2: Bob (Collaborator / Editor)
    // ----------------------------------------------------
    console.log("2. Setting up Bob (Collaborator in separate context)...");
    const bobContext = await browser.createBrowserContext();
    const bobPage = await bobContext.newPage();
    await bobPage.setViewport({ width: 1440, height: 900 });

    await bobPage.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
    await bobPage.type("input[type='text']", "Bob Smith");
    await bobPage.type("input[type='email']", bobEmail);
    await bobPage.type("input[type='password']", "password123");
    await bobPage.click("button[type='submit']");
    await bobPage.waitForNavigation({ waitUntil: "networkidle0" });

    // Bob opens the document
    console.log("Bob joining document session...");
    await bobPage.goto(`http://localhost:5173/d/${testDocId}`, { waitUntil: "domcontentloaded" });
    await bobPage.waitForSelector(".ProseMirror", { timeout: 10000 });

    // Bob focuses editor and types content
    console.log("Bob typing into editor...");
    await bobPage.click(".ProseMirror");
    await bobPage.type(
      ".ProseMirror",
      "Real-time collaborative editing with Yjs and Tiptap.\nAll peers converge automatically via CRDT state vectors.",
      { delay: 15 }
    );

    // Keep Bob actively typing so name flag is fully visible
    await bobPage.type(".ProseMirror", " ");
    await new Promise((r) => setTimeout(r, 100));

    // ----------------------------------------------------
    // Capture View 1: Owner View with Remote Caret
    // ----------------------------------------------------
    console.log("Capturing View 1: Owner view with Bob's remote caret...");
    await alicePage.bringToFront();
    // Wait for text to appear in Alice's paper
    await alicePage.waitForFunction(
      () => {
        const pm = document.querySelector(".ProseMirror");
        return pm && pm.textContent && pm.textContent.includes("Real-time collaborative editing");
      },
      { timeout: 10000 }
    ).catch((err) => console.log("Alice waitForFunction error:", err.message));

    // Wait a brief moment for debounce/flush to complete to "Saved HH:MM"
    await new Promise((r) => setTimeout(r, 2200));

    // Touch Bob cursor once more right before screenshot so flag is visible
    await bobPage.bringToFront();
    await bobPage.keyboard.press("ArrowLeft");
    await new Promise((r) => setTimeout(r, 150));
    await alicePage.bringToFront();

    const aliceStatus = await alicePage.evaluate(() => {
      const el = document.querySelector("header [aria-live='polite']");
      const pm = document.querySelector(".ProseMirror");
      const carets = document.querySelectorAll(".collaboration-carets__label, .collaboration-carets__cursor");
      return {
        status: el ? el.textContent : null,
        pmText: pm ? pm.textContent : null,
        caretsCount: carets.length,
      };
    });
    console.log("Alice page inspection:", JSON.stringify(aliceStatus));

    await alicePage.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));

    const ownerScreenshotPath = path.join(outDir, "editor-owner-caret-1440x900.png");
    await alicePage.screenshot({ path: ownerScreenshotPath });
    console.log("Saved owner screenshot:", ownerScreenshotPath);

    // Copy to artifact directory
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(ownerScreenshotPath, path.join(artifactDir, "editor-owner-caret-1440x900.png"));
    }

    // ----------------------------------------------------
    // Context 3: Carol (Viewer)
    // ----------------------------------------------------
    console.log("3. Setting up Carol (Viewer)...");
    // Switch link access to VIEWER for Carol
    await alicePage.evaluate(async (docId) => {
      await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_access: "VIEWER" }),
      });
    }, testDocId);

    const carolContext = await browser.createBrowserContext();
    const carolPage = await carolContext.newPage();
    await carolPage.setViewport({ width: 1440, height: 900 });

    await carolPage.goto("http://localhost:5173/register", { waitUntil: "networkidle0" });
    await carolPage.type("input[type='text']", "Carol Davis");
    await carolPage.type("input[type='email']", carolEmail);
    await carolPage.type("input[type='password']", "password123");
    await carolPage.click("button[type='submit']");
    await carolPage.waitForNavigation({ waitUntil: "networkidle0" });

    // Carol opens the document as VIEWER
    console.log("Carol opening document as viewer...");
    await carolPage.goto(`http://localhost:5173/d/${testDocId}`, { waitUntil: "domcontentloaded" });
    await carolPage.waitForSelector(".ProseMirror", { timeout: 10000 });
    await carolPage.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 600));

    const viewerScreenshotPath = path.join(outDir, "editor-viewer-1440x900.png");
    await carolPage.screenshot({ path: viewerScreenshotPath });
    console.log("Saved viewer screenshot:", viewerScreenshotPath);

    // Copy to artifact directory
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(viewerScreenshotPath, path.join(artifactDir, "editor-viewer-1440x900.png"));
    }

    console.log("Screenshots captured successfully!");
  } finally {
    await browser.close();

    // Clean up test users and documents so dev DB remains 100% clean
    console.log("Cleaning up test records from dev database...");
    try {
      const { default: pg } = await import("pg");
      const client = new pg.Client({
        connectionString:
          process.env.DATABASE_URL ||
          "postgresql://collabspace:collabspace_dev@localhost:5432/collabspace",
      });
      await client.connect();
      if (testDocId) {
        await client.query("DELETE FROM document_members WHERE document_id = $1", [testDocId]);
        await client.query("DELETE FROM documents WHERE id = $1", [testDocId]);
      }
      await client.query("DELETE FROM users WHERE email LIKE 'm6_%'");
      await client.end();
      console.log("Dev database successfully cleaned up.");
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
