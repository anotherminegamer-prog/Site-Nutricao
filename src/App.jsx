import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  todayStr,
  uid,
  fmtDateHeader,
  daysAgo,
  TYPE_META,
  DEFAULT_GOALS,
  COSMETIC_STYLES,
  groupByDate,
  BRAND,
  themeVars,
} from "./lib/helpers";
import { buildPlanGoals, PLAN_PREFIX } from "./lib/plan";
import "./App.css";
import DietScreen from "./components/DietScreen";
import NewsScreen from "./components/NewsScreen";
import AppHeader, { BrandLogo } from "./components/AppHeader";
import MonitorHero from "./components/MonitorHero";


export default function RitmoApp() {
  const [phase, setPhase] = useState("loading");
  const [view, setView] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [entries, setEntries] = useState([]);
  const [banner, setBanner] = useState(null);

  const [goals, setGoals] = useState([]);
  const [completedToday, setCompletedToday] = useState({});
  const [pointsEarned, setPointsEarned] = useState(0);
  const [cosmeticsCatalog, setCosmeticsCatalog] = useState([]);
  const [cosmeticUnlocks, setCosmeticUnlocks] = useState(new Set());
  const [selectedCosmetic, setSelectedCosmetic] = useState("branco");
  const [healthProfile, setHealthProfile] = useState(null);
  const [ready, setReady] = useState({ entries: false, goals: false, profile: false });
  const markReady = (key) => setReady((r) => ({ ...r, [key]: true }));

  const flash = (msg) => {
    setBanner(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setBanner(null), 3200);
  };

  const loadEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      markReady("entries");
      setEntries(
        (data || []).map((r) => ({
          id: r.id,
          type: r.type,
          value: Number(r.value),
          date: r.date,
          activity: r.activity || undefined,
          createdAt: new Date(r.created_at).getTime(),
        }))
      );
    } catch (err) {
      console.error("loadEntries:", err);
      flash("Não foi possível carregar seus registros agora.");
    }
  };

  const loadGoalsData = async (currentSession) => {
    try {
      const { error: seedError } = await supabase.rpc("seed_default_goals", { labels: DEFAULT_GOALS });
      if (seedError) console.error("seed_default_goals:", seedError);

      const [goalsRes, completionsRes, unlocksRes, cosmeticsRes] = await Promise.all([
        supabase.from("goals").select("*").eq("archived", false).order("created_at", { ascending: true }),
        supabase.from("goal_completions").select("goal_id, points, date"),
        supabase.from("cosmetic_unlocks").select("cosmetic_id"),
        supabase.from("cosmetics").select("id, cost"),
      ]);
      if (goalsRes.error) throw goalsRes.error;
      if (completionsRes.error) throw completionsRes.error;
      if (unlocksRes.error) throw unlocksRes.error;
      if (cosmeticsRes.error) throw cosmeticsRes.error;

      const completionRows = completionsRes.data || [];
      const today = todayStr();
      const unlockedIds = new Set((unlocksRes.data || []).map((r) => r.cosmetic_id));
      const catalog = cosmeticsRes.data || [];

      const saved = currentSession?.user?.user_metadata?.selected_cosmetic;
      const savedEntry = catalog.find((c) => c.id === saved);
      const savedIsValid = savedEntry && (savedEntry.cost === 0 || unlockedIds.has(saved));

      setGoals(goalsRes.data || []);
      setCompletedToday(
        Object.fromEntries(completionRows.filter((r) => r.date === today).map((r) => [r.goal_id, true]))
      );
      setPointsEarned(completionRows.reduce((s, r) => s + r.points, 0));
      setCosmeticsCatalog(catalog);
      setCosmeticUnlocks(unlockedIds);
      setSelectedCosmetic(savedIsValid ? saved : "branco");
      markReady("goals");
    } catch (err) {
      console.error("loadGoalsData:", err);
      flash("Não foi possível carregar as metas agora.");
    }
  };

  const loadHealthProfile = async () => {
    try {
      const { data, error } = await supabase.from("health_profiles").select("*").maybeSingle();
      if (error) throw error;
      setHealthProfile(data || null);
      markReady("profile");
    } catch (err) {
      console.error("loadHealthProfile:", err);
      flash("Não foi possível carregar seu perfil de saúde agora.");
    }
  };

  const saveHealthProfile = async (values) => {
    try {
      const { data, error } = await supabase
        .from("health_profiles")
        .upsert({ ...values, user_id: session.user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      setHealthProfile(data);
      return true;
    } catch (err) {
      console.error("saveHealthProfile:", err);
      flash("Não foi possível salvar seu perfil de saúde agora.");
      return false;
    }
  };

  const deleteHealthProfile = async () => {
    const prev = healthProfile;
    setHealthProfile(null);
    try {
      const { error } = await supabase.from("health_profiles").delete().eq("user_id", session.user.id);
      if (error) throw error;
    } catch (err) {
      console.error("deleteHealthProfile:", err);
      setHealthProfile(prev);
      flash("Não foi possível apagar seu perfil de saúde agora.");
    }
  };

  const loadedUserId = useRef(null);
  const loadAllFor = (currentSession) => {
    const userId = currentSession?.user?.id;
    if (!userId || loadedUserId.current === userId) return;
    loadedUserId.current = userId;
    loadEntries();
    loadGoalsData(currentSession);
    loadHealthProfile();
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setPhase((prev) => (prev === "reset-password" ? prev : data.session ? "app" : "auth"));
      if (data.session) loadAllFor(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setSession(newSession);
        setPhase("reset-password");
        return;
      }
      setSession(newSession);
      if (newSession) {
        setPhase((prev) => (prev === "reset-password" ? prev : "app"));
        setTimeout(() => {
          if (active) loadAllFor(newSession);
        }, 0);
      } else {
        loadedUserId.current = null;
        setEntries([]);
        setGoals([]);
        setCompletedToday({});
        setPointsEarned(0);
        setCosmeticUnlocks(new Set());
        setSelectedCosmetic("branco");
        setHealthProfile(null);
        setReady({ entries: false, goals: false, profile: false });
        setView("dashboard");
        setPhase("auth");
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const planSyncing = useRef(false);
  useEffect(() => {
    if (!session || !ready.entries || !ready.goals || !ready.profile || planSyncing.current) return;
    const desired = buildPlanGoals(healthProfile, entries);
    const signature = desired.join("|");
    const storageKey = `nutrivita-plano-${session.user.id}`;
    const saved = (() => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();
    const remember = () => {
      try {
        localStorage.setItem(storageKey, signature);
      } catch {}
    };

    const current = goals.filter((g) => g.label.startsWith(PLAN_PREFIX));
    const stale = current.filter((g) => !desired.includes(g.label));
    const missing = desired.filter((l) => !current.some((g) => g.label === l));
    if (stale.length === 0 && (missing.length === 0 || saved === signature)) {
      remember();
      return;
    }

    planSyncing.current = true;
    (async () => {
      try {
        if (stale.length) {
          const { error } = await supabase.from("goals").update({ archived: true }).in("id", stale.map((g) => g.id));
          if (error) throw error;
        }
        if (missing.length) {
          const { error } = await supabase.from("goals").insert(missing.map((label) => ({ label, points: 10 })));
          if (error) throw error;
        }
        const { data, error } = await supabase
          .from("goals")
          .select("*")
          .eq("archived", false)
          .order("created_at", { ascending: true });
        if (error) throw error;
        setGoals(data || []);
        remember();
      } catch (err) {
        console.error("syncPlanGoals:", err);
      } finally {
        planSyncing.current = false;
      }
    })();
  }, [session, ready, healthProfile, entries, goals]);

  const addEntry = async (type, value, extra) => {
    const optimistic = { id: uid(), type, value, date: todayStr(), createdAt: Date.now(), ...extra };
    setEntries((prev) => [optimistic, ...prev]);
    try {
      const { data, error } = await supabase
        .from("entries")
        .insert({ type, value, date: todayStr(), activity: extra?.activity || null })
        .select()
        .single();
      if (error) throw error;
      setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? { ...optimistic, id: data.id } : e)));
    } catch (err) {
      console.error("addEntry:", err);
      setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
      flash("Não foi possível salvar. Tente de novo.");
    }
  };

  const deleteEntry = async (id) => {
    const prevEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("deleteEntry:", err);
      setEntries(prevEntries);
      flash("Não foi possível excluir. Tente de novo.");
    }
  };

  const resetAll = async () => {
    const prevEntries = entries;
    setEntries([]);
    try {
      const { error } = await supabase.from("entries").delete().eq("user_id", session.user.id);
      if (error) throw error;
    } catch (err) {
      console.error("resetAll:", err);
      setEntries(prevEntries);
      flash("Não foi possível apagar tudo agora.");
    }
  };

  const completeGoal = async (goal) => {
    if (completedToday[goal.id]) return;
    setCompletedToday((prev) => ({ ...prev, [goal.id]: true }));
    setPointsEarned((prev) => prev + goal.points);
    try {
      const { error } = await supabase.from("goal_completions").insert({ goal_id: goal.id, date: todayStr() });
      if (error) throw error;
    } catch (err) {
      console.error("completeGoal:", err);
      setCompletedToday((prev) => {
        const next = { ...prev };
        delete next[goal.id];
        return next;
      });
      setPointsEarned((prev) => prev - goal.points);
      flash("Não foi possível concluir essa meta agora.");
    }
  };

  const addGoal = async (label) => {
    try {
      const { data, error } = await supabase.from("goals").insert({ label, points: 10 }).select().single();
      if (error) throw error;
      setGoals((prev) => [...prev, data]);
    } catch (err) {
      console.error("addGoal:", err);
      flash("Não foi possível adicionar a meta agora.");
    }
  };

  const archiveGoal = async (goalId) => {
    const prevGoals = goals;
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    try {
      const { error } = await supabase.from("goals").update({ archived: true }).eq("id", goalId);
      if (error) throw error;
    } catch (err) {
      console.error("archiveGoal:", err);
      setGoals(prevGoals);
      flash("Não foi possível remover a meta agora.");
    }
  };

  const cosmetics = cosmeticsCatalog.map((c) => ({ ...COSMETIC_STYLES[c.id], id: c.id, cost: c.cost }));
  const cosmeticById = (id) =>
    cosmetics.find((c) => c.id === id) || { id, cost: 0, ...(COSMETIC_STYLES[id] || COSMETIC_STYLES.branco) };

  const pointsSpent = [...cosmeticUnlocks].reduce((s, id) => s + cosmeticById(id).cost, 0);
  const pointsBalance = pointsEarned - pointsSpent;

  const chooseCosmetic = async (cosmetic) => {
    const alreadyUnlocked = cosmetic.cost === 0 || cosmeticUnlocks.has(cosmetic.id);
    if (!alreadyUnlocked && pointsBalance < cosmetic.cost) {
      flash(`Faltam ${cosmetic.cost - pointsBalance} pontos para desbloquear "${cosmetic.label}".`);
      return;
    }

    const prevSelected = selectedCosmetic;
    const prevUnlocks = cosmeticUnlocks;
    setSelectedCosmetic(cosmetic.id);
    if (!alreadyUnlocked) setCosmeticUnlocks((prev) => new Set(prev).add(cosmetic.id));

    try {
      if (!alreadyUnlocked) {
        const { error } = await supabase.from("cosmetic_unlocks").insert({ cosmetic_id: cosmetic.id });
        if (error) throw error;
      }
      const { error: userError } = await supabase.auth.updateUser({
        data: { selected_cosmetic: cosmetic.id },
      });
      if (userError) throw userError;
    } catch (err) {
      console.error("chooseCosmetic:", err);
      setSelectedCosmetic(prevSelected);
      setCosmeticUnlocks(prevUnlocks);
      flash("Não foi possível desbloquear essa cor — confira se você tem pontos suficientes.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const profile = session
    ? { name: session.user.user_metadata?.name || session.user.email.split("@")[0] }
    : null;

  const cosmeticNow = cosmeticById(selectedCosmetic);
  const inApp = phase === "app" && session;

  return (
    <div className="rt-root" style={themeVars(cosmeticNow)}>
      {inApp && (
        <AppHeader
          active={view}
          userName={profile.name}
          pointsBalance={pointsBalance}
          onNavigate={setView}
          onLogout={handleLogout}
        />
      )}
      {inApp && banner && (
        <div className="rt-banner" role="status">
          {banner}
        </div>
      )}

      {phase === "loading" && (
        <div className="rt-boot">
          <div className="rt-boot-dot" />
          <p>carregando o painel…</p>
        </div>
      )}

      {phase === "auth" && <AuthScreen />}

      {phase === "reset-password" && (
        <ResetPasswordScreen
          onDone={() => {
            setPhase("app");
            loadAllFor(session);
          }}
        />
      )}

      {phase === "app" && session && view === "dashboard" && (
        <Dashboard
          profile={profile}
          entries={entries}
          onAdd={addEntry}
          onDelete={deleteEntry}
          onResetAll={resetAll}
        />
      )}

      {phase === "app" && session && view === "goals" && (
        <GoalsScreen
          profile={profile}
          goals={goals}
          completedToday={completedToday}
          pointsBalance={pointsBalance}
          cosmetics={cosmetics}
          cosmeticUnlocks={cosmeticUnlocks}
          selectedCosmetic={selectedCosmetic}
          hasHealthProfile={!!healthProfile}
          onComplete={completeGoal}
          onAddGoal={addGoal}
          onArchiveGoal={archiveGoal}
          onChooseCosmetic={chooseCosmetic}
          onOpenDiet={() => setView("diet")}
        />
      )}

      {phase === "app" && session && view === "diet" && (
        <DietScreen
          profile={healthProfile}
          entries={entries}
          onSaveProfile={saveHealthProfile}
          onDeleteProfile={deleteHealthProfile}
          onBackToDashboard={() => setView("dashboard")}
        />
      )}

      {phase === "app" && session && view === "news" && <NewsScreen />}
    </div>
  );
}


function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  const resetToMode = (next) => {
    setMode(next);
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (isForgot) {
      if (!email.trim()) return setError("Digite seu e-mail.");
      setSubmitting(true);
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      setSubmitting(false);
      setInfo(
        err
          ? "Não foi possível enviar o e-mail agora. Tente de novo em instantes."
          : "Se esse e-mail tiver uma conta, enviamos um link para redefinir a senha."
      );
      return;
    }

    if (!isSignup) {
      if (!email.trim() || !password) return setError("Preencha e-mail e senha.");
      setSubmitting(true);
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setSubmitting(false);
      if (err) setError("E-mail ou senha incorretos.");
      return;
    }

    if (name.trim().length < 2) return setError("Digite seu nome.");
    if (!email.trim()) return setError("Digite seu e-mail.");
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirmPassword) return setError("As senhas não são iguais.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    setSubmitting(false);
    if (err) {
      if (err.status !== 422 && err.status !== 400) console.error("signUp:", err);
      return setError(
        /already registered/i.test(err.message) ? "Esse e-mail já tem uma conta." : "Não foi possível criar a conta agora."
      );
    }
    resetToMode("login");
    setInfo("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
  };

  const titles = {
    login: ["Entrar", "Acesse seu diário de saúde."],
    signup: ["Criar conta", "Leva menos de um minuto."],
    forgot: ["Recuperar acesso", "Vamos te enviar um link por e-mail."],
  };
  const [title, subtitle] = titles[mode];

  return (
    <div className="rt-auth-wrap">
      <div className="rt-auth-card">
        <div className="rt-brand">
          <BrandLogo />
          <span className="rt-brand-name">{BRAND}</span>
        </div>
        <p className="rt-brand-tag">monitor pessoal de saúde</p>

        <h1 className="rt-auth-title">{title}</h1>
        <p className="rt-auth-sub">{subtitle}</p>

        <form onSubmit={submit} className="rt-form">
          {isSignup && (
            <label className="rt-field">
              <span>Nome</span>
              <input
                className="rt-input rt-focus"
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="Como quer ser chamado"
                autoFocus
              />
            </label>
          )}

          <label className="rt-field">
            <span>E-mail</span>
            <input
              className="rt-input rt-focus"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="voce@email.com"
              autoFocus={!isSignup}
            />
          </label>

          {!isForgot && (
            <label className="rt-field">
              <span>Senha</span>
              <input
                className="rt-input rt-focus"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="mín. 6 caracteres"
              />
            </label>
          )}

          {isSignup && (
            <label className="rt-field">
              <span>Confirmar senha</span>
              <input
                className="rt-input rt-focus"
                type="password"
                value={confirmPassword}
                onChange={(ev) => setConfirmPassword(ev.target.value)}
                placeholder="digite de novo"
              />
            </label>
          )}

          {error && <p className="rt-error" role="alert">{error}</p>}
          {info && <p className="rt-info" role="status">{info}</p>}

          <button type="submit" className="rt-btn rt-btn-primary rt-focus" disabled={submitting}>
            {submitting ? "Aguarde…" : isForgot ? "Enviar link" : isSignup ? "Criar conta" : "Entrar"}
          </button>
        </form>

        {isSignup && (
          <p className="rt-fineprint">
            Login, senha e recuperação por e-mail são geridos pelo Supabase Auth — sua senha nunca
            passa por código escrito por este app.
          </p>
        )}

        {mode === "login" && (
          <div className="rt-auth-links">
            <button className="rt-link rt-focus" onClick={() => resetToMode("signup")}>
              Não tem conta? Criar conta
            </button>
            <button className="rt-link rt-focus" onClick={() => resetToMode("forgot")}>
              Esqueci minha senha
            </button>
          </div>
        )}
        {mode !== "login" && (
          <button className="rt-link rt-focus" onClick={() => resetToMode("login")}>
            Voltar para o login
          </button>
        )}
      </div>
    </div>
  );
}

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirmPassword) return setError("As senhas não são iguais.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) return setError("Não foi possível salvar a nova senha. Tente de novo.");
    onDone();
  };

  return (
    <div className="rt-auth-wrap">
      <div className="rt-auth-card">
        <div className="rt-brand">
          <BrandLogo />
          <span className="rt-brand-name">{BRAND}</span>
        </div>
        <p className="rt-brand-tag">monitor pessoal de saúde</p>

        <h1 className="rt-auth-title">Definir nova senha</h1>
        <p className="rt-auth-sub">Você clicou num link de recuperação. Escolha uma nova senha.</p>

        <form onSubmit={submit} className="rt-form">
          <label className="rt-field">
            <span>Nova senha</span>
            <input
              className="rt-input rt-focus"
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="mín. 6 caracteres"
              autoFocus
            />
          </label>
          <label className="rt-field">
            <span>Confirmar senha</span>
            <input
              className="rt-input rt-focus"
              type="password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              placeholder="digite de novo"
            />
          </label>
          {error && <p className="rt-error" role="alert">{error}</p>}
          <button type="submit" className="rt-btn rt-btn-primary rt-focus" disabled={submitting}>
            {submitting ? "Aguarde…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}


function Dashboard({ profile, entries, onAdd, onDelete, onResetAll }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const firstName = profile.name.split(" ")[0];

  const byDateAsc = (a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);

  const weightSeries = entries
    .filter((e) => e.type === "weight")
    .slice()
    .sort(byDateAsc)
    .slice(-8);

  const last7 = (type) =>
    entries.filter((e) => e.type === type && daysAgo(e.date) <= 6 && daysAgo(e.date) >= 0);

  const avgSleep7 = (() => {
    const list = last7("sleep");
    if (!list.length) return null;
    return list.reduce((s, e) => s + Number(e.value), 0) / list.length;
  })();

  const totalExercise7 = last7("exercise").reduce((s, e) => s + Number(e.value), 0);

  const grouped = groupByDate(entries);

  return (
    <div className="rt-app">
      <section className="rt-welcome">
        <p className="rt-eyebrow">{fmtDateHeader(todayStr())}</p>
        <h1 className="rt-page-title">Painel</h1>
        <p className="rt-page-sub">Olá, {firstName}! Veja como estão seu peso, seu sono e seus treinos, e registre o dia de hoje.</p>
      </section>

      <MonitorHero entries={entries} />

      <section className="rt-grid" aria-label="Registrar dados">
        <QuickAddCard
          type="weight"
          title="Peso"
          hint="quanto você pesa hoje"
          placeholder="ex: 78.4"
          step="0.1"
          onAdd={(v) => onAdd("weight", Number(v))}
          footer={
            weightSeries.length >= 2 ? (
              <Sparkline points={weightSeries.map((e) => Number(e.value))} color="var(--amber)" />
            ) : (
              <p className="rt-card-empty">Registre pelo menos duas vezes para ver a tendência.</p>
            )
          }
        />
        <QuickAddCard
          type="sleep"
          title="Sono"
          hint="horas dormidas na última noite"
          placeholder="ex: 7.5"
          step="0.25"
          onAdd={(v) => onAdd("sleep", Number(v))}
          footer={
            <p className="rt-card-stat">
              {avgSleep7 !== null ? `${avgSleep7.toFixed(1)}h de média nos últimos 7 dias` : "Sem registros nos últimos 7 dias"}
            </p>
          }
        />
        <QuickAddCard
          type="exercise"
          title="Exercício"
          hint="minutos de atividade hoje"
          placeholder="ex: 30"
          step="1"
          extraField
          onAdd={(v, activity) => onAdd("exercise", Number(v), { activity })}
          footer={<p className="rt-card-stat">{totalExercise7} min esta semana</p>}
        />
      </section>

      <section className="rt-logbook" aria-label="Dados registrados">
        <h2 className="rt-section-title">Dados</h2>
        {grouped.length === 0 ? (
          <p className="rt-card-empty">
            Você ainda não tem dados. Comece registrando peso, sono ou exercício acima.
          </p>
        ) : (
          grouped.map(([date, list]) => (
            <div key={date} className="rt-log-day">
              <p className="rt-log-date">{fmtDateHeader(date)}</p>
              <ul className="rt-log-list">
                {list.map((e) => (
                  <li key={e.id} className="rt-log-row">
                    <span className="rt-log-dot" style={{ background: TYPE_META[e.type].color }} />
                    <span className="rt-log-label">
                      {TYPE_META[e.type].label}
                      {e.activity ? ` · ${e.activity}` : ""}
                    </span>
                    <span className="rt-log-value">
                      {e.value}
                      {TYPE_META[e.type].unit}
                    </span>
                    <button
                      className="rt-log-del rt-focus"
                      onClick={() => onDelete(e.id)}
                      aria-label="Excluir registro"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <footer className="rt-footer">
        {!confirmingReset ? (
          <button className="rt-link rt-danger rt-focus" onClick={() => setConfirmingReset(true)}>
            Apagar todos os dados
          </button>
        ) : (
          <span className="rt-confirm-row">
            <span>Isso apaga todos os registros. Não dá para desfazer.</span>
            <button
              className="rt-link rt-danger rt-focus"
              onClick={() => {
                onResetAll();
                setConfirmingReset(false);
              }}
            >
              Confirmar
            </button>
            <button className="rt-link rt-focus" onClick={() => setConfirmingReset(false)}>
              Cancelar
            </button>
          </span>
        )}
      </footer>
    </div>
  );
}


const TYPE_ICON = {
  weight: <path d="M5 9h14l-1.2 9a2 2 0 0 1-2 1.7H8.2a2 2 0 0 1-2-1.7L5 9zm4-3.5a3 3 0 0 1 6 0M12 9l1.8-2.8" />,
  sleep: <path d="M20 14.5A8 8 0 0 1 9.500 4 8 8 0 1 0 20 14.5z" />,
  exercise: <path d="M13 3L5 13.5h6L10 21l8-10.500h-6L13 3z" />,
};

function QuickAddCard({ type, title, hint, placeholder, step, onAdd, footer, extraField }) {
  const [value, setValue] = useState("");
  const [activity, setActivity] = useState("");
  const meta = TYPE_META[type];

  const submit = (e) => {
    e.preventDefault();
    if (!value || Number.isNaN(Number(value))) return;
    onAdd(value, activity.trim() || undefined);
    setValue("");
    setActivity("");
  };

  return (
    <div className="rt-card">
      <div className="rt-card-head">
        <span className="rt-card-icon" style={{ color: meta.color }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {TYPE_ICON[type]}
          </svg>
        </span>
        <h3>{title}</h3>
      </div>
      <p className="rt-card-hint">{hint}</p>
      <form className="rt-card-form" onSubmit={submit}>
        <div className="rt-card-inputs">
          <input
            className="rt-input rt-input-num rt-focus"
            type="number"
            step={step}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            aria-label={`${title} (${meta.unit})`}
          />
          {extraField && (
            <input
              className="rt-input rt-focus"
              type="text"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="atividade"
              maxLength={100}
              aria-label="Atividade"
            />
          )}
          <button type="submit" className="rt-btn rt-btn-primary rt-btn-small rt-focus">
            Adicionar
          </button>
        </div>
      </form>
      <div className="rt-card-footer">{footer}</div>
    </div>
  );
}

function Sparkline({ points, color }) {
  const w = 160;
  const h = 44;
  const pad = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xFor = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const yFor = (v) => pad + (1 - (v - min) / range) * (h - pad * 2);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="rt-sparkline" role="img" aria-label="Tendência">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xFor(points.length - 1)} cy={yFor(points[points.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}


function GoalItem({ goal, done, onComplete, onArchive, label }) {
  return (
    <li className={`rt-goal-item ${done ? "rt-goal-done" : ""}`}>
      <button
        type="button"
        className="rt-goal-check rt-focus"
        onClick={() => onComplete(goal)}
        disabled={done}
        aria-pressed={done}
        aria-label={done ? "Meta concluída" : "Marcar meta como concluída"}
      >
        {done ? "✓" : ""}
      </button>
      <span className="rt-goal-label">{label}</span>
      <span className="rt-goal-points">+{goal.points} pts</span>
      <button type="button" className="rt-goal-remove rt-focus" onClick={() => onArchive(goal.id)} aria-label="Remover meta">
        ×
      </button>
    </li>
  );
}

function GoalsScreen({
  goals,
  completedToday,
  pointsBalance,
  cosmetics,
  cosmeticUnlocks,
  selectedCosmetic,
  hasHealthProfile,
  onComplete,
  onAddGoal,
  onArchiveGoal,
  onChooseCosmetic,
  onOpenDiet,
}) {
  const [newGoal, setNewGoal] = useState("");
  const doneCount = goals.filter((g) => completedToday[g.id]).length;
  const planGoals = goals.filter((g) => g.label.startsWith(PLAN_PREFIX));
  const otherGoals = goals.filter((g) => !g.label.startsWith(PLAN_PREFIX));

  const submitGoal = (e) => {
    e.preventDefault();
    const label = newGoal.trim();
    if (!label) return;
    onAddGoal(label);
    setNewGoal("");
  };

  const renderItems = (list, strip) => (
    <ul className="rt-goal-items">
      {list.map((goal) => (
        <GoalItem
          key={goal.id}
          goal={goal}
          done={!!completedToday[goal.id]}
          onComplete={onComplete}
          onArchive={onArchiveGoal}
          label={strip ? goal.label.slice(PLAN_PREFIX.length).replace(/^./, (c) => c.toUpperCase()) : goal.label}
        />
      ))}
    </ul>
  );

  return (
    <div className="rt-app">
      <section className="rt-goals-hero">
        <div>
          <h1 className="rt-page-title">Metas</h1>
          <p className="rt-page-sub">
            {doneCount} de {goals.length} concluídas hoje
          </p>
        </div>
        <div className="rt-points-badge">
          <span className="rt-points-value">{pointsBalance}</span>
          <span className="rt-points-label">pontos</span>
        </div>
      </section>

      <section className="rt-goals-list" aria-label="Metas do seu plano">
        <h2 className="rt-section-title">Do seu plano de dieta</h2>
        {hasHealthProfile ? (
          <>
            <p className="rt-page-sub rt-plan-note">
              Calculadas com as suas respostas do questionário e com os seus registros. Se você mudar o perfil ou
              registrar um novo peso, elas se atualizam.
            </p>
            {renderItems(planGoals, true)}
          </>
        ) : (
          <div className="rt-card rt-plan-cta">
            <p className="rt-card-empty">
              Responda o questionário da dieta para receber metas feitas para você: água, calorias, refeições,
              atividade, sono e as suas restrições.
            </p>
            <button type="button" className="rt-btn rt-btn-primary rt-btn-small rt-focus" onClick={onOpenDiet}>
              Responder o questionário
            </button>
          </div>
        )}
      </section>

      <section className="rt-goals-list" aria-label="Lista de metas">
        <h2 className="rt-section-title">Minhas metas</h2>
        {otherGoals.length === 0 ? (
          <p className="rt-card-empty">Nenhuma meta ainda — adicione uma abaixo.</p>
        ) : (
          renderItems(otherGoals, false)
        )}

        <form className="rt-goal-add-form" onSubmit={submitGoal}>
          <input
            className="rt-input rt-focus"
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Adicionar uma meta nova"
            maxLength={200}
          />
          <button type="submit" className="rt-btn rt-btn-primary rt-btn-small rt-focus">
            Adicionar
          </button>
        </form>
      </section>

      <section className="rt-shop" aria-label="Loja de cores">
        <h2 className="rt-section-title">Cor de fundo do site</h2>
        <p className="rt-page-sub" style={{ marginBottom: 14 }}>
          A cor que você escolher vale para o site todo: Painel, Dietas, Notícias e Metas. Branco e preto sempre
          disponíveis. As outras custam pontos pra desbloquear, e depois de desbloqueada você pode trocar de volta a
          qualquer hora, de graça.
        </p>
        <div className="rt-cosmetics-grid">
          {cosmetics.map((c) => {
            const unlocked = c.cost === 0 || cosmeticUnlocks.has(c.id);
            const selected = c.id === selectedCosmetic;
            const affordable = unlocked || pointsBalance >= c.cost;
            return (
              <button
                key={c.id}
                type="button"
                className={`rt-cosmetic-swatch rt-focus ${selected ? "rt-cosmetic-selected" : ""} ${
                  !affordable ? "rt-cosmetic-locked" : ""
                }`}
                style={{ background: c.bg, color: c.ink }}
                onClick={() => onChooseCosmetic(c)}
                aria-pressed={selected}
              >
                <span className="rt-cosmetic-name">{c.label}</span>
                <span className="rt-cosmetic-cost">
                  {selected ? "selecionada" : unlocked ? "desbloqueada" : `${c.cost} pts`}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
