# Płatności Tpay

Zakup biletów (aplikacja mobilna, strona WWW) może być rozliczany przez Tpay. Bez kluczy Tpay system działa jak
dotąd – z płatnością symulowaną. Po ustawieniu kluczy serwer przestaje przyjmować płatność symulowaną, a bilety
powstają **wyłącznie po potwierdzeniu z Tpay**.

## Jak to działa

1. Klient składa zamówienie (stan „oczekuje na płatność").
2. `POST /api/pay/start` – serwer zakłada transakcję w Tpay (Open API, `POST /transactions`) i zwraca adres strony
   płatności Tpay. Klient wybiera tam metodę (BLIK, karta, przelew) i płaci.
3. Tpay wysyła powiadomienie na `POST /api/pay/notify`. Serwer sprawdza podpis JWS (certyfikat z domeny Tpay,
   wystawiony przez główny certyfikat Tpay), opcjonalnie sumę md5, kwotę i numer zamówienia, po czym oznacza
   zamówienie jako opłacone i wydaje bilety. Odpowiada `TRUE`.
4. Zapas na wypadek braku powiadomienia: gdy klient wraca ze strony Tpay (`GET /api/pay/return`) albo aplikacja
   pyta o stan (`GET /api/pay/status`), serwer sam odczytuje stan transakcji w Tpay (`GET /transactions/{id}`).
5. Zwrot wykonany w Panelu Akceptanta Tpay przychodzi jako powiadomienie i unieważnia bilety.

Zwrot kliknięty w systemie (aplikacja, CMS) zmienia tylko stan zamówienia – **nie cofa pieniędzy w Tpay**.
Pieniądze zwraca się w Panelu Akceptanta; system dostanie wtedy powiadomienie.

## Konfiguracja

Netlify → projekt → **Project configuration → Environment variables**, potem ponowne wdrożenie (Deploys → Trigger deploy).

| Zmienna | Wartość |
|---|---|
| `TPAY_CLIENT_ID` | „Client ID" z Panelu Akceptanta: Integracje → API → klucze do Open API |
| `TPAY_CLIENT_SECRET` | „Secret" z tego samego miejsca |
| `TPAY_ENV` | `sandbox` (domyślnie) albo `production` |
| `TPAY_SECURITY_CODE` | opcjonalnie: kod bezpieczeństwa (Powiadomienia → Bezpieczeństwo) – włącza dodatkową kontrolę md5 |
| `TPAY_MERCHANT_ID` | opcjonalnie: identyfikator akceptanta – kontrola pola `id` w powiadomieniu |

Konto testowe: <https://register.sandbox.tpay.com>, panel: <https://panel.sandbox.tpay.com>.
Stan konfiguracji bez ujawniania kluczy: `GET /api/pay/check` (pola `provider`, `env`, `auth`, `reach`, `region`).

## Ważne: sandbox Tpay odrzuca serwery w chmurze

Środowisko testowe Tpay (`openapi.sandbox.tpay.com`, `secure.sandbox.tpay.com`) odpowiada kodem HTTP 403 (zapora)
na połączenia z serwerów, na których działa ten system. Sprawdzone 25.11.2026:

- funkcja Netlify (AWS, region us-east-2) – 403,
- maszyny GitHub Actions (Azure, USA) – 403,
- węzeł brzegowy Netlify najbliższy przeglądarce w Polsce (`GET /api/pay/reach-edge`) – 403,
- środowisko produkcyjne (`api.tpay.com`, `secure.tpay.com`) – odpowiada poprawnie z tych samych miejsc.

Wniosek: blokada nie dotyczy tylko USA, więc przeniesienie funkcji do regionu europejskiego (Netlify Pro, Frankfurt)
najpewniej nic nie da. Integracja przez Open API działa z tego serwera wyłącznie z kluczami produkcyjnymi.

Możliwe drogi:

- **klucze produkcyjne** (`TPAY_ENV=production`) – obecny kod, prawdziwe pieniądze (test małą kwotą i zwrot w panelu),
- **przekierowanie przez przeglądarkę kupującego** (starsza metoda Tpay „bez API”: serwer podpisuje parametry sumą md5,
  przeglądarka kupującego sama otwiera stronę Tpay; serwer nie łączy się z Tpay, a powiadomienie sprawdza sumą md5
  i podpisem JWS z certyfikatami zapisanymi w repozytorium) – nadaje się do sandboxa; do zrobienia,
- pytanie do wsparcia Tpay, czy sandbox da się otworzyć dla adresów serwera.

## Co sprawdzono, a czego nie

- `test/srv-tpay.mjs` – pełny przebieg na atrapie Tpay (`tools/tpay-mock.mjs`): transakcja, odrzucanie podrobionych
  powiadomień (zły podpis, zmieniona treść, obcy certyfikat, zła kwota, zła suma md5, brak podpisu), rozliczenie,
  powtórzone powiadomienie, potwierdzenie przez API, zapłata po anulowaniu, zwrot, tryb bez kluczy.
- Na prawdziwych serwerach Tpay sprawdzono tylko: osiągalność produkcji i zgodność łańcucha certyfikatów powiadomień
  (certyfikat podpisu ↔ certyfikat główny). **Żadna transakcja na prawdziwym Tpay (sandbox ani produkcja) nie została
  wykonana** – format żądań pochodzi z dokumentacji <https://docs-api.tpay.com> i wymaga potwierdzenia pierwszą płatnością testową.
- Zwroty przez API Tpay nie są zaimplementowane.
