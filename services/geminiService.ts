// services/geminiService.ts
import type { Transaction } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const MODEL = "models/gemini-1.5-flash-latest";

if (!API_KEY) {
  console.warn("⚠️ VITE_GEMINI_API_KEY NÃO ENCONTRADA. Configure no Netlify.");
}

// Função para chamar Gemini
async function callGemini(prompt: string): Promise<string> {
  if (!API_KEY) {
    throw new Error("❌ Gemini API key não configurada.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ Erro da API Gemini:", response.status, errText);
    throw new Error("Falha ao chamar Gemini.");
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text ?? "")
      .join("") ?? "";

  return text.trim();
}

// ---------------------------------------------------------------------------
// 💡 Resumo financeiro do mês
// ---------------------------------------------------------------------------
export async function analyzeFinances(
  transactions: Transaction[],
  monthLabel: string
): Promise<string> {
  if (!transactions.length)
    return "Não encontrei lançamentos neste mês para analisar.";

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

// ---------------------------------------------------------------------------
// 💡 Leitura de extrato (PDF/CSV transformado em texto)
// ---------------------------------------------------------------------------
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
