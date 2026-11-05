/* ---------- opções do questionário ---------- */

export const SEX_OPTIONS = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "other", label: "Outro / prefiro não informar" },
];

export const LIFESTYLE_OPTIONS = [
  { value: "sedentary", label: "Maior parte do dia sentado(a)", hint: "Escritório, estudo, home office" },
  { value: "standing", label: "Boa parte do dia em pé ou andando", hint: "Comércio, professor(a), cuidar de casa e crianças" },
  { value: "active", label: "Trabalho físico pesado", hint: "Construção, lavoura, carga e descarga" },
];

export const GOAL_OPTIONS = [
  { value: "lose", label: "Perder peso / gordura" },
  { value: "maintain", label: "Manter o peso atual" },
  { value: "gain", label: "Ganhar massa muscular / peso" },
  { value: "health", label: "Melhorar a saúde e a alimentação em geral" },
];

export const COOKING_OPTIONS = [
  { value: "little", label: "Pouco tempo", hint: "até ~20 min por refeição" },
  { value: "some", label: "Tempo moderado", hint: "20 a 45 min" },
  { value: "lots", label: "Gosto de cozinhar", hint: "tenho tempo para preparar" },
];

export const BUDGET_OPTIONS = [
  { value: "low", label: "Orçamento apertado" },
  { value: "medium", label: "Orçamento moderado" },
  { value: "high", label: "Orçamento flexível" },
];

export const RESTRICTION_OPTIONS = [
  { value: "vegetarian", label: "Vegetariano(a)", hint: "sem carnes e peixes" },
  { value: "vegan", label: "Vegano(a)", hint: "sem nenhum produto animal" },
  { value: "lactose_free", label: "Sem lactose / sem laticínios" },
  { value: "gluten_free", label: "Sem glúten", hint: "doença celíaca ou sensibilidade" },
  { value: "nut_allergy", label: "Alergia a oleaginosas", hint: "castanhas, nozes, amendoim" },
  { value: "seafood_allergy", label: "Alergia a peixes ou frutos do mar" },
];

export const CONDITION_OPTIONS = [
  { value: "hypertension", label: "Pressão alta" },
  { value: "diabetes", label: "Diabetes", hint: "tipo 1, tipo 2 ou gestacional" },
  { value: "cholesterol", label: "Colesterol ou triglicerídeos altos" },
  { value: "heart", label: "Doença cardíaca" },
  { value: "kidney", label: "Doença renal" },
  { value: "pregnant", label: "Gestante", femaleOnly: true },
  { value: "lactating", label: "Amamentando", femaleOnly: true },
  { value: "eating_disorder", label: "Histórico de transtorno alimentar", hint: "anorexia, bulimia, compulsão..." },
];

// Como adaptar qualquer dieta quando a pessoa tem uma restrição que a dieta
// não cobre por padrão (compat = "adapt").
export const RESTRICTION_ADAPTATIONS = {
  vegetarian: "Troque carnes e peixes por ovos, laticínios, leguminosas (feijão, lentilha, grão-de-bico), tofu e castanhas.",
  vegan:
    "Substitua ovos e laticínios por leguminosas, tofu e bebidas vegetais enriquecidas com cálcio; a vitamina B12 precisa ser suplementada (com orientação profissional).",
  lactose_free: "Use versões sem lactose ou bebidas vegetais enriquecidas com cálcio no lugar do leite e derivados.",
  gluten_free:
    "Troque trigo, centeio e cevada por arroz, milho, mandioca, batata, quinoa e aveia certificada sem glúten. Na doença celíaca, o acompanhamento profissional é essencial.",
  nut_allergy: "Retire oleaginosas e pasta de amendoim; use abacate e sementes (se não houver alergia a elas) e leia sempre os rótulos.",
  seafood_allergy: "Troque peixes e frutos do mar por ovos, aves, leguminosas e tofu; leia os rótulos de molhos e caldos prontos.",
};

export const RESTRICTION_LABELS = Object.fromEntries(RESTRICTION_OPTIONS.map((o) => [o.value, o.label]));

