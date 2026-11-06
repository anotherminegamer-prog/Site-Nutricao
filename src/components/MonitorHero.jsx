import { useId } from "react";
import { daysAgo, fmtDateShort, lastNDays } from "../lib/helpers";


const DAYS = 14;
const W = 560;
const H = 92;
const PAD = { l: 34, r: 12, t: 10, b: 10 };
const plotW = W - PAD.l - PAD.r;
const plotH = H - PAD.t - PAD.b;

const COLORS = { weight: "#F0B26A", sleep: "#6FE7C3", exercise: "#9BD68A" };

const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

function byDay(entries, type, reduce) {
  const map = new Map();
  entries.filter((e) => e.type === type).forEach((e) => {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  });
  const out = new Map();
  map.forEach((list, date) => out.set(date, reduce(list)));
  return out;
}

function Channel({ label, color, value, unit, caption, delta, children }) {
  return (
    <div className="rt-channel">
      <div className="rt-channel-info">
        <span className="rt-readout-label">{label}</span>
        <span className="rt-readout-value" style={{ color }}>
          {value}
          <span className="rt-readout-unit">{unit}</span>
        </span>
        {delta !== null && delta !== undefined && !Number.isNaN(delta) && (
          <span className={`rt-readout-delta ${delta <= 0 ? "rt-delta-down" : "rt-delta-up"}`}>
            {delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)} kg
          </span>
        )}
        {caption && <span className="rt-channel-caption">{caption}</span>}
      </div>
      <div className="rt-channel-plot">{children}</div>
    </div>
  );
}

function Grid({ ticks, yFor, fmt }) {
  return ticks.map((t) => (
    <g key={t}>
      <line x1={PAD.l} x2={W - PAD.r} y1={yFor(t)} y2={yFor(t)} className="rt-grid-line" />
      <text x={PAD.l - 6} y={yFor(t) + 3} textAnchor="end" className="rt-grid-label">
        {fmt(t)}
      </text>
    </g>
  ));
}

function Empty({ text }) {
  return (
    <text x={W / 2} y={H / 2 + 4} textAnchor="middle" className="rt-monitor-empty">
      {text}
    </text>
  );
}

