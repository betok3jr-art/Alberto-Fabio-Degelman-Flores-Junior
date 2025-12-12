const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function callGemini(prompt: string): Promise<string> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-001:generateContent?key=${API_KEY}`,
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

    // Resposta da API em JSON
    const data = await response.json();

    // Checar se houve erro
    if (!response.ok) {
      console.error("Erro da API Gemini:", data);
      throw new Error(data.error?.message || "Erro ao chamar Gemini");
    }

    // Retornar o texto gerado pela IA
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Erro no geminiService:", error);
    throw error;
  }
}
