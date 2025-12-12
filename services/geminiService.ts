// services/geminiService.ts
import type { Transaction } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Modelo correto que funciona no endpoint v1beta
const MODEL = "gemini-1.5-flash-001";

if (!API_KEY) {
  console.warn("⚠️ VITE_GEMINI_API_KEY NÃO ENCONTRADA. Configure no Vercel.");
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ Erro API Gemini:", response.status, errText);
    throw new Error("Falha ao chamar Gemini.");
  }

  const data = await response.json();

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("") ?? ""
  );
}

// ----------------------
// Análise financeira
// ----------------------
export async function analyzeFinances(
  transactions: Transaction[],
  monthLabel: string
): Promise<string> {
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
Você é um assistente financeiro. Analise os lançamentos abaixo e escreva um resumo
curto e objetivo em português do Brasil.

Mês: ${monthLabel}

Lançamentos:
${resumo}

Responda em até 3 parágrafos, com dicas simples e diretas.
`;

  return callGemini(prompt);
}

// ----------------------
// PDF → JSON
// ----------------------
export async function parseDocumentToTransactions(
  text: string
): Promise<Partial<Transaction>[]> {
  if (!text.trim()) return [];

  const prompt = `
Converta o texto do extrato abaixo em JSON.

Formato:
[
  {
    "date": "AAAA-MM-DD",
    "description": "texto",
    "category": "📦 Outros",
    "type": "expense" ou "income",
    "amount": 0
  }
]

NÃO explique nada, responda apenas com JSON válido.

Extrato:
"""
${text}
"""
`;

  const raw = await callGemini(prompt);

  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return [];

    const json = JSON.parse(raw.slice(start, end + 1));

    return json.filter(
      (t: any) =>
        t.date &&
        t.description &&
        typeof t.amount === "number" &&
        (t.type === "income" || t.type === "expense")
    );
  } catch (err) {
    console.error("❌ Erro ao interpretar JSON:", err, raw);
    return [];
  }
}
