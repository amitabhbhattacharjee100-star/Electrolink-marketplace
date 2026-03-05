require("dotenv").config();
const express = require("express");
const cors = require("cors");
const ProductAdvertisingAPIv1 = require("amazon-paapi");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const REQUIRED_ENV = ["AMAZON_ACCESS_KEY", "AMAZON_SECRET_KEY", "AMAZON_PARTNER_TAG"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const commonParameters = {
  AccessKey: process.env.AMAZON_ACCESS_KEY,
  SecretKey: process.env.AMAZON_SECRET_KEY,
  PartnerTag: process.env.AMAZON_PARTNER_TAG,
  PartnerType: "Associates",
  Marketplace: "www.amazon.com",
};

// Search for products by keyword
app.get("/api/search", async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: "Keyword query parameter is required" });
  }

  const requestParameters = {
    Keywords: keyword,
    SearchIndex: "Electronics",
    ItemCount: 10,
    Resources: [
      "Images.Primary.Medium",
      "ItemInfo.Title",
      "Offers.Listings.Price",
    ],
  };

  try {
    const data = await ProductAdvertisingAPIv1.SearchItems(
      commonParameters,
      requestParameters
    );
    const items = data?.SearchResult?.Items ?? [];
    res.json({ items });
  } catch (error) {
    console.error("PA-API SearchItems error:", error);
    res.status(500).json({ error: "Failed to fetch products from Amazon." });
  }
});

// Get details for a specific ASIN
app.get("/api/item/:asin", async (req, res) => {
  const { asin } = req.params;

  const requestParameters = {
    ItemIds: [asin],
    Resources: [
      "Images.Primary.Large",
      "ItemInfo.Title",
      "ItemInfo.Features",
      "Offers.Listings.Price",
    ],
  };

  try {
    const data = await ProductAdvertisingAPIv1.GetItems(
      commonParameters,
      requestParameters
    );
    const items = data?.ItemsResult?.Items ?? [];
    res.json({ items });
  } catch (error) {
    console.error("PA-API GetItems error:", error);
    res.status(500).json({ error: "Failed to fetch item details from Amazon." });
  }
});

app.listen(PORT, () => {
  console.log(`TechDrop server running on port ${PORT}`);
});
