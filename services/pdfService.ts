import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM/CJS interop issues where pdfjs-dist might be exported as default
const pdf: any = (pdfjsLib as any).default || pdfjsLib;

// Set worker source to CDN matching the version
// We use unpkg here because it provides a reliable classic script for the worker
const workerVersion = '3.11.174';

// Wrap initialization to prevent app crash if PDF lib fails to load
try {
  if (pdf && pdf.GlobalWorkerOptions) {
    pdf.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${workerVersion}/build/pdf.worker.min.js`;
  }
} catch (e) {
  console.warn("PDF Worker initialization failed (App will continue working):", e);
}

export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    if (!pdf) throw new Error("Biblioteca PDF não carregada corretamente.");

    const arrayBuffer = await file.arrayBuffer();
    
    // Use the resolved pdf object to call getDocument
    const loadingTask = pdf.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    
    let fullText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    throw new Error("Falha ao ler o PDF. Tente um arquivo diferente ou verifique se é um PDF de texto.");
  }
};