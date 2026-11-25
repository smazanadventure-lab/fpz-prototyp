# Logo Fabryki Pełnej Życia – pliki

**Źródło znaku:** oficjalne logo przekazane przez Zamawiającego – `zrodlo/fabryka-pelna-zycia-logo-czarne-poziome.png`
(4000×1405 px, czarny znak na przezroczystym tle, wersja pozioma: sygnet + napis „Fabryka. / Pełna / Życia”).

Wszystkie pliki w tym katalogu powstały przez **wektoryzację pliku źródłowego** (trasowanie kanału alfa, próg 50%,
w pełnej rozdzielczości – `tools/vectorize-logo.py`), bez przerysowywania: proporcje, odstępy i krój są zachowane.
Kontrola wierności: wektor wyrenderowany do 4000×1405 px pokrywa się z maską źródła w 99,75% (IoU), różnice tylko na
krawędziach (≤ 1,4 px). Te same ścieżki są wbudowane w system (`src/ui/logo-data.js`).

| Plik | Zawartość | Na jakie tło |
|---|---|---|
| `fpz-logo-poziome-czarne.svg/.png` | pełne logo, `#000000` | białe, jasne (np. `#EEF6F2`) – wersja podstawowa |
| `fpz-logo-poziome-zielone.svg/.png` | pełne logo, `#125930` | białe, jasnozielone |
| `fpz-logo-poziome-biale.svg/.png` | pełne logo, `#FFFFFF` | zielone `#125930`, ciemne (`#0E1512`), zdjęcia |
| `fpz-sygnet-czarny / -zielony / -bialy .svg/.png` | sam sygnet | jak wyżej; do małych formatów (ikony, plakietki) |

PNG: pełne logo 2000 px szerokości, sygnet 1024 px szerokości, przezroczyste tło.
`podglad.png` – plansza ze wszystkimi wersjami na właściwych tłach i ikoną aplikacji.

W systemie logo przyjmuje kolor automatycznie (`currentColor`): na jasnym tle ciemne (kolor tekstu), na ciemnym
i w motywie nocnym / wysokiego kontrastu – jasne. Ikony aplikacji (PWA, Android, iOS) to biały sygnet na zielonym
`#125930` (`tools/gen-pwa-icons.py`, `android/tools/gen-icons.py`).

Odtwarzanie plików: `python3 tools/vectorize-logo.py` → `node tools/gen-logo-files.mjs`.
Napis w logo jest drobny – przy wysokości logo poniżej ok. 36 px linie „Pełna / Życia” stają się słabo czytelne;
w takich miejscach lepiej użyć samego sygnetu.
