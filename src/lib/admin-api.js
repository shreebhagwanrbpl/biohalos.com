import "server-only";

import { WEBSITE_ID, COMPANY_ID } from "./catalog-utils";

export const ADMIN_API_BASE_URL = (
  process.env.ADMIN_API_BASE_URL ||
  process.env.ADMIN_API_URL ||
  "https://admin.rajbiosis.app"
).replace(/\/+$/, "");

function buildUrl(pathname, params = {}) {
  const path = String(pathname || "");
  const url = new URL(
    `${ADMIN_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
  );

  const query = {
    websiteId: WEBSITE_ID,
    companyId: COMPANY_ID,
    ...params,
  };

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

const cacheStore = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function adminFetch(pathname, options = {}, params = {}) {
  const isGet = !options.method || options.method.toUpperCase() === "GET";
  const url = buildUrl(pathname, params).toString();

  // If GET request, check server cache first
  if (isGet) {
    const cached = cacheStore.get(url);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Check if an identical fetch is already in-flight
    if (inFlightRequests.has(url)) {
      return inFlightRequests.get(url);
    }
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, {
        ...options,
        next: { revalidate: 60 },
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });

      const text = await response.text();
      let body = null;

      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }

      if (
        !response.ok ||
        body?.success === false ||
        body?.ok === false
      ) {
        const message =
          typeof body === "string"
            ? body
            : JSON.stringify(body);
        throw new Error(`Admin API ${response.status}: ${message}`);
      }

      if (isGet) {
        cacheStore.set(url, { data: body, timestamp: Date.now() });
      }

      return body;
    } finally {
      if (isGet) {
        inFlightRequests.delete(url);
      }
    }
  })();

  if (isGet) {
    inFlightRequests.set(url, fetchPromise);
  }

  return fetchPromise;
}

export async function postAdminQuery(endpoint, payload = {}) {
  return adminFetch(
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        websiteId: WEBSITE_ID,
        companyId: COMPANY_ID,
        ...payload,
      }),
    },
    {}
  );
}

export async function fetchCatalogFromAdmin() {
  const response = await adminFetch("/api/catalog");
  const products =
    response?.products ??
    response?.data?.products ??
    response?.data ??
    response;
  return Array.isArray(products) ? products : [];
}
