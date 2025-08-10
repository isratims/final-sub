// server.js — רק Ktuvit: חיפוש עברית/אנגלית + הורדת SRT (Movie/Series)
const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const KtuvitManager = require("ktuvit-api");
const AdmZip = require("adm-zip");
const zlib = require("zlib");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use("/api/", rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true }));

// ---- Ktuvit ----
const token = process.env.KTUVIT_TOKEN || ""; // ה-cookie בפורמט u=...&g=...
const ktuvitBaseUrl = process.env.KTUVIT_BASE_URL || "https://www.ktuvit.me/";

if (!token) console.warn("⚠️  חסר KTUVIT_TOKEN בקובץ .env");
console.log(`🔗 משתמש בכתובת Ktuvit: ${ktuvitBaseUrl}`);

const ktuvit = new KtuvitManager(token, true, ktuvitBaseUrl);

// ---- עזר ----
function norm(s) {
  return (s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[._\-]+/g, " ")
    .replace(/[^\p{L}\p{N} /:&]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
const HEBREW_RE = /[\u0590-\u05FF]/;

// בוחר תוצאה הכי מתאימה לפי שם ושנה/סוג
function rankKtuvitResults(list, q, mode) {
  const nq = norm(q);
  const wantSeries = mode === "series";
  return (Array.isArray(list) ? list : [])
    .filter((x) => (wantSeries ? /series/i.test(x.Type) : !/series/i.test(x.Type)))
    .map((x) => {
      const name = norm(`${x.HebName || ""} ${x.EngName || ""}`);
      let score = 0;
      if (name === nq) score -= 10000;
      else if (name.startsWith(nq)) score -= 700;
      else if (name.includes(nq)) score -= 400;
      return { raw: x, _score: score };
    })
    .sort((a, b) => a._score - b._score)
    .map((x) => x.raw);
}

// ---- ראוטים ----

// הצעות חיפוש (אוטוקומפליט) — רק מה-Ktuvit
app.post("/api/resolve", async (req, res) => {
  try {
    const { query, mode = "film" } = req.body || {};
    if (!query?.trim()) return res.json({ ok: true, results: [] });
    const list = await ktuvit.searchKtuvit(query.trim());
    const ranked = rankKtuvitResults(list, query, mode).slice(0, 15);
    const results = ranked.map((x) => ({
      id: String(x.Id),
      title: x.EngName || x.HebName || "(ללא שם)",
      hebName: x.HebName || "",
      year: x.Year || null,
      type: /series/i.test(x.Type) ? "series" : "film",
      _score: 0,
    }));
    res.json({ ok: true, results });
  } catch (e) {
    console.error("resolve error:", e);
    let errorMsg = String(e?.message || e);
    
    if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("getaddrinfo")) {
      errorMsg = `שגיאת חיבור לשרת Ktuvit (${ktuvitBaseUrl}). בדוק את החיבור לאינטרנט או נסה שוב מאוחר יותר.`;
    }
    
    res.status(500).json({ ok: false, error: errorMsg });
  }
});

// חיפוש והבאת רשימת כתוביות זמינות
app.post("/api/search", async (req, res) => {
  try {
    const { query, mode = "film", season, episode } = req.body || {};
    if (!query?.trim()) return res.status(400).json({ ok: false, error: "יש לספק טקסט חיפוש" });

    const q = query.trim();
    const list = await ktuvit.searchKtuvit(q);
    const ranked = rankKtuvitResults(list, q, mode);

    for (const item of ranked) {
      const ktuvitId = item.Id;
      let results = [];
      if (mode === "series") {
        const s = Number(season || 1);
        const e = Number(episode || 1);
        try {
          results = await ktuvit.getSubsIDsListEpisode(ktuvitId, s, e);
        } catch {}
      } else {
        try {
          results = await ktuvit.getSubsIDsListMovie(ktuvitId);
        } catch {}
      }
      if (Array.isArray(results) && results.length) {
        return res.json({
          ok: true,
          ktuvitId,
          title: item.EngName || item.HebName || "",
          hebName: item.HebName || "",
          year: item.Year || null,
          results,
        });
      }
    }

    res.json({
      ok: true,
      results: [],
      note: HEBREW_RE.test(q)
        ? "לא נמצאו כתוביות לשם הזה/לעונה/פרק. נסה ניסוח מעט שונה או מספרי עונה/פרק אחרים."
        : "לא נמצאו כתוביות. נסה גם את השם בעברית או בדוק עונה/פרק.",
    });
  } catch (e) {
    console.error("search error:", e);
    let errorMsg = String(e?.message || e);
    
    // Provide more helpful error messages based on error type
    if (errorMsg.includes("ENOTFOUND") || errorMsg.includes("getaddrinfo")) {
      errorMsg = `שגיאת חיבור לשרת Ktuvit (${ktuvitBaseUrl}). יתכן שהשירות אינו זמין כרגע או שכתובת הדומיין השתנתה.`;
    } else if (errorMsg.includes("ECONNREFUSED")) {
      errorMsg = "שרת Ktuvit מסרב להתחבר. יתכן שהשירות מושבת זמנית.";
    } else if (errorMsg.includes("timeout")) {
      errorMsg = "תם הזמן הקצוב לחיבור לשרת Ktuvit. נסה שוב.";
    }
    
    res.status(500).json({ ok: false, error: errorMsg });
  }
});

// הורדה: ZIP/GZIP -> SRT
app.get("/api/download/:ktuvitId/:subId", async (req, res) => {
  try {
    const { ktuvitId, subId } = req.params;
    const name = decodeURIComponent(req.query.name || "subtitle.srt");

    let buf = await ktuvit.downloadSubtitle({ ktuvitId, subtitleId: subId });

    // אם זה ZIP
    try {
      const zip = new AdmZip(buf);
      const entry = zip.getEntries().find((e) => /\.srt$/i.test(e.entryName));
      if (entry) buf = entry.getData();
    } catch {
      /* לא ZIP */
    }

    // אם זה gz
    if (buf && buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      buf = zlib.gunzipSync(buf);
    }

    res.setHeader("Content-Type", "application/x-subrip");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.send(buf);
  } catch (e) {
    console.error("download error:", e);
    res.status(500).send("Download failed");
  }
});

const PORT = process.env.PORT || 3000;

// ---- אנדפוינט לבדיקת סטטוס ----
app.get("/api/status", async (req, res) => {
  try {
    const baseUrl = process.env.KTUVIT_BASE_URL || "https://www.ktuvit.me/";
    const hasToken = !!process.env.KTUVIT_TOKEN;
    
    // בדיקה בסיסית של זמינות הדומיין
    let domainStatus = "unknown";
    try {
      const testKtuvit = new KtuvitManager(process.env.KTUVIT_TOKEN || "dummy", true, baseUrl);
      // נסיון חיפוש בסיסי לבדיקת חיבור
      await testKtuvit.searchKtuvit("test");
      domainStatus = "connected";
    } catch (e) {
      if (e.message.includes("ENOTFOUND") || e.message.includes("getaddrinfo")) {
        domainStatus = "dns_error";
      } else if (e.message.includes("ECONNREFUSED")) {
        domainStatus = "connection_refused";
      } else {
        domainStatus = "other_error";
      }
    }
    
    res.json({
      ok: true,
      status: {
        baseUrl,
        hasToken,
        domainStatus,
        timestamp: new Date().toISOString(),
        message: domainStatus === "connected" 
          ? "הכל פועל כראוי" 
          : domainStatus === "dns_error"
          ? "לא ניתן להתחבר לדומיין. נסה להריץ node test-domains.js"
          : domainStatus === "connection_refused"
          ? "השרת מסרב להתחבר"
          : "שגיאה לא ידועה בחיבור"
      }
    });
  } catch (e) {
    res.status(500).json({ 
      ok: false, 
      error: "שגיאה בבדיקת סטטוס",
      details: e.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});
