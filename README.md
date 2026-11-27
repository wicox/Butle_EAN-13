# Baza Butelek & Generator EAN-13

Aplikacja webowa do prowadzenia bazy danych butelek oraz puszek wraz z odczytem kodów kreskowych ze zdjęć, regeneracją kodów EAN-13, precyzyjną linijką (2,70–3,00 cm od pierwszej do ostatniej kreski) oraz eksportem do Word (`.docx`), PDF (`.pdf`) i archiwum ZIP.

## Funkcje

- **Baza butelek i puszek**: dodawanie, edycja oraz usuwanie rekordów (przechowywanie w lokalnej bazie IndexedDB przeglądarki wraz ze zdjęciami).
- **Zdjęcia opakowań**: dodawanie i usuwanie zdjęć butelek/puszek.
- **Wymiary opakowania**: dodawanie i usuwanie wymiarów (`Średnica` oraz `Długość / Wysokość` w mm).
- **Odczyt i generator EAN-13**: automatyczny odczyt kodu ze zdjęcia (lokalny dekoder ZXing + analiza wizyjna po stronie serwera) oraz regeneracja czystego kodu EAN-13 (kreski + cyfry na dole) wyświetlanego w osobnym panelu obok.
- **Precyzyjna linijka (2,70–3,00 cm)**: ustawienie dokładnej szerokości samego kodu kreskowego (od pierwszej kreski do ostatniej) przed eksportem do Worda lub PDF.
- **Selektywny eksport do Word (`.docx`) i PDF (`.pdf`)**: zaznaczanie wybranych opakowań i generowanie arkusza A4 z ramkami tabeli ułatwiającymi wycinanie oraz opisem wymiarów nad każdym kodem.
- **Kopia zapasowa ZIP (Eksport / Import)**: zapis pełnej bazy jako plik `.zip` zawierający plik `database.json` oraz katalog `images/` ze wszystkimi zdjęciami, z możliwością natychmiastowego przywrócenia.

## Szybki start po pobraniu / synchronizacji z GitHub

### Linux / macOS
```bash
chmod +x start.sh
./start.sh
```

### Windows
Uruchom dwukrotnie plik `start.bat` lub wykonaj w terminalu:
```cmd
start.bat
```

## Dostępne skrypty `npm`

| Skrypt | Opis |
| --- | --- |
| `npm run dev` | Uruchamia serwer deweloperski Express + Vite na porcie `3000` |
| `npm run typecheck` | Weryfikuje poprawność typów TypeScript (`tsc --noEmit`) |
| `npm run lint` | Alias kontroli typów i składni |
| `npm run build` | Kompiluje aplikację produkcyjną do katalogu `dist/` |
| `npm run verify` | Wykonuje kolejno `typecheck` oraz `build` |
| `npm run start` | Uruchamia skompilowaną wersję produkcyjną na porcie `3000` |
| `npm run clean` | Usuwa wygenerowane pliki z `dist/` |

## Automatyzacja GitHub (CI)

Repozytorium zawiera konfigurację GitHub Actions w `.github/workflows/ci.yml`, która automatycznie weryfikuje instalację zależności, kontrolę typów TypeScript oraz kompilację produkcyjną po każdym wypchnięciu zmian (`push`) lub otwarciu Pull Requesta.
