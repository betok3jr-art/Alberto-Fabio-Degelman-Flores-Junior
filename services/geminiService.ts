// services/geminiService.ts
import type { Transaction } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = "gemini-1.5-flash";

if (!API_KEY) {
  console.warn("VITE_GEMINI_API_KEY não encontrada. Configure no Vercel.");
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://api.google.ai/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("Erro API Gemini:", await response.text());
    throw new Error("Falha ao chamar Gemini.");
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("") ?? ""
  );
}

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
Analise os lançamentos financeiros abaixo e gere um resumo simples e objetivo:

Mês: ${monthLabel}

${resumo}

Responda em até 3 parágrafos em português do Brasil.
`;

  return callGemini(prompt);
}

export async function parseDocumentToTransactions(
  text: string
): Promise<Partial<Transaction>[]> {
  if (!text.trim()) return [];

  const prompt = `
Você vai transformar texto de extrato bancário em JSON:

Formato esperado:

[
  {
    "date": "AAAA-MM-DD",
    "description": "texto",
    "category": "📦 Outros",
    "type": "expense" ou "income",
    "amount": número
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
    return JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    console.error("Erro convertendo JSON:", raw, err);
    return [];
  }
}
