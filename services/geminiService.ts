export async function callGemini(prompt: string) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
        }),
      }
    );

    const data = await response.json();
    console.log("Gemini API Response:", data);

    // Retorna o texto gerado
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

  } catch (error) {
    console.error("Erro da API Gemini:", error);
    return null;
  }
}
