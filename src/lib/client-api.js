/* Client-side compatibility API backed by the central Admin MongoDB API. */
const clientCache = new Map();
const inFlightRequests = new Map();
const CLIENT_CACHE_TTL = 60 * 1000; // 60s memory cache

const json = async (response) => {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok || body?.ok === false || body?.success === false) {
    throw new Error(
      `API ${response.status}: ${
        typeof body === "string" ? body : JSON.stringify(body)
      }`
    );
  }
  return body;
};

async function fetchWithCache(url) {
  const now = Date.now();
  const cached = clientCache.get(url);
  if (cached && (now - cached.timestamp < CLIENT_CACHE_TTL)) {
    return cached.data;
  }

  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url);
  }

  const promise = (async () => {
    try {
      const res = await fetch(url, { cache: "default" });
      const data = await json(res);
      clientCache.set(url, { data, timestamp: Date.now() });
      return data;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, promise);
  return promise;
}

export const db = { __adminApi: true };

export function doc(...segments) {
  return { __type: "doc", segments };
}

export function collection(...segments) {
  return { __type: "collection", segments };
}

function pageFromDocSegments(segments = []) {
  const parts = segments.filter(Boolean).map(String);
  const pagesIndex = parts.indexOf("pages");
  if (pagesIndex >= 0 && parts[pagesIndex + 1]) return {
    type: parts[pagesIndex + 1],
    pageType: parts[pagesIndex + 1],
  };

  const districtsIndex = parts.indexOf("districts");
  if (districtsIndex >= 0 && parts[districtsIndex + 1]) return {
    type: "district",
    pageType: "district",
    district: parts[districtsIndex + 1],
  };

  return {};
}

export async function getDoc(ref) {
  const params = pageFromDocSegments(ref?.segments || []);
  const url = `/api/site-data?${new URLSearchParams(params).toString()}`;
  const response = await fetchWithCache(url);
  const data = response?.data ?? response ?? null;
  return {
    exists: () => data !== null && data !== undefined,
    data: () => data,
  };
}

export async function getDocs(ref) {
  const segments = ref?.segments || [];
  const parts = segments.filter(Boolean).map(String);

  if (parts.includes("districts")) {
    const response = await fetchWithCache("/api/site-data?districts=1");
    const rows = Array.isArray(response)
      ? response
      : response?.data?.districts ?? response?.districts ?? response?.data ?? [];
    return {
      empty: rows.length === 0,
      docs: rows.map((row, index) => ({
        id: row?.id || row?.slug || `dist-${index}`,
        data: () => row,
      })),
    };
  }

  const response = await fetchWithCache("/api/catalog");
  const rows =
    response?.products ?? response?.data?.products ?? response?.data ?? response;
  const products = Array.isArray(rows) ? rows : [];
  return {
    empty: products.length === 0,
    docs: products.map((row, index) => ({
      id: row?.id || row?.uid || row?.productId || `product-${index}`,
      data: () => row,
    })),
  };
}

export async function addDoc(ref, payload = {}) {
  const parts = ref?.segments || [];
  const joined = parts.map(String).join("/");
  const endpoint = joined.includes("contactQueries")
    ? "/api/contact-query"
    : "/api/product-query";

  const response = await json(
    await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );

  return response;
}
