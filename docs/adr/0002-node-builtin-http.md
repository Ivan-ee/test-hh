# Встроенный node:https вместо HTTP-клиента

Измерительный слой работает на встроенных `node:https`/`node:http`, а не на fetch/got/undici/axios. Сокетные события дают точный пофазный расклад DNS → TCP → TLS → TTFB → download (undici даже через `diagnostics_channel` DNS не отделяет), подсчёт байт идёт по чанкам потока, а слоёв между замером и сокетом — ноль. Редиректы (до 10, GET сохраняется) и свежее соединение на пробу (см. [ADR 0001](./0001-fresh-connection-per-probe.md)) — явный цикл в десятки строк.

## Considered options

- got 16: готовые `timings.phases` из коробки, но фазы группирует грубее и тянет зависимость.
- undici `request()` + `diagnostics_channel` (выбор research-стека): TTFB есть, но DNS не отделить, а контроль соединения всё равно ручной.

## Consequences

- HTTP/1.1 (как и у got/undici по умолчанию); HTTP/2 не поддерживается — осознанно.
- Заголовки запроса фиксируются кодом: `Accept-Encoding` не отправляется, поэтому Transfer size — честные «проводные» байты без декомпрессии.
