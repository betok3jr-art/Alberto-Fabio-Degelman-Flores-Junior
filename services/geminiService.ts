// services/geminiService.ts

// Tipagem simples para não dar erro de compilação.
// Se você já tiver um type/interface Transaction em outro arquivo, pode
// apagar isso aqui e importar de lá.
export interface Transaction {
  date: string;
  description: string;
  category: string;
  type: "expense" | "income";
  amount: number;
}

// -----------------------------------------------------------------------------
// CONFIG GEMINI
// -----------------------------------------------------------------------------

// A chave precisa estar como VITE_GEMINI_API_KEY nas variáveis de ambiente
// (Vercel ou Netlify).
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Modelo correto (sem "models/" aqui, o endpoint já adiciona isso).
const MODEL = "gemini-1.5-flash-001";

// ATENÇÃO: usar /v1/ e NÃO /v1beta/, senão dá 404 de modelo.
const API_URL = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

if (!API_KEY) {
  console.error(
    "❌ ERRO: VITE_GEMINI_API_KEY não está configurada. Defina a variável no painel da Vercel/Netlify."
  );
}

// -----------------------------------------------------------------------------
// Função base para chamar a Gemini API
// -----------------------------------------------------------------------------
export async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("Gemini API key não configurada (VITE_GEMINI_API_KEY).");
  }

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("❌ Erro da API Gemini:", data);
    const message =
      data?.error?.message ??
      `Erro ${response.status} ao chamar a Gemini API.`;
    throw new Error(message);
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? "")
      .join("") ?? "";

  return text.trim();
}

// -----------------------------------------------------------------------------
// IA – Resumo financeiro do mês
// -----------------------------------------------------------------------------
export async function analyzeFinances(
  transactions: Transaction[],
  monthLabel: string
): Promise<string> {
  if (!transactions.length) {
    return "Não encontrei lançamentos neste mês para analisar.";
  }

  const resumo = transactions
    .map((t) => {
      const tipo = t.type === "income" ? "Receita" : "Despesa";
      const valor = Number(t.amount || 0).toFixed(2);
      return `${t.date} - ${tipo} - ${t.category} - ${t.description} - R$ ${valor}`;
    })
    .join("\n");

  const prompt = `
Você é um assistente financeiro. Analise os lançamentos abaixo e escreva um resumo
curto, objetivo e profissional em português do Brasil.

Mês: ${monthLabel}

Lançamentos:
${resumo}

Responda em até 3 parágrafos, com dicas simples e diretas.
`;

  return callGemini(prompt);
}

// -----------------------------------------------------------------------------
// IA – Ler extrato (PDF/CSV convertido em texto) e gerar transações
// -----------------------------------------------------------------------------
export async function parseDocumentToTransactions(
  text: string
): Promise<Partial<Transaction>[]> {
  if (!text.trim()) return [];

  const prompt = `
Você vai receber o texto de um extrato bancário ou fatura de cartão.

Transforme em um JSON *válido* exatamente neste formato:

[
  {
    "date": "AAAA-MM-DD",
    "description": "texto",
    "category": "📦 Outros",
    "type": "expense" ou "income",
    "amount": 123.45
  }
]

Regras:
- Use "expense" para saídas/gastos e "income" para entradas/receitas.
- Se não souber a categoria, use "📦 Outros".
- A data deve estar no formato "AAAA-MM-DD".
- NÃO escreva nenhuma explicação, apenas o JSON.

Texto do extrato:
""" 
${text}
"""
`;

  const raw = await callGemini(prompt);

  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("Resposta da IA não contém um array JSON:", raw);
      return [];
    }

    const jsonText = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonText) as Partial<Transaction>[];

    return parsed.filter(
      (t) =>
        t.date &&
        t.description &&
        typeof t.amount === "number" &&
        (t.type === "expense" || t.type === "income")
    );
  } catch (error) {
    console.error("❌ Erro ao interpretar JSON vindo da IA:", error, raw);
    return [];
  }
}
