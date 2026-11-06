const pad2 = (n) => String(n).padStart(2, "0");

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

export const daysAgo = (d) => {
  const diff = (new Date(`${todayStr()}T00:00:00`) - new Date(`${d}T00:00:00`)) / 86400000;
  return Math.round(diff);
};

export const BRAND = "Nutri Vita";

export function lastNDays(n) {
  const out = [];
  const base = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }
  return out;
}

const isDark = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
};

export function themeVars(cosmetic) {
  const { bg, ink } = cosmetic || COSMETIC_STYLES.branco;
  const dark = isDark(bg);
  return {
    "--bg": bg,
    "--fg": ink,
    "--surface": dark ? `color-mix(in srgb, ${bg} 88%, #ffffff)` : `color-mix(in srgb, ${bg} 30%, #ffffff)`,
    "--brand": dark ? "#6FCF97" : "#2E7A4D",
    "--brand-ink": dark ? "#08170E" : "#FFFFFF",
    "--shadow-a": dark ? "0.4" : "0.07",
  };
}

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
