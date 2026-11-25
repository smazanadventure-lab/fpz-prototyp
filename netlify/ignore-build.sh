#!/bin/sh
# Czy pominąć wdrożenie na Netlify?  Kod wyjścia 0 = pomiń, każdy inny = buduj.
# Wdrożenie produkcyjne kosztuje kredyty, więc pomijamy je, gdy zmieniły się wyłącznie rzeczy bez wpływu na stronę:
# dokumentacja, testy, przepływy GitHub, projekt Android, narzędzia pomocnicze.
# Budujemy zawsze, gdy nie wiadomo, co się zmieniło: pierwsze wdrożenie albo ręczne ponowienie tego samego commitu
# („Trigger deploy”, np. po zmianie zmiennych środowiskowych).
[ -n "$CACHED_COMMIT_REF" ] || exit 1
[ "$CACHED_COMMIT_REF" != "$COMMIT_REF" ] || exit 1
git cat-file -e "$CACHED_COMMIT_REF^{commit}" 2>/dev/null || exit 1
git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- . ':(exclude)docs' ':(exclude)test' ':(exclude).github' ':(exclude)android' ':(exclude)tools' ':(exclude)*.md'
