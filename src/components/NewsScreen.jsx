import { useEffect, useState } from "react";
import { NEWS_TOPICS, NEWS_TOPIC_BY_ID } from "../lib/newsTopics";
import { FALLBACK_NEWS, FALLBACK_SAVED_AT } from "../lib/newsFallback";

/* Seção de notícias sobre nutrição.

   As notícias vêm de /api/news (server/news-core.js), que lê o Google Notícias
   no servidor, e cada item aponta para a matéria original no site do veículo.
   Se o endpoint falhar, a tela mostra a seleção de reserva de
   src/lib/newsFallback.js, avisando que ela é salva. */

const PAGE_SIZE = 12;
const CLIENT_TTL_MS = 10 * 60 * 1000;
const clientCache = new Map(); // topicId -> { at, items }

function isHttps(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

const isValidItem = (it) =>
  it && typeof it.title === "string" && it.title.trim() && typeof it.source === "string" && isHttps(it.url);

// a imagem é opcional: se vier algo inválido, o item só fica sem foto
const cleanItem = (it, topicId) => ({ ...it, topic: topicId, image: isHttps(it.image) ? it.image : undefined });

async function loadTopic(topicId, { force, signal }) {
  const hit = clientCache.get(topicId);
  if (!force && hit && Date.now() - hit.at < CLIENT_TTL_MS) return hit.items;

  const res = await fetch(`/api/news?topic=${encodeURIComponent(topicId)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // num site estático sem o endpoint, o servidor devolve o index.html com 200;
  // o .json() falha e a tela cai na seleção de reserva
  const data = await res.json();
  if (!Array.isArray(data?.items)) throw new Error("resposta inesperada");

  const items = data.items.filter(isValidItem).map((it) => cleanItem(it, topicId));
  clientCache.set(topicId, { at: Date.now(), items });
  return items;
}

const normTitle = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 80);

// junta temas, tira repetidas (a mesma matéria pode aparecer em dois temas) e põe a mais nova primeiro
function mergeItems(lists) {
  const seen = new Set();
  const out = [];
  for (const it of lists.flat()) {
    const keys = [it.url, normTitle(it.title)];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push(it);
  }
  return out.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}

function fallbackFor(topicId) {
  const list = topicId === "all" ? FALLBACK_NEWS : FALLBACK_NEWS.filter((n) => n.topic === topicId);
  return mergeItems([list]);
}

// "hoje", "ontem", "há 3 dias" ou a data, sempre pelo dia local da pessoa
function fmtNewsDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

const fmtSavedAt = (iso) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`)
  );

function useNews(topicId, reloadKey) {
  const [state, setState] = useState({ status: "loading", items: [], fallback: false, partial: false });

  useEffect(() => {
    const ctrl = new AbortController();
    const force = reloadKey > 0;
    const ids = topicId === "all" ? NEWS_TOPICS.map((t) => t.id) : [topicId];
    setState((s) => ({ ...s, status: "loading" }));

    Promise.allSettled(ids.map((id) => loadTopic(id, { force, signal: ctrl.signal }))).then((results) => {
      if (ctrl.signal.aborted) return;
      const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      if (ok.length === 0) {
        setState({ status: "done", items: fallbackFor(topicId), fallback: true, partial: false });
      } else {
        setState({ status: "done", items: mergeItems(ok), fallback: false, partial: ok.length < ids.length });
      }
    });

    return () => ctrl.abort();
  }, [topicId, reloadKey]);

  return state;
}


/* Ilustração do tema, usada quando a matéria não tem foto (ou ela não carrega). */
const ART = {
  emagrecimento: (
    <>
      <rect x="14" y="20" width="36" height="28" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M22 32a10 10 0 0 1 20 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 32l4-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  dietas: (
    <>
      <circle cx="32" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="32" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <path d="M9 18v10a3 3 0 0 0 3 3v15M15 18v13M12 18v-0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M55 18c-4 3-5 8-5 13h5v15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  nutricionistas: (
    <>
      <path d="M32 24c-5-4-16-2-16 10 0 9 6 17 11 17 3 0 3-1.5 5-1.5s2 1.5 5 1.5c5 0 11-8 11-17 0-12-11-14-16-10z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 24c0-5 2-8 6-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  saude: (
    <path d="M32 50S12 38 12 25c0-6 4-10 9.5-10 4 0 7.5 2.5 10.500 6.500C35 17.5 38.5 15 42.500 15 48 15 52 19 52 25c0 13-20 25-20 25z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
  ),
};

function TopicArt({ topicId }) {
  const topic = NEWS_TOPIC_BY_ID[topicId];
  return (
    <div className="rt-news-art" style={{ color: topic?.color || "var(--ink-soft)" }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="56" height="56">
        {ART[topicId] || ART.saude}
      </svg>
    </div>
  );
}

function NewsThumb({ item }) {
  const [failed, setFailed] = useState(false);
  if (item.image && !failed) {
    return (
      <div className="rt-news-thumb">
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return <TopicArt topicId={item.topic} />;
}

function NewsCard({ item }) {
  const topic = NEWS_TOPIC_BY_ID[item.topic];
  const when = fmtNewsDate(item.publishedAt);
  return (
    <li className="rt-card rt-news-card">
      <NewsThumb item={item} />
      <div className="rt-news-body">
        {topic && (
          <span className="rt-news-topic">
            <span className="rt-card-dot" style={{ background: topic.color }} aria-hidden="true" />
            {topic.label}
          </span>
        )}
        <h3 className="rt-news-title">
          <a className="rt-news-link rt-focus" href={item.url} target="_blank" rel="noopener noreferrer">
            {item.title}
            <span className="rt-news-ext" aria-hidden="true">
              {" "}
              ↗
            </span>
            <span className="rt-sr-only"> (abre em uma nova aba)</span>
          </a>
        </h3>
        <p className="rt-news-meta">
          <strong>{item.source}</strong>
          {when && <span> · {when}</span>}
        </p>
      </div>
    </li>
  );
}

export default function NewsScreen({ banner, userName, onBackToDashboard, onOpenDiet, onOpenGoals, onLogout }) {
  const [topicId, setTopicId] = useState("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { status, items, fallback, partial } = useNews(topicId, reloadKey);
  const firstName = userName.split(" ")[0];
  const loading = status === "loading";

  const pickTopic = (id) => {
    setTopicId(id);
    setVisible(PAGE_SIZE);
  };

  return (
    <div className="rt-app">
      {banner && <div className="rt-banner">{banner}</div>}

      <header className="rt-header">
        <div className="rt-brand">
          <span className="rt-brand-mark" aria-hidden="true" />
          <span className="rt-brand-name">PROTÓTIPO</span>
        </div>
        <div className="rt-header-right">
          <button className="rt-nav-btn rt-focus" onClick={onBackToDashboard}>
            Painel
          </button>
          <button className="rt-nav-btn rt-focus" onClick={onOpenDiet}>
            Dietas
          </button>
          <button className="rt-nav-btn rt-focus" onClick={onOpenGoals}>
            Metas
          </button>
          <span className="rt-greeting">Olá, {firstName}</span>
          <button className="rt-link rt-focus" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <section className="rt-goals-hero">
        <div>
          <h1 className="rt-goals-title">Notícias de nutrição</h1>
          <p className="rt-goals-sub">
            Emagrecimento, dietas especiais e dicas de nutricionistas, direto de jornais e portais de saúde.
          </p>
        </div>
      </section>

      <div className="rt-news-filters" role="group" aria-label="Filtrar por tema">
        {[{ id: "all", label: "Todas" }, ...NEWS_TOPICS].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rt-chip rt-focus ${topicId === t.id ? "rt-chip-on" : ""}`}
            aria-pressed={topicId === t.id}
            onClick={() => pickTopic(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rt-news-status" aria-live="polite">
        {loading && (
          <span className="rt-news-loading">
            <span className="rt-boot-dot" aria-hidden="true" /> buscando notícias…
          </span>
        )}
        {!loading && fallback && (
          <p className="rt-notice rt-notice-warn">
            Não foi possível buscar as notícias ao vivo agora. Mostrando uma seleção salva em{" "}
            {fmtSavedAt(FALLBACK_SAVED_AT)}.{" "}
            <button type="button" className="rt-link rt-focus" onClick={() => setReloadKey((k) => k + 1)}>
              Tentar de novo
            </button>
          </p>
        )}
        {!loading && !fallback && partial && (
          <p className="rt-notice rt-notice-info">Alguns temas não carregaram agora e ficaram de fora desta lista.</p>
        )}
        {!loading && !fallback && !partial && (
          <button type="button" className="rt-link rt-focus" onClick={() => setReloadKey((k) => k + 1)}>
            Atualizar
          </button>
        )}
      </div>

      {!loading && items.length === 0 && (
        <section className="rt-card">
          <p className="rt-card-empty">Nenhuma notícia encontrada agora para este tema. Tente outro filtro.</p>
        </section>
      )}

      {items.length > 0 && (
        <ul className={`rt-news-list ${loading ? "rt-news-stale" : ""}`} aria-busy={loading}>
          {items.slice(0, visible).map((it) => (
            <NewsCard key={it.url} item={it} />
          ))}
        </ul>
      )}

      {!loading && items.length > visible && (
        <button type="button" className="rt-btn rt-btn-ghost rt-btn-small rt-focus" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
          Ver mais notícias
        </button>
      )}

      <p className="rt-fineprint rt-diet-disclaimer">
        As matérias são de veículos externos, reunidas automaticamente a partir do Google Notícias, e o app não as
        escreve nem revisa. Notícias e dicas gerais não substituem a avaliação de um nutricionista ou médico, que
        considera seus exames, medicamentos e histórico. Desconfie de promessas de resultado rápido.
      </p>
    </div>
  );
}
