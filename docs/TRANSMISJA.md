# Transmisja na żywo z kamery telefonu

Zamiast symulowanej transmisji ekrany, aplikacja i strona WWW mogą pokazywać prawdziwy obraz i dźwięk z telefonu.

## Jak nadać

1. Na telefonie otwórz `https://<adres>/nadawanie` (link i kod QR są w Zarządzaniu ekspozycją → „Transmisje i napisy").
2. Zaloguj się, wybierz kamerę (przednia / tylna), mikrofon i jakość, dotknij „Rozpocznij transmisję"
   i zezwól przeglądarce na kamerę i mikrofon.
3. Obraz pojawia się tam, gdzie dotąd była symulacja: na ekranach z pozycją „napisy na żywo" lub filmem „na żywo",
   w aplikacji, na stronie WWW i w kioskach. Napisy wpisuje się jak dotąd w konsoli respeakera.
4. „Zakończ" na telefonie albo zakończenie transmisji w panelu wyłącza kamerę.

## Jak to działa

Obraz płynie bezpośrednio z przeglądarki telefonu do każdego odbiorcy (WebRTC). Serwer pośredniczy tylko w zestawieniu
połączenia (`/api/live/*`, `server/live-routes.mjs`); kod po stronie przeglądarki: `src/kernel/rtc.js`,
strona nadawania: `src/endpoints/broadcast/`, odbiornik: `src/ui/live.jsx`.

## Ograniczenia

- Do 6 odbiorców naraz (każdy ekran lub otwarta strona z transmisją to jeden odbiorca) – telefon wysyła obraz do każdego osobno.
- Najpewniej w tej samej sieci Wi-Fi. Przez internet działa, gdy sieci po obu stronach przepuszczają połączenia
  bezpośrednie; część sieci komórkowych i firmowych tego nie robi. Wtedy potrzebny jest serwer pośredniczący TURN –
  ustawia się go zmiennymi `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` na serwerze.
- Telefon musi mieć stronę nadawania na wierzchu (przeglądarki wstrzymują kamerę w tle) i nie może się wygasić.
- Transmisja nie jest nagrywana. Dźwięk na ekranach LCD startuje wyciszony, jeśli przeglądarka ekranu blokuje autoodtwarzanie z dźwiękiem.
- Sprawdzone automatycznie z atrapą kamery w jednej przeglądarce (`test/rtc-core.mjs`, `test/live-flow.mjs`).
  Niesprawdzone: prawdziwe telefony (Android, iPhone), połączenia między różnymi sieciami.
