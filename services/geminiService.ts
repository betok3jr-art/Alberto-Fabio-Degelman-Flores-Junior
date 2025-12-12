// ========================================
// Gemini API Service - Versão Correta e Estável
// ========================================

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// MODELO CORRETO DA API v1beta
const MODEL = "gemini-1.5-flash-001";

// ENDPOINT CORRETO
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// CHECAR SE A CHAVE EXISTE
if (!API_KEY) {
  console.error("❌ ERRO: VITE_GEMINI_API_KEY não configurada no ambiente.");
}

// -----------------------------
// Função Genérica de Chamada IA
// -----------------------------
export async function callGemini(prompt: string): Promise<string> {
  try {
    const body = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Se API retornar erro → tratar corretamente
    if (!response.ok) {
      console.error("❌ Erro ao chamar Gemini:", data.error);
      throw new Error(data.error?.message || "Falha ao chamar Gemini");
    }

    // Extrair resposta corretamente
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text || "")
        .join("") || ""
    );

  } catch (err) {
    console.error("❌ Erro interno no callGemini:", err);
    throw err;
  }
}

// -------------------------------------
// IA: Análise de Lançamentos Financeiros
// -------------------------------------
export async function analyzeFinances(transactions: any[], monthLabel: string) {
  if (!transactions.length) {
    return "Não encontrei lançamentos neste mês para analisar.";
  }

  const resumo = transactions
    .map(
      (t) =>
        `${t.date} - ${t.type === "income" ? "Receita" : "Despesa"} - ${
          t.category
        } - ${t.description} - R$ ${t.amount.toFixed(2)}`
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

// ----------------------------------------
// IA: Interpretação de extrato (PDF/CSV)
// ----------------------------------------
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
