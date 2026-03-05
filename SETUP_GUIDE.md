# TechDrop — Full Setup Guide
### Amazon PA-API Affiliate Electronics Store

---

## YOUR 4 FILES

| File | Purpose |
|------|---------|
| `index.html` | The complete storefront — open in any browser |
| `server.js` | Node.js backend that calls Amazon PA-API securely |
| `package.json` | Lists the packages server.js needs (express, cors) |
| `SETUP_GUIDE.md` | This file |

---

## STEP 1 — Open the Store Right Now (No Setup Needed)

1. Download all 4 files to a folder on your computer
2. Double-click `index.html` — it opens in your browser
3. You'll see **Demo Mode** with 8 sample products
4. Click **⚙️ Admin** tab → upload a product → it appears live instantly
5. Click any product image → product detail popup opens
6. Add products to cart → click "Buy All on Amazon"

✅ Everything works in Demo Mode without any setup.

---

## STEP 2 — Sign Up for Amazon Associates (Free)

To show **real** Amazon products with live prices, you need an Associates account.

1. Go to: **https://affiliate-program.amazon.com**
2. Click **"Sign up"** (use your existing Amazon account)
3. Fill in your website URL — use anything for now, e.g. `https://techdrop.com`
4. Describe how you'll promote products (e.g. "Electronics review blog")
5. You get your **Associate Tag** immediately — looks like `yourname-20`

> ⚠️ You have **180 days** to make 3 qualifying sales, or your account is paused.

---

## STEP 3 — Get PA-API Access

The Product Advertising API is separate from your Associates account.

1. Log into Associates: **https://affiliate-program.amazon.com**
2. Go to: **Tools → Product Advertising API**
3. Click **"Sign Up for Product Advertising API"**
4. Requirements:
   - Active Associates account
   - At least **3 qualifying sales** in the last 180 days
   - A website showing affiliate content
5. Once approved, go to:
   **https://webservices.amazon.com/paapi5/scratchpad**
6. Click your account name (top right) → **Security Credentials**
7. Click **"Create Access Key"**
8. You'll receive:
   - `Access Key ID`      — looks like: `AKIAIOSFODNN7EXAMPLE`
   - `Secret Access Key`  — looks like: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

> ⚠️ Save these immediately — the Secret Key is only shown ONCE.

---

## STEP 4 — Set Up the Backend Server

### Install Node.js (if you don't have it)
Download from: **https://nodejs.org** — choose the LTS version.

### Install and Run
```bash
# 1. Open Terminal / Command Prompt
# 2. Navigate to your project folder
cd path/to/your/project

# 3. Install packages
npm install

# 4. Start the server
npm start
```

You should see:
```
═══════════════════════════════════════════
  TechDrop PA-API Server
  Running on http://localhost:4000
═══════════════════════════════════════════
```

### Add Your Keys to server.js

Open `server.js` and find this section (around line 45):

```javascript
const CONFIG = {
  accessKey:    process.env.ACCESS_KEY    || "YOUR_ACCESS_KEY_ID",
  secretKey:    process.env.SECRET_KEY    || "YOUR_SECRET_ACCESS_KEY",
  associateTag: process.env.ASSOCIATE_TAG || "yourtag-20",
```

Replace the placeholder strings:
```javascript
const CONFIG = {
  accessKey:    process.env.ACCESS_KEY    || "AKIAIOSFODNN7EXAMPLE",
  secretKey:    process.env.SECRET_KEY    || "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
  associateTag: process.env.ASSOCIATE_TAG || "yourname-20",
```

### Test It
Open your browser and visit:
```
http://localhost:4000/health
```
You should see: `"configured": true`

Also test a product search:
```
http://localhost:4000/api/search?keywords=wireless+headphones
```
You should see real Amazon product JSON!

---

## STEP 5 — Connect index.html to Your Server

Open `index.html` and find these two lines near the bottom (inside `<script>`):

```javascript
const DEMO_MODE   = true;
const BACKEND_URL = "http://localhost:4000";
```

Change `DEMO_MODE` to `false`:
```javascript
const DEMO_MODE   = false;
const BACKEND_URL = "http://localhost:4000";
```

Save and refresh `index.html` — it now shows **real Amazon products**!

---

## STEP 6 — Deploy Online (Free)

To make your store accessible from anywhere on the internet:

### Deploy Backend → Render.com (Free)

1. Push your backend files to GitHub:
   - Create a new GitHub repo
   - Upload `server.js` and `package.json`

2. Go to: **https://render.com** → Sign up free

3. Click **New → Web Service** → Connect your GitHub repo

4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:**  `npm start`

5. Add Environment Variables in Render dashboard:
   - `ACCESS_KEY`    = your Access Key ID
   - `SECRET_KEY`    = your Secret Access Key
   - `ASSOCIATE_TAG` = yourname-20

6. Click Deploy → you get a URL like:
   `https://techdrop-api.onrender.com`

### Deploy Frontend → Netlify (Free)

1. Go to: **https://netlify.com** → Sign up free
2. Drag and drop your `index.html` onto the Netlify dashboard
3. Before uploading, edit `index.html`:
   ```javascript
   const BACKEND_URL = "https://techdrop-api.onrender.com"; // your Render URL
   ```
4. Your store is live at something like `https://techdrop.netlify.app`

---

## PA-API Rules You Must Follow

| Rule | Detail |
|------|--------|
| Rate limit | 1 request/second, 8,640/day |
| Caching | Must cache results for 24 hours |
| Images | Must link back to Amazon — do NOT re-host images |
| Prices | Must show "price as of" date — prices change |
| Disclosure | Must show the Amazon affiliate disclaimer |
| Sales requirement | Must make 3 sales within 180 days of signup |

---

## Amazon Electronics Commission Rates

| Category | Commission % |
|----------|-------------|
| Headphones | 4% |
| Laptops | 2.5% |
| Tablets | 3% |
| TVs | 2% |
| Cameras | 3% |
| Smart Home | 4% |
| Gaming | 1% |
| Cell Phones | 3% |
| Computer Components | 2.5% |

---

## Useful Links

| Resource | URL |
|----------|-----|
| Amazon Associates signup | https://affiliate-program.amazon.com |
| PA-API documentation | https://webservices.amazon.com/paapi5/documentation/ |
| PA-API scratchpad (test) | https://webservices.amazon.com/paapi5/scratchpad/ |
| Associates help | https://affiliate-program.amazon.com/help |
| Render.com (backend host) | https://render.com |
| Netlify.com (frontend host) | https://netlify.com |

---

## File Structure

```
techdrop/
├── index.html        ← Open this in browser — complete storefront
├── server.js         ← Node.js backend — add your PA-API keys here
├── package.json      ← Backend dependencies (express + cors)
└── SETUP_GUIDE.md    ← This file
```

---

## Quick Checklist

- [ ] Opened `index.html` in browser (works in Demo Mode)
- [ ] Signed up for Amazon Associates
- [ ] Got PA-API access (after 3 qualifying sales)
- [ ] Got Access Key + Secret Key from PA-API dashboard
- [ ] Added keys to `server.js`
- [ ] Ran `npm install` and `npm start`
- [ ] Visited `http://localhost:4000/health` — shows configured: true
- [ ] Changed `DEMO_MODE = false` in `index.html`
- [ ] Store shows real Amazon products ✓
- [ ] Deployed backend to Render.com
- [ ] Deployed frontend to Netlify
- [ ] Store is live online ✓
