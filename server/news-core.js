export const TOPIC_QUERIES = {
  emagrecimento: '(emagrecimento OR "perda de peso" OR obesidade) (nutricionista OR nutrição OR alimentação)',
  dietas: '(dieta mediterrânea OR "dieta low carb" OR "jejum intermitente" OR "dieta cetogênica" OR "dieta vegana" OR "dieta DASH")',
  nutricionistas: '(nutricionista dicas OR "segundo nutricionista" OR "segundo a nutricionista") alimentação',
  saude: '(alimentação saudável OR nutrição OR "guia alimentar") saúde',
};

const MAX_ITEMS = 12;
const IMAGE_BUDGET_MS = 4500;
const IMAGE_TIMEOUT_MS = 3500;
const IMAGE_CONCURRENCY = 6;
const imageCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const BLOCKLIST = /milagr|detox|emagre[çc]a \d+|perca \d+ ?kg|\d+ ?kg em \d+|p[óo]s-gradua[çc]|\bcurso\b|inscri[çc][õo]es|cupom|promo[çc][ãa]o/i;

const decodeEntities = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const stripTags = (s) => s.replace(/<[^>]*>/g, "");
const clean = (s) => decodeEntities(stripTags(decodeEntities(s))).replace(/\s+/g, " ").trim();

function tagText(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}

export function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const rawTitle = clean(tagText(block, "title"));
    const url = decodeEntities(tagText(block, "link")).trim();
    const source = clean(tagText(block, "source"));
    const date = new Date(tagText(block, "pubDate"));

    if (!rawTitle || !url.startsWith("https://")) continue;

    let title = rawTitle;
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();

    items.push({
      title,
      source: source || "Fonte não informada",
      url,
      publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    });
  }
  return items;
}

function dedupeAndFilter(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (BLOCKLIST.test(it.title)) continue;
    const key = it.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  out.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  return out.slice(0, MAX_ITEMS);
}



function decodeGoogleNewsUrl(link) {
  const m = link.match(/\/articles\/([^?/]+)/);
  if (!m) return null;
  try {
    const s = Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("latin1");
    const i = s.search(/https?:\/\//);
    if (i < 0) return null;
    const url = s.slice(i).split(/[\x00-\x1f\x7f-\xff]/)[0];
    return isPublicHttps(url) ? url : null;
  } catch {
    return null;
  }
}

const GOOGLE_HOST = /(^|\.)(google|gstatic|googleusercontent|ggpht)\.[a-z.]+$/i;

function isPublicHttps(u) {
  try {
    const { protocol, hostname } = new URL(u);
    if (protocol !== "https:") return false;
    if (hostname === "localhost" || !hostname.includes(".")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) return false;
    if (/\.(local|internal|localhost|lan)$/i.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function readHead(res, maxBytes = 300_000) {
  const reader = res.body?.getReader?.();
  if (!reader) return (await res.text()).slice(0, maxBytes);
  const dec = new TextDecoder();
  let html = "";
  while (html.length < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    html += dec.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  reader.cancel().catch(() => {});
  return html;
}

export function extractOgImage(html, baseUrl) {
  for (const prop of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>|<meta[^>]+content=["'][^"']+["'][^>]+(?:property|name)=["']${prop}["'][^>]*>`,
      "i"
    );
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']+)["']/i)?.[1];
    if (!content) continue;
    try {
      const abs = new URL(decodeEntities(content).trim(), baseUrl);
      if (abs.protocol === "https:" && !GOOGLE_HOST.test(abs.hostname)) return abs.href;
    } catch {}
  }
  return null;
}

async function findImage(link) {
  if (imageCache.has(link)) return imageCache.get(link);
  let image = null;
  try {
    let page = decodeGoogleNewsUrl(link);
    const headers = {
      "User-Agent": "Mozilla/5.0 (compatible; RitmoNews/1.0)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
    };
    const res = await fetch(page || link, { headers, redirect: "follow", signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    const finalUrl = res.url || page || link;
    if (res.ok && isPublicHttps(finalUrl) && !GOOGLE_HOST.test(new URL(finalUrl).hostname)) {
      image = extractOgImage(await readHead(res), finalUrl);
    }
  } catch {
    image = null;
  }
  imageCache.set(link, image);
  return image;
}

async function attachImages(items) {
  const queue = [...items];
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const image = await findImage(it.url);
      if (image) it.image = image;
    }
  };
  const all = Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));
  await Promise.race([all, new Promise((r) => setTimeout(r, IMAGE_BUDGET_MS))]);
  for (const it of items) if (!it.image && imageCache.get(it.url)) it.image = imageCache.get(it.url);
  return items;
}

export async function fetchNews(topic) {
  const query = TOPIC_QUERIES[topic];
  if (!query) {
    const err = new Error("Tema inválido");
    err.status = 400;
    throw err;
  }

  const hit = cache.get(topic);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(`${query} when:30d`) +
    "&hl=pt-BR&gl=BR&ceid=BR:pt-419";

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RitmoNews/1.0)", Accept: "application/rss+xml, application/xml" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = new Error(`Fonte de notícias respondeu ${res.status}`);
    err.status = 502;
    throw err;
  }

  const items = await attachImages(dedupeAndFilter(parseRss(await res.text())));
  const data = { topic, fetchedAt: new Date().toISOString(), items };
  cache.set(topic, { at: Date.now(), data });
  return data;
}

export async function handleNewsRequest(topic) {
  try {
    const data = await fetchNews(topic);
    return { status: 200, body: data, cache: "public, s-maxage=1800, stale-while-revalidate=3600" };
  } catch (err) {
    const status = err.status || 502;
    if (status !== 400) console.error("news:", err);
    return {
      status,
      body: { error: status === 400 ? "Tema inválido" : "Não foi possível buscar as notícias agora." },
      cache: "no-store",
    };
  }
}
