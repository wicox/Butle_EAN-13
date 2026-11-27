import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/scan-barcode', async (req, res) => {
    try {
      const { imageDataUrl } = req.body as { imageDataUrl?: string };
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        res.status(400).json({ error: 'Brak obrazu do analizy.' });
        return;
      }

      const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Nieprawidłowy format obrazu (oczekiwano data URL base64).' });
        return;
      }

      const mimeType = match[1];
      const base64Data = match[2];

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error: 'Klucz GEMINI_API_KEY nie jest skonfigurowany w środowisku serwera. Wpisz kod EAN-13 ręcznie lub użyj lokalnego skanera.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text:
                'Przeanalizuj zdjęcie butelki lub puszki. ' +
                'Odczytaj dokładnie 13-cyfrowy kod kreskowy EAN-13 (tylko cyfry, bez spacji). ' +
                'Jeśli widoczny jest 12-cyfrowy kod UPC-A, poprzedź go zerem, lub podaj dokładnie odczytane cyfry. ' +
                'Rozpoznaj również czy opakowanie to butelka ("bottle") czy puszka ("can") oraz podaj krótką nazwę produktu jeśli jest czytelna na etykiecie.',
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ean13: {
                type: Type.STRING,
                description: 'Odczytany 13-cyfrowy kod EAN-13 (tylko cyfry) lub pusty string jeśli nie znaleziono.',
              },
              confidence: {
                type: Type.STRING,
                description: 'Poziom pewności odczytu: high, medium lub low.',
              },
              containerType: {
                type: Type.STRING,
                description: 'Typ opakowania: bottle albo can.',
              },
              detectedName: {
                type: Type.STRING,
                description: 'Krótka nazwa produktu z etykiety (opcjonalnie).',
              },
            },
            required: ['ean13', 'confidence', 'containerType', 'detectedName'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        ean13?: string;
        confidence?: string;
        containerType?: string;
        detectedName?: string;
      };

      const digitsOnly = (parsed.ean13 ?? '').replace(/\D/g, '');
      res.json({
        ean13: digitsOnly,
        confidence: parsed.confidence ?? 'low',
        containerType: parsed.containerType === 'can' ? 'can' : 'bottle',
        detectedName: parsed.detectedName ?? '',
      });
    } catch (err) {
      console.error('Barcode AI scan error:', err);
      const message = err instanceof Error ? err.message : 'Nieznany błąd podczas analizy obrazu.';
      res.status(500).json({ error: `Nie udało się odczytać kodu ze zdjęcia: ${message}` });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      console.warn('Katalog dist/ nie istnieje. Uruchom najpierw "npm run build".');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer aplikacji uruchomiony na http://0.0.0.0:${PORT} (${isProduction ? 'produkcja' : 'deweloperski'})`);
  });
}

startServer().catch((err) => {
  console.error('Błąd uruchamiania serwera:', err);
  process.exit(1);
});
