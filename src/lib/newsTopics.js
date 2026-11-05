/* Temas da seção Notícias.
   Os ids precisam bater com TOPIC_QUERIES em server/news-core.js: é por eles
   que o endpoint /api/news decide qual busca fazer. */

export const NEWS_TOPICS = [
  { id: "emagrecimento", label: "Emagrecimento", color: "var(--wine)" },
  { id: "dietas", label: "Dietas especiais", color: "var(--amber)" },
  { id: "nutricionistas", label: "Dicas de nutricionistas", color: "var(--moss)" },
  { id: "saude", label: "Saúde e alimentação", color: "var(--night)" },
];

export const NEWS_TOPIC_BY_ID = Object.fromEntries(NEWS_TOPICS.map((t) => [t.id, t]));
