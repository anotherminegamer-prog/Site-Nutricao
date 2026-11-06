import { ageFromBirth, recommend } from "./diet";
import { RESTRICTION_LABELS } from "./dietData";


export const PLAN_PREFIX = "Plano: ";

const NO_NUMBERS = ["eating_disorder", "pregnant", "lactating", "kidney"];

const fmtLiters = (ml) => `${(ml / 1000).toFixed(1).replace(".", ",")} L`;
const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

export function buildPlanGoals(profile, entries) {
  if (!profile) return [];
  const conditions = profile.conditions || [];
  const age = ageFromBirth(profile.birth_date);
  const numbersOk = age >= 18 && !conditions.some((c) => NO_NUMBERS.includes(c));
  const goals = [];

  if (entries.some((e) => e.type === "weight")) {
    try {
      const rec = recommend(profile, entries);
      if (rec.targets) {
        goals.push(`beber ${fmtLiters(rec.targets.waterMl)} de água`);
        goals.push(`ficar perto de ${rec.targets.kcal} kcal hoje`);
        const prot = rec.picks[0]?.macros?.protG;
        if (prot) goals.push(`comer cerca de ${prot} g de proteína`);
      }
    } catch (err) {
      console.error("buildPlanGoals:", err);
    }
  }

  if (profile.meals_per_day) goals.push(`fazer as ${profile.meals_per_day} refeições do dia, sem pular nenhuma`);

  if (numbersOk) {
    const minutes = profile.lifestyle === "active" ? 20 : 30;
    let label = `fazer ${minutes} minutos de atividade física`;
    if (profile.goal === "gain") label += ", com treino de força";
    if (conditions.includes("heart") || conditions.includes("hypertension")) label += " (combine a intensidade com seu médico)";
    goals.push(label);
  }

  goals.push(age < 18 ? "dormir de 8 a 10 horas" : "dormir de 7 a 9 horas");

  goals.push(
    profile.cooking_time === "little" ? "preparar uma refeição simples, de até 20 minutos" : "cozinhar uma refeição em casa"
  );

  const restrictions = (profile.restrictions || []).map((r) => lowerFirst(RESTRICTION_LABELS[r] || r));
  if (restrictions.length) goals.push(`respeitar suas restrições: ${restrictions.join(", ")}`);

  return goals.map((g) => PLAN_PREFIX + g);
}