export default function MonitorHero({ entries }) {
  const uid = useId().replace(/:/g, "");
  const days = lastNDays(DAYS);
  const xFor = (i) => PAD.l + (i / (DAYS - 1)) * plotW;

  const weight = byDay(entries, "weight", (l) => l.slice().sort((a, b) => b.createdAt - a.createdAt)[0].value);
  const sleep = byDay(entries, "sleep", (l) => avg(l.map((e) => Number(e.value))));
  const exercise = byDay(entries, "exercise", (l) => l.reduce((s, e) => s + Number(e.value), 0));

  const pointsOf = (map) =>
    days.map((d, i) => (map.has(d) ? { i, d, v: Number(map.get(d)) } : null)).filter(Boolean);
  const pathOf = (pts, yFor) => pts.map((p, k) => `${k ? "L" : "M"} ${xFor(p.i).toFixed(1)},${yFor(p.v).toFixed(1)}`).join(" ");

  const in7 = (e) => daysAgo(e.date) >= 0 && daysAgo(e.date) <= 6;
  const sleep7 = entries.filter((e) => e.type === "sleep" && in7(e));
  const avgSleep7 = sleep7.length ? avg(sleep7.map((e) => Number(e.value))) : null;
  const total7 = entries.filter((e) => e.type === "exercise" && in7(e)).reduce((s, e) => s + Number(e.value), 0);
  const weightsAll = entries
    .filter((e) => e.type === "weight")
    .slice()
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  const lastW = weightsAll[weightsAll.length - 1];
  const prevW = weightsAll[weightsAll.length - 2];
  const weightDelta = lastW && prevW ? lastW.value - prevW.value : null;

  const wPts = pointsOf(weight);
  const wVals = wPts.map((p) => p.v);
  let wMin = wVals.length ? Math.min(...wVals) : 0;
  let wMax = wVals.length ? Math.max(...wVals) : 1;
  if (wMax - wMin < 1) {
    wMin -= 0.5;
    wMax += 0.5;
  }
  const wYFor = (v) => PAD.t + (1 - (v - wMin) / (wMax - wMin)) * plotH;
  const wTicks = [wMin, (wMin + wMax) / 2, wMax];

  const sPts = pointsOf(sleep);
  const sYFor = (v) => PAD.t + (1 - Math.min(Math.max(v, 0), 10) / 10) * plotH;

  const ePts = pointsOf(exercise);
  const eMax = Math.max(60, ...ePts.map((p) => p.v));
  const eYFor = (v) => PAD.t + (1 - v / eMax) * plotH;
  const eTicks = [0, Math.round(eMax / 2), eMax];
  const barW = Math.min(18, (plotW / DAYS) * 0.6);

  const axis = (
    <g>
      {[0, Math.floor((DAYS - 1) / 2), DAYS - 1].map((i) => (
        <text key={i} x={xFor(i)} y={H - 0} textAnchor={i === 0 ? "start" : i === DAYS - 1 ? "end" : "middle"} className="rt-grid-label">
          {fmtDateShort(days[i])}
        </text>
      ))}
    </g>
  );

  return (
    <section className="rt-hero" aria-label="Seus gráficos dos últimos 14 dias">
      <div className="rt-hero-head">
        <h2 className="rt-hero-title">Seu ritmo</h2>
        <span className="rt-hero-range">últimos {DAYS} dias</span>
      </div>

      <Channel
        label="PESO ATUAL"
        color={COLORS.weight}
        value={lastW ? Number(lastW.value).toFixed(1) : "--"}
        unit="kg"
        delta={weightDelta}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="rt-monitor-svg" role="img" aria-label="Gráfico de peso">
          <Grid ticks={wTicks} yFor={wYFor} fmt={(t) => t.toFixed(1)} />
          {wPts.length === 0 ? (
            <Empty text="Sem registros de peso ainda." />
          ) : (
            <>
              {wPts.length > 1 && <path d={pathOf(wPts, wYFor)} className="rt-trace-path" style={{ stroke: COLORS.weight }} />}
              {wPts.map((p) => (
                <circle key={p.d} cx={xFor(p.i)} cy={wYFor(p.v)} r="3.4" fill={COLORS.weight}>
                  <title>{`${fmtDateShort(p.d)}: ${p.v.toFixed(1)} kg`}</title>
                </circle>
              ))}
            </>
          )}
        </svg>
      </Channel>

      <Channel
        label="SONO MÉDIO · 7D"
        color={COLORS.sleep}
        value={avgSleep7 !== null ? avgSleep7.toFixed(1) : "--"}
        unit="h"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="rt-monitor-svg" role="img" aria-label="Gráfico de sono">
          <defs>
            <filter id={`${uid}-glow`} x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect x={PAD.l} y={sYFor(9)} width={plotW} height={sYFor(7) - sYFor(9)} className="rt-target-band" />
          <Grid ticks={[0, 5, 10]} yFor={sYFor} fmt={(t) => `${t}h`} />
          {sPts.length === 0 ? (
            <Empty text="Sem registros de sono ainda." />
          ) : (
            <>
              {sPts.length > 1 && (
                <path d={pathOf(sPts, sYFor)} className="rt-trace-path" style={{ stroke: COLORS.sleep }} filter={`url(#${uid}-glow)`} />
              )}
              {sPts.map((p) => (
                <circle key={p.d} cx={xFor(p.i)} cy={sYFor(p.v)} r="3.4" fill={COLORS.sleep}>
                  <title>{`${fmtDateShort(p.d)}: ${p.v.toFixed(1)} h`}</title>
                </circle>
              ))}
            </>
          )}
        </svg>
      </Channel>

      <Channel
        label="EXERCÍCIO · 7D"
        color={COLORS.exercise}
        value={String(total7)}
        unit="min"
        caption={null}
      >
        <svg viewBox={`0 0 ${W} ${H + 16}`} className="rt-monitor-svg" role="img" aria-label="Gráfico de exercício">
          <Grid ticks={eTicks} yFor={eYFor} fmt={(t) => String(t)} />
          {ePts.length === 0 ? (
            <Empty text="Sem registros de exercício ainda." />
          ) : (
            ePts.map((p) => (
              <rect
                key={p.d}
                x={xFor(p.i) - barW / 2}
                y={eYFor(p.v)}
                width={barW}
                height={Math.max(2, eYFor(0) - eYFor(p.v))}
                rx="3"
                fill={COLORS.exercise}
              >
                <title>{`${fmtDateShort(p.d)}: ${p.v} min`}</title>
              </rect>
            ))
          )}
          <g transform="translate(0,12)">{axis}</g>
        </svg>
      </Channel>
    </section>
  );
}
