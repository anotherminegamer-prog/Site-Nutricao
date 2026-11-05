/* ---------- helpers ---------- */

const pad2 = (n) => String(n).padStart(2, "0");

// Data de hoje no fuso LOCAL da pessoa (YYYY-MM-DD).
// Antes usava toISOString(), que é UTC: no Brasil (UTC-3), depois das 21h o
// app já achava que era o dia seguinte e registros/metas caíam no dia errado.
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const fmtDateShort = (d) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${d}T12:00:00`));

export const fmtDateHeader = (d) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "long" }).format(
    new Date(`${d}T12:00:00`)
  );

// Diferença em dias entre hoje (local) e a data informada. Arredonda para
// absorver as mudanças de horário de verão (dia com 23h/25h).
export const daysAgo = (d) => {
  const diff = (new Date(`${todayStr()}T00:00:00`) - new Date(`${d}T00:00:00`)) / 86400000;
  return Math.round(diff);
};

export const TYPE_META = {
  weight: { label: "Peso", unit: "kg", color: "var(--amber)", short: "PESO" },
  sleep: { label: "Sono", unit: "h", color: "var(--night)", short: "SONO" },
  exercise: { label: "Exercício", unit: "min", color: "var(--moss)", short: "EXERC" },
};

export const DEFAULT_GOALS = [
  "Beber pelo menos 2 litros de água",
  "Incluir uma fruta em alguma refeição",
  "Comer vegetais em pelo menos uma refeição",
  "Variar os alimentos em relação a ontem",
  "Caminhar por pelo menos 10 minutos",
  "Fazer uma pausa para se alongar",
  "Reduzir doces e ultraprocessados hoje",
  "Comer devagar, sem pressa",
];

export const COSMETIC_STYLES = {
  branco: { label: "Branco", bg: "#FFFFFF", ink: "#14211D" },
  preto: { label: "Preto", bg: "#111312", ink: "#F2F4F2" },
  areia: { label: "Areia", bg: "#F1E4CF", ink: "#3D3423" },
  ceu: { label: "Céu", bg: "#DCEBF5", ink: "#1E3A47" },
  pessego: { label: "Pêssego", bg: "#F7DED2", ink: "#4A2E22" },
  lavanda: { label: "Lavanda", bg: "#E6DFF5", ink: "#352C4A" },
  menta: { label: "Menta", bg: "#D7F0E4", ink: "#1F4536" },
  grafite: { label: "Grafite", bg: "#2A2E2C", ink: "#F2F4F2" },
};

export function groupByDate(entries) {
  const map = new Map();
  entries.forEach((e) => {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  });
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
