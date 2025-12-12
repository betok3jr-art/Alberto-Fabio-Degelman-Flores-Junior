// services/geminiService.ts
import type { Transaction } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("⚠️ VITE_GEMINI_API_KEY NÃO ENCONTRADA. Configure no Vercel/Netlify.");
}

// Função genérica que chama a API Gemini
export async function callGemini(prompt: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("❌ Erro API Gemini:", data.error);
      throw new Error(data.error.message);
    }

    return (
      data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      ""
    );
  } catch (err) {
    console.error("❌ Erro ao chamar Gemini:", err);
    throw err;
  }
}

// 📌 IA para analisar o mês
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

Responda em até 3 parágrafos com dicas simples e diretas.
`;

  return callGemini(prompt);
}

// 📌 IA para transformar PDF/CSV em transações
export async function parseDocumentToTransactions(
  text: string
): Promise<Partial<Transaction>[]> {
  if (!text.trim()) return [];

  const prompt = `
Você vai receber o texto de um extrato bancário ou fatura de cartão.

Transforme em um JSON com este formato:

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
- Use "expense" para gastos e "income" para entradas.
- Se não souber a categoria, use "📦 Outros".
- A data deve estar no formato AAAA-MM-DD.
- NÃO escreva explicação, apenas o JSON.

Texto do extrato:
"""
${text}
"""
`;

  const raw = await callGemini(prompt);

  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");

    if (jsonStart === -1 || jsonEnd === -1) return [];

    const jsonText = raw.slice(jsonStart, jsonEnd + 1);

    const parsed = JSON.parse(jsonText) as Partial<Transaction>[];

    // Filtro básico
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