/* ---------- catálogo de dietas ----------
   Cada dieta é um padrão alimentar conhecido, com respaldo em diretrizes ou
   estudos clínicos. Campos usados pelo motor de recomendação (diet.js):

   fit.goal[objetivo]   = [pontos, justificativa]
   fit.cond[condição]   = [pontos, texto]  (pontos negativos viram aviso)
   compat[restrição]    = "ideal" | "ok" | "adapt" | "no"
   onlyIf / onlyGoals   = só aparece para quem tem essa restrição / objetivo
   effort, cost         = 1 (baixo) a 3 (alto)
   trainingFit          = -1, 0 ou 1 (adequação a muito exercício)
   sleepFriendly        = ajuda no apetite de quem dorme pouco
   macros               = faixa de % das calorias (carb/protein/fat)           */

export const DIETS = [
  {
    id: "guia",
    name: "Guia Alimentar Brasileiro",
    nickname: "Comida de verdade",
    short: "Base de comida in natura (arroz, feijão, legumes, frutas) e pouco ultraprocessado. Simples, barata e sustentável.",
    origin: "Guia Alimentar para a População Brasileira (Ministério da Saúde)",
    fit: {
      goal: {
        lose: [14, "Tirar os ultraprocessados e priorizar comida de verdade já reduz calorias sem contar nada"],
        maintain: [24, "É o padrão mais fácil de manter no dia a dia, sem restrições radicais"],
        health: [28, "É a referência oficial brasileira para uma alimentação saudável"],
        gain: [12, "Permite aumentar porções sem abrir mão da qualidade dos alimentos"],
      },
      cond: {},
    },
    compat: { vegetarian: "adapt", vegan: "adapt", lactose_free: "adapt", gluten_free: "adapt", nut_allergy: "ok", seafood_allergy: "ok" },
    effort: 2,
    cost: 1,
    trainingFit: 1,
    sleepFriendly: true,
    macros: { carb: [50, 60], protein: [15, 20], fat: [20, 30] },
    how: [
      "Faça de arroz com feijão, legumes, verduras e frutas a base das refeições.",
      "Use óleo, sal, açúcar e gordura em pequenas quantidades, só para temperar e cozinhar.",
      "Limite os alimentos processados (queijos, pães, conservas) e evite os ultraprocessados (refrigerante, salgadinho, embutidos, biscoito recheado).",
      "Coma com regularidade, devagar e, sempre que possível, em companhia.",
      "Planeje as compras, cozinhe em casa e desconfie da propaganda de alimentos.",
    ],
    prioritize: [
      "Arroz (de preferência integral) e feijão",
      "Legumes e verduras variados",
      "Frutas inteiras",
      "Ovos, frango, peixes e carnes magras",
      "Leite e iogurte natural, castanhas e sementes",
      "Água como bebida principal",
    ],
    limit: [
      "Refrigerantes e sucos de caixinha",
      "Salgadinhos, biscoitos recheados, macarrão instantâneo",
      "Embutidos (salsicha, presunto, mortadela)",
      "Fast-food e doces industrializados",
    ],
    menu: {
      "Café da manhã": "Café ou leite com pão integral e ovo mexido; 1 fruta (mamão ou banana)",
      "Lanche da manhã": "1 fruta e um punhado de castanhas",
      Almoço: "Arroz, feijão, filé de frango grelhado, salada de folhas com tomate e cenoura refogada; laranja de sobremesa",
      "Lanche da tarde": "Iogurte natural com banana e aveia",
      Jantar: "Omelete de legumes, purê de abóbora e salada de repolho",
    },
    tips: ["Se o orçamento estiver curto, priorize feijão, ovos, frutas e legumes da estação e compre a granel."],
    warnings: [],
    sources: ["Ministério da Saúde. Guia Alimentar para a População Brasileira, 2ª edição, 2014."],
  },

  {
    id: "med",
    name: "Dieta Mediterrânea",
    nickname: "Azeite, peixes, leguminosas e vegetais",
    short: "Padrão com muita fruta, hortaliça, leguminosa, grão integral, azeite e peixe. Um dos mais estudados para saúde do coração.",
    origin: "Padrão tradicional do Mediterrâneo; estudos como o PREDIMED",
    fit: {
      goal: {
        lose: [20, "Rica em fibras e gorduras boas, costuma dar boa saciedade e tem resultados de perda de peso comparáveis a outras dietas"],
        maintain: [22, "Fácil de manter por ser variada e saborosa"],
        health: [26, "É um dos padrões alimentares com mais evidência de benefício à saúde geral"],
        gain: [8, "Dá para aumentar as porções, mas não é desenhada para ganho de massa"],
      },
      cond: {
        hypertension: [15, "Associada a melhora da pressão arterial"],
        cholesterol: [24, "Boa evidência para melhorar o perfil de colesterol e triglicerídeos"],
        diabetes: [14, "Ajuda no controle glicêmico e do risco cardiovascular"],
        heart: [28, "Foi associada à redução de eventos cardiovasculares em estudos clínicos"],
      },
    },
    compat: { vegetarian: "adapt", vegan: "no", lactose_free: "ok", gluten_free: "adapt", nut_allergy: "adapt", seafood_allergy: "adapt" },
    effort: 2,
    cost: 2,
    trainingFit: 0,
    sleepFriendly: true,
    macros: { carb: [40, 50], protein: [15, 20], fat: [30, 40] },
    how: [
      "Use azeite de oliva extravirgem como principal gordura.",
      "Coma hortaliças, frutas, leguminosas e grãos integrais todos os dias.",
      "Inclua peixes e frutos do mar pelo menos 2 vezes por semana.",
      "Aves, ovos e laticínios em porções moderadas; carne vermelha e doces só de vez em quando.",
      "Um punhado diário de oleaginosas (nozes, amêndoas, castanhas).",
      "Álcool é opcional: se você não bebe, não precisa começar.",
    ],
    prioritize: [
      "Azeite extravirgem",
      "Peixes (sardinha, atum, salmão)",
      "Grão-de-bico, lentilha, feijão",
      "Tomate, folhas, berinjela, abobrinha",
      "Frutas, nozes e amêndoas",
      "Pães e massas integrais",
    ],
    limit: ["Carne vermelha e processada", "Doces, bolos e refrigerantes", "Manteiga e margarina em excesso", "Farinhas refinadas"],
    menu: {
      "Café da manhã": "Iogurte natural com frutas, aveia e nozes; café sem açúcar",
      "Lanche da manhã": "1 fruta",
      Almoço: "Salada grande com grão-de-bico, tomate, pepino e azeite; peixe assado com batata-doce",
      "Lanche da tarde": "Pão integral com pasta de grão-de-bico (homus)",
      Jantar: "Sopa de legumes com feijão branco, fatia de pão integral e uma fruta",
    },
    tips: ["Peixes enlatados em água (sardinha, atum) são uma opção mais barata que o peixe fresco."],
    warnings: [],
    sources: ["Estruch R. et al. Primary Prevention of Cardiovascular Disease with a Mediterranean Diet (PREDIMED). N Engl J Med, 2018."],
  },

  {
    id: "dash",
    name: "Dieta DASH",
    nickname: "Contra a pressão alta",
    short: "Muitas frutas, hortaliças e laticínios magros, com pouco sal e pouco ultraprocessado. Criada para controlar a pressão arterial.",
    origin: "Dietary Approaches to Stop Hypertension (NIH / NHLBI)",
    fit: {
      goal: {
        lose: [16, "Priorizar vegetais e cortar ultraprocessados e sal ajuda a reduzir calorias e retenção de líquidos"],
        maintain: [18, "Padrão equilibrado e seguro para o longo prazo"],
        health: [20, "Foi testada em ensaios clínicos e é recomendada em diretrizes de saúde cardiovascular"],
        gain: [6, "Dá para aumentar porções, mas não é focada em ganho de massa"],
      },
      cond: {
        hypertension: [30, "É a dieta com mais evidência para reduzir a pressão arterial"],
        heart: [20, "Recomendada em diretrizes para saúde cardiovascular"],
        cholesterol: [14, "Reduz colesterol LDL em estudos clínicos"],
        diabetes: [10, "Boa para risco cardiovascular, comum em quem tem diabetes"],
      },
    },
    compat: { vegetarian: "adapt", vegan: "adapt", lactose_free: "adapt", gluten_free: "adapt", nut_allergy: "adapt", seafood_allergy: "ok" },
    effort: 2,
    cost: 2,
    trainingFit: 0,
    sleepFriendly: true,
    macros: { carb: [52, 58], protein: [16, 20], fat: [25, 30] },
    how: [
      "Coma muitas porções de frutas e hortaliças ao longo do dia.",
      "Prefira laticínios desnatados ou com baixo teor de gordura.",
      "Escolha grãos integrais e leguminosas.",
      "Prefira aves, peixes e leguminosas à carne vermelha.",
      "Reduza o sódio: meta de até 2.300 mg por dia (cerca de 1 colher de chá de sal, somando o sal dos alimentos) e, se possível, 1.500 mg.",
      "Evite embutidos, enlatados, caldos e temperos prontos; tempere com ervas, alho, limão e especiarias.",
    ],
    prioritize: [
      "Frutas e hortaliças (banana, laranja, folhas escuras, tomate)",
      "Leite e iogurte desnatados",
      "Aveia, arroz integral, pão integral",
      "Feijão, lentilha, grão-de-bico",
      "Frango sem pele e peixes",
      "Castanhas e sementes sem sal",
    ],
    limit: ["Sal de cozinha e sal de mesa", "Embutidos, salgados e carnes salgadas", "Caldos e temperos prontos", "Doces e bebidas açucaradas"],
    menu: {
      "Café da manhã": "Iogurte desnatado com aveia e banana; 1 fatia de pão integral com ricota",
      "Lanche da manhã": "1 laranja ou maçã",
      Almoço: "Arroz integral, feijão sem caldo pronto, frango assado com ervas, salada de folhas com tomate e brócolis",
      "Lanche da tarde": "Mix de castanhas sem sal (um punhado) e 1 fruta",
      Jantar: "Sopa de legumes com lentilha; salada de cenoura ralada com limão",
    },
    tips: ["Reduza o sal aos poucos: o paladar se adapta em algumas semanas."],
    warnings: [
      "É rica em potássio. Se você tem doença renal ou usa medicamentos que elevam o potássio, só siga com orientação médica.",
    ],
    sources: [
      "Appel LJ. et al. A clinical trial of the effects of dietary patterns on blood pressure (DASH). N Engl J Med, 1997.",
      "Sacks FM. et al. Effects on blood pressure of reduced dietary sodium and the DASH diet. N Engl J Med, 2001.",
    ],
  },

  {
    id: "lowcarb",
    name: "Low carb moderada",
    nickname: "Menos carboidrato, sem ser cetogênica",
    short: "Reduz açúcar e farinhas refinadas e aumenta proteínas e vegetais, mantendo carboidratos de boa qualidade em menor quantidade.",
    origin: "Padrão com redução parcial de carboidratos (cerca de 26 a 40% das calorias)",
    fit: {
      goal: {
        lose: [24, "Em estudos, funciona para emagrecer a médio prazo, com resultado parecido ao de dietas com pouca gordura"],
        maintain: [10, "Pode ser mantida, mas não é necessária para quem já está no peso"],
        health: [8, "Não tem vantagem clara sobre outros padrões para saúde geral"],
        gain: [0, ""],
      },
      cond: {
        diabetes: [-12, "Reduzir carboidratos pode causar hipoglicemia em quem usa insulina ou alguns medicamentos; só com orientação médica"],
      },
    },
    compat: { vegetarian: "adapt", vegan: "no", lactose_free: "ok", gluten_free: "ok", nut_allergy: "adapt", seafood_allergy: "ok" },
    effort: 2,
    cost: 3,
    trainingFit: -1,
    sleepFriendly: false,
    macros: { carb: [26, 40], protein: [20, 30], fat: [35, 45] },
    how: [
      "Reduza açúcar, farinha branca, pães, massas e bebidas açucaradas.",
      "Mantenha carboidratos de qualidade em porções menores: feijão, lentilha, frutas, batata-doce.",
      "Aumente proteínas (ovos, carnes magras, peixes, frango) e vegetais não amiláceos.",
      "Inclua gorduras boas: azeite, abacate, castanhas.",
      "Mantenha as fibras altas (verduras, legumes, sementes) e beba bastante água.",
    ],
    prioritize: [
      "Ovos, frango, peixes e carnes magras",
      "Folhas, brócolis, abobrinha, couve-flor",
      "Feijão e lentilha em porção menor",
      "Abacate, azeite, castanhas",
      "Frutas com baixo teor de açúcar (morango, frutas cítricas)",
      "Iogurte natural e queijos brancos",
    ],
    limit: ["Açúcar e doces", "Pães, massas e bolos de farinha branca", "Refrigerantes e sucos", "Arroz branco e batata em grande quantidade"],
    menu: {
      "Café da manhã": "Ovos mexidos com tomate e queijo branco; café sem açúcar",
      "Lanche da manhã": "Iogurte natural com morangos",
      Almoço: "Filé de peixe grelhado, salada de folhas com abacate e azeite, abobrinha refogada e 3 colheres de feijão",
      "Lanche da tarde": "Um punhado de castanhas e 1 fruta cítrica",
      Jantar: "Omelete de espinafre com queijo e salada de pepino e tomate",
    },
    tips: ["Se treina bastante, mantenha carboidrato perto do treino para não perder rendimento."],
    warnings: [
      "Não é uma dieta cetogênica. Cortes mais radicais de carboidrato devem ter acompanhamento profissional.",
    ],
    sources: [
      "Gardner CD. et al. Effect of Low-Fat vs Low-Carbohydrate Diet on 12-Month Weight Loss (DIETFITS). JAMA, 2018.",
      "Evert AB. et al. Nutrition Therapy for Adults With Diabetes or Prediabetes: A Consensus Report. Diabetes Care, 2019.",
    ],
  },

  {
    id: "veg",
    name: "Vegetariana equilibrada",
    nickname: "Ovolactovegetariana",
    short: "Sem carnes e peixes, com ovos e laticínios, leguminosas e grãos integrais no centro das refeições.",
    origin: "Posicionamento da Academy of Nutrition and Dietetics sobre dietas vegetarianas",
    onlyIf: ["vegetarian", "vegan"],
    fit: {
      goal: {
        lose: [16, "Costuma ter mais fibras e menos calorias por prato"],
        maintain: [18, "Sustentável quando bem planejada"],
        health: [22, "Dietas vegetarianas bem planejadas são adequadas a todas as fases da vida, segundo posicionamentos de nutrição"],
        gain: [8, "Dá para ganhar massa, com atenção à proteína"],
      },
      cond: {
        cholesterol: [14, "Tende a reduzir o colesterol LDL"],
        hypertension: [10, "Associada a pressão arterial mais baixa"],
        heart: [14, "Associada a menor risco cardiovascular"],
        diabetes: [8, "Associada a melhor controle glicêmico"],
      },
    },
    compat: { vegetarian: "ideal", vegan: "adapt", lactose_free: "adapt", gluten_free: "adapt", nut_allergy: "adapt", seafood_allergy: "ok" },
    effort: 2,
    cost: 1,
    trainingFit: 0,
    sleepFriendly: true,
    macros: { carb: [50, 58], protein: [14, 18], fat: [25, 30] },
    how: [
      "Proteínas de ovos, laticínios, feijão, lentilha, grão-de-bico, soja e tofu.",
      "Combine cereais e leguminosas (arroz com feijão) ao longo do dia.",
      "Coma fontes de ferro junto com vitamina C (feijão com laranja ou limão) para absorver melhor.",
      "Fique atento à vitamina B12 (ovos e laticínios ajudam) e discuta suplementação com um profissional.",
    ],
    prioritize: ["Feijão, lentilha, grão-de-bico", "Ovos, leite, iogurte e queijos", "Tofu e soja", "Grãos integrais", "Folhas escuras (ferro e cálcio)", "Castanhas e sementes"],
    limit: ["Ultraprocessados vegetarianos (hambúrguer pronto, salgados)", "Excesso de queijo e frituras", "Doces e refrigerantes"],
    menu: {
      "Café da manhã": "Iogurte natural com aveia e frutas; pão integral com ovo",
      "Lanche da manhã": "1 fruta e castanhas",
      Almoço: "Arroz, feijão, omelete de legumes, salada de folhas com laranja e couve refogada",
      "Lanche da tarde": "Vitamina de banana com leite e aveia",
      Jantar: "Hambúrguer caseiro de lentilha com salada e batata assada",
    },
    tips: ["Peça ao seu médico exames de ferro, B12 e vitamina D uma vez por ano."],
    warnings: ["Vitamina B12 e ferro merecem acompanhamento periódico."],
    sources: ["Melina V., Craig W., Levin S. Position of the Academy of Nutrition and Dietetics: Vegetarian Diets. J Acad Nutr Diet, 2016."],
  },

  {
    id: "vegan",
    name: "Alimentação vegana",
    nickname: "100% baseada em plantas",
    short: "Sem nenhum produto de origem animal; exige planejamento e suplementação de vitamina B12.",
    origin: "Posicionamento da Academy of Nutrition and Dietetics sobre dietas vegetarianas e veganas",
    onlyIf: ["vegan", "vegetarian"],
    fit: {
      goal: {
        lose: [16, "Muita fibra e menos densidade calórica ajudam na saciedade"],
        maintain: [14, "Sustentável quando bem planejada"],
        health: [18, "Bem planejada, é adequada para todas as fases da vida"],
        gain: [4, "Possível, mas exige atenção à proteína e às calorias"],
      },
      cond: {
        cholesterol: [16, "Tende a reduzir o colesterol LDL"],
        hypertension: [10, "Associada a pressão arterial mais baixa"],
        heart: [14, "Associada a menor risco cardiovascular"],
        diabetes: [10, "Associada a melhor controle glicêmico"],
      },
    },
    compat: { vegetarian: "ok", vegan: "ideal", lactose_free: "ideal", gluten_free: "adapt", nut_allergy: "adapt", seafood_allergy: "ok" },
    effort: 3,
    cost: 2,
    trainingFit: 0,
    sleepFriendly: true,
    macros: { carb: [52, 60], protein: [12, 18], fat: [22, 30] },
    how: [
      "Faça leguminosas (feijão, lentilha, grão-de-bico, soja, tofu) em quase todas as refeições.",
      "Combine cereais e leguminosas e varie as cores do prato.",
      "Inclua fontes de cálcio: couve, brócolis, tofu com cálcio, bebidas vegetais enriquecidas.",
      "Use linhaça, chia e nozes para ômega-3.",
      "Suplemente vitamina B12; avalie ferro, zinco, vitamina D e ômega-3 com um profissional.",
    ],
    prioritize: ["Feijão, lentilha, grão-de-bico", "Tofu, tempeh e proteína de soja", "Grãos integrais e tubérculos", "Folhas escuras e brássicas", "Castanhas, sementes (linhaça, chia)", "Frutas e hortaliças variadas"],
    limit: ["Ultraprocessados veganos (carnes vegetais, salgadinhos)", "Frituras e excesso de óleo", "Açúcar e refrigerantes"],
    menu: {
      "Café da manhã": "Mingau de aveia com bebida vegetal fortificada, banana e linhaça; pão integral com pasta de grão-de-bico",
      "Lanche da manhã": "1 fruta e castanhas",
      Almoço: "Arroz, feijão, tofu grelhado, couve refogada, salada colorida; laranja",
      "Lanche da tarde": "Homus com palitos de cenoura e pepino",
      Jantar: "Curry de lentilha com abóbora e arroz integral",
    },
    tips: ["Marque na agenda a reposição de B12 e faça exames de acompanhamento."],
    warnings: ["A suplementação de vitamina B12 é indispensável. Converse com um profissional sobre ferro, zinco, cálcio, ômega-3 e vitamina D."],
    sources: ["Melina V., Craig W., Levin S. Position of the Academy of Nutrition and Dietetics: Vegetarian Diets. J Acad Nutr Diet, 2016."],
  },

  {
    id: "lowgi",
    name: "Baixo índice glicêmico",
    nickname: "Carboidratos que sobem pouco a glicose",
    short: "Escolha de carboidratos integrais e ricos em fibras, sempre combinados com proteína e vegetais, para evitar picos de glicose.",
    origin: "Estratégia presente em diretrizes de nutrição para diabetes",
    fit: {
      goal: {
        lose: [16, "Refeições com fibra e proteína saciam mais e reduzem a fome entre as refeições"],
        maintain: [16, "Ajuda a manter energia estável ao longo do dia"],
        health: [16, "Boa escolha de carboidratos para a saúde metabólica"],
        gain: [0, ""],
      },
      cond: {
        diabetes: [30, "A escolha de carboidratos com atenção à glicemia é central no cuidado do diabetes"],
        cholesterol: [6, "Fibras solúveis ajudam a reduzir o colesterol"],
        heart: [6, "Fibras e grãos integrais favorecem a saúde cardiovascular"],
      },
    },
    compat: { vegetarian: "adapt", vegan: "adapt", lactose_free: "ok", gluten_free: "adapt", nut_allergy: "ok", seafood_allergy: "ok" },
    effort: 2,
    cost: 1,
    trainingFit: 1,
    sleepFriendly: true,
    macros: { carb: [40, 50], protein: [18, 25], fat: [25, 35] },
    how: [
      "Prefira carboidratos integrais e ricos em fibras: aveia, feijões, arroz integral, batata-doce, frutas com casca.",
      "Combine carboidratos com proteína e gordura boa na mesma refeição.",
      "Evite açúcar, sucos e farinhas refinadas.",
      "Distribua os carboidratos ao longo do dia, em horários regulares.",
      "Inclua vegetais em todas as refeições.",
    ],
    prioritize: ["Aveia, cevada, feijões e lentilha", "Arroz integral e batata-doce", "Frutas inteiras (maçã, pera, laranja)", "Verduras e legumes", "Ovos, peixes, frango e iogurte natural", "Castanhas e sementes"],
    limit: ["Açúcar, doces, sucos", "Pão branco, bolos e biscoitos", "Arroz branco e purê em grande quantidade", "Refrigerantes"],
    menu: {
      "Café da manhã": "Mingau de aveia com canela e maçã picada; 1 ovo cozido",
      "Lanche da manhã": "Iogurte natural com chia",
      Almoço: "Arroz integral, feijão, frango grelhado, salada de folhas e legumes refogados",
      "Lanche da tarde": "1 fruta com casca e um punhado de castanhas",
      Jantar: "Sopa de legumes com grão-de-bico e uma fatia de pão integral",
    },
    tips: ["Comer a salada e a proteína antes do carboidrato na refeição pode reduzir o pico de glicose."],
    warnings: ["Se você usa medicamentos para diabetes, ajustes na alimentação precisam ser combinados com seu médico."],
    sources: ["Evert AB. et al. Nutrition Therapy for Adults With Diabetes or Prediabetes: A Consensus Report. Diabetes Care, 2019."],
  },

  {
    id: "gain",
    name: "Ganho de massa magra",
    nickname: "Superávit moderado e mais proteína",
    short: "Pequeno excesso de calorias, proteína distribuída ao longo do dia e carboidratos suficientes para treinar.",
    origin: "Recomendações de nutrição esportiva (ISSN)",
    onlyGoals: ["gain"],
    fit: {
      goal: {
        gain: [34, "Foi desenhada para ganho de massa magra com superávit moderado"],
      },
      cond: {},
    },
    compat: { vegetarian: "adapt", vegan: "adapt", lactose_free: "adapt", gluten_free: "adapt", nut_allergy: "ok", seafood_allergy: "ok" },
    effort: 3,
    cost: 3,
    trainingFit: 1,
    sleepFriendly: false,
    macros: { carb: [45, 55], protein: [20, 25], fat: [22, 30] },
    how: [
      "Coma cerca de 250 a 300 kcal acima do seu gasto: ganhos mais rápidos tendem a virar gordura.",
      "Distribua proteína em 3 a 5 refeições, buscando cerca de 1,6 a 2,0 g por kg de peso por dia.",
      "Mantenha carboidratos suficientes para sustentar o treino.",
      "O treino de força 2 a 3 vezes por semana é o que direciona o ganho para músculo.",
      "Durma de 7 a 9 horas: o sono faz parte da recuperação muscular.",
    ],
    prioritize: ["Ovos, frango, carnes magras, peixes", "Leite, iogurte e queijos", "Feijão, lentilha, grão-de-bico", "Arroz, batata, mandioca, aveia, macarrão integral", "Pasta de amendoim, azeite, abacate", "Frutas"],
    limit: ["Doces e ultraprocessados como fonte principal de calorias", "Álcool", "Pular refeições"],
    menu: {
      "Café da manhã": "3 ovos mexidos, 2 fatias de pão integral, 1 banana e 1 copo de leite",
      "Lanche da manhã": "Iogurte natural com aveia e pasta de amendoim",
      Almoço: "Arroz, feijão, bife grelhado, batata-doce assada e salada com azeite",
      "Lanche da tarde": "Sanduíche de frango desfiado com queijo e 1 fruta",
      Jantar: "Macarrão integral com carne moída e legumes; iogurte",
    },
    tips: ["Antes de pensar em suplementos, feche a conta com comida; a maior parte da proteína pode vir da alimentação."],
    warnings: ["Sem treino de força, o excesso de calorias tende a virar principalmente gordura."],
    sources: [
      "Jäger R. et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr, 2017.",
      "Morton RW. et al. Protein supplementation and resistance training-induced gains in muscle mass and strength. Br J Sports Med, 2018.",
    ],
  },
];
