/**
 * ═══════════════════════════════════════════════════════════════
 *  TechDrop — Amazon PA-API Backend Server
 *  File: server.js
 * ═══════════════════════════════════════════════════════════════
 *
 *  WHY this file exists:
 *  Amazon PA-API requires AWS Signature v4 authentication using
 *  your Secret Key. Secret keys must NEVER go in frontend code.
 *  This Node.js server sits between your HTML page and Amazon,
 *  signs every request securely, and returns clean product data.
 *
 *  SETUP:
 *  1. npm install          (install express + cors)
 *  2. Add your keys below  (ACCESS_KEY, SECRET_KEY, ASSOCIATE_TAG)
 *  3. node server.js       (starts on http://localhost:4000)
 *
 *  ENDPOINTS:
 *  GET /health                              → server status check
 *  GET /api/search?keywords=headphones      → search Amazon products
 *  GET /api/product/:asin                   → single product details
 * ═══════════════════════════════════════════════════════════════
 */

const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const https   = require("https");

const app = express();
app.use(cors());          // allow requests from your HTML page
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
//  YOUR AMAZON PA-API CREDENTIALS
//  Replace the placeholder strings with your real keys.
//  Get them from: https://affiliate-program.amazon.com → Tools → PA-API
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  accessKey:    process.env.ACCESS_KEY    || "YOUR_ACCESS_KEY_ID",
  secretKey:    process.env.SECRET_KEY    || "YOUR_SECRET_ACCESS_KEY",
  associateTag: process.env.ASSOCIATE_TAG || "yourtag-20",
  region:       "us-east-1",              // us-east-1 for amazon.com (change for other countries)
  host:         "webservices.amazon.com",
  path:         "/paapi5/searchitems",
  pathGetItems: "/paapi5/getitems",
};

// ═══════════════════════════════════════════════════════════════
//  AWS SIGNATURE V4 — signs every request to Amazon
//  You do NOT need to modify this section.
// ═══════════════════════════════════════════════════════════════
function hmac(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest();
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate    = hmac("AWS4" + secretKey, dateStamp);
  const kRegion  = hmac(kDate,    region);
  const kService = hmac(kRegion,  service);
  const kSigning = hmac(kService, "aws4_request");
  return kSigning;
}

