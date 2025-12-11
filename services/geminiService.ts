import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("⚠️ A variável VITE_GEMINI_API_KEY não está definida no ambiente.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Gemini Pro (texto)
const model = genAI.getGenerativeModel({
  model: "gemini-pro"
});

/**
 * 📌 1) ANÁLISE FINANCEIRA DO MÊS
 * Usada na aba K3 Intelligence
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
      Analise os dados financeiros do mês de **${monthName}**.

      Transações:
      ${list}

      Gere um resumo completo contendo:
      • visão geral do mês
      • padrões de comportamento financeiro
      • categorias mais relevantes
      • pontos de alerta
      • oportunidades reais de economia
      • dicas práticas baseadas no perfil de gastos

      Responda de forma amigável, organizada e direta.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
