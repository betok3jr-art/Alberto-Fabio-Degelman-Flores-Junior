const API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!API_KEY) {
  console.error("❌ ERRO: A chave 'VITE_GROQ_API_KEY' não foi configurada.");
}

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export async function callGemini(prompt: string): Promise<string> {
  // Mantive o nome callGemini pra você NÃO ter que mexer no resto do app agora
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Erro GROQ:", data);
    throw new Error(data?.error?.message || "Erro ao chamar GROQ");
  }

  return data?.choices?.[0]?.message?.content || "";
}

// ===== Mantém suas funções atuais usando callGemini =====

export async function analyzeFinances(transactions: any[], monthLabel: string) {
  if (!transactions.length) {
    return "Não encontrei lançamentos neste mês para analisar.";
  }

  const resumo = transactions
    .map(
      (t) =>
        `${t.date} - ${t.type === "income" ? "Receita" : "Despesa"} - ${
          t.category
        } - ${t.description} - R$ ${Number(t.amount).toFixed(2)}`
    )
    .join("\n");

  const prompt = `
Você é um especialista financeiro. Analise os lançamentos abaixo e escreva um resumo profissional.

Mês: ${monthLabel}

Lançamentos:
${resumo}

Responda em até 3 parágrafos.
`;

  return callGemini(prompt);
}

export async function parseDocumentToTransactions(text: string) {
  if (!text.trim()) return [];

  const prompt = `
Converta o texto abaixo em JSON válido no formato:

[
  {
    "date": "AAAA-MM-DD",
    "description": "texto",
    "category": "📦 Outros",
    "type": "expense" ou "income",
    "amount": 123.45
  }
]

Retorne APENAS o JSON (sem explicações, sem texto extra).

Texto:
"""
${text}
"""
`;

  const raw = await callGemini(prompt);

  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return [];

    const jsonText = raw.slice(start, end + 1);
    const parsed = JSON.parse(jsonText);

    return parsed.filter(
      (t: any) =>
        t.date &&
        t.description &&
        typeof t.amount === "number" &&
        ["expense", "income"].includes(t.type)
    );
  } catch (error) {
    console.error("❌ Falha ao interpretar JSON da IA:", error, raw);
    return [];
  }
}
