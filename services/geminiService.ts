// ===============================
// Gemini API Service (V1BETA)
// ===============================

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-1.5-flash-001"; // Modelo correto e suportado

if (!API_KEY) {
  console.error("❌ ERRO: VITE_GEMINI_API_KEY não configurada.");
}

/**
 * Função principal para chamar a API do Gemini
 */
export async function callGemini(prompt: string): Promise<string> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Tratar erros da API
    if (!response.ok) {
      console.error("❌ Erro API Gemini:", data);
      throw new Error(data.error?.message || "Falha ao chamar Gemini");
    }

    // Retornar o texto gerado
    return (
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
      ""
    );
  } catch (err) {
    console.error("❌ Erro no callGemini:", err);
    throw err;
  }
}

/**
 * Análise financeira via IA
 */
export async function analyzeFinances(transactions: any[], monthLabel: string) {
  if (!transactions.length) {
    return "Não encontrei lançamentos neste mês para analisar.";
  }

  const resumo = transactions
    .map(
      t =>
        `${t.date} - ${t.type === "income" ? "Receita" : "Despesa"} - ${
          t.category
        } - ${t.description} - R$ ${t.amount.toFixed(2)}`
    )
    .join("\n");

  const prompt = `
Você é um assistente financeiro profissional. Analise os lançamentos abaixo e escreva um resumo objetivo.

Mês: ${monthLabel}

Lançamentos:
${resumo}

Responda em até 3 parágrafos.
`;

  return callGemini(prompt);
}

/**
 * IA para interpretar extrato bancário (PDF/CSV convertido para texto)
 */
export async function parseDocumentToTransactions(
  text: string
): Promise<Partial<any>[]> {
  if (!text.trim()) return [];

  const prompt = `
Transforme o extrato abaixo em JSON válido:

[
  {
    "date": "AAAA-MM-DD",
    "description": "texto",
    "category": "📦 Outros",
    "type": "expense" ou "income",
    "amount": 123.45
  }
]

Texto do extrato:
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
      t =>
        t.date &&
        t.description &&
        typeof t.amount === "number" &&
        (t.type === "expense" || t.type === "income")
    );
  } catch (error) {
    console.error("❌ Erro ao interpretar JSON:", error, raw);
    return [];
  }
}
