import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("⚠️ A variável VITE_GEMINI_API_KEY não está definida no ambiente.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-pro"
});

/**
 * 📌 1) Análise financeira do mês
 */
export async function analyzeFinances(transactions: any[], monthName: string): Promise<string> {
  try {
    if (transactions.length === 0) {
      return "Nenhuma transação encontrada para análise.";
    }

    const list = transactions
      .map(t => `${t.date} | ${t.type} | ${t.category} | R$ ${t.amount} | ${t.description}`)
      .join("\n");

    const prompt = `
      Analise os dados financeiros do mês de ${monthName}.

      Transações:
      ${list}

      Gere um resumo contendo:
      - visão geral
      - padrões de gasto
      - categorias dominantes
      - alertas importantes
      - sugestões práticas de economia

      Seja direto e amigável.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (error) {
    console.error("Erro Gemini:", error);
    return "❌ Não foi possível gerar o resumo financeiro.";
  }
}

/**
 * 📌 2) Conversão de extrato (PDF/CSV → JSON)
 */
export async function parseDocumentToTransactions(rawText: string): Promise<any[]> {
  try {
    const prompt = `
      Você é uma IA especialista em extratos bancários.

      Converta o texto abaixo em uma lista JSON de transações:

      Cada item deve conter:
      - date: YYYY-MM-DD
      - description
      - amount
      - category
      - type ("income" ou "expense")

      Texto recebido:
      ${rawText}

      Responda APENAS com JSON puro.
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Remove blocos markdown se houver
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {
    console.error("Erro ao converter extrato:", error);
    return [];
  }
}
