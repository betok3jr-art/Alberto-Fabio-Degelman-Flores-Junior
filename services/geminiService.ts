// API Key para o acesso correto
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Substituir pelo modelo correto
const MODEL = "gemini-1.5-flash-001";

// Endpoint da API com o modelo correto
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// Checar se a chave da API foi configurada corretamente
if (!API_KEY) {
  console.error("❌ ERRO: A chave da API 'VITE_GEMINI_API_KEY' não foi configurada.");
}

// Função para chamar a Gemini API com tratamento de erros adequado
export async function callGemini(prompt: string): Promise<string> {
  try {
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

    // Checar se o status da resposta é ok ou se ocorreu erro
    if (!response.ok) {
      console.error("❌ Erro ao chamar Gemini:", data.error);
      throw new Error(data.error?.message || "Erro desconhecido na chamada Gemini");
    }

    // Processar a resposta e retornar
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text || "")
        .join("") || ""
    );
  } catch (err) {
    console.error("❌ Erro na função callGemini:", err);
    throw err; // Relança o erro para que a chamada seja interrompida e tratado pelo consumidor da função
  }
}

// Função para analisar transações financeiras e gerar um resumo
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

// Função para analisar um documento e gerar transações
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
