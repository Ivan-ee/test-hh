# Архитектура netspeed

Консольный тулзамер скорости скачивания: N последовательных Probe по одному Target, живой TUI, динамические единицы. Термины — в [GLOSSARY.md](../GLOSSARY.md); ключевые решения — в [docs/adr/](./adr/).

## Слои и правила зависимостей

```
cli  →  core  ←  ui
```

- **`src/core/`** — домен и измерения. Только встроенные модули Node (`node:https`, `node:http`, `node:perf_hooks`). Ни React, ни ink — отсюда прямой тестируемый слой.
- **`src/ui/`** — ink-компоненты. Читают доменные типы и события Run, сами HTTP не делают.
- **`src/cli/`** — вход. Commander-парсинг флагов, выбор режима (`--json` / прямая ссылка / интерактивное меню), маппинг ошибок в exit codes.

## Поток данных

```
cli → Preflight (validate) → runSeries
        runSeries: события probeStart / tick (instant speed) / probeDone + итог RunResult
            → ink App (live-рендер)     |     --json → stdout JSON
```

## Модули

```
src/
  cli/
    index.ts        вход: commander, режимы, exit codes
  core/
    domain.ts       типы: Target, ProbeResult, RunResult, PhaseTimings, RunStats
    validate.ts     Preflight: синтаксис + доступность цели
    measure.ts      одна Probe: свежее соединение, фазы, байты
    run.ts          Run: N последовательных Probe + события
    stats.ts        агрегаты: min/avg/median/max, скорости
    format.ts       динамические единицы (десятичные байты, Mbps)
    presets.ts      встроенные Preset-цели
  ui/
    App.tsx         корень ink: статическая зона + живая зона + итог
    ...
```

Тесты colocated: `src/core/*.test.ts` (vitest).

## Семантика метрик

- **Probe duration** — от старта запроса до последнего байта тела (`performance.now()`), «время запроса» из задания.
- Фазы одной Probe: **Connect** (DNS+TCP+TLS) → **TTFB** → **Download**; сумма фаз ≈ duration.
- **Probe speed** = Transfer size / Probe duration (аналог `curl speed_download`).
- **Run speed** = Σ Transfer size / Σ Probe duration — заголовочное число; рядом фиксированная строка в Mbps (десятичные биты).
- **Instant speed** — байты за скользящее окно 500 мс; питает живую панель и спарклайн.
- **Run stats** — min / avg / **median** / max по длительностям: median устойчив к выбросам (первая холодная проба, рывок CDN), avg рядом для сравнения.

## Отказы и лимиты

- Ошибка пробы (сеть, таймаут, HTTP ≥ 400, обрыв тела) помечает Probe неуспешной с причиной; серия продолжается, итог считается по успешным.
- `--timeout` — лимит на Probe в секундах; по умолчанию `0` — без лимита: задание требует дожидаться полного ответа на каждый запрос.
- Редиректы следуются до 10 раз; тайминги берутся с финального хопа (соединение на каждый hop свежее).
- Exit codes: `0` — серия завершилась (≥1 успешная Probe); `1` — ошибка использования / Preflight не прошёл; `2` — все Probe неуспешны.

## Единицы

Десятичные (1000): размеры `B → kB → MB → GB`, скорости `B/s → kB/s → MB/s → GB/s` — выбираются автоматически под величину; вторая строка — фиксированные **Mbps** (словарь ISP/Speedtest). Подробности в README.
