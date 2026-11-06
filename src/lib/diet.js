import { DIETS, RESTRICTION_ADAPTATIONS, RESTRICTION_LABELS } from "./dietData";
import { daysAgo } from "./helpers";


const byRecent = (a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1);

export function ageFromBirth(birthDate, now = new Date()) {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = now.getFullYear() - y;
  const hadBirthday = now.getMonth() + 1 > m || (now.getMonth() + 1 === m && now.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

export function classifyBmi(bmi) {
  if (bmi < 18.5) return "baixo peso";
  if (bmi < 25) return "peso saudável";
  if (bmi < 30) return "sobrepeso";
  return "obesidade";
}


export function summarizeEntries(entries) {
  const weights = entries.filter((e) => e.type === "weight").slice().sort(byRecent);
  const latestWeight = weights[0] || null;

  const inLast7 = (e) => daysAgo(e.date) >= 0 && daysAgo(e.date) <= 6;
  const sleep7 = entries.filter((e) => e.type === "sleep" && inLast7(e));
  const exercise7 = entries.filter((e) => e.type === "exercise" && inLast7(e));

  const avgSleep = sleep7.length ? sleep7.reduce((s, e) => s + Number(e.value), 0) / sleep7.length : null;
  const exerciseMinutes = exercise7.reduce((s, e) => s + Number(e.value), 0);

  const recentWeights = weights.filter((e) => daysAgo(e.date) <= 60 && daysAgo(e.date) >= 0).slice().reverse();
  let weeklyChange = null;
  if (recentWeights.length >= 2) {
    const first = recentWeights[0];
    const last = recentWeights[recentWeights.length - 1];
    const spanDays = daysAgo(first.date) - daysAgo(last.date);
    if (spanDays >= 7) weeklyChange = ((last.value - first.value) / spanDays) * 7;
  }

  return {
    latestWeight,
    weightAgeDays: latestWeight ? daysAgo(latestWeight.date) : null,
    sleepCount: sleep7.length,
    avgSleep,
    exerciseCount: exercise7.length,
    exerciseMinutes,
    weeklyChange,
  };
}


export function getReadiness(profile, entries) {
  const s = summarizeEntries(entries);
  const hasProfile = !!profile;
  const hasWeight = !!s.latestWeight;

  const steps = [
    { id: "basics", label: "Seus dados básicos", hint: "Idade, sexo e altura definem seu gasto de energia.", done: hasProfile, required: true, wizardStep: 0 },
    { id: "goal", label: "Rotina e objetivo", hint: "Seu dia a dia e o que você quer alcançar.", done: hasProfile, required: true, wizardStep: 1 },
    { id: "restrictions", label: "Restrições e alergias", hint: "Garante que a dieta respeite o que você não come.", done: hasProfile, required: true, wizardStep: 2 },
    { id: "health", label: "Triagem de saúde", hint: "Condições que mudam o que é seguro recomendar.", done: hasProfile, required: true, wizardStep: 3 },
    {
      id: "weight",
      label: "Registrar seu peso",
      hint: hasWeight && s.weightAgeDays > 30 ? "Seu último peso tem mais de 30 dias: registre um novo." : "O peso atual é a base do cálculo de calorias.",
      done: hasWeight && s.weightAgeDays <= 30,
      required: true,
      goTo: "dashboard",
    },
    {
      id: "sleep",
      label: "Registrar o sono (3 noites nos últimos 7 dias)",
      hint: "Dormir pouco muda a fome e o tipo de dieta mais adequado.",
      done: s.sleepCount >= 3,
      required: false,
      goTo: "dashboard",
    },
    {
      id: "exercise",
      label: "Registrar o exercício da semana",
      hint: "Entra no cálculo de calorias. Se não treinou, tudo bem: conta como zero.",
      done: s.exerciseCount >= 1,
      required: false,
      goTo: "dashboard",
    },
  ];

  const ready = hasProfile && hasWeight;
  const optionalDone = steps.filter((st) => !st.required && st.done).length;
  const precision = optionalDone === 2 ? "alta" : optionalDone === 1 ? "média" : "básica";
  return { steps, ready, precision, summary: s };
}


function assessSafety({ age, conditions, goal, bmi }) {
  const notices = [];
  let allowedIds = null;
  let allowNumbers = true;
  let effectiveGoal = goal;

  const restrictTo = (ids) => {
    allowedIds = allowedIds ? allowedIds.filter((id) => ids.includes(id)) : ids;
  };

  if (age < 18) {
    restrictTo(["guia"]);
    allowNumbers = false;
    effectiveGoal = "health";
    notices.push({
      type: "danger",
      text: "Para menores de 18 anos não calculamos metas de calorias nem de emagrecimento: a alimentação precisa acompanhar o crescimento. Mostramos apenas o guia alimentar geral; procure um pediatra ou nutricionista.",
    });
  }

  if (conditions.includes("eating_disorder")) {
    restrictTo(["guia"]);
    allowNumbers = false;
    effectiveGoal = "health";
    notices.push({
      type: "danger",
      text: "Por você ter histórico de transtorno alimentar, não mostramos metas de calorias nem de perda de peso, pois isso pode fazer mal. Busque acompanhamento de nutricionista e psicólogo ou psiquiatra. Se estiver em sofrimento, o CVV atende 24 horas pelo telefone 188.",
    });
  }

  if (conditions.includes("pregnant") || conditions.includes("lactating")) {
    restrictTo(["guia", "med"]);
    allowNumbers = false;
    effectiveGoal = "health";
    notices.push({
      type: "danger",
      text: "Na gestação e na amamentação as necessidades de energia e nutrientes mudam e emagrecer não é indicado. Mostramos apenas padrões gerais; as metas devem ser definidas pelo seu obstetra ou nutricionista.",
    });
  }

  if (conditions.includes("kidney")) {
    restrictTo(["guia"]);
    allowNumbers = false;
    notices.push({
      type: "danger",
      text: "Na doença renal, proteína, sódio, potássio e fósforo precisam de limites individuais. Mostramos apenas o guia alimentar geral; a dieta deve ser definida pelo seu nefrologista ou nutricionista.",
    });
  }

  if (conditions.includes("diabetes")) {
    notices.push({
      type: "warn",
      text: "Com diabetes, mudanças na alimentação podem exigir ajuste de medicamentos (principalmente insulina). Combine qualquer mudança com seu médico.",
    });
  }
  if (conditions.includes("heart")) {
    notices.push({
      type: "warn",
      text: "Com doença cardíaca, use estas sugestões como complemento ao plano definido pela sua equipe de saúde.",
    });
  }

  if (age >= 18 && allowNumbers) {
    if (goal === "lose" && bmi < 18.5) {
      effectiveGoal = "gain";
      notices.push({
        type: "danger",
        text: `Seu IMC (${bmi.toFixed(1)}) está na faixa de baixo peso, então não indicamos emagrecer. Ajustamos a recomendação para um ganho de peso saudável; converse com um profissional de saúde.`,
      });
    } else if (goal === "lose" && bmi < 25) {
      notices.push({
        type: "info",
        text: "Seu IMC está na faixa de peso saudável. Perder peso pode ser desnecessário; se mesmo assim quiser, mantenha o déficit pequeno.",
      });
    }
    if (goal === "gain" && bmi >= 27) {
      effectiveGoal = "maintain";
      notices.push({
        type: "info",
        text: "Com seu IMC atual, ganhar peso não é recomendado. Ajustamos para manutenção; o treino de força pode melhorar sua composição corporal sem aumentar o peso.",
      });
    }
    if (age >= 65 && effectiveGoal === "lose") {
      notices.push({
        type: "warn",
        text: "Acima de 65 anos, perder peso rápido também faz perder músculo e osso. Faça isso com acompanhamento e mantenha a proteína em dia.",
      });
    }
  }

  return { notices, allowedIds, allowNumbers, effectiveGoal };
}


function computeTargets({ profile, age, weightKg, effectiveGoal, exerciseMinutes }) {
  const sexConstant = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78;
  const bmr = 10 * weightKg + 6.25 * profile.height_cm - 5 * age + sexConstant;
  const lifestyleFactor = { sedentary: 1.2, standing: 1.3, active: 1.4 }[profile.lifestyle] || 1.2;
  const exerciseKcalDay = (4 * weightKg * (exerciseMinutes / 60)) / 7;
  const tdee = bmr * lifestyleFactor + exerciseKcalDay;

  const floor = profile.sex === "male" ? 1500 : profile.sex === "female" ? 1200 : 1350;
  let target = tdee;
  let floorApplied = false;
  if (effectiveGoal === "lose") {
    target = tdee - Math.min(500, tdee * 0.15);
    if (target < floor) {
      target = floor;
      floorApplied = true;
    }
  } else if (effectiveGoal === "gain") {
    target = tdee + Math.min(300, tdee * 0.1);
  }

  const round50 = (n) => Math.round(n / 50) * 50;
  return {
    bmr: Math.round(bmr),
    tdee: round50(tdee),
    kcal: round50(target),
    floorApplied,
    waterMl: Math.min(4000, Math.max(1500, Math.round((weightKg * 35) / 50) * 50)),
  };
}

function computeMacros(diet, kcal, weightKg, effectiveGoal) {
  const mid = (r) => (r[0] + r[1]) / 2;
  const c = mid(diet.macros.carb);
  const p = mid(diet.macros.protein);
  const f = mid(diet.macros.fat);
  const sum = c + p + f;

  const floorPerKg = effectiveGoal === "lose" ? 1.2 : effectiveGoal === "gain" ? 1.6 : 0;
  let protG = Math.max((kcal * (p / sum)) / 4, floorPerKg * weightKg);
  protG = Math.min(protG, (kcal * 0.35) / 4);

  const remainingKcal = Math.max(0, kcal - protG * 4);
  const carbG = (remainingKcal * (c / (c + f))) / 4;
  const fatG = (remainingKcal * (f / (c + f))) / 9;

  return {
    carbG: Math.round(carbG),
    protG: Math.round(protG),
    fatG: Math.round(fatG),
    carbPct: Math.round(((carbG * 4) / kcal) * 100),
    protPct: Math.round(((protG * 4) / kcal) * 100),
    fatPct: Math.round(((fatG * 9) / kcal) * 100),
    protPerKg: Math.round((protG / weightKg) * 10) / 10,
  };
}


function scoreDiet(diet, ctx) {
  let score = 40;
  const reasons = [];
  const warnings = [...(diet.warnings || [])];
  const adaptations = [];

  const goalFit = diet.fit.goal[ctx.goal];
  if (goalFit) {
    score += goalFit[0];
    if (goalFit[0] >= 14 && goalFit[1]) reasons.push(goalFit[1]);
  }

  ctx.conditions.forEach((c) => {
    const fit = diet.fit.cond[c];
    if (!fit) return;
    score += fit[0];
    if (fit[0] > 0) reasons.push(fit[1]);
    else warnings.push(fit[1]);
  });

  ctx.restrictions.forEach((r) => {
    const level = diet.compat[r];
    if (level === "ideal") {
      score += 14;
      reasons.push(`Pensada para quem é ${RESTRICTION_LABELS[r].toLowerCase()}`);
    } else if (level === "adapt") {
      score -= 4;
      adaptations.push(RESTRICTION_ADAPTATIONS[r]);
    }
  });

  if (ctx.cooking === "little") score += diet.effort === 3 ? -8 : diet.effort === 1 ? 3 : 0;
  else if (ctx.cooking === "some") score += diet.effort === 3 ? -3 : 0;

  if (ctx.budget === "low") score += diet.cost === 3 ? -8 : diet.cost === 1 ? 3 : 0;
  else if (ctx.budget === "medium") score += diet.cost === 3 ? -3 : 0;

  if (ctx.sleepCount >= 3 && ctx.avgSleep !== null && ctx.avgSleep < 6 && diet.sleepFriendly) {
    score += 5;
    reasons.push("Com pouco sono a fome e a vontade de doces aumentam; fibras, proteína e refeições regulares ajudam a controlar isso");
  }

  if (ctx.exerciseMinutes >= 150) {
    const weight = ctx.exerciseMinutes >= 300 ? 6 : 3;
    score += diet.trainingFit * weight;
    if (diet.trainingFit > 0) reasons.push("Tem carboidratos suficientes para sustentar o seu volume de exercício");
    if (diet.trainingFit < 0) warnings.push("Com o seu volume de exercício, reduzir carboidratos pode diminuir o rendimento e a recuperação.");
  }

  return { score: Math.max(0, Math.min(98, Math.round(score))), reasons, warnings, adaptations };
}

function isEligible(diet, ctx) {
  if (ctx.allowedIds && !ctx.allowedIds.includes(diet.id)) return false;
  if (diet.onlyIf && !diet.onlyIf.some((r) => ctx.restrictions.includes(r))) return false;
  if (diet.onlyGoals && !diet.onlyGoals.includes(ctx.goal)) return false;
  return !ctx.restrictions.some((r) => diet.compat[r] === "no");
}


function buildInsights(s, effectiveGoal) {
  const insights = [];

  if (s.sleepCount >= 3 && s.avgSleep !== null) {
    if (s.avgSleep < 6) {
      insights.push({
        type: "warn",
        text: `Seu sono médio nos últimos 7 dias foi de ${s.avgSleep.toFixed(1)} h. Dormir pouco aumenta a fome e a vontade de doces. Procure dormir 7 a 9 h, deixe a cafeína só para a primeira metade do dia e evite refeições pesadas perto de deitar.`,
      });
    } else if (s.avgSleep > 9) {
      insights.push({ type: "info", text: `Você tem dormido bastante (média de ${s.avgSleep.toFixed(1)} h). Se sente cansaço mesmo assim, vale conversar com um médico.` });
    } else {
      insights.push({ type: "ok", text: `Seu sono médio (${s.avgSleep.toFixed(1)} h) está numa boa faixa. Isso ajuda a regular a fome e o peso.` });
    }
  } else {
    insights.push({ type: "info", text: "Registre pelo menos 3 noites de sono nos últimos 7 dias para a recomendação considerar o seu sono." });
  }

  if (s.exerciseCount === 0) {
    insights.push({ type: "info", text: "Sem exercício registrado nesta semana, o cálculo considera 0 min. Caminhar 10 minutos após as refeições já é um bom começo." });
  } else if (s.exerciseMinutes < 150) {
    insights.push({ type: "info", text: `Você fez ${s.exerciseMinutes} min de exercício nos últimos 7 dias. A recomendação da OMS para adultos é de pelo menos 150 min por semana de atividade moderada.` });
  } else {
    insights.push({ type: "ok", text: `${s.exerciseMinutes} min de exercício nos últimos 7 dias: você atinge a recomendação mínima da OMS (150 min por semana).` });
  }

  if (s.weeklyChange !== null) {
    const change = s.weeklyChange;
    const txt = `${change > 0 ? "+" : "-"}${Math.abs(change).toFixed(2)} kg por semana`;
    if (effectiveGoal === "lose" && change > 0.1) {
      insights.push({ type: "info", text: `Seu peso tem subido (${txt}) enquanto o objetivo é perder. Revise porções, bebidas e lanches e dê tempo: o peso oscila de um dia para o outro.` });
    } else if (effectiveGoal === "lose" && change < -1) {
      insights.push({ type: "warn", text: `Você está perdendo peso rápido demais (${txt}). Acima de ~1 kg por semana costuma haver perda de massa muscular; considere comer um pouco mais.` });
    } else if (effectiveGoal === "gain" && change < 0) {
      insights.push({ type: "info", text: `Seu peso tem caído (${txt}) mas o objetivo é ganhar. Aumente as porções de forma gradual.` });
    } else {
      insights.push({ type: "ok", text: `Tendência de peso recente: ${txt}.` });
    }
  }

  return insights;
}


export function recommend(profile, entries) {
  const s = summarizeEntries(entries);
  const weightKg = Number(s.latestWeight.value);
  const age = ageFromBirth(profile.birth_date);
  const heightM = profile.height_cm / 100;
  const bmi = weightKg / (heightM * heightM);

  const conditions = profile.conditions || [];
  let restrictions = profile.restrictions || [];
  if (restrictions.includes("vegan")) restrictions = restrictions.filter((r) => r !== "vegetarian");

  const safety = assessSafety({ age, conditions, goal: profile.goal, bmi });
  const goal = safety.effectiveGoal;

  const notices = [...safety.notices];
  if (s.weightAgeDays > 30) {
    notices.push({ type: "info", text: `Seu último peso foi registrado há ${s.weightAgeDays} dias. Registre um novo para recalcular com mais precisão.` });
  }

  let targets = null;
  if (safety.allowNumbers) {
    targets = computeTargets({ profile, age, weightKg, effectiveGoal: goal, exerciseMinutes: s.exerciseMinutes });
    if (targets.floorApplied) {
      notices.push({
        type: "warn",
        text: `A meta de calorias foi limitada a ${targets.kcal} kcal, o mínimo que consideramos seguro sem acompanhamento. Perder peso com menos calorias do que isso exige um profissional.`,
      });
    }
  }

  const ctx = {
    goal,
    conditions,
    restrictions,
    cooking: profile.cooking_time,
    budget: profile.budget,
    sleepCount: s.sleepCount,
    avgSleep: s.avgSleep,
    exerciseMinutes: s.exerciseMinutes,
    allowedIds: safety.allowedIds,
  };

  const scored = DIETS.filter((d) => isEligible(d, ctx))
    .map((diet) => {
      const result = scoreDiet(diet, ctx);
      return {
        diet,
        ...result,
        macros: targets ? computeMacros(diet, targets.kcal, weightKg, goal) : null,
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const picks = scored.filter((r, i) => i === 0 || (i < 3 && r.score >= 55 && r.score >= top.score - 15));

  return {
    age,
    weightKg,
    bmi,
    bmiClass: classifyBmi(bmi),
    goal,
    originalGoal: profile.goal,
    targets,
    notices,
    insights: buildInsights(s, goal),
    picks,
    mealsPerDay: profile.meals_per_day,
    allowNumbers: safety.allowNumbers,
    summary: s,
  };
}
