import React from 'react';
import { FolderGit2, Terminal, FileArchive, Ruler } from 'lucide-react';

export const GuideSection: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <FolderGit2 className="h-5 w-5 text-blue-700" />
          <h1 className="text-lg font-semibold text-slate-900">
            Struktura GitHub i skrypty uruchomieniowe
          </h1>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Projekt jest przygotowany do publikacji w repozytorium GitHub wraz z automatyczną
          integracją CI (<code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">.github/workflows/ci.yml</code>),
          szablonem Pull Requestów oraz plikami startowymi do kompilacji i uruchomienia zaraz po
          synchronizacji lub pobraniu kodu.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Terminal className="h-4 w-4 text-slate-600" />
              <span>Linux / macOS — start.sh</span>
            </div>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100">
{`chmod +x start.sh
./start.sh`}
            </pre>
            <p className="text-xs text-slate-500">
              Instaluje pakiety, sprawdza typy TypeScript, kompiluje produkcyjny bundle
              Vite i uruchamia serwer na porcie 3000.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Terminal className="h-4 w-4 text-slate-600" />
              <span>Windows — start.bat</span>
            </div>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100">
{`start.bat`}
            </pre>
            <p className="text-xs text-slate-500">
              Automatycznie tworzy plik .env z .env.example, wykonuje npm install,
              kompiluje projekt i startuje serwer.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Ruler className="h-4 w-4 text-blue-700" />
            <span>Dokładność wymiaru EAN-13 (2,70–3,00 cm)</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Standardowy kod EAN-13 składa się z dokładnie 95 modułów liczonych od
            lewej krawędzi pierwszej czarnej kreski do prawej krawędzi ostatniej
            czarnej kreski. Zarówno plik Word (.docx), jak i wektorowy plik PDF
            przeliczają szerokość tak, aby wymiar między pierwszą a ostatnią kreską
            wynosił dokładnie tyle, ile ustawiono na linijce (2,70–3,00 cm).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileArchive className="h-4 w-4 text-blue-700" />
            <span>Format kopii zapasowej ZIP</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Eksport ZIP zapisuje czytelny plik <code className="font-mono bg-slate-100 px-1 rounded">database.json</code> ze
            wszystkimi rekordami, wymiarami i ustawieniem linijki oraz folder{' '}
            <code className="font-mono bg-slate-100 px-1 rounded">images/</code> zawierający oryginalne
            zdjęcia butelek i puszek. Wybranie tego pliku w funkcji „Przywróć ZIP”
            odtwarza całą bazę w ułamku sekundy.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Wszystkie skrypty npm</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Komenda</th>
                <th className="py-2 font-medium">Działanie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2 pr-4 font-mono">npm run dev</td>
                <td className="py-2">Uruchamia serwer Express + Vite HMR (port 3000)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">npm run typecheck</td>
                <td className="py-2">Sprawdza typy TypeScript bez emisji plików</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">npm run build</td>
                <td className="py-2">Buduje zoptymalizowaną aplikację do dist/</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">npm run verify</td>
                <td className="py-2">Uruchamia kolejno typecheck oraz build (używane w CI)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">npm run start</td>
                <td className="py-2">Uruchamia zbudowaną aplikację w trybie produkcyjnym</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">npm run clean</td>
                <td className="py-2">Czyści katalog dist/</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
