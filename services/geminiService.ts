// services/geminiService.ts
import type { Transaction } from "../types";

// 🔑 Pega a chave que você colocou no Netlify (VITE_GEMINI_API_KEY)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// 🧠 Modelo correto para a API REST v1beta
const MODEL = "models/gemini-1.5-flash";

if (!API_KEY) {
  console.warn("VITE_GEMINI_API_KEY NÃO ENCONTRADA. Configure no Netlify.");
}

async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("Gemini API key não configurada.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`;

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
    const errText = await response.text();
    console.error("Erro da API Gemini:", response.status, errText);
    throw new Error("Falha ao chamar Gemini.");
  }

  const data = await response.json();

  // Pega o texto de volta
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("") ?? "";

  return text.trim();
}

/**
 * 💡 IA para analisar o mês
 */
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
Você é um assistente financeiro.
Analise os lançamentos abaixo e escreva um resumo curto e objetivo em português do Brasil.

Mês: ${monthLabel}

Lançamentos:
${resumo}

Responda em até 3 parágrafos, com dicas simples.
`;

  return callGemini(prompt);
}

/**
 * 💡 IA para ler extrato (PDF/CSV convertido em texto)
 */
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
- Use "expense" para saídas/gastos e "income" para entradas/receitas.
- Se não souber a categoria, use "📦 Outros".
- A data deve estar no formato "AAAA-MM-DD".
- NÃO escreva explicação, apenas o JSON.

Texto do extrato:
""" 
${text}
"""
`;

  const raw = await callGemini(prompt);

  try {
    // Tenta isolar só o JSON dentro da resposta
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.warn("Nenhum JSON detectado na resposta da IA:", raw);
      return [];
    }

    const jsonText = raw.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonText) as Partial<Transaction>[];

    // Filtro básico pra garantir qualidade
    return parsed.filter(
      (t) =>
        t.date &&
        t.description &&
        typeof t.amount === "number" &&
        (t.type === "expense" || t.type === "income")
    );
  } catch (e) {
    console.error("Erro ao interpretar JSON vindo da IA:", e, raw);
    return [];
  }
}
