import { GoogleGenAI } from "@google/genai";
import { Transaction, CATEGORIES } from "../types";

// Helper to initialize AI only when needed
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Chave da API não configurada.");
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

export const analyzeFinances = async (transactions: Transaction[], month: string) => {
  // Filter only relevant fields to save tokens
  const minimalData = transactions.map(t => ({
    type: t.type,
    cat: t.category,
    val: t.amount,
    date: t.date,
    desc: t.description
  }));

  const prompt = `
    Atue como um consultor financeiro pessoal estilo 'C6 Bank'. Analise estas transações de ${month}. 
    Dados: ${JSON.stringify(minimalData)}
    
    Gere um resumo financeiro curto e direto (max 150 palavras) em Português do Brasil.
    
    Estrutura:
    1. 📊 **Resumo**: Destaque quanto foi gasto vs recebido.
    2. 🚨 **Alerta**: Identifique a categoria com maior gasto (ex: "Você gastou 20% a mais em Lazer").
    3. 💡 **Dica**: Sugira uma ação prática para economizar.
    
    Use emojis e mantenha um tom profissional, mas encorajador.
  `;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Sem análise disponível.";
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Não foi possível analisar seus dados no momento. Verifique sua conexão ou chave de API.";
  }
};

export const parseDocumentToTransactions = async (text: string): Promise<Partial<Transaction>[]> => {
  const categoriesList = [...CATEGORIES.expense, ...CATEGORIES.income].join(', ');
  
  const prompt = `
    Analyze the following raw text from a financial statement (PDF/CSV). 
    Extract individual transactions and format them as a JSON array.
    
    Text content:
    """
    ${text.substring(0, 10000)} 
    """
    (Note: Text truncated to fit context window if necessary)

    Rules:
    1. Ignore headers, footers, page numbers, and balances.
    2. Extract: 
       - description (string, clean up codes)
       - amount (number, always positive)
       - type ('expense' or 'income' based on context, e.g., '-' sign or 'Crédito/Débito')
       - date (YYYY-MM-DD format, assume current year ${new Date().getFullYear()} if missing)
       - category (Choose the BEST match from this list: ${categoriesList}. Default to '📦 Outros' or '💵 Outros' if unsure)
    
    Return ONLY the raw JSON array. No markdown formatting.
  `;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const json = JSON.parse(response.text || '[]');
    return json;
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw new Error("Falha ao interpretar o documento com IA.");
  }
};