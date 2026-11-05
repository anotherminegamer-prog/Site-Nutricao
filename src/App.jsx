import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import {
  todayStr,
  uid,
  fmtDateShort,
  fmtDateHeader,
  daysAgo,
  TYPE_META,
  DEFAULT_GOALS,
  COSMETIC_STYLES,
  groupByDate,
} from "./lib/helpers";
import "./App.css";
import DietScreen from "./components/DietScreen";

/* ---------- root ----------
   A autenticação (cadastro, login, "esqueci minha senha" por e-mail, limite
   de tentativas) agora é toda feita pelo Supabase Auth — não há mais nenhum
   código de senha na mão neste arquivo. Os registros de saúde ficam numa
   tabela de verdade (`entries`), protegida por Row Level Security: o banco
   em si garante que cada pessoa só lê/escreve as próprias linhas. */

export default function RitmoApp() {
  const [phase, setPhase] = useState("loading"); // loading | auth | reset-password | app
  const [view, setView] = useState("dashboard"); // dashboard | goals | diet
  const [session, setSession] = useState(null);
  const [entries, setEntries] = useState([]);
  const [banner, setBanner] = useState(null);

  const [goals, setGoals] = useState([]);
  const [completedToday, setCompletedToday] = useState({}); // { [goal_id]: true }
  const [pointsEarned, setPointsEarned] = useState(0);
  const [cosmeticsCatalog, setCosmeticsCatalog] = useState([]); // [{id, cost}] — preço real, vem do banco
  const [cosmeticUnlocks, setCosmeticUnlocks] = useState(new Set());
  const [selectedCosmetic, setSelectedCosmetic] = useState("branco");
  const [healthProfile, setHealthProfile] = useState(null); // linha de health_profiles ou null

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
      // 1ª vez da pessoa aqui: semeia o catálogo padrão de metas. Isso roda
      // dentro do banco (função seed_default_goals), de forma atômica — abrir
      // duas abas ao mesmo tempo não duplica as metas, e quem arquivou todas
      // as metas de propósito não as ganha de volta.
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

      // a cor salva fica em user_metadata, que a própria pessoa consegue editar;
      // só vale se for gratuita ou realmente desbloqueada
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

  // Carrega os dados da pessoa uma única vez por usuário. Antes, getSession e
  // onAuthStateChange disparavam as duas cargas em duplicidade, e eventos como
  // TOKEN_REFRESHED / USER_UPDATED (disparado ao trocar a cor) recarregavam
  // tudo de novo à toa.
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
      // não atropela a tela de nova senha, caso o evento PASSWORD_RECOVERY
      // já tenha chegado antes desta promessa resolver
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
        // adia a carga: o supabase-js recomenda não chamar o próprio cliente
        // de dentro do callback de auth (risco de travar a fila interna)
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
        setView("dashboard");
        setPhase("auth");
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
      // o filtro por user_id é explícito (a RLS já garantiria o mesmo), e
      // evita depender de uma condição "fantasma" só para o delete passar
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
      // sem "points" aqui — o valor vem da própria meta, definido pelo banco
      // (trigger enforce_goal_completion), não pelo que o site manda
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

  // preço real (banco) + aparência (fixa no código, sem risco) combinados
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
        // sem "cost" aqui — o preço real é conferido pelo próprio banco
        // (política de RLS em cosmetic_unlocks), não pelo que o site manda
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

  return (
    <div className="rt-root">
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
          onLogout={handleLogout}
          onAdd={addEntry}
          onDelete={deleteEntry}
          onResetAll={resetAll}
          banner={banner}
          pointsBalance={pointsBalance}
          onOpenGoals={() => setView("goals")}
          onOpenDiet={() => setView("diet")}
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
          banner={banner}
          onComplete={completeGoal}
          onAddGoal={addGoal}
          onArchiveGoal={archiveGoal}
          onChooseCosmetic={chooseCosmetic}
          onBackToDashboard={() => setView("dashboard")}
          onOpenDiet={() => setView("diet")}
          onLogout={handleLogout}
        />
      )}

      {phase === "app" && session && view === "diet" && (
        <DietScreen
          profile={healthProfile}
          entries={entries}
          banner={banner}
          userName={profile.name}
          onSaveProfile={saveHealthProfile}
          onDeleteProfile={deleteHealthProfile}
          onBackToDashboard={() => setView("dashboard")}
          onOpenGoals={() => setView("goals")}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

/* ---------- auth screen ---------- */

function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | signup | forgot
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
      // mesma mensagem exista ou não a conta, para não vazar quais e-mails têm cadastro
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
    // resetToMode limpa error/info, então precisa vir ANTES do setInfo — antes
    // vinha depois e a mensagem de "conta criada" nunca aparecia
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
          <span className="rt-brand-mark" aria-hidden="true" />
          <span className="rt-brand-name">PROTÓTIPO</span>
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
          <span className="rt-brand-mark" aria-hidden="true" />
          <span className="rt-brand-name">PROTÓTIPO</span>
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

/* ---------- dashboard ---------- */

function Dashboard({ profile, entries, onLogout, onAdd, onDelete, onResetAll, banner, pointsBalance, onOpenGoals, onOpenDiet }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const firstName = profile.name.split(" ")[0];

  const byDateAsc = (a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1);

  const sleepSeries = entries
    .filter((e) => e.type === "sleep")
    .slice()
    .sort(byDateAsc)
    .slice(-10);

  const weightSeries = entries
    .filter((e) => e.type === "weight")
    .slice()
    .sort(byDateAsc)
    .slice(-8);

  const exerciseDatesSet = new Set(entries.filter((e) => e.type === "exercise").map((e) => e.date));

  const last7 = (type) =>
    entries.filter((e) => e.type === type && daysAgo(e.date) <= 6 && daysAgo(e.date) >= 0);

  const avgSleep7 = (() => {
    const list = last7("sleep");
    if (!list.length) return null;
    return list.reduce((s, e) => s + Number(e.value), 0) / list.length;
  })();

  const totalExercise7 = last7("exercise").reduce((s, e) => s + Number(e.value), 0);

  const lastWeight = weightSeries[weightSeries.length - 1];
  const prevWeight = weightSeries[weightSeries.length - 2];
  const weightDelta = lastWeight && prevWeight ? lastWeight.value - prevWeight.value : null;

  const grouped = groupByDate(entries);

  return (
    <div className="rt-app">
      {banner && <div className="rt-banner">{banner}</div>}

      <header className="rt-header">
        <div className="rt-brand">
          <span className="rt-brand-mark" aria-hidden="true" />
          <span className="rt-brand-name">PROTÓTIPO</span>
        </div>
        <div className="rt-header-right">
          <button className="rt-nav-btn rt-focus" onClick={onOpenDiet}>
            Dietas
          </button>
          <button className="rt-nav-btn rt-focus" onClick={onOpenGoals}>
            Metas <span className="rt-points-pill">{pointsBalance} pts</span>
          </button>
          <span className="rt-greeting">Olá, {firstName}</span>
          <button className="rt-link rt-focus" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <MonitorHero
        sleepSeries={sleepSeries}
        exerciseDatesSet={exerciseDatesSet}
        avgSleep7={avgSleep7}
        lastWeight={lastWeight}
        weightDelta={weightDelta}
        totalExercise7={totalExercise7}
      />

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

      <section className="rt-logbook" aria-label="Diário de registros">
        <h2 className="rt-section-title">Diário</h2>
        {grouped.length === 0 ? (
          <p className="rt-card-empty">
            Seu diário está vazio. Comece registrando peso, sono ou exercício acima.
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

/* ---------- monitor hero (signature element) ---------- */

function MonitorHero({ sleepSeries, exerciseDatesSet, avgSleep7, lastWeight, weightDelta, totalExercise7 }) {
  const W = 720;
  const H = 220;
  const padL = 44;
  const padR = 20;
  const padT = 22;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const n = sleepSeries.length;
  const hasTrace = n >= 2;

  const xFor = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = (v) => padT + (1 - Math.min(Math.max(v, 0), 10) / 10) * plotH;

  const pathD = hasTrace
    ? sleepSeries.map((e, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)},${yFor(Number(e.value)).toFixed(1)}`).join(" ")
    : "";

  return (
    <section className="rt-hero" aria-label="Ritmo dos últimos dias">
      <div className="rt-hero-readouts">
        <Readout label="SONO MÉDIO · 7D" value={avgSleep7 !== null ? avgSleep7.toFixed(1) : "--"} unit="h" color="var(--trace)" />
        <Readout
          label="PESO ATUAL"
          value={lastWeight ? Number(lastWeight.value).toFixed(1) : "--"}
          unit="kg"
          color="var(--amber-dark)"
          delta={weightDelta}
        />
        <Readout label="EXERCÍCIO · 7D" value={String(totalExercise7)} unit="min" color="var(--moss-dark)" />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="rt-monitor-svg" role="img" aria-label="Traçado de sono dos últimos dias">
        <defs>
          <filter id="rt-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0, 5, 10].map((h) => (
          <g key={h}>
            <line x1={padL} x2={W - padR} y1={yFor(h)} y2={yFor(h)} className="rt-grid-line" />
            <text x={padL - 10} y={yFor(h) + 4} textAnchor="end" className="rt-grid-label">
              {h}h
            </text>
          </g>
        ))}

        {hasTrace ? (
          <>
            <path d={pathD} className="rt-trace-path" filter="url(#rt-glow)" />
            {sleepSeries.map((e, i) => (
              <circle key={e.id} cx={xFor(i)} cy={yFor(Number(e.value))} r="3.2" className="rt-trace-dot" />
            ))}
            {sleepSeries.map((e, i) => (
              <circle
                key={`m-${e.id}`}
                cx={xFor(i)}
                cy={H - padB + 14}
                r={exerciseDatesSet.has(e.date) ? 3.4 : 1.6}
                className={exerciseDatesSet.has(e.date) ? "rt-marker-on" : "rt-marker-off"}
              />
            ))}
            {sleepSeries.map((e, i) =>
              i === 0 || i === n - 1 ? (
                <text key={`t-${e.id}`} x={xFor(i)} y={H - 6} textAnchor="middle" className="rt-grid-label">
                  {fmtDateShort(e.date)}
                </text>
              ) : null
            )}
          </>
        ) : (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="rt-monitor-empty">
            Sem sinais ainda — registre seu sono abaixo para ver o traçado.
          </text>
        )}
      </svg>
    </section>
  );
}

function Readout({ label, value, unit, color, delta }) {
  return (
    <div className="rt-readout">
      <span className="rt-readout-label">{label}</span>
      <span className="rt-readout-value" style={{ color }}>
        {value}
        <span className="rt-readout-unit">{unit}</span>
      </span>
      {delta !== null && delta !== undefined && !Number.isNaN(delta) && (
        <span className={`rt-readout-delta ${delta <= 0 ? "rt-delta-down" : "rt-delta-up"}`}>
          {delta <= 0 ? "▼" : "▲"} {Math.abs(delta).toFixed(1)}kg
        </span>
      )}
    </div>
  );
}

/* ---------- quick add card ---------- */

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
        <span className="rt-card-dot" style={{ background: meta.color }} />
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
              placeholder="atividade (opcional)"
              maxLength={100}
              aria-label="Atividade"
            />
          )}
          <button type="submit" className="rt-btn rt-btn-small rt-focus">
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

/* ---------- goals screen ---------- */

function GoalsScreen({
  profile,
  goals,
  completedToday,
  pointsBalance,
  cosmetics,
  cosmeticUnlocks,
  selectedCosmetic,
  banner,
  onComplete,
  onAddGoal,
  onArchiveGoal,
  onChooseCosmetic,
  onBackToDashboard,
  onOpenDiet,
  onLogout,
}) {
  const [newGoal, setNewGoal] = useState("");
  const firstName = profile.name.split(" ")[0];
  const cosmetic = cosmetics.find((c) => c.id === selectedCosmetic) || cosmetics[0] || COSMETIC_STYLES.branco;
  const doneCount = goals.filter((g) => completedToday[g.id]).length;

  const submitGoal = (e) => {
    e.preventDefault();
    const label = newGoal.trim();
    if (!label) return;
    onAddGoal(label);
    setNewGoal("");
  };

  return (
    <div
      className="rt-goals-screen"
      style={{ "--goals-bg": cosmetic.bg, "--goals-ink": cosmetic.ink }}
    >
      <div className="rt-goals-inner">
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
            <span className="rt-greeting">Olá, {firstName}</span>
            <button className="rt-link rt-focus" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>

        <section className="rt-goals-hero">
          <div>
            <h1 className="rt-goals-title">Metas de hoje</h1>
            <p className="rt-goals-sub">
              {doneCount} de {goals.length} concluídas hoje
            </p>
          </div>
          <div className="rt-points-badge">
            <span className="rt-points-value">{pointsBalance}</span>
            <span className="rt-points-label">pontos</span>
          </div>
        </section>

        <section className="rt-goals-list" aria-label="Lista de metas">
          {goals.length === 0 ? (
            <p className="rt-card-empty">Nenhuma meta ainda — adicione uma abaixo.</p>
          ) : (
            <ul className="rt-goal-items">
              {goals.map((goal) => {
                const done = !!completedToday[goal.id];
                return (
                  <li key={goal.id} className={`rt-goal-item ${done ? "rt-goal-done" : ""}`}>
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
                    <span className="rt-goal-label">{goal.label}</span>
                    <span className="rt-goal-points">+{goal.points} pts</span>
                    <button
                      type="button"
                      className="rt-goal-remove rt-focus"
                      onClick={() => onArchiveGoal(goal.id)}
                      aria-label="Remover meta"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
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
            <button type="submit" className="rt-btn rt-btn-small rt-focus">
              Adicionar
            </button>
          </form>
        </section>

        <section className="rt-shop" aria-label="Loja de cores">
          <h2 className="rt-section-title">Cor de fundo desta tela</h2>
          <p className="rt-goals-sub" style={{ marginBottom: 14 }}>
            Branco e preto sempre disponíveis. As outras cores custam pontos pra desbloquear —
            depois de desbloqueada, pode trocar de volta a qualquer hora, de graça.
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
    </div>
  );
}