function buildSignedHeaders(payload, path, target) {
  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const service   = "ProductAdvertisingAPI";

  const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=UTF-8\n` +
    `host:${CONFIG.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${target}\n`;

  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${CONFIG.region}/${service}/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const signingKey = getSigningKey(CONFIG.secretKey, dateStamp, CONFIG.region, service);
  const signature  = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    "Content-Encoding": "amz-1.0",
    "Content-Type":     "application/json; charset=UTF-8",
    "Host":             CONFIG.host,
    "X-Amz-Date":       amzDate,
    "X-Amz-Target":     `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${target}`,
    "Authorization":    `AWS4-HMAC-SHA256 Credential=${CONFIG.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  CALL AMAZON PA-API — makes the actual HTTPS request
// ═══════════════════════════════════════════════════════════════
function callAmazon(payload, path, target) {
  return new Promise((resolve, reject) => {
    const body    = JSON.stringify(payload);
    const headers = buildSignedHeaders(body, path, target);

    const options = {
      hostname: CONFIG.host,
      path,
      method:   "POST",
      headers:  { ...headers, "Content-Length": Buffer.byteLength(body) },
    };

    const req = https.request(options, res => {
      let data = "";
      res.on("data",  chunk => data += chunk);
      res.on("end",   ()    => {
        try   { resolve(JSON.parse(data)); }
        catch { reject(new Error("Amazon returned invalid JSON")); }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
//  PA-API COMPLIANCE HELPERS
//  - Rate limiting: PA-API is commonly limited to ~1 req/sec.
//  - Caching: Amazon requires caching results for 24 hours.
//
//  Notes:
//  - This is an in-memory cache (resets when the server restarts).
//  - For production, consider Redis / durable storage.
// ═══════════════════════════════════════════════════════════════
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const AMAZON_MIN_INTERVAL_MS = 1100; // slightly above 1s

const responseCache = new Map();

function cacheKeyFor(target, path, payload) {
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  return `${target}:${path}:${payloadHash}`;
}

function cacheGet(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  while (responseCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let amazonCallChain = Promise.resolve();
let lastAmazonCallAt = 0;

function enqueueAmazonCall(fn) {
  const run = amazonCallChain.then(fn);
  amazonCallChain = run.catch(() => undefined);
  return run;
}

function callAmazonThrottled(payload, path, target) {
  return enqueueAmazonCall(async () => {
    const elapsed = Date.now() - lastAmazonCallAt;
    const waitMs = Math.max(0, AMAZON_MIN_INTERVAL_MS - elapsed);
    if (waitMs > 0) await delay(waitMs);
    lastAmazonCallAt = Date.now();
    return callAmazon(payload, path, target);
  });
}

// ═══════════════════════════════════════════════════════════════
//  PARSE PA-API ITEMS → clean product objects
// ═══════════════════════════════════════════════════════════════
function parseItems(items) {
  return (items || []).map(item => {
    const info    = item.ItemInfo     || {};
    const offers  = item.Offers?.Listings?.[0] || {};
    const images  = item.Images?.Primary?.Large || {};
    const reviews = item.CustomerReviews || {};

    const price    = offers.Price?.DisplayAmount || null;
    const saving   = offers.Price?.SavingBasis?.DisplayAmount || null;
    const title    = info.Title?.DisplayValue || "No title";
    const features = (info.Features?.DisplayValues || []).slice(0, 4);
    const rating   = parseFloat(reviews.StarRating?.Value)  || 4.5;
    const revCount = parseInt(reviews.Count?.Value)         || 0;

    // Auto-generate badge based on listing data
    let badge = null, badgeColor = "#3b82f6";
    if (offers.IsBuyBoxWinner)     { badge = "Best Seller"; badgeColor = "#f59e0b"; }
    else if (offers.Condition?.Value === "New") { badge = "New"; badgeColor = "#10b981"; }

    return {
      asin:         item.ASIN,
      cat:          "Electronics",
      title,
      price:        price  || "N/A",
      origPrice:    saving || null,
      image:        images.URL || "",
      rating,
      reviews:      revCount,
      features,
      badge,
      badgeColor,
      url:          item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}?tag=${CONFIG.associateTag}`,
      affiliateUrl: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}?tag=${CONFIG.associateTag}`,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
//  API ROUTE: GET /api/search
//  Query params:
//    keywords  (string, default "electronics")
//    category  (string, default "Electronics")
//    count     (number, default 12, max 10 per PA-API)
//
//  Example: GET /api/search?keywords=wireless+headphones&count=8
// ═══════════════════════════════════════════════════════════════
app.get("/api/search", async (req, res) => {
  const keywords = req.query.keywords || "electronics";
  const category = req.query.category || "Electronics";
  const count    = Math.min(parseInt(req.query.count) || 12, 10); // PA-API max is 10

  console.log(`[PA-API] Searching: "${keywords}" in ${category}`);

  const payload = {
    Keywords:    keywords,
    SearchIndex: category,
    PartnerTag:  CONFIG.associateTag,
    PartnerType: "Associates",
    Marketplace: "www.amazon.com",
    ItemCount:   count,
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.Features",
      "Offers.Listings.Price",
      "Offers.Listings.Condition",
      "Offers.Listings.IsBuyBoxWinner",
      "Images.Primary.Large",
      "CustomerReviews.StarRating",
      "CustomerReviews.Count",
    ],
  };

  try {
    const key = cacheKeyFor("SearchItems", CONFIG.path, payload);
    const cached = cacheGet(key);
    if (cached) {
      const products = parseItems(cached.SearchResult?.Items);
      return res.json({
        products,
        associateTag: CONFIG.associateTag,
        total:        cached.SearchResult?.TotalResultCount || products.length,
        keywords,
        cached:       true,
      });
    }

    const data = await callAmazonThrottled(payload, CONFIG.path, "SearchItems");

    if (data.Errors) {
      console.error("[PA-API] Error:", data.Errors);
      return res.status(400).json({
        error: data.Errors[0]?.Message || "PA-API returned an error",
        code:  data.Errors[0]?.Code,
      });
    }

    cacheSet(key, data);

    const products = parseItems(data.SearchResult?.Items);
    console.log(`[PA-API] Found ${products.length} products`);

    res.json({
      products,
      associateTag: CONFIG.associateTag,
      total:        data.SearchResult?.TotalResultCount || products.length,
      keywords,
    });

  } catch (err) {
    console.error("[PA-API] Request failed:", err.message);
    res.status(500).json({ error: "Failed to fetch from Amazon PA-API", detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTE: GET /api/product/:asin
//  Returns detailed info for one specific product by ASIN.
//
//  Example: GET /api/product/B09XS7JWHH
// ═══════════════════════════════════════════════════════════════
app.get("/api/product/:asin", async (req, res) => {
  const asin = req.params.asin;
  console.log(`[PA-API] Getting product: ${asin}`);

  const payload = {
    ItemIds:     [asin],
    PartnerTag:  CONFIG.associateTag,
    PartnerType: "Associates",
    Marketplace: "www.amazon.com",
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.Features",
      "ItemInfo.ByLineInfo",
      "Offers.Listings.Price",
      "Offers.Listings.IsBuyBoxWinner",
      "Images.Primary.Large",
      "Images.Variants.Large",
      "CustomerReviews.StarRating",
      "CustomerReviews.Count",
    ],
  };

  try {
    const key = cacheKeyFor("GetItems", CONFIG.pathGetItems, payload);
    const cached = cacheGet(key);
    if (cached) {
      const products = parseItems(cached.ItemsResult?.Items);
      return res.json({ product: products[0] || null, cached: true });
    }

    const data = await callAmazonThrottled(payload, CONFIG.pathGetItems, "GetItems");
    cacheSet(key, data);
    const products = parseItems(data.ItemsResult?.Items);
    res.json({ product: products[0] || null });
  } catch (err) {
    console.error("[PA-API] GetItems failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  API ROUTE: GET /health
//  Use this to check the server is running and keys are set.
// ═══════════════════════════════════════════════════════════════
app.get("/health", (req, res) => {
  const configured =
    CONFIG.accessKey !== "YOUR_ACCESS_KEY_ID" &&
    CONFIG.secretKey !== "YOUR_SECRET_ACCESS_KEY" &&
    CONFIG.associateTag !== "yourtag-20";
  res.json({
    status:       "ok",
    configured,
    associateTag: CONFIG.associateTag,
    region:       CONFIG.region,
    message:      configured
      ? "✓ PA-API keys are set. Ready to fetch real Amazon products."
      : "⚠️ Keys not set. Replace YOUR_ACCESS_KEY_ID and YOUR_SECRET_ACCESS_KEY in server.js",
  });
});

// ═══════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("\n═══════════════════════════════════════════");
  console.log("  TechDrop PA-API Server");
  console.log(`  Running on http://localhost:${PORT}`);
  console.log("═══════════════════════════════════════════");
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Search:  http://localhost:${PORT}/api/search?keywords=headphones`);
  console.log(`  Product: http://localhost:${PORT}/api/product/B09XS7JWHH`);
  console.log("═══════════════════════════════════════════");
  if (CONFIG.accessKey === "YOUR_ACCESS_KEY_ID") {
    console.log("\n  ⚠️  WARNING: PA-API keys not configured!");
    console.log("  Open server.js and replace:");
    console.log("    YOUR_ACCESS_KEY_ID    → your Access Key");
    console.log("    YOUR_SECRET_ACCESS_KEY → your Secret Key");
    console.log("    yourtag-20             → your Associate Tag\n");
  } else {
    console.log("\n  ✓ PA-API keys configured. Ready!\n");
  }
});