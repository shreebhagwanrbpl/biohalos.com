import { makeSlug } from "@/lib/catalog-utils";

function normalizeProduct(item, defaultCategory = "") {
  if (!item || typeof item !== "object") return null;

  const title = String(
    item.title ||
    item.name ||
    item.productName ||
    item.itemName ||
    ""
  ).trim();

  if (!title) return null;

  const rawSlug =
    item.slug ||
    item.productSlug ||
    item.itemSlug ||
    makeSlug(title);

  const category =
    item.category ||
    item.categoryName ||
    defaultCategory ||
    "";

  const subCategory =
    item.subCategory ||
    item["sub category"] ||
    item.subCategoryName ||
    "";

  const description =
    item.desc ||
    item.description ||
    item.detail ||
    item.summary ||
    "";

  const image =
    item.image ||
    item.imgUrl ||
    item.imageUrl ||
    (Array.isArray(item.images) && item.images[0]) ||
    "";

  const images =
    Array.isArray(item.images) && item.images.length
      ? item.images
      : image
        ? [image]
        : [];

  const features =
    Array.isArray(item.features)
      ? item.features.filter(Boolean)
      : typeof item.features === "string"
        ? item.features.split(",").map((x) => x.trim()).filter(Boolean)
        : [];

  return {
    ...item,
    id: item.uid || item.id || item.categoryProductId || rawSlug,
    uid: item.uid || item.id || rawSlug,
    productId: item.productId || item.uid || item.id || rawSlug,
    categoryProductId: item.categoryProductId || "",
    title,
    name: title,
    slug: rawSlug,
    category,
    subCategory,
    description,
    desc: description,
    price: item.price || "",
    capacity: item.capacity || "",
    throughput: item.throughput || "",
    instrument: item.instrument || "",
    model: item.model || "",
    usage: item.usage || "",
    brand: item.brand || "",
    parameters: item.parameters || "",
    automation: item.automation || "",
    availability: item.availability || item.status || "",
    size: item.size || "",
    features,
    specs: item.specs && typeof item.specs === "object" ? item.specs : null,
    badge: item.badge || item.tag || "",
    status: item.status || item.availability || "",
    image,
    images,
    video: item.video || "",
    pdf: item.pdf || "",
    isPublished: item.isPublished !== false,
  };
}

export { normalizeProduct };

let productsCache = null;
let productsCacheTime = 0;
let inFlightCatalogPromise = null;
const CATALOG_TTL = 60 * 1000; // 60s memory cache

export async function fetchAllDynamicProducts() {
  const now = Date.now();
  if (productsCache && (now - productsCacheTime < CATALOG_TTL)) {
    return productsCache;
  }

  if (inFlightCatalogPromise) {
    return inFlightCatalogPromise;
  }

  inFlightCatalogPromise = (async () => {
    try {
      const response = await fetch("/api/catalog", {
        cache: "default",
      });
      const body = await response.json();

      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || `Catalog API ${response.status}`);
      }

      const products =
        body?.products ??
        body?.data?.products ??
        body?.data ??
        body;

      const normalized = Array.isArray(products)
        ? products.map((item) => normalizeProduct(item)).filter(Boolean)
        : [];

      productsCache = normalized;
      productsCacheTime = Date.now();
      return normalized;
    } catch (error) {
      console.error("[fetchProducts] Admin catalog error:", error);
      return productsCache || [];
    } finally {
      inFlightCatalogPromise = null;
    }
  })();

  return inFlightCatalogPromise;
}
