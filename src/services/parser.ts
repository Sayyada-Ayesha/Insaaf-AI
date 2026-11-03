import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Setup PDF.js worker from the locally packaged asset (no CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// F6: extraction quality reporting. The document-understanding assistant uses
// this to warn the user clearly when OCR quality is poor instead of guessing.
export interface TextExtractionResult {
  text: string;
  source: 'pdf-text' | 'pdf-ocr' | 'image-ocr';
  confidence: number; // 0-100 (100 = native PDF text layer)
}

export async function extractTextWithQuality(file: File): Promise<TextExtractionResult> {
  if (file.type === 'application/pdf') {
    return extractPdfWithQuality(file);
  } else if (file.type.startsWith('image/')) {
    return extractImageWithQuality(file);
  }
  throw new Error('Unsupported file type');
}

async function extractPdfWithQuality(file: File): Promise<TextExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  // If text layer is sparse/empty (scanned image PDF), render page canvas & run
  // server-side OCR fallback (browser WASM Tesseract hangs in headless Chrome).
  if (fullText.trim().length < 20) {
    let ocrText = '';
    let confidenceSum = 0;
    let confidenceCount = 0;
    try {
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          // J2.3: use server-side OCR (browser WASM hangs)
          const base64 = dataUrl.split(',')[1];
          const res = await fetch('/api/ai/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: base64, mimeType: 'image/png' })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              ocrText += data.text + '\n';
              if (typeof data.confidence === 'number' && data.confidence > 0) {
                confidenceSum += data.confidence;
                confidenceCount++;
              }
            }
          }
        }
      }
    } catch (ocrErr) {
      console.warn("Canvas OCR fallback error on PDF:", ocrErr);
    }
    if (ocrText.trim().length > 0) {
      return {
        text: ocrText,
        source: 'pdf-ocr',
        confidence: confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : 0
      };
    }
  }

  return { text: fullText, source: 'pdf-text', confidence: 100 };
}

async function extractImageWithQuality(file: File): Promise<TextExtractionResult> {
  // J2.3 FIX: Browser WASM Tesseract hangs in headless Chrome (worker + language
  // data load successfully but recognize() never resolves). Run OCR server-side
  // where Tesseract in Node.js works reliably (verified 86% confidence).
  // Uses FileReader.readAsDataURL for safe base64 encoding (spread operator
  // overflows the call stack for files > ~100KB).
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.onabort = () => reject(new Error('FileReader aborted'));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.split(',')[1];
    const res = await fetch('/api/ai/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64: base64, mimeType: file.type })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        return { text: data.text, source: 'image-ocr', confidence: data.confidence || 0 };
      }
    }
    return { text: '', source: 'image-ocr', confidence: 0 };
  } catch (err) {
    console.warn('[parser] Server OCR failed:', (err as Error).message);
    return { text: '', source: 'image-ocr', confidence: 0 };
  }
}

export function detectPlaceholders(text: string) {
  const placeholders: { fieldId: string; label: string; type: string; originalMatch: string }[] = [];
  
  // Pattern 1: [Bracketed Text] or (Parenthesized Text)
  const bracketRegex = /[\[\(]([^\]\)]+)[\]\)]/g;
  let match;
  while ((match = bracketRegex.exec(text)) !== null) {
    if (match[1].length > 2 && match[1].length < 50) {
      placeholders.push({
        fieldId: `bracket_${match.index}`,
        label: match[1].trim(),
        type: 'text',
        originalMatch: match[0]
      });
    }
  }

  // Pattern 2: Labels followed by colons, underscores or dots (English & Urdu)
  const labeledFillRegex = /([A-Za-z\u0600-\u06FF\s,]{3,20})[:：]?\s*([_.]{3,})/gi;
  while ((match = labeledFillRegex.exec(text)) !== null) {
      if (!placeholders.some(p => p.fieldId.includes(String(match!.index)))) {
          placeholders.push({
              fieldId: `labeled_${match.index}`,
              label: match[1].trim(),
              type: 'text',
              originalMatch: match[0]
          });
      }
  }

  // Pattern 3: Key-Value headers e.g. "Complainant Name:", "Police Station:"
  const headerRegex = /([A-Za-z\u0600-\u06FF\s,]{3,25})[:：]\s*(?=\r?\n|$)/gi;
  while ((match = headerRegex.exec(text)) !== null) {
      if (!placeholders.some(p => p.label.toLowerCase() === match![1].trim().toLowerCase())) {
          placeholders.push({
              fieldId: `header_${match.index}`,
              label: match[1].trim(),
              type: 'text',
              originalMatch: match[0]
          });
      }
  }

  // Pattern 4: Lone underscores or dots (minimum 5)
  const loneFillRegex = /[_.]{5,}/g;
  while ((match = loneFillRegex.exec(text)) !== null) {
      const isDuplicate = placeholders.some(p => 
        match!.index >= text.indexOf(p.originalMatch) && 
        match!.index <= text.indexOf(p.originalMatch) + p.originalMatch.length
      );
      
      if (!isDuplicate) {
          placeholders.push({
              fieldId: `lone_${match.index}`,
              label: `Field at position ${match.index}`,
              type: 'text',
              originalMatch: match[0]
          });
      }
  }

  return placeholders;
}

export function mergeDataIntoText(text: string, formData: Record<string, string>, placeholders: any[]): string {
    let result = text;
    // We need to replace them in reverse order to keep indices valid if we were doing slice/splice,
    // but since we have the original strings, we can just replace.
    // However, global replace might be risky if multiple identical placeholders exist.
    // A better way is to iterate through placeholders and replace their specific occurrence.
    
    // Sort placeholders by length desc to avoid partial replacements
    const sorted = [...placeholders].sort((a, b) => b.originalMatch.length - a.originalMatch.length);
    
    sorted.forEach(p => {
        const value = formData[p.fieldId] || p.originalMatch;
        // Use split/join for global replacement of that EXACT string
        result = result.split(p.originalMatch).join(value);
    });

    return result;
}
