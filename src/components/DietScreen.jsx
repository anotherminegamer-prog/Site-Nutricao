import { useState } from "react";
import ProfileWizard from "./ProfileWizard";
import { getReadiness, recommend } from "../lib/diet";
import { GOAL_OPTIONS } from "../lib/dietData";

const GOAL_LABEL = Object.fromEntries(GOAL_OPTIONS.map((g) => [g.value, g.label]));

function StepsChecklist({ steps, onWizard, onGoTo }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="rt-card rt-diet-steps" aria-label="Etapas para a dieta ideal">
      <div className="rt-diet-steps-head">
        <h2 className="rt-section-title">Seu caminho até a dieta certa</h2>
        <span className="rt-points-pill">
          {done}/{steps.length}
        </span>
      </div>
      <ol className="rt-step-list">
        {steps.map((s) => (
          <li key={s.id} className={`rt-step ${s.done ? "rt-step-done" : ""}`}>
            <span className="rt-step-mark" aria-hidden="true">
              {s.done ? "✓" : ""}
            </span>
            <span className="rt-step-text">
              <strong>
                {s.label}
                {!s.required && <em> · opcional, melhora a precisão</em>}
              </strong>
              <small>{s.hint}</small>
            </span>
            {s.wizardStep !== undefined && (
              <button type="button" className="rt-link rt-focus" onClick={() => onWizard(s.wizardStep)}>
                {s.done ? "Editar" : "Preencher"}
              </button>
            )}
            {s.goTo && !s.done && (
              <button type="button" className="rt-link rt-focus" onClick={() => onGoTo(s.goTo)}>
                Registrar
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Notice({ type, text }) {
  return <p className={`rt-notice rt-notice-${type}`}>{text}</p>;
}

function Stat({ label, value, unit, sub }) {
  return (
    <div className="rt-diet-stat">
      <span className="rt-readout-label">{label}</span>
      <span className="rt-diet-stat-value">
        {value}
        {unit && <span className="rt-readout-unit">{unit}</span>}
      </span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function MacroBar({ macros }) {
  return (
    <div className="rt-macro">
      <div className="rt-macro-bar" role="img" aria-label={`Carboidratos ${macros.carbPct}%, proteínas ${macros.protPct}%, gorduras ${macros.fatPct}%`}>
        <span style={{ width: `${macros.carbPct}%`, background: "var(--amber)" }} />
        <span style={{ width: `${macros.protPct}%`, background: "var(--moss)" }} />
        <span style={{ width: `${macros.fatPct}%`, background: "var(--night)" }} />
      </div>
      <ul className="rt-macro-legend">
        <li>
          <i style={{ background: "var(--amber)" }} /> Carboidratos: {macros.carbG} g ({macros.carbPct}%)
        </li>
        <li>
          <i style={{ background: "var(--moss)" }} /> Proteínas: {macros.protG} g ({macros.protPct}%) · {macros.protPerKg} g/kg
        </li>
        <li>
          <i style={{ background: "var(--night)" }} /> Gorduras: {macros.fatG} g ({macros.fatPct}%)
        </li>
      </ul>
    </div>
  );
}

function DietCard({ pick, rank, targets, mealsPerDay }) {
  const { diet, score, reasons, warnings, adaptations, macros } = pick;
  return (
    <article className="rt-diet-card">
      <header className="rt-diet-card-head">
        <div>
          <span className={`rt-rank ${rank === 0 ? "rt-rank-top" : ""}`}>{rank === 0 ? "Melhor combinação" : "Alternativa"}</span>
          <h3>{diet.name}</h3>
          <p className="rt-diet-nick">{diet.nickname}</p>
        </div>
        <div className="rt-match" aria-label={`Compatibilidade de ${score}%`}>
          <span className="rt-match-value">{score}%</span>
          <span className="rt-match-label">compatível</span>
        </div>
      </header>

      <p className="rt-diet-short">{diet.short}</p>

      {reasons.length > 0 && (
        <div className="rt-diet-block">
          <h4>Por que combina com você</h4>
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {adaptations.length > 0 && (
        <div className="rt-diet-block">
          <h4>Adaptações para as suas restrições</h4>
          <ul>
            {adaptations.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rt-diet-block rt-diet-warn">
          <h4>Atenção</h4>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="rt-diet-details">
        <summary>Ver plano completo</summary>

        {macros && targets && (
          <div className="rt-diet-block">
            <h4>
              Sua meta com esta dieta: {targets.kcal} kcal por dia
              {mealsPerDay ? ` (≈ ${Math.round(targets.kcal / mealsPerDay / 10) * 10} kcal por refeição em ${mealsPerDay} refeições)` : ""}
            </h4>
            <MacroBar macros={macros} />
          </div>
        )}

        <div className="rt-diet-block">
          <h4>Como seguir</h4>
          <ul>
            {diet.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>

        <div className="rt-diet-cols">
          <div className="rt-diet-block">
            <h4>Priorize</h4>
            <ul>
              {diet.prioritize.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="rt-diet-block">
            <h4>Reduza</h4>
            <ul>
              {diet.limit.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rt-diet-block">
          <h4>Exemplo de um dia</h4>
          <dl className="rt-menu">
            {Object.entries(diet.menu).map(([meal, food]) => (
              <div key={meal}>
                <dt>{meal}</dt>
                <dd>{food}</dd>
              </div>
            ))}
          </dl>
          {mealsPerDay && mealsPerDay < 5 && (
            <p className="rt-diet-note">Você faz {mealsPerDay} refeições por dia: junte os lanches às refeições principais ou escolha só os que fazem sentido na sua rotina.</p>
          )}
        </div>

        {diet.tips.length > 0 && (
          <div className="rt-diet-block">
            <h4>Dica</h4>
            <ul>
              {diet.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="rt-diet-block rt-diet-sources">
          <h4>Base científica</h4>
          <p className="rt-diet-note">{diet.origin}</p>
          <ul>
            {diet.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </details>
    </article>
  );
}

function Results({ profile, entries }) {
  const rec = recommend(profile, entries);
  const { targets } = rec;
  const goalChanged = rec.goal !== rec.originalGoal;

  return (
    <>
      <section className="rt-diet-stats" aria-label="Seus números">
        <Stat label="IMC" value={rec.bmi.toFixed(1)} sub={`${rec.bmiClass} · ${rec.weightKg.toFixed(1)} kg`} />
        {targets ? (
          <>
            <Stat label="GASTO ESTIMADO" value={targets.tdee} unit="kcal" sub="por dia, com seu exercício" />
            <Stat label="META DIÁRIA" value={targets.kcal} unit="kcal" sub={GOAL_LABEL[rec.goal]} />
            <Stat label="ÁGUA" value={(targets.waterMl / 1000).toFixed(1)} unit="L" sub="referência: ~35 ml por kg" />
          </>
        ) : (
          <Stat label="METAS NUMÉRICAS" value="--" sub="não exibidas por segurança" />
        )}
      </section>

      {goalChanged && rec.allowNumbers && (
        <p className="rt-diet-note">Objetivo considerado na recomendação: {GOAL_LABEL[rec.goal]}.</p>
      )}

      {rec.notices.length > 0 && (
        <section className="rt-diet-notices" aria-label="Avisos importantes">
          {rec.notices.map((n) => (
            <Notice key={n.text} {...n} />
          ))}
        </section>
      )}

      <section className="rt-diet-notices" aria-label="O que seus registros mostram">
        <h2 className="rt-section-title">O que seus registros mostram</h2>
        {rec.insights.map((n) => (
          <Notice key={n.text} {...n} />
        ))}
      </section>

      <section aria-label="Dietas recomendadas">
        <h2 className="rt-section-title">{rec.picks.length > 1 ? "Dietas recomendadas para você" : "Dieta recomendada para você"}</h2>
        <div className="rt-diet-list">
          {rec.picks.map((p, i) => (
            <DietCard key={p.diet.id} pick={p} rank={i} targets={targets} mealsPerDay={rec.mealsPerDay} />
          ))}
        </div>
      </section>

      <p className="rt-fineprint rt-diet-disclaimer">
        As calorias são estimativas (equação de Mifflin-St Jeor mais o exercício registrado) e as dietas são padrões
        alimentares gerais, não prescrições. Elas não substituem a avaliação de um nutricionista ou médico, que
        considera exames, medicamentos e histórico. Procure um profissional antes de mudanças importantes,
        principalmente se você tem alguma condição de saúde.
      </p>
    </>
  );
}

export default function DietScreen({ profile, entries, banner, userName, onSaveProfile, onDeleteProfile, onBackToDashboard, onOpenGoals, onOpenNews, onLogout }) {
  const [wizardStep, setWizardStep] = useState(null); // null = fechado, número = etapa inicial
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const firstName = userName.split(" ")[0];

  const { steps, ready, precision } = getReadiness(profile, entries);
  const showWizard = !profile || wizardStep !== null;

  const handleGoTo = (target) => {
    if (target === "dashboard") onBackToDashboard();
  };

  const handleSave = async (values) => {
    const ok = await onSaveProfile(values);
    if (ok) setWizardStep(null);
    return ok;
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
          <button className="rt-nav-btn rt-focus" onClick={onOpenNews}>
            Notícias
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
          <h1 className="rt-goals-title">Dietas para você</h1>
          <p className="rt-goals-sub">
            Responda algumas etapas e registre peso, sono e exercício. A recomendação usa tudo isso.
          </p>
        </div>
        {ready && (
          <span className="rt-points-pill" title="Quanto mais registros, mais precisa a recomendação">
            precisão {precision}
          </span>
        )}
      </section>

      <StepsChecklist
        steps={steps}
        onWizard={(i) => setWizardStep(i)}
        onGoTo={handleGoTo}
      />

      {showWizard && (
        <section className="rt-card rt-wizard-card" aria-label="Questionário">
          <h2 className="rt-section-title">{profile ? "Editar suas informações" : "Vamos conhecer você"}</h2>
          <ProfileWizard
            key={wizardStep ?? "new"}
            profile={profile}
            initialStep={wizardStep ?? 0}
            onSave={handleSave}
            onCancel={profile ? () => setWizardStep(null) : undefined}
          />
        </section>
      )}

      {!showWizard && ready && <Results profile={profile} entries={entries} />}

      {!showWizard && profile && !ready && (
        <section className="rt-card">
          <p className="rt-card-empty">
            Falta só registrar o seu peso para calcular as suas metas e liberar as dietas.
          </p>
          <button className="rt-btn rt-btn-primary rt-btn-small rt-focus" style={{ marginTop: 12 }} onClick={onBackToDashboard}>
            Ir para o painel registrar o peso
          </button>
        </section>
      )}

      {profile && (
        <footer className="rt-footer">
          {!confirmingDelete ? (
            <button className="rt-link rt-danger rt-focus" onClick={() => setConfirmingDelete(true)}>
              Apagar meu perfil de saúde
            </button>
          ) : (
            <span className="rt-confirm-row">
              <span>Isso apaga idade, altura, objetivo, restrições e condições de saúde. Seus registros de peso, sono e exercício continuam.</span>
              <button
                className="rt-link rt-danger rt-focus"
                onClick={() => {
                  onDeleteProfile();
                  setConfirmingDelete(false);
                  setWizardStep(null);
                }}
              >
                Confirmar
              </button>
              <button className="rt-link rt-focus" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </button>
            </span>
          )}
        </footer>
      )}
    </div>
  );
}
