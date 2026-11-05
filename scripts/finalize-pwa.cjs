const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputDirectory = path.join(root, "dist");
const { version } = require(path.join(root, "package.json"));
const buildId = String(process.env.GITHUB_SHA || process.env.PWA_BUILD_ID || "local")
  .replace(/[^a-zA-Z0-9_-]/g, "")
  .slice(0, 24);
const html = fs.readFileSync(path.join(outputDirectory, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
  .map((match) => match[1]);
const precache = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", ...assets];
const worker = `const CACHE_NAME = "silva-xvi-${version}-${buildId}";
const PRECACHE_URLS = ${JSON.stringify([...new Set(precache)])};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("silva-xvi-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const scope = self.registration.scope;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin ||
      !request.url.startsWith(scope) || request.headers.has("range")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) ||
          (await caches.match(new URL("./index.html", scope).href)) ||
          new Response("O aplicativo está offline e esta página ainda não foi armazenada.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }
  if (new URL(request.url).pathname.includes("/assets/") ||
      new URL(request.url).pathname.includes("/icons/") ||
      request.url.endsWith("/manifest.webmanifest")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    })());
  }
});
`;
fs.writeFileSync(path.join(outputDirectory, "sw.js"), worker);
console.log(`PWA preparado: versão ${version}, build ${buildId}, ${precache.length} recursos pré-carregados.`);
