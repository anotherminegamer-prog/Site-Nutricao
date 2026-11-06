import { useState } from "react";
import {
  SEX_OPTIONS,
  LIFESTYLE_OPTIONS,
  GOAL_OPTIONS,
  COOKING_OPTIONS,
  BUDGET_OPTIONS,
  RESTRICTION_OPTIONS,
  CONDITION_OPTIONS,
} from "../lib/dietData";
import { ageFromBirth } from "../lib/diet";
import { todayStr } from "../lib/helpers";

const STEP_TITLES = ["Sobre você", "Rotina e objetivo", "Restrições e alergias", "Saúde"];

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div className="rt-choice-list" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`rt-choice ${value === o.value ? "rt-choice-on" : ""}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className="rt-choice-text">
            <span>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}

function CheckGroup({ options, values, onToggle }) {
  return (
    <div className="rt-choice-list">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <label key={o.value} className={`rt-choice ${on ? "rt-choice-on" : ""}`}>
            <input type="checkbox" checked={on} onChange={() => onToggle(o.value)} />
            <span className="rt-choice-text">
              <span>{o.label}</span>
              {o.hint && <small>{o.hint}</small>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function ProfileWizard({ profile, initialStep = 0, onSave, onCancel }) {
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    birth_date: profile?.birth_date || "",
    sex: profile?.sex || "",
    height_cm: profile?.height_cm ? String(profile.height_cm) : "",
    lifestyle: profile?.lifestyle || "",
    goal: profile?.goal || "",
    meals_per_day: profile?.meals_per_day || 4,
    cooking_time: profile?.cooking_time || "some",
    budget: profile?.budget || "medium",
    restrictions: profile?.restrictions || [],
    conditions: profile?.conditions || [],
    consent: !!profile?.consented_at,
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  const setSex = (sex) =>
    setForm((f) => ({
      ...f,
      sex,
      conditions: sex === "male" ? f.conditions.filter((c) => c !== "pregnant" && c !== "lactating") : f.conditions,
    }));

  const validate = (index) => {
    if (index === 0) {
      if (!form.birth_date) return "Informe sua data de nascimento.";
      const age = ageFromBirth(form.birth_date);
      if (Number.isNaN(age) || age < 10 || age > 110) return "Confira sua data de nascimento.";
      if (!form.sex) return "Escolha uma opção de sexo (usada só no cálculo de energia).";
      const h = Number(form.height_cm);
      if (!h || h < 100 || h > 250) return "Informe sua altura em centímetros (entre 100 e 250).";
    }
    if (index === 1) {
      if (!form.lifestyle) return "Escolha como é o seu dia a dia.";
      if (!form.goal) return "Escolha o seu objetivo.";
    }
    if (index === 3 && !form.consent) {
      return "Para salvar, confirme que entendeu o aviso e concorda com o armazenamento.";
    }
    return "";
  };

  const next = () => {
    const msg = validate(step);
    if (msg) return setError(msg);
    setError("");
    setStep((s) => s + 1);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step < STEP_TITLES.length - 1) return next();
    for (let i = 0; i < STEP_TITLES.length; i += 1) {
      const msg = validate(i);
      if (msg) {
        setStep(i);
        return setError(msg);
      }
    }
    setError("");
    setSaving(true);
    const ok = await onSave({
      birth_date: form.birth_date,
      sex: form.sex,
      height_cm: Number(form.height_cm),
      lifestyle: form.lifestyle,
      goal: form.goal,
      meals_per_day: Number(form.meals_per_day),
      cooking_time: form.cooking_time,
      budget: form.budget,
      restrictions: form.restrictions,
      conditions: form.conditions,
      consented_at: profile?.consented_at || new Date().toISOString(),
    });
    setSaving(false);
    if (!ok) setError("Não foi possível salvar agora. Tente de novo.");
  };

  const conditionOptions = CONDITION_OPTIONS.filter((o) => !(o.femaleOnly && form.sex === "male"));

  return (
    <form className="rt-wizard" onSubmit={submit} noValidate>
      <ol className="rt-wizard-steps" aria-label="Etapas do questionário">
        {STEP_TITLES.map((t, i) => (
          <li key={t} className={i === step ? "rt-wz-current" : i < step ? "rt-wz-done" : ""}>
            <span className="rt-wz-num">{i + 1}</span>
            <span className="rt-wz-label">{t}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="rt-wz-body">
          <label className="rt-field">
            <span>Data de nascimento</span>
            <input
              className="rt-input rt-focus"
              type="date"
              value={form.birth_date}
              min="1900-01-01"
              max={todayStr()}
              onChange={(e) => set("birth_date", e.target.value)}
            />
          </label>
          <fieldset className="rt-fieldset">
            <legend>Sexo (usado só no cálculo do gasto de energia)</legend>
            <RadioGroup name="sex" options={SEX_OPTIONS} value={form.sex} onChange={setSex} />
          </fieldset>
          <label className="rt-field">
            <span>Altura (cm)</span>
            <input
              className="rt-input rt-input-num rt-focus"
              type="number"
              inputMode="decimal"
              step="1"
              min="100"
              max="250"
              value={form.height_cm}
              onChange={(e) => set("height_cm", e.target.value)}
              placeholder="ex: 170"
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="rt-wz-body">
          <fieldset className="rt-fieldset">
            <legend>Como é o seu dia a dia (sem contar os treinos)?</legend>
            <RadioGroup name="lifestyle" options={LIFESTYLE_OPTIONS} value={form.lifestyle} onChange={(v) => set("lifestyle", v)} />
          </fieldset>
          <fieldset className="rt-fieldset">
            <legend>Qual é o seu objetivo?</legend>
            <RadioGroup name="goal" options={GOAL_OPTIONS} value={form.goal} onChange={(v) => set("goal", v)} />
          </fieldset>
          <label className="rt-field">
            <span>Quantas refeições você costuma fazer por dia?</span>
            <select
              className="rt-input rt-focus"
              value={form.meals_per_day}
              onChange={(e) => set("meals_per_day", e.target.value)}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} refeições
                </option>
              ))}
            </select>
          </label>
          <fieldset className="rt-fieldset">
            <legend>Quanto tempo tem para cozinhar?</legend>
            <RadioGroup name="cooking" options={COOKING_OPTIONS} value={form.cooking_time} onChange={(v) => set("cooking_time", v)} />
          </fieldset>
          <fieldset className="rt-fieldset">
            <legend>Orçamento para alimentação</legend>
            <RadioGroup name="budget" options={BUDGET_OPTIONS} value={form.budget} onChange={(v) => set("budget", v)} />
          </fieldset>
        </div>
      )}

      {step === 2 && (
        <div className="rt-wz-body">
          <p className="rt-wz-help">Marque tudo o que se aplica. Se não houver nenhuma restrição, é só avançar.</p>
          <CheckGroup options={RESTRICTION_OPTIONS} values={form.restrictions} onToggle={(v) => toggle("restrictions", v)} />
        </div>
      )}

      {step === 3 && (
        <div className="rt-wz-body">
          <p className="rt-wz-help">
            Algumas condições mudam o que é seguro recomendar. Marque o que se aplica; se nada, é só seguir. Esses dados
            são sensíveis: ficam apenas na sua conta e você pode apagá-los quando quiser.
          </p>
          <CheckGroup options={conditionOptions} values={form.conditions} onToggle={(v) => toggle("conditions", v)} />
          <label className={`rt-choice rt-consent ${form.consent ? "rt-choice-on" : ""}`}>
            <input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
            <span className="rt-choice-text">
              <span>
                Entendo que as dietas são orientações gerais e não substituem nutricionista ou médico, e concordo em
                guardar estas informações de saúde na minha conta.
              </span>
            </span>
          </label>
        </div>
      )}

      {error && (
        <p className="rt-error" role="alert">
          {error}
        </p>
      )}

      <div className="rt-wz-actions">
        {step > 0 ? (
          <button type="button" className="rt-btn rt-btn-ghost rt-focus" onClick={() => { setError(""); setStep(step - 1); }}>
            Voltar
          </button>
        ) : onCancel ? (
          <button type="button" className="rt-btn rt-btn-ghost rt-focus" onClick={onCancel}>
            Cancelar
          </button>
        ) : (
          <span />
        )}
        {step < STEP_TITLES.length - 1 ? (
          <button type="button" className="rt-btn rt-btn-primary rt-focus" onClick={next}>
            Continuar
          </button>
        ) : (
          <button type="submit" className="rt-btn rt-btn-primary rt-focus" disabled={saving}>
            {saving ? "Salvando…" : "Salvar e ver minhas dietas"}
          </button>
        )}
      </div>
    </form>
  );
}
