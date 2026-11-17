# netspeed

CLI-тулзамер скорости скачивания: серия последовательных HTTP-запросов к одной цели, честные пофазные тайминги и динамические единицы.

## Language

**Target**: URL, на котором измеряют скорость скачивания. _Avoid_: link, урл, endpoint.

**Preset**: предзаданная цель из встроенного меню (картинка Яндекса, большое видео). _Avoid_: default, template.

**Preflight**: проверка цели до серии — корректный URL, доступность, сервер отдаёт тело. _Avoid_: validation, healthcheck.

**Probe**: один HTTP GET к цели, который дожидается полного тела ответа. _Avoid_: request, attempt, iteration.

**Run**: серия из N последовательных Probe по одной цели вместе с агрегатами. _Avoid_: session, batch, speedtest.

**Connect phase**: часть Probe от старта до установленного защищённого соединения (DNS + TCP + TLS суммарно). _Avoid_: handshake.

**TTFB**: часть Probe от установленного соединения до первых байтов ответа (заголовков); сегмент фаз, не пересекается с Connect phase. _Avoid_: latency, response delay.

**Download phase**: часть Probe от первых байтов до конца тела. _Avoid_: body time.

**Probe duration**: полное время Probe от старта до последнего байта — «время запроса» из задания. _Avoid_: latency, request time.

**Transfer size**: байты тела ответа, принятые в Probe «по проводам», без декомпрессии. _Avoid_: file size, payload.

**Instant speed**: скорость стрима в данный момент — байты за короткое скользящее окно. _Avoid_: current speed.

**Probe speed**: Transfer size данной Probe, делённый на её Probe duration. _Avoid_: average speed (закреплено за Run).

**Run speed**: суммарный Transfer size всех Probe серии, делённый на сумму их длительностей; заголовочное число результата. _Avoid_: total speed.

**Run stats**: min / avg / median / max по длительностям Probe серии; median — главная устойчивая оценка. _Avoid_: aggregates.
