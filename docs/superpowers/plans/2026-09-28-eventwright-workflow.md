# Eventwright — план реализации

> ⚠️ **ВРЕМЕННЫЙ ФАЙЛ.** План нужен только на время создания проекта под техзадание «Build a Reliable Agentic Workflow with Claude Code». Когда все задачи выполнены и финальный чек-лист (Задача 13) закрыт, **файл удаляется** отдельным коммитом (`chore: remove temporary implementation plan`). Постоянная документация проекта — `CLAUDE.md` и `README.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** С нуля построить репозиторий **Eventwright**: агентный workflow для Claude Code, вызываемый командой `/plan-event <описание события>`. Workflow собирает и подтверждает требования, исследует погоду (Open-Meteo MCP), площадки, кейтеринг, развлечения и логистику (web search), сводит бюджет, проверяет всё quality gates с точечными повторами, получает детерминированно проверяемое одобрение человека и выдаёт `event-plan.html` + `event-plan.md`.

**Architecture:** Hub-and-spoke. Координатор — slash-команда в главной сессии Claude Code, следует skill `workflow-orchestration`. Модель решает, **какие** subagents нужны: formalizer выводит из запроса строку `- Services:`, человек подтверждает требования, `wf plan` детерминированно применяет выбор. Следующий шаг вычисляет **код**: `nextAction()` по графу `src/config/dag.ts` и `runs/<runId>/workflow-state.json`. 10 subagents с одной ответственностью и одним артефактом каждый; 3 из них (catering, entertainment, logistics) необязательные. Независимые агенты запускаются параллельно (несколько вызовов Agent в одном сообщении), зависимые — последовательно. Состояние пишут только CLI (`npm run -s wf -- …`) и hooks. Одобрение фиксирует hook `UserPromptSubmit` по тексту, набранному человеком, и оно привязано к sha256 плана.

**Code architecture:** строгий TypeScript без сборки (`node --import tsx`), слои `src/types → src/config → src/lib → src/io → src/cli | src/hooks`. `lib` — чистая логика (без fs и process), `io` — единственный слой с диском и процессом, `cli` и `hooks` — тонкие точки входа. Направление импортов, alias `@/`, запрет классов, `enum`, `as` и `export default` проверяет ESLint (Задача 0.1). Правила кода — в `CLAUDE.md`.

**Tech Stack:** Claude Code (slash commands, subagents, skills, hooks, `.claude/mcp.json`), Node ≥ 22, TypeScript 6.0 (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), `tsx` 4, `node:test`, ESLint 10 + `typescript-eslint` 8 (strict type-checked), Prettier 3, Husky 9, community MCP `open-meteo-mcp-server@2.5.0`, встроенные WebSearch/WebFetch.

**Spec:** техзадание пользователя из сессии 2026-09-28 и правила кода из `CLAUDE.md`. Перечень требований ТЗ и их сопоставление с задачами — в разделе «0. Требования ТЗ» ниже.

**Проверка плана.** Код задач 0.1–4.6 собран в песочнице **задача за задачей**. После каждой задачи на проекте, собранном только из неё и предыдущих задач, прошли `tsc --noEmit`, `eslint .`, `prettier --check .` и все тесты (итого 128 тестов). Код в плане — ровно тот, что прошёл проверку.

## Global Constraints

- **Код — только TypeScript** по правилам `CLAUDE.md`: `.ts` в `src/` и `tests/`; `.js` только для конфигов инструментов (`eslint.config.js`). Импорты — только через alias `@/` (код) и `@tests/` (тестовые фикстуры), никогда `../`.
- **Язык:** промпты агентов, skills, артефакты, итоговый документ, README, сообщения CLI и hooks — English. Комментарии в коде — по-русски, коротко и только там, где неочевидно «зачем». Запрос пользователя может быть на любом языке; имена собственные сохраняются как даны.
- Node `"engines": { "node": ">=22" }`. Сборки нет: `node --import tsx <file>.ts` из чистого checkout после `npm install`.
- **Все настройки Claude Code, кроме `CLAUDE.md`, лежат в `.claude/`** (`settings.json`, `mcp.json`, `agents/`, `commands/`, `skills/`). Сессия запускается `npm run claude` (= `claude --mcp-config=.claude/mcp.json`). Hooks: `node --import tsx "${CLAUDE_PROJECT_DIR}/src/hooks/<name>.ts"`. **Не через `npx`**: на Windows `.cmd`-шимы без shell не запускаются.
- Координатор и агенты меняют состояние только командой `npm run -s wf -- <command> …` (`-s` — чтобы stdout был чистым JSON).
- `maxRetries = 3` — лимит **подряд идущих** неудач: провалов quality gate (сбрасывается на PASS), провалов структурной проверки (сбрасывается на успешный `check`), запусков агента без записанного артефакта (сбрасывается при записи). Законные повторные запуски после retry/revise лимит не расходуют.
- Перед каждым коммитом — `npm run format`: pre-commit запускает lint, `format:check`, typecheck и тесты.
- Внутренние детали (`0N-*.md`, `validation-*.md`, `workflow-state.json`, `approval.json`, `runs/…`, имена агентов, `mcp__…`) **никогда** не попадают в `runs/*/output/*`. За этим следит hook `no-leak-guard`.
- Секретов у workflow нет: Claude Code использует логин пользователя, Open-Meteo работает без ключа. `.env*` всё равно в `.gitignore`. `.env.example` документирует, что ничего задавать не нужно.
- `runs/**` не форматируется и не меняет EOL (`.prettierignore`, `.gitattributes -text`): от sha256 плана зависит одобрение.
- Денежные строки в артефактах — строго `- <Label>: <number> <CUR>`, где number = цифры с необязательной дробной частью через точку, без разделителей тысяч (`- Budget: 9000 EUR`). Их парсит детерминированная проверка бюджета.

## Review Focus

1. **Windows-пути в payload hooks** (`C:\…\runs\x\artifacts\01-requirements.md`) распознаются так же, как POSIX. Тест `parseRunPath` (Задача 1.2).
2. **Возобновление после прерывания:** агент в `running` без артефакта перезапускается, завершённые — нет; артефакт, записанный прямо перед падением, сначала проходит `check` (Задача 1.6). Агент, который раз за разом падает без артефакта, останавливает run после лимита (Задача 3.2).
3. **Отказ человека, затрагивающий upstream** («возьмите вторую площадку»): координатор инвалидирует `venue-scout`, и **всё downstream** (кейтеринг, развлечения, логистика, бюджет, план) перегенерируется. Тесты `invalidateAgents` (Задачи 1.3, 1.6).
4. **`/reject-event` без причины или с неверным runId** блокируется понятным сообщением и не портит `approval.json`. Тест (Задача 4.3).
5. **Битый отчёт валидатора** (пропущен гейт, статус не PASS/FAIL): `record-gates` падает с перечнем, попытка гейту не засчитывается. Тест (Задача 1.5). **Битый `workflow-state.json`** на диске даёт понятную ошибку с путём, а не падение позже (Задача 1.8).
6. **Запрос без части услуг** («еду принесём сами»): `catering-planner` не запускается, G5 = `n/a`, бюджет не ждёт кейтеринга и не получает его артефакт. Тесты (Задачи 1.4, 1.6).

## Прогресс

Отмечать `[x]` задачу целиком, когда все её шаги отмечены и коммит сделан.

- [x] 0.1 Каркас TypeScript и инструменты качества
- [x] 0.2 Open-Meteo MCP *(установка, `.claude/mcp.json` и smoke-тест уже сделаны — остались тест и коммит)*
- [x] 1.1 Доменные типы и граф DAG
- [x] 1.2 Запросы к графу и разбор путей
- [x] 1.3 Состояние run: запись артефактов и инвалидация
- [x] 1.4 Динамический выбор subagents (execution plan)
- [x] 1.5 Quality gates и точечные повторы
- [x] 1.6 Вычисление следующего шага `nextAction`
- [x] 1.7 Правила одобрения человеком
- [x] 1.8 Слой io: хранение состояния run
- [x] 1.9 Слой io: хранение одобрения
- [x] 2.1 Структурная проверка артефактов
- [x] 2.2 Детерминированная проверка бюджета
- [ ] 3.1 CLI: `init`, `list`, `status`, `next`
- [ ] 3.2 CLI: `start`, `lint`, `check`
- [ ] 3.3 CLI: `confirm-requirements`, `plan`, `budget`, `record-gates`, `invalidate`
- [ ] 4.1 Разбор payload hooks + `state-integrity-guard`
- [ ] 4.2 `post-write-state`
- [ ] 4.3 `record-approval`
- [ ] 4.4 `approval-gate-guard`
- [ ] 4.5 `no-leak-guard`
- [ ] 4.6 `.claude/settings.json`
- [ ] 5 Проверка MCP в Claude Code
- [ ] 6 Skills (5 шт.)
- [ ] 7 Subagents (10 шт.)
- [ ] 8 Slash-команды координатора
- [ ] 9 Smoke-проверка в живом Claude Code
- [ ] 10 Сквозной отладочный прогон
- [ ] 11 Демонстрационные run (4)
- [ ] 12 CLAUDE.md (раздел workflow) и README.md
- [ ] 13 Чистый checkout, DoD, push

## Где выполнять задачи: облако или локально

Репозиторий: `github.com/vilkasts/Eventwright`. Облачная сессия (claude.ai/code или `claude --cloud`) клонирует его на Linux-VM, зависимости ставит SessionStart-hook из `.claude/settings.json`.

| Задачи | Где | Почему |
|---|---|---|
| 0.1–4.6, 6, 7, 8, 12 | **облако** | чистый код и тексты: нужны только npm и git |
| 5, 9, 10, 11 | **локально** (`npm run claude`) | живой workflow: MCP из `.claude/mcp.json` подключается только флагом `--mcp-config`, облако читает MCP лишь из корневого `.mcp.json`; Run C требует закрыть Claude Code посреди группы |
| 13 | локально | проверка чистого checkout на машине пользователя |

Одна облачная сессия = одна задача (или 2–3 соседние мелкие) → отдельная ветка и PR → ревью диффа → merge в `main`. Галочки в разделе «Прогресс» отмечаются в том же PR.

---

## 0. Требования ТЗ и как они закрываются

### 0.1. Требования ТЗ

| # | Требование ТЗ | Где закрывается |
|---|---|---|
| 1 | Workflow вызывается custom slash-командой, которая запускает координатора | Задача 8 (`/plan-event`) |
| 2 | Hub-and-spoke, ≥5 subagents + 1 координатор | Задачи 1.1, 7, 8 (10 subagents) |
| 3 | **Динамический выбор subagents**, model-driven | Задачи 1.4 (`applyExecutionPlan`), 3.3 (`wf plan`), 7 (formalizer пишет `- Services:`), 6 (действие `plan`) |
| 4 | У каждого subagent одна ответственность и явное владение артефактом | Задача 1.1 (`src/config/dag.ts`), Задача 7 |
| 5 | Единая структура выходов subagents | Задачи 2.1, 6 (`artifact-validator`) |
| 6 | Отдельный synthesis-subagent | Задача 7 (`event-plan-builder`) |
| 7 | Зависимые — последовательно, независимые — параллельно | Задача 1.6 (`nextAction`), Задача 6 (оркестрация) |
| 8 | Явные quality gates; артефакт проходит гейт до запуска зависимой работы | Задачи 1.5, 2.1, 3.2 (`check` после каждой группы), 7 (`validator`, G1–G12) |
| 9 | Точечный повтор только затронутых агентов + перегенерация downstream, лимит повторов | Задачи 1.3 (`invalidateAgents`), 1.5 (`recordGates`) |
| 10 | Нерешённый провал останавливает зависимую работу и явно сообщается | Задачи 1.5, 1.6, 3.2, 6 (отчёт `failed`) |
| 11 | Финальный вывод только после явного, детерминированно проверенного одобрения человека | Задачи 1.7, 1.9, 4.3, 4.4, 8 |
| 12 | Отклонённая работа дорабатывается по отзыву и снова идёт на одобрение | Задачи 1.7, 4.3, 6, 8 |
| 13 | Состояние переживает прерывания и перезапуски, продолжение без повтора готового | Задачи 1.3, 1.6 (`check` после падения), 1.8 (атомарная запись), 3.1 (`--resume`), 4.2, 8 |
| 14 | Сбор, фиксация и подтверждение недостающей информации | Задачи 6, 7 (clarify) |
| 15 | План выполнения адаптируется к подтверждённым требованиям и контексту | Задачи 1.4, 1.6 (состав агентов и гейтов), 7 (метод погоды, крытая зона, фильтр по `[MUST]`) |
| 16 | Внешние источники: web search + ≥1 MCP-сервер | Задачи 0.2, 5, 7 (Open-Meteo, WebSearch/WebFetch) |
| 17 | Общие возможности — переиспользуемые skills (≥2), workflow их использует | Задача 6 (5 skills) |
| 18 | Итог в Markdown/HTML с одинаковой структурой при повторных запусках | Задача 6 (`event-html-theme`), Задача 7 |
| 19 | PreToolUse и PostToolUse hooks реализованы и используются | Задачи 4.1–4.6 |
| 20 | CLAUDE.md документирует workflow и правила выполнения | `CLAUDE.md` (правила кода — уже есть), Задача 12 (раздел workflow) |
| 21 | Всё (компоненты, skills, hooks, MCP-конфиг) в репозитории | Все задачи |
| 22 | ≥3 сохранённых run (входы, артефакты, состояние) | Задача 11 (4 run) |
| 23 | README: setup, run, resume, prerequisites, окружение | Задача 12 |
| 24 | Нет секретов, нужные секреты документированы и исключены | Задачи 0.1, 12, 13 |
| 25 | Разворачивается и работает из чистого checkout | Задача 13 |

---

## 1. Дизайн workflow

### 1.1. Домен: Event Planner

Пользователь описывает событие. Workflow выдаёт полный план события.

**Пример входа:**
```
/plan-event 40th birthday dinner in Lisbon on 2027-06-12 for 30 guests. Budget 9000 EUR. Rooftop or garden restaurant, live acoustic music, 3 vegetarians and 1 gluten-free guest, one guest uses a wheelchair.
```

**Выход:** `runs/<runId>/output/event-plan.html` и `event-plan.md`. Разделы всегда в одном порядке:
1. Overview · 2. Weather & Plan B · 3. Venue · 4. Menu · 5. Program · 6. Run of Show · 7. Preparation Checklist · 8. Budget · 9. Sources

### 1.2. Агенты (1 координатор + 10 subagents)

| # | Агент | Одна ответственность | Артефакт | Внешние источники |
|---|---|---|---|---|
| — | **Coordinator** (`/plan-event`, `/resume-event`, `/approve-event`, `/reject-event`) | План по DAG, запуск агентов, гейты, уточнения, одобрение, повторы, состояние. **Контент не пишет.** | `input.md`, `clarifications.md` | — |
| 1 | `requirements-formalizer` | Запрос + уточнения → структурированные требования `R-NN` | `01-requirements.md` | user-input |
| 2 | `weather-analyst` | Погода на дату и место: прогноз (≤14 дней) или климатическая норма (архив за 10 лет), вердикт для улицы | `02-weather-outlook.md` | **MCP Open-Meteo** |
| 3 | `venue-scout` | 3 площадки: вместимость, цена, доступность, крытая/открытая зона, рекомендация | `03-venues.md` | **WebSearch/WebFetch** |
| 4 | `catering-planner` *(если нужен сервис `catering`)* | Формат питания, меню, покрытие диет, стоимость на гостя | `04-catering.md` | WebSearch/WebFetch |
| 5 | `entertainment-planner` *(если нужен сервис `entertainment`)* | Программа, исполнители/ведущий, активности, план Б при плохой погоде | `05-entertainment.md` | WebSearch/WebFetch |
| 6 | `logistics-planner` *(если нужен сервис `logistics`)* | Транспорт и парковка, доступность, аренда и декор, дедлайны бронирований | `06-logistics.md` | WebSearch/WebFetch |
| 7 | `budget-aggregator` | Сводит стоимости из 03–06 в бюджет с резервом 10%, предлагает экономию | `07-budget.md` | артефакты 01, 03–06 |
| 8 | `validator` | Проверяет артефакты по именованным гейтам: PASS/FAIL + владельцы | `validation-domain.md`, `validation-final.md` | Open-Meteo, WebFetch (выборочно), `wf budget` |
| 9 | `event-plan-builder` (**synthesis**) | Сливает проверенные артефакты в единый план + сценарий дня + чек-лист подготовки | `08-event-plan.md` | артефакты 01–07 |
| 10 | `html-builder` | Рендерит **утверждённый** план в MD + HTML по шаблону | `output/event-plan.md`, `output/event-plan.html` | skill `event-html-theme` |

### 1.3. Поток выполнения (DAG)

```
requirements-formalizer (draft)
  → clarify (AskUserQuestion в главной сессии → clarifications.md → formalizer finalize → подтверждение)
  → plan (cli plan: из `- Services:` выбираются нужные агенты группы 4; остальные → skipped, их гейты → n/a)
  → weather-analyst                                                         группа 2
  → venue-scout                   (зависит от вердикта погоды: нужна ли крытая зона)   группа 3
  → [catering-planner ∥ entertainment-planner ∥ logistics-planner]          группа 4 (параллельно, только выбранные)
  → budget-aggregator                                                       группа 5
  → validator(domain): G1–G9 → FAIL: перезапуск владельцев + их downstream (max 3)
  → event-plan-builder (synthesis)
  → validator(final): G10–G12 (max 3)
  → human approval: /approve-event | /reject-event <feedback>
        reject → координатор инвалидирует затронутых агентов (+downstream) → … → снова approval
  → html-builder → output/event-plan.{md,html}
```

После каждой группы запускается детерминированная структурная проверка `npm run -s wf -- check <runId> <agent>`. Следующая группа не стартует, пока артефакт её не прошёл. Если процесс упал между записью артефакта и `check`, `nextAction` вернёт `{action:"check"}` раньше всего остального.

### 1.4. Quality gates

| Гейт | Стадия | Проверка | Владельцы |
|---|---|---|---|
| `G1-requirements-complete` | domain | Все разделы заполнены, машинные строки `- Date/City/Guests/Budget` есть, каждое требование `R-NN`, «Open questions» = `None` | requirements-formalizer |
| `G2-sources-cited` | domain | Каждая площадка/поставщик/цена имеет URL реальной страницы | venue-scout, catering-planner, entertainment-planner, logistics-planner |
| `G3-weather-grounded` | domain | Цифры получены из вызовов Open-Meteo (координаты, период, инструмент указаны); метод соответствует сроку (≤14 дней → forecast, иначе archive-climatology) | weather-analyst |
| `G4-venue-fit` | domain | Рекомендованная площадка: вместимость ≥ гостей, требования доступности выполнены, есть крытая зона при вердикте ≠ `outdoor-ok` | venue-scout |
| `G5-dietary-coverage` | domain | Каждое диетическое ограничение покрыто названными блюдами; порции на всех гостей | catering-planner |
| `G6-weather-plan-b` | domain | При вердикте ≠ `outdoor-ok` у каждого уличного элемента есть план Б | venue-scout, entertainment-planner, logistics-planner |
| `G7-budget-within-limit` | domain | `wf budget` → `withinLimit: true` (итог с резервом ≤ лимита, валюта совпадает) | venue-scout, catering-planner, entertainment-planner, logistics-planner, budget-aggregator |
| `G8-currency-consistent` | domain | Все суммы в валюте требований | venue-scout, catering-planner, entertainment-planner, logistics-planner, budget-aggregator |
| `G9-must-haves-covered` | domain | Каждое `[MUST]`-требование выполнено конкретным пунктом в 03–06 | venue-scout, catering-planner, entertainment-planner, logistics-planner |
| `G10-plan-covers-requirements` | final | Каждый `R-NN` есть в «Requirements matrix» (дублируется детерминированно в `check`) | event-plan-builder |
| `G11-plan-consistent-with-artifacts` | final | Цифры, имена, время и суммы плана совпадают с 02–07 | event-plan-builder |
| `G12-timeline-feasible` | final | Сценарий дня укладывается в часы площадки; дедлайны подготовки после «today» и до даты события | event-plan-builder |

**Неприменимые гейты.** Гейт, все владельцы которого пропущены по execution plan, получает `n/a`: валидатор его не проверяет, а `record-gates` не требует для него строки (пример: G5 без кейтеринга). Пропущенные агенты исключаются из владельцев остальных гейтов.

**Правило повтора.** Каждый FAIL увеличивает `attempts` гейта, PASS сбрасывает счётчик. Владельцы из строки отчёта (пересечённые с `owners`) и **все их downstream** получают `stale`, и `nextAction` перезапускает только их. На 4-м FAIL гейт получает статус `blocked`, заполняется `state.failure`, run останавливается, координатор выдаёт отчёт.

### 1.5. Одобрение человеком (детерминированное)

- План готов и G10–G12 прошли. Координатор показывает сводку и **завершает ход**, попросив набрать `/approve-event <runId>` или `/reject-event <runId> <feedback>`.
- Hook `UserPromptSubmit` (`src/hooks/record-approval.ts`) видит **сырой текст, набранный человеком**, до раскрытия команды. Он считает sha256 `08-event-plan.md` и пишет `approval.json`. Модель не может породить `UserPromptSubmit`. Запись в `approval.json` моделью блокирует `state-integrity-guard`. Вызов команд моделью блокируют `disable-model-invocation: true` и тот же guard.
- `approval-gate-guard` (PreToolUse) разрешает запись в `runs/<id>/output/*`, только если `approval.current.decision == "approved"` и `planSha256 == sha256(текущий план)`. Любая правка плана после одобрения его аннулирует.
- Отказ: hook ставит `event-plan-builder` в `stale` с `feedback`. Затем координатор решает, затрагивает ли отзыв upstream-агентов (таблица ответственности 1.2). Если да, вызывает `npm run -s wf -- invalidate <runId> <agents…> --feedback "<text>"`: эти агенты получают режим `revise`, их downstream перегенерируется. Дальше обычный цикл: гейты → план → одобрение. История раундов хранится в `approval.json.history`.

### 1.6. Состояние и возобновление

`runs/<runId>/workflow-state.json` пишут **только**:
- CLI `npm run -s wf -- …` (координатор через Bash);
- `post-write-state` (PostToolUse): запись артефакта → агент `done` + sha256, downstream → `stale`, затронутые PASS-гейты → `pending`;
- `record-approval` (UserPromptSubmit) через `src/io/approval-store.ts`.

`/resume-event <runId>` вызывает `wf next <runId> --resume`. `done`-агенты не перезапускаются. `running` без артефакта (прерван) перезапускается. Артефакт записан, но `check` не выполнен → сначала `check`. Если отчёт валидатора записан, но не учтён, выполняется только `record-gates`. Execution plan (`state.plan`) хранится в состоянии и при resume не пересчитывается. Сбрасывается он только при перезаписи требований, и тогда человек подтверждает их заново.

### 1.7. Структура репозитория

```
CLAUDE.md                                    правила кода (есть) + workflow (Задача 12)
README.md  LICENSE  package.json  tsconfig.json  eslint.config.js
.prettierrc  .prettierignore  .gitignore  .gitattributes  .env.example  .husky/pre-commit
.claude/                                     ВСЕ настройки Claude Code, кроме CLAUDE.md
  settings.json                              hooks + permissions
  mcp.json                                   open-meteo (подключается через npm run claude)
  commands/{plan-event,resume-event,approve-event,reject-event}.md
  agents/<10 subagents>.md
  skills/{workflow-orchestration,artifact-validator,web-research,weather-lookup,event-html-theme}/SKILL.md
  skills/artifact-validator/template.md      шаблон артефакта
  skills/event-html-theme/template.html      шаблон итогового HTML
src/
  types/    workflow.ts approval.ts checks.ts hooks.ts          типы + кортежи имён; ничего не импортирует
  config/   dag.ts workflow.ts hooks.ts                         граф и константы; импортирует только types
  lib/      narrow text hash dag-queries run-path state execution-plan gates approval-status next-action
            approval agent-runs artifact-check budget status-report hook-input approval-command
            schemas/{workflow-state,approval-file}  guards/{state-integrity,output-target,leaks}
                                                                чистая логика: без fs и process
  io/       paths files clock state-store approval-store output hook-io   единственный слой с fs/process
  cli/      main.ts command.ts require-run.ts commands/{run,agent,flow}-commands.ts
  hooks/    state-integrity-guard approval-gate-guard no-leak-guard post-write-state record-approval
tests/
  support/  state-fixtures plan-fixtures gate-fixtures approval-fixtures temp-project run-cli run-hook
  config/   secrets mcp settings  (.test.ts)
  lib/ io/ cli/ hooks/                                          зеркалят src/
runs/                                        4 демонстрационных run (Задача 11)
docs/superpowers/plans/…                     ЭТОТ временный план
```

Направление импортов: `cli`, `hooks` → `io` → `lib` → `config` → `types`. Нарушение — ошибка ESLint.

---

## Задачи

### Задача 0.1: Каркас TypeScript и инструменты качества

**Files:**
- Modify: `package.json` (скрипты, dev-зависимости)
- Create: `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `.env.example`, `.husky/pre-commit`, `LICENSE`
- Test: `tests/config/secrets.test.ts`
- Уже есть: `.gitignore`, `.gitattributes`, `CLAUDE.md`, `.claude/mcp.json`, `.claude/settings.json` (SessionStart для облака), зависимость `open-meteo-mcp-server`

**Interfaces:**
- Produces: `npm run typecheck | lint | format | format:check | test | wf -- <cmd> | claude`; alias `@/*` → `src/*`, `@tests/*` → `tests/*`; ESLint, который проверяет правила `CLAUDE.md` (слои, alias, без классов/`enum`/`as`/`export default`).

- [ ] **Step 1: Dev-зависимости**

```bash
npm install -D typescript@~6.0.3 tsx@^4 @types/node@^22 eslint@^10 @eslint/js@^10 typescript-eslint@^8 globals@^17 prettier@^3 eslint-config-prettier@^10 husky@^9
```
Expected: установка без ошибок. `typescript` держим на 6.0: `typescript-eslint` 8 поддерживает TypeScript `<6.1`.

- [ ] **Step 2: Скрипты в `package.json`** (заменить блок `scripts` целиком)

```json
"scripts": {
  "claude": "claude --mcp-config=.claude/mcp.json",
  "mcp:weather": "node node_modules/open-meteo-mcp-server/dist/index.js",
  "wf": "node --import tsx src/cli/main.ts",
  "test": "node --import tsx --test \"tests/**/*.test.ts\"",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"],
      "@tests/*": ["./tests/*"]
    }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: `eslint.config.js`** — правила `CLAUDE.md` становятся ошибками линтера (конфиг инструмента, поэтому `.js`)

```js
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const RELATIVE_IMPORTS = { group: ["./*", "../*"], message: "Import via the @/ or @tests/ alias only (CLAUDE.md)." };
const LIB_FORBIDDEN_MODULES = ["node:fs", "node:fs/promises", "node:process", "node:child_process"].map((name) => ({
  name,
  message: "src/lib is pure: file system and process access belong to src/io (CLAUDE.md).",
}));

// Import direction is enforced here: cli, hooks → io → lib → config → types.
const restrictImports = (forbiddenLayers, paths = []) => [
  "error",
  {
    paths,
    patterns: [
      RELATIVE_IMPORTS,
      ...forbiddenLayers.map((layer) => ({
        group: [`@/${layer}/*`],
        message: `This layer must not import @/${layer} (import direction, CLAUDE.md).`,
      })),
    ],
  },
];

export default defineConfig([
  globalIgnores(["node_modules", "runs", "docs"]),
  { files: ["**/*.js"], extends: [js.configs.recommended], languageOptions: { globals: globals.node } },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "func-style": ["error", "expression"],
      "no-restricted-syntax": [
        "error",
        { selector: "ClassDeclaration, ClassExpression", message: "No classes: use arrow functions (CLAUDE.md)." },
        { selector: "TSEnumDeclaration", message: "Use a union type instead of enum (CLAUDE.md)." },
        { selector: "TSModuleDeclaration", message: "No namespaces (CLAUDE.md)." },
        { selector: "ExportDefaultDeclaration", message: "Named exports only (CLAUDE.md)." },
      ],
      "no-restricted-imports": restrictImports([]),
    },
  },
  {
    files: ["src/types/**/*.ts"],
    rules: { "no-restricted-imports": restrictImports(["config", "lib", "io", "cli", "hooks"]) },
  },
  { files: ["src/config/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["lib", "io", "cli", "hooks"]) } },
  {
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports(["io", "cli", "hooks"], LIB_FORBIDDEN_MODULES),
      "no-restricted-globals": ["error", "process"],
    },
  },
  { files: ["src/io/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["cli", "hooks"]) } },
  { files: ["src/cli/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["hooks"]) } },
  { files: ["src/hooks/**/*.ts"], rules: { "no-restricted-imports": restrictImports(["cli"]) } },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        { allowForKnownSafeCalls: [{ from: "package", package: "node:test", name: ["describe", "test"] }] },
      ],
    },
  },
  eslintConfigPrettier,
]);
```

- [ ] **Step 5: `.prettierrc`, `.prettierignore`, `.env.example`**

`.prettierrc`:
```
{ "printWidth": 120 }
```
`.prettierignore` (Prettier 3 дополнительно учитывает `.gitignore`):
```
node_modules/
package-lock.json
runs/
docs/
```
`.env.example`:
```
# Eventwright needs NO secrets.
# - Claude Code uses your own Claude login (run `claude` and sign in).
# - The Open-Meteo MCP server uses the free public Open-Meteo API (no key).
# Keep this file for documentation; never commit a real .env.
```

- [x] **Step 5a: `.gitattributes`** (уже в репозитории) — LF везде, иначе на Windows с `core.autocrlf=true` падает `prettier --check`; артефакты run не трогаются вовсе

```
* text=auto eol=lf

# Workflow artifacts are hashed (human approval is bound to the plan's sha256) — never rewrite line endings.
runs/** -text
```

- [x] **Step 5b: `.claude/settings.json`** (уже в репозитории) — облачная сессия стартует с чистого клона: hook ставит зависимости только там (`CLAUDE_CODE_REMOTE=true`), локально ничего не делает

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "if [ \"$CLAUDE_CODE_REMOTE\" = \"true\" ] && [ ! -d \"$CLAUDE_PROJECT_DIR/node_modules\" ]; then cd \"$CLAUDE_PROJECT_DIR\" && npm ci --no-audit --no-fund; fi",
            "timeout": 600
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 6: Первый тест `tests/config/secrets.test.ts`**

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();

test("secrets are documented and excluded from git", () => {
  assert.ok(existsSync(path.join(ROOT, ".env.example")));
  const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.claude\/settings\.local\.json$/m);
});
```

Run: `npm test` → Expected: PASS (1 test).

- [ ] **Step 7: Линтер действительно ловит нарушения**

Временно создать `src/lib/bad-example.ts`:
```ts
import { readFileSync } from "node:fs";

import { statePath } from "@/io/paths";
import { sha256 } from "../lib/hash";

enum Color {
  Red,
}
class Thing {}
export default function legacy(value: unknown) {
  return [readFileSync, statePath, sha256, Color.Red, Thing, value as string, process.cwd()];
}
```
Run: `npx eslint src/lib/bad-example.ts` → Expected: ошибки `node:fs … src/lib is pure`, `must not import @/io`, `Import via the @/ or @tests/ alias only`, `Use a union type instead of enum`, `No classes`, `Named exports only`, `Missing return type`, `Do not use any type assertions`, `Unexpected use of 'process'`. Удалить файл.

- [ ] **Step 8: Husky pre-commit**

```bash
npx husky init
```
Expected: в `package.json` появился `"prepare": "husky"`. Заменить содержимое `.husky/pre-commit`:
```sh
npm run lint || exit 1
npm run format:check || exit 1
npm run typecheck || exit 1
npm test || exit 1
```

- [ ] **Step 9: `LICENSE`** (MIT, © 2026 vilkasts) и проверка

Run: `npm run format && npm run lint && npm run typecheck && npm test`
Expected: без ошибок.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Eventwright (strict TypeScript, tsx, eslint layers, prettier, husky)"
```

---

### Задача 0.2: Подключение Open-Meteo MCP

**Files:**
- Уже сделано: `open-meteo-mcp-server@2.5.0` в `dependencies`, `.claude/mcp.json`, скрипты `claude` и `mcp:weather`
- Test: `tests/config/mcp.test.ts`

**Interfaces:**
- Produces: сервер `open-meteo` для сессии `npm run claude`; инструменты `mcp__open-meteo__geocoding` (обязателен `name`), `mcp__open-meteo__weather_forecast` (`latitude`, `longitude`), `mcp__open-meteo__weather_archive` (`latitude`, `longitude`, `start_date`, `end_date`) — на них опираются Задачи 6 и 7.

- [x] **Step 1: Установка** — `npm install --save-exact open-meteo-mcp-server@2.5.0` (точка входа `dist/index.js`).
- [x] **Step 2: `.claude/mcp.json`** — сервер запускается `node node_modules/open-meteo-mcp-server/dist/index.js`.
- [x] **Step 3: Smoke-тест по протоколу MCP** — сервер отвечает, 17 инструментов, `geocoding("Lisbon")` вернул `38.725, -9.150`; headless-сессия `claude --mcp-config=.claude/mcp.json` видит `mcp__open-meteo__*`.
- [ ] **Step 4: Тест конфигурации `tests/config/mcp.test.ts`**

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SERVER_ENTRY = "node_modules/open-meteo-mcp-server/dist/index.js";

test("the open-meteo MCP server lives in .claude/mcp.json and starts from node_modules (no npx)", () => {
  const config: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "mcp.json"), "utf8"));
  assert.deepEqual(config, {
    mcpServers: { "open-meteo": { type: "stdio", command: "node", args: [SERVER_ENTRY] } },
  });
  assert.ok(existsSync(path.join(ROOT, SERVER_ENTRY)), SERVER_ENTRY);
});

test("npm run claude loads the MCP config from .claude/", () => {
  const manifest: unknown = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(JSON.stringify(manifest), /"claude":"claude --mcp-config=\.claude\/mcp\.json"/);
});
```

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add package.json package-lock.json .claude/mcp.json tests/config/mcp.test.ts
git commit -m "feat(mcp): integrate the community Open-Meteo MCP server"
```

---

### Задача 1.1: Доменные типы и граф DAG

**Files:**
- Create: `src/types/workflow.ts`, `src/config/dag.ts`, `src/config/workflow.ts`

**Interfaces:**
- Produces (`types/workflow`): кортежи `AGENT_NAMES`, `GATE_IDS`, `SERVICES`, `AGENT_STATUSES`, `GATE_STATUSES` и выведенные из них union-типы `AgentName`, `GateId`, `Service`, `AgentStatus`, `GateStatus`; `Stage`, `GatedStage`, `ArtifactArea`, `BriefMode`, `RequestedService`; `ArtifactAgentDefinition | OutputAgentDefinition`, `GateDefinition`, `Dag`; `AgentState`, `GateState`, `ValidationRecord`, `ExecutionPlan`, `Failure`, `LogEntry`, `WorkflowState`, `Brief`, `Action`, `ActionName`, `RunLocation`, `GateSummary`.
- Produces (`config/dag`): `DAG: Dag` — единственное место с зависимостями, артефактами, разделами, обязательными строками и владельцами гейтов. Опечатка в имени агента или гейта — ошибка компиляции.
- Produces (`config/workflow`): `MAX_RETRIES`, `REQUIREMENTS_AGENT`, `BUDGET_AGENT`, `PLAN_AGENT`, `OUTPUT_AGENT`, `VALIDATOR_NAME`, `STAGE_ORDER`, `ARTIFACTS_AREA`, `OUTPUT_AREA`, `VENUE_SERVICE`, `SCHEMA_VERSION`, `RUNS_DIRECTORY`, `STATE_FILE`, `APPROVAL_FILE`, `HASH_PREVIEW_LENGTH`, `APPROVAL_RECORDED_BY`, `validationFileName(stage)`.

- [ ] **Step 1: `src/types/workflow.ts`**

```ts
// Кортежи имён — единственный источник литералов; типы ниже выводятся из них.
export const AGENT_NAMES = [
  "requirements-formalizer",
  "weather-analyst",
  "venue-scout",
  "catering-planner",
  "entertainment-planner",
  "logistics-planner",
  "budget-aggregator",
  "event-plan-builder",
  "html-builder",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const GATE_IDS = [
  "G1-requirements-complete",
  "G2-sources-cited",
  "G3-weather-grounded",
  "G4-venue-fit",
  "G5-dietary-coverage",
  "G6-weather-plan-b",
  "G7-budget-within-limit",
  "G8-currency-consistent",
  "G9-must-haves-covered",
  "G10-plan-covers-requirements",
  "G11-plan-consistent-with-artifacts",
  "G12-timeline-feasible",
] as const;
export type GateId = (typeof GATE_IDS)[number];

export const SERVICES = ["catering", "entertainment", "logistics"] as const;
export type Service = (typeof SERVICES)[number];
export type RequestedService = Service | "venue";

export const AGENT_STATUSES = ["pending", "running", "done", "stale", "skipped"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const GATE_STATUSES = ["pending", "pass", "fail", "blocked", "n/a"] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

export type Stage = "domain" | "final" | "output";
export type GatedStage = Exclude<Stage, "output">;
export type ArtifactArea = "artifacts" | "output";
export type BriefMode = "initial" | "retry" | "revise";

type AgentDefinitionBase = {
  readonly deps: readonly AgentName[];
  readonly stage: Stage;
  readonly service?: Service;
};

export type ArtifactAgentDefinition = AgentDefinitionBase & {
  readonly kind: "artifact";
  readonly artifact: string;
  readonly sections: readonly string[];
  readonly requiredLines: readonly string[];
  readonly coversRequirements?: true;
};

export type OutputAgentDefinition = AgentDefinitionBase & {
  readonly kind: "output";
  readonly outputs: readonly string[];
};

export type AgentDefinition = ArtifactAgentDefinition | OutputAgentDefinition;

export type GateDefinition = {
  readonly stage: GatedStage;
  readonly owners: readonly AgentName[];
};

export type Dag = {
  readonly maxRetries: number;
  readonly agents: Readonly<Record<AgentName, AgentDefinition>>;
  readonly gates: Readonly<Record<GateId, GateDefinition>>;
};

export type AgentState = {
  status: AgentStatus;
  attempts: number;
  startsWithoutArtifact: number;
  structuralFailures: number;
  structureOk: boolean;
  sha256: string | null;
  updatedAt: string | null;
  lastError: string | null;
  feedback: string | null;
  outputs: Record<string, string>;
};

export type GateState = {
  status: GateStatus;
  attempts: number;
  findings: string[];
};

export type ValidationRecord = {
  sha256: string | null;
  recorded: boolean;
  at: string;
};

export type ExecutionPlan = {
  services: RequestedService[];
  selected: AgentName[];
  skipped: AgentName[];
  at: string;
};

export type Failure =
  | { kind: "gate"; gate: GateId; findings: string[]; attempts: number; at: string }
  | { kind: "agent"; agent: AgentName; findings: string[]; attempts: number; at: string };

export type LogEntry = {
  at: string;
  event: string;
  details: Record<string, unknown>;
};

export type Brief = {
  name: AgentName;
  artifact: string | null;
  inputs: string[];
  mode: BriefMode;
  reason: string | null;
  feedback: string | null;
};

export type Action =
  | { action: "failed"; failure: Failure }
  | { action: "check"; agents: AgentName[] }
  | { action: "run"; agents: Brief[] }
  | { action: "clarify" }
  | { action: "plan" }
  | { action: "validate"; stage: GatedStage; recheck: GateId[]; notApplicable: GateId[] }
  | { action: "record-gates"; stage: GatedStage }
  | { action: "await-approval"; planSha256: string | null }
  | { action: "done"; outputs: readonly string[] };

export type ActionName = Action["action"];

export type WorkflowState = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  updatedAt: string;
  phase: ActionName | "init";
  requirementsConfirmed: boolean;
  plan: ExecutionPlan | null;
  failure: Failure | null;
  agents: Record<AgentName, AgentState>;
  gates: Record<GateId, GateState>;
  validation: Record<GatedStage, ValidationRecord | null>;
  log: LogEntry[];
};

export type RunLocation = {
  runId: string;
  area: ArtifactArea;
  fileName: string;
};

export type GateSummary = {
  passed: GateId[];
  failed: { id: GateId; owners: AgentName[] }[];
  blocked: GateId[];
};
```

- [ ] **Step 2: `src/config/dag.ts`** — у агентов с `service` запуск необязателен (динамический выбор, Задача 1.4)

```ts
import type { Dag } from "@/types/workflow";

const SERVICE_PLANNERS = ["venue-scout", "catering-planner", "entertainment-planner", "logistics-planner"] as const;

// Граф workflow — единственное место, где заданы зависимости, артефакты, разделы и владельцы гейтов.
// Агенты с полем service запускаются, только если сервис есть в подтверждённых требованиях.
export const DAG: Dag = {
  maxRetries: 3,
  agents: {
    "requirements-formalizer": {
      kind: "artifact",
      artifact: "01-requirements.md",
      deps: [],
      stage: "domain",
      sections: [
        "Event profile",
        "Guests",
        "Date and location",
        "Budget and currency",
        "Services needed",
        "Constraints",
        "Clarification log",
        "Requirements",
      ],
      requiredLines: ["- Date:", "- City:", "- Guests:", "- Budget:", "- Services:"],
    },
    "weather-analyst": {
      kind: "artifact",
      artifact: "02-weather-outlook.md",
      deps: ["requirements-formalizer"],
      stage: "domain",
      sections: ["Location", "Method", "Outlook", "Outdoor suitability"],
      requiredLines: ["- Method:", "- Rain risk:", "- Verdict:"],
    },
    "venue-scout": {
      kind: "artifact",
      artifact: "03-venues.md",
      deps: ["requirements-formalizer", "weather-analyst"],
      stage: "domain",
      sections: ["Shortlist", "Recommendation", "Accessibility and logistics"],
      requiredLines: ["- Recommended venue:", "- Venue cost:"],
    },
    "catering-planner": {
      kind: "artifact",
      artifact: "04-catering.md",
      service: "catering",
      deps: ["requirements-formalizer", "venue-scout"],
      stage: "domain",
      sections: ["Catering option", "Menu", "Dietary coverage", "Cost"],
      requiredLines: ["- Catering cost:"],
    },
    "entertainment-planner": {
      kind: "artifact",
      artifact: "05-entertainment.md",
      service: "entertainment",
      deps: ["requirements-formalizer", "weather-analyst", "venue-scout"],
      stage: "domain",
      sections: ["Program", "Vendors", "Weather plan B", "Cost"],
      requiredLines: ["- Entertainment cost:"],
    },
    "logistics-planner": {
      kind: "artifact",
      artifact: "06-logistics.md",
      service: "logistics",
      deps: ["requirements-formalizer", "weather-analyst", "venue-scout"],
      stage: "domain",
      sections: [
        "Guest transport and parking",
        "Accessibility",
        "Rentals and decor",
        "Vendor booking timeline",
        "Cost",
      ],
      requiredLines: ["- Logistics cost:"],
    },
    "budget-aggregator": {
      kind: "artifact",
      artifact: "07-budget.md",
      deps: ["requirements-formalizer", ...SERVICE_PLANNERS],
      stage: "domain",
      sections: ["Line items", "Totals", "Savings options"],
      requiredLines: ["- Subtotal:", "- Contingency (10%):", "- Total with contingency:", "- Budget limit:"],
    },
    "event-plan-builder": {
      kind: "artifact",
      artifact: "08-event-plan.md",
      deps: ["requirements-formalizer", "weather-analyst", ...SERVICE_PLANNERS, "budget-aggregator"],
      stage: "final",
      coversRequirements: true,
      sections: [
        "Event overview",
        "Weather and plan B",
        "Venue",
        "Menu",
        "Program",
        "Run of show",
        "Preparation checklist",
        "Budget",
        "Requirements matrix",
      ],
      requiredLines: [],
    },
    "html-builder": {
      kind: "output",
      outputs: ["event-plan.md", "event-plan.html"],
      deps: ["event-plan-builder"],
      stage: "output",
    },
  },
  gates: {
    "G1-requirements-complete": { stage: "domain", owners: ["requirements-formalizer"] },
    "G2-sources-cited": { stage: "domain", owners: SERVICE_PLANNERS },
    "G3-weather-grounded": { stage: "domain", owners: ["weather-analyst"] },
    "G4-venue-fit": { stage: "domain", owners: ["venue-scout"] },
    "G5-dietary-coverage": { stage: "domain", owners: ["catering-planner"] },
    "G6-weather-plan-b": { stage: "domain", owners: ["venue-scout", "entertainment-planner", "logistics-planner"] },
    "G7-budget-within-limit": { stage: "domain", owners: [...SERVICE_PLANNERS, "budget-aggregator"] },
    "G8-currency-consistent": { stage: "domain", owners: [...SERVICE_PLANNERS, "budget-aggregator"] },
    "G9-must-haves-covered": { stage: "domain", owners: SERVICE_PLANNERS },
    "G10-plan-covers-requirements": { stage: "final", owners: ["event-plan-builder"] },
    "G11-plan-consistent-with-artifacts": { stage: "final", owners: ["event-plan-builder"] },
    "G12-timeline-feasible": { stage: "final", owners: ["event-plan-builder"] },
  },
};
```

- [ ] **Step 3: `src/config/workflow.ts`**

```ts
import { DAG } from "@/config/dag";
import type { AgentName, ArtifactArea, GatedStage } from "@/types/workflow";

export const MAX_RETRIES = DAG.maxRetries;
export const REQUIREMENTS_AGENT = "requirements-formalizer" satisfies AgentName;
export const BUDGET_AGENT = "budget-aggregator" satisfies AgentName;
export const PLAN_AGENT = "event-plan-builder" satisfies AgentName;
export const OUTPUT_AGENT = "html-builder" satisfies AgentName;
export const VALIDATOR_NAME = "validator";

// Стадии с quality gates в порядке выполнения.
export const STAGE_ORDER: readonly GatedStage[] = ["domain", "final"];

export const ARTIFACTS_AREA: ArtifactArea = "artifacts";
export const OUTPUT_AREA: ArtifactArea = "output";
export const VENUE_SERVICE = "venue";

export const SCHEMA_VERSION = 1;
export const RUNS_DIRECTORY = "runs";
export const STATE_FILE = "workflow-state.json";
export const APPROVAL_FILE = "approval.json";
export const HASH_PREVIEW_LENGTH = 12;
export const APPROVAL_RECORDED_BY = "UserPromptSubmit hook (record-approval)";

export const validationFileName = (stage: GatedStage): string => `validation-${stage}.md`;
```

- [ ] **Step 4: Проверка типов**

Run: `npm run typecheck && npm run lint` → Expected: без ошибок. Для проверки удалить из `DAG.agents` любой ключ → `tsc` сообщает о недостающем агенте; вернуть.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/types/workflow.ts src/config/dag.ts src/config/workflow.ts
git commit -m "feat(workflow): typed domain model and workflow DAG"
```

---

### Задача 1.2: Запросы к графу и разбор путей

**Files:**
- Create: `src/lib/narrow.ts`, `src/lib/dag-queries.ts`, `src/lib/run-path.ts`
- Test: `tests/lib/dag-queries.test.ts`

**Interfaces:**
- Consumes: `DAG`, константы и типы (Задача 1.1).
- Produces (`lib/narrow`): `isRecord`, `isOneOf`, `stringOrNull`, `listOf`, `recordOf(keys, make) → Record<K, V>` — сужение `unknown` без `as`.
- Produces (`lib/dag-queries`): `OPTIONAL_AGENTS`, `isAgentName`, `parseAgentName(value) → AgentName` (бросает со списком известных), `agentNamesForStage`, `gateIdsForStage`, `artifactDefinition`, `artifactOf`, `requireArtifactOf`, `outputFiles`, `downstreamOf`, `agentForFile`.
- Produces (`lib/run-path`): `parseRunPath(path) → RunLocation | null` (POSIX и Windows).

- [ ] **Step 1: Падающие тесты `tests/lib/dag-queries.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DAG } from "@/config/dag";
import { agentForFile, downstreamOf, OPTIONAL_AGENTS, parseAgentName } from "@/lib/dag-queries";
import { parseRunPath } from "@/lib/run-path";
import { AGENT_NAMES, SERVICES } from "@/types/workflow";

describe("DAG", () => {
  test("the graph has no cycles", () => {
    for (const name of AGENT_NAMES) assert.ok(!downstreamOf(name).includes(name), name);
  });
  test("optional agents are exactly the service planners", () => {
    assert.deepEqual(OPTIONAL_AGENTS, ["catering-planner", "entertainment-planner", "logistics-planner"]);
    assert.deepEqual(
      OPTIONAL_AGENTS.map((name) => DAG.agents[name].service),
      [...SERVICES],
    );
  });
});

describe("downstreamOf", () => {
  test("catering invalidates budget, plan and html only", () => {
    assert.deepEqual(downstreamOf("catering-planner").sort(), [
      "budget-aggregator",
      "event-plan-builder",
      "html-builder",
    ]);
  });
  test("venue invalidates all service planners and everything after", () => {
    assert.deepEqual(downstreamOf("venue-scout").sort(), [
      "budget-aggregator",
      "catering-planner",
      "entertainment-planner",
      "event-plan-builder",
      "html-builder",
      "logistics-planner",
    ]);
  });
});

describe("agentForFile / parseAgentName", () => {
  test("maps artifacts and outputs to their owners", () => {
    assert.equal(agentForFile("artifacts", "03-venues.md"), "venue-scout");
    assert.equal(agentForFile("output", "event-plan.html"), "html-builder");
    assert.equal(agentForFile("artifacts", "notes.md"), null);
  });
  test("rejects unknown agent names with the list of known ones", () => {
    assert.equal(parseAgentName("venue-scout"), "venue-scout");
    assert.throws(() => parseAgentName("nope"), /Unknown agent: nope\. Known: requirements-formalizer/);
  });
});

describe("parseRunPath", () => {
  test("parses windows paths", () => {
    assert.deepEqual(parseRunPath("C:\\p\\Eventwright\\runs\\2026-09-28-lisbon\\artifacts\\01-requirements.md"), {
      runId: "2026-09-28-lisbon",
      area: "artifacts",
      fileName: "01-requirements.md",
    });
  });
  test("parses output paths and ignores unrelated files", () => {
    assert.equal(parseRunPath("/x/runs/r/output/event-plan.html")?.area, "output");
    assert.equal(parseRunPath("/x/src/config/dag.ts"), null);
    assert.equal(parseRunPath("/x/runs/r/input.md"), null);
    assert.equal(parseRunPath("/x/runs/r/notes/a.md"), null);
  });
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/dag-queries.test.ts` → Expected: FAIL (`Cannot find module '@/lib/dag-queries'`).

- [ ] **Step 3: `src/lib/narrow.ts`**

```ts
// Сужение unknown-данных (JSON с диска, stdin hooks) без приведений типов.
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some((item) => item === value);

export const stringOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

// Массив из JSON как unknown[]: элементы по-прежнему нужно сужать.
export const listOf = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  const items: unknown[] = value;
  return items;
};

// Строит Record по полному списку ключей; проверка сохраняет строгий тип без `as`.
export const recordOf = <K extends string, V>(keys: readonly K[], make: (key: K) => V): Record<K, V> => {
  const result: Partial<Record<K, V>> = {};
  for (const key of keys) result[key] = make(key);
  if (!hasAllKeys(keys, result)) throw new Error("recordOf: a key was not filled");
  return result;
};

const hasAllKeys = <K extends string, V>(keys: readonly K[], value: Partial<Record<K, V>>): value is Record<K, V> =>
  keys.every((key) => value[key] !== undefined);
```

- [ ] **Step 4: `src/lib/dag-queries.ts`**

```ts
import { DAG } from "@/config/dag";
import { OUTPUT_AGENT, OUTPUT_AREA } from "@/config/workflow";
import { isOneOf } from "@/lib/narrow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentName, ArtifactAgentDefinition, ArtifactArea, GatedStage, GateId, Stage } from "@/types/workflow";

export const OPTIONAL_AGENTS: readonly AgentName[] = AGENT_NAMES.filter(
  (name) => DAG.agents[name].service !== undefined,
);

export const isAgentName = (value: unknown): value is AgentName => isOneOf(AGENT_NAMES, value);

export const parseAgentName = (value: string): AgentName => {
  if (!isAgentName(value)) throw new Error(`Unknown agent: ${value}. Known: ${AGENT_NAMES.join(", ")}.`);
  return value;
};

export const agentNamesForStage = (stage: Stage): AgentName[] =>
  AGENT_NAMES.filter((name) => DAG.agents[name].stage === stage);

export const gateIdsForStage = (stage: GatedStage): GateId[] => GATE_IDS.filter((id) => DAG.gates[id].stage === stage);

export const artifactDefinition = (name: AgentName): ArtifactAgentDefinition | null => {
  const definition = DAG.agents[name];
  return definition.kind === "artifact" ? definition : null;
};

export const artifactOf = (name: AgentName): string | null => artifactDefinition(name)?.artifact ?? null;

export const requireArtifactOf = (name: AgentName): string => {
  const artifact = artifactOf(name);
  if (artifact === null) throw new Error(`${name} does not own an artifact.`);
  return artifact;
};

export const outputFiles = (): readonly string[] => {
  const definition = DAG.agents[OUTPUT_AGENT];
  return definition.kind === "output" ? definition.outputs : [];
};

export const downstreamOf = (agentName: AgentName): AgentName[] => {
  const result = new Set<AgentName>();
  const queue: AgentName[] = [agentName];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const name of AGENT_NAMES) {
      if (DAG.agents[name].deps.includes(current) && !result.has(name)) {
        result.add(name);
        queue.push(name);
      }
    }
  }
  return [...result];
};

export const agentForFile = (area: ArtifactArea, fileName: string): AgentName | null => {
  if (area === OUTPUT_AREA) return outputFiles().includes(fileName) ? OUTPUT_AGENT : null;
  return AGENT_NAMES.find((name) => artifactOf(name) === fileName) ?? null;
};
```

- [ ] **Step 5: `src/lib/run-path.ts`**

```ts
import { RUNS_DIRECTORY } from "@/config/workflow";
import { isOneOf } from "@/lib/narrow";
import type { ArtifactArea, RunLocation } from "@/types/workflow";

const AREAS: readonly ArtifactArea[] = ["artifacts", "output"];
const RUN_FILE = new RegExp(`/${RUNS_DIRECTORY}/([^/]+)/([^/]+)/([^/]+)$`);

// В payload hooks пути абсолютные, на Windows — с обратными слешами.
export const parseRunPath = (filePath: string): RunLocation | null => {
  const match = RUN_FILE.exec(filePath.replace(/\\/g, "/"));
  const [, runId, area, fileName] = match ?? [];
  if (runId === undefined || fileName === undefined || !isOneOf(AREAS, area)) return null;
  return { runId, area, fileName };
};
```

- [ ] **Step 6: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/narrow.ts src/lib/dag-queries.ts src/lib/run-path.ts tests/lib/dag-queries.test.ts
git commit -m "feat(workflow): graph queries and cross-platform run path parsing"
```

---

### Задача 1.3: Состояние run — запись артефактов и инвалидация

**Files:**
- Create: `src/lib/state.ts`, `tests/support/state-fixtures.ts`
- Test: `tests/lib/state.test.ts`

**Interfaces:**
- Consumes: Задачи 1.1–1.2.
- Produces: `createInitialState(runId, now) → WorkflowState`, `appendLog`, `markStale`, `recordArtifactWrite(state, location, hash, writer, now) → boolean` (true — состояние изменилось), `invalidateAgents(state, names, feedback, now)`, `confirmRequirements(state, now)`. Функции меняют переданный state и не трогают диск. Перезапись требований сбрасывает подтверждение и execution plan.
- Produces (`tests/support/state-fixtures`): `NOW`, `DOMAIN_AGENTS`, `markDone(state, names)` — запись артефакта + пройденная структурная проверка.

- [ ] **Step 1: `tests/support/state-fixtures.ts`**

```ts
import { ARTIFACTS_AREA } from "@/config/workflow";
import { requireArtifactOf } from "@/lib/dag-queries";
import { recordArtifactWrite } from "@/lib/state";
import type { AgentName, WorkflowState } from "@/types/workflow";

export const NOW = "2026-09-28T10:00:00.000Z";

export const DOMAIN_AGENTS: readonly AgentName[] = [
  "requirements-formalizer",
  "weather-analyst",
  "venue-scout",
  "catering-planner",
  "entertainment-planner",
  "logistics-planner",
  "budget-aggregator",
];

// Имитирует «агент записал артефакт (hook post-write-state) и структурная проверка координатора прошла».
export const markDone = (state: WorkflowState, names: readonly AgentName[]): void => {
  for (const name of names) {
    const location = { runId: state.runId, area: ARTIFACTS_AREA, fileName: requireArtifactOf(name) };
    recordArtifactWrite(state, location, `hash-${name}`, "test", NOW);
    state.agents[name].structureOk = true;
  }
};
```

- [ ] **Step 2: Падающие тесты `tests/lib/state.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { createInitialState, invalidateAgents, recordArtifactWrite } from "@/lib/state";
import type { ArtifactArea, WorkflowState } from "@/types/workflow";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

let state: WorkflowState;
const write = (fileName: string, hash: string, area: ArtifactArea = "artifacts"): boolean =>
  recordArtifactWrite(state, { runId: state.runId, area, fileName }, hash, "test", NOW);

beforeEach(() => {
  state = createInitialState("run-1", NOW);
});

describe("createInitialState", () => {
  test("starts with every agent and gate pending and no execution plan", () => {
    assert.ok(Object.values(state.agents).every((agent) => agent.status === "pending"));
    assert.ok(Object.values(state.gates).every((gate) => gate.status === "pending"));
    assert.equal(state.plan, null);
    assert.equal(state.requirementsConfirmed, false);
  });
});

describe("recordArtifactWrite", () => {
  test("marks the owner done and waits for a structure check", () => {
    assert.equal(write("02-weather-outlook.md", "h1"), true);
    assert.equal(state.agents["weather-analyst"].status, "done");
    assert.equal(state.agents["weather-analyst"].sha256, "h1");
    assert.equal(state.agents["weather-analyst"].structureOk, false);
  });
  test("an identical rewrite is a no-op", () => {
    write("02-weather-outlook.md", "h1");
    assert.equal(write("02-weather-outlook.md", "h1"), false);
  });
  test("a changed artifact makes finished downstream work stale", () => {
    markDone(state, DOMAIN_AGENTS);
    write("02-weather-outlook.md", "h2");
    assert.equal(state.agents["requirements-formalizer"].status, "done");
    for (const name of ["venue-scout", "catering-planner", "entertainment-planner", "logistics-planner"] as const) {
      assert.equal(state.agents[name].status, "stale", name);
    }
  });
  test("a write resets the counter of starts without an artifact", () => {
    state.agents["weather-analyst"].startsWithoutArtifact = 3;
    write("02-weather-outlook.md", "h1");
    assert.equal(state.agents["weather-analyst"].startsWithoutArtifact, 0);
  });
  test("new requirements must be confirmed again", () => {
    markDone(state, ["requirements-formalizer"]);
    state.requirementsConfirmed = true;
    write("01-requirements.md", "v2");
    assert.equal(state.requirementsConfirmed, false);
  });
  test("html-builder is done only after both outputs exist", () => {
    write("event-plan.md", "m", "output");
    assert.equal(state.agents["html-builder"].status, "pending");
    write("event-plan.html", "h", "output");
    assert.equal(state.agents["html-builder"].status, "done");
  });
  test("a validator report is stored as not yet recorded", () => {
    write("validation-domain.md", "r");
    assert.equal(state.validation.domain?.recorded, false);
  });
  test("unrelated files are ignored", () => {
    assert.equal(write("notes.md", "x"), false);
  });
});

describe("invalidateAgents", () => {
  test("marks the agents for revision and their finished downstream stale", () => {
    markDone(state, DOMAIN_AGENTS);
    invalidateAgents(state, ["venue-scout"], "Pick the second venue", NOW);
    assert.equal(state.agents["venue-scout"].status, "stale");
    assert.equal(state.agents["venue-scout"].feedback, "Pick the second venue");
    assert.equal(state.agents["weather-analyst"].status, "done");
    assert.equal(state.agents["budget-aggregator"].status, "stale");
  });
  test("rejects the output agent without changing anything", () => {
    assert.throws(() => {
      invalidateAgents(state, ["venue-scout", "html-builder"], "x", NOW);
    }, /html-builder/);
    assert.equal(state.agents["venue-scout"].feedback, null);
  });
  test("feedback is cleared once the agent rewrites its artifact", () => {
    invalidateAgents(state, ["requirements-formalizer"], "Budget is 10000 EUR", NOW);
    write("01-requirements.md", "v2");
    assert.equal(state.agents["requirements-formalizer"].feedback, null);
  });
});
```

- [ ] **Step 3: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/state.test.ts` → Expected: FAIL (`Cannot find module '@/lib/state'`).

- [ ] **Step 4: `src/lib/state.ts`**

```ts
import { DAG } from "@/config/dag";
import {
  ARTIFACTS_AREA,
  HASH_PREVIEW_LENGTH,
  OUTPUT_AGENT,
  REQUIREMENTS_AGENT,
  SCHEMA_VERSION,
  STAGE_ORDER,
  validationFileName,
} from "@/config/workflow";
import { agentForFile, artifactOf, downstreamOf, outputFiles } from "@/lib/dag-queries";
import { recordOf } from "@/lib/narrow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentName, AgentState, GatedStage, RunLocation, WorkflowState } from "@/types/workflow";

const pendingAgent = (): AgentState => ({
  status: "pending",
  attempts: 0,
  startsWithoutArtifact: 0,
  structuralFailures: 0,
  structureOk: false,
  sha256: null,
  updatedAt: null,
  lastError: null,
  feedback: null,
  outputs: {},
});

export const createInitialState = (runId: string, now: string): WorkflowState => ({
  schemaVersion: SCHEMA_VERSION,
  runId,
  createdAt: now,
  updatedAt: now,
  phase: "init",
  requirementsConfirmed: false,
  plan: null,
  failure: null,
  agents: recordOf(AGENT_NAMES, pendingAgent),
  gates: recordOf(GATE_IDS, () => ({ status: "pending", attempts: 0, findings: [] })),
  validation: { domain: null, final: null },
  log: [{ at: now, event: "init", details: {} }],
});

export const appendLog = (state: WorkflowState, event: string, details: Record<string, unknown>, now: string): void => {
  state.log.push({ at: now, event, details });
};

export const markStale = (
  state: WorkflowState,
  names: readonly AgentName[],
  reasonFor: (name: AgentName) => string,
): void => {
  for (const name of names) {
    const agent = state.agents[name];
    if (agent.status !== "done") continue;
    agent.status = "stale";
    agent.lastError = reasonFor(name);
  }
};

const resetPassedGates = (state: WorkflowState, names: readonly AgentName[]): void => {
  for (const id of GATE_IDS) {
    const gate = state.gates[id];
    if (gate.status === "pass" && DAG.gates[id].owners.some((owner) => names.includes(owner))) gate.status = "pending";
  }
  for (const name of names) {
    const stage = DAG.agents[name].stage;
    if (stage !== "output") state.validation[stage] = null;
  }
};

// Новые требования могут изменить список сервисов: человек подтверждает их заново, план выполнения пересобирается.
const resetExecutionPlan = (state: WorkflowState): void => {
  state.requirementsConfirmed = false;
  if (state.plan === null) return;
  for (const name of state.plan.skipped) state.agents[name].status = "pending";
  for (const id of GATE_IDS) {
    if (state.gates[id].status === "n/a") state.gates[id].status = "pending";
  }
  state.plan = null;
};

const validationStageOf = (location: RunLocation): GatedStage | null => {
  if (location.area !== ARTIFACTS_AREA) return null;
  return STAGE_ORDER.find((stage) => validationFileName(stage) === location.fileName) ?? null;
};

const recordOutputWrite = (state: WorkflowState, fileName: string, hash: string, writer: string, now: string): void => {
  const agent = state.agents[OUTPUT_AGENT];
  agent.outputs[fileName] = hash;
  agent.startsWithoutArtifact = 0;
  if (outputFiles().every((file) => agent.outputs[file] !== undefined)) {
    agent.status = "done";
    agent.updatedAt = now;
  }
  appendLog(state, "output-written", { file: fileName, writer }, now);
};

// Возвращает true, если состояние изменилось и его нужно сохранить.
export const recordArtifactWrite = (
  state: WorkflowState,
  location: RunLocation,
  hash: string,
  writer: string,
  now: string,
): boolean => {
  const validationStage = validationStageOf(location);
  if (validationStage !== null) {
    state.validation[validationStage] = { sha256: hash, recorded: false, at: now };
    appendLog(state, "validation-written", { stage: validationStage, writer }, now);
    return true;
  }

  const agentName = agentForFile(location.area, location.fileName);
  if (agentName === null) return false;
  if (agentName === OUTPUT_AGENT) {
    recordOutputWrite(state, location.fileName, hash, writer, now);
    return true;
  }

  const agent = state.agents[agentName];
  if (agent.status === "done" && agent.sha256 === hash) return false;
  const written: Partial<AgentState> = {
    status: "done",
    sha256: hash,
    updatedAt: now,
    lastError: null,
    feedback: null,
    structureOk: false,
    startsWithoutArtifact: 0,
  };
  Object.assign(agent, written);
  if (agentName === REQUIREMENTS_AGENT) resetExecutionPlan(state);

  const downstream = downstreamOf(agentName);
  markStale(state, downstream, () => `input artifact ${location.fileName} changed — regenerate`);
  resetPassedGates(state, [agentName, ...downstream]);
  const details = { agent: agentName, file: location.fileName, writer, sha256: hash.slice(0, HASH_PREVIEW_LENGTH) };
  appendLog(state, "artifact-written", details, now);
  return true;
};

// Координатор вызывает после отказа человека, если отзыв затрагивает upstream-агентов.
export const invalidateAgents = (
  state: WorkflowState,
  names: readonly AgentName[],
  feedback: string,
  now: string,
): void => {
  for (const name of names) {
    if (artifactOf(name) === null) throw new Error(`${name} does not own an artifact and cannot be invalidated.`);
    if (state.agents[name].status === "skipped") {
      throw new Error(
        `${name} is not in the execution plan — revise ${REQUIREMENTS_AGENT} to change the requested services.`,
      );
    }
  }
  for (const name of names) {
    const agent = state.agents[name];
    if (agent.status !== "pending") agent.status = "stale";
    agent.feedback = feedback;
    agent.lastError = null;
  }
  const downstream = [...new Set(names.flatMap(downstreamOf))].filter((name) => !names.includes(name));
  markStale(state, downstream, () => "an upstream artifact is being revised — regenerate");
  resetPassedGates(state, [...names, ...downstream]);
  appendLog(state, "invalidated", { agents: names, feedback }, now);
};

export const confirmRequirements = (state: WorkflowState, now: string): void => {
  state.requirementsConfirmed = true;
  appendLog(state, "requirements-confirmed", {}, now);
};
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/state.ts tests/support/state-fixtures.ts tests/lib/state.test.ts
git commit -m "feat(workflow): run state with artifact write tracking and invalidation"
```

---

### Задача 1.4: Динамический выбор subagents (execution plan)

**Files:**
- Create: `src/lib/execution-plan.ts`, `tests/support/plan-fixtures.ts`
- Test: `tests/lib/execution-plan.test.ts`

**Interfaces:**
- Consumes: `OPTIONAL_AGENTS`, `appendLog` (Задачи 1.2–1.3).
- Produces: `parseServices(requirementsText) → string[] | null`; `applyExecutionPlan(state, services, now) → ExecutionPlan`. Неизвестный сервис — ошибка без изменения state. Невыбранные агенты → `skipped`; гейты, у которых все владельцы пропущены, → `n/a`.
- Produces (`tests/support/plan-fixtures`): `ALL_SERVICES`, `confirmWithPlan(state, services?)`.

- [ ] **Step 1: `tests/support/plan-fixtures.ts`**

```ts
import { VENUE_SERVICE } from "@/config/workflow";
import { applyExecutionPlan } from "@/lib/execution-plan";
import { SERVICES } from "@/types/workflow";
import type { WorkflowState } from "@/types/workflow";
import { NOW } from "@tests/support/state-fixtures";

export const ALL_SERVICES: readonly string[] = [VENUE_SERVICE, ...SERVICES];

// Имитирует «человек подтвердил требования, координатор применил план выполнения».
export const confirmWithPlan = (state: WorkflowState, services: readonly string[] = ALL_SERVICES): void => {
  state.requirementsConfirmed = true;
  applyExecutionPlan(state, services, NOW);
};
```

- [ ] **Step 2: Падающие тесты `tests/lib/execution-plan.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { applyExecutionPlan, parseServices } from "@/lib/execution-plan";
import { createInitialState, invalidateAgents, recordArtifactWrite } from "@/lib/state";
import type { WorkflowState } from "@/types/workflow";
import { ALL_SERVICES } from "@tests/support/plan-fixtures";
import { markDone, NOW } from "@tests/support/state-fixtures";

describe("parseServices", () => {
  test("reads a comma-separated service list", () => {
    assert.deepEqual(parseServices("- Services: venue, Catering , entertainment\n"), [
      "venue",
      "catering",
      "entertainment",
    ]);
  });
  test("returns null without the line", () => {
    assert.equal(parseServices("- Budget: 1000 EUR"), null);
  });
});

describe("applyExecutionPlan", () => {
  let state: WorkflowState;
  beforeEach(() => {
    state = createInitialState("run-1", NOW);
  });

  test("skips planners of services that were not requested", () => {
    const plan = applyExecutionPlan(state, ["venue", "entertainment", "logistics"], NOW);
    assert.deepEqual(plan.skipped, ["catering-planner"]);
    assert.ok(!plan.selected.includes("catering-planner"));
    assert.equal(state.agents["catering-planner"].status, "skipped");
    assert.equal(state.gates["G5-dietary-coverage"].status, "n/a");
    assert.equal(state.gates["G2-sources-cited"].status, "pending");
  });
  test("keeps every agent when all services are requested", () => {
    assert.deepEqual(applyExecutionPlan(state, ALL_SERVICES, NOW).skipped, []);
  });
  test("rejects unknown services and leaves the state untouched", () => {
    assert.throws(() => applyExecutionPlan(state, ["venue", "fireworks"], NOW), /fireworks/);
    assert.equal(state.plan, null);
  });
  test("new requirements restore skipped agents and not-applicable gates", () => {
    markDone(state, ["requirements-formalizer"]);
    applyExecutionPlan(state, ["venue"], NOW);
    recordArtifactWrite(
      state,
      { runId: "run-1", area: "artifacts", fileName: "01-requirements.md" },
      "v2",
      "test",
      NOW,
    );
    assert.equal(state.plan, null);
    assert.equal(state.agents["catering-planner"].status, "pending");
    assert.equal(state.gates["G5-dietary-coverage"].status, "pending");
  });
  test("a skipped agent cannot be invalidated", () => {
    applyExecutionPlan(state, ["venue"], NOW);
    assert.throws(() => {
      invalidateAgents(state, ["catering-planner"], "x", NOW);
    }, /not in the execution plan/);
  });
});
```

- [ ] **Step 3: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/execution-plan.test.ts` → Expected: FAIL (`Cannot find module '@/lib/execution-plan'`).

- [ ] **Step 4: `src/lib/execution-plan.ts`**

```ts
import { DAG } from "@/config/dag";
import { VENUE_SERVICE } from "@/config/workflow";
import { OPTIONAL_AGENTS } from "@/lib/dag-queries";
import { isOneOf } from "@/lib/narrow";
import { appendLog } from "@/lib/state";
import { AGENT_NAMES, GATE_IDS, SERVICES } from "@/types/workflow";
import type { ExecutionPlan, RequestedService, WorkflowState } from "@/types/workflow";

const REQUESTED_SERVICES: readonly RequestedService[] = [VENUE_SERVICE, ...SERVICES];
const SERVICES_LINE = /^\s*- Services:\s*(.+)$/m;

// Строку «- Services: venue, catering, …» пишет formalizer, подтверждает человек.
export const parseServices = (requirementsText: string): string[] | null => {
  const list = SERVICES_LINE.exec(requirementsText)?.[1];
  if (list === undefined) return null;
  const services = list
    .split(",")
    .map((service) => service.trim().toLowerCase())
    .filter((service) => service.length > 0);
  return [...new Set(services)];
};

// Динамический выбор subagents: планировщики незапрошенных сервисов пропускаются, их гейты — n/a.
export const applyExecutionPlan = (state: WorkflowState, services: readonly string[], now: string): ExecutionPlan => {
  const unknown = services.filter((service) => !isOneOf(REQUESTED_SERVICES, service));
  if (unknown.length > 0) {
    throw new Error(`Unknown services: ${unknown.join(", ")}. Known: ${REQUESTED_SERVICES.join(", ")}.`);
  }
  const requested = REQUESTED_SERVICES.filter((service) => services.includes(service));
  const skipped = OPTIONAL_AGENTS.filter((name) => {
    const service = DAG.agents[name].service;
    return service !== undefined && !requested.includes(service);
  });
  for (const name of skipped) {
    const agent = state.agents[name];
    agent.status = "skipped";
    agent.lastError = null;
    agent.feedback = null;
  }
  for (const id of GATE_IDS) {
    if (DAG.gates[id].owners.every((owner) => skipped.includes(owner))) {
      state.gates[id] = { status: "n/a", attempts: 0, findings: [] };
    }
  }
  const selected = AGENT_NAMES.filter((name) => !skipped.includes(name));
  state.plan = { services: requested, selected, skipped, at: now };
  appendLog(state, "execution-plan", { selected, skipped }, now);
  return state.plan;
};
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/execution-plan.ts tests/support/plan-fixtures.ts tests/lib/execution-plan.test.ts
git commit -m "feat(workflow): dynamic subagent selection from the confirmed service list"
```

---

### Задача 1.5: Quality gates и точечные повторы

**Files:**
- Create: `src/lib/gates.ts`, `tests/support/gate-fixtures.ts`
- Test: `tests/lib/gates.test.ts`

**Interfaces:**
- Consumes: `markStale`, `appendLog`, `downstreamOf`, `gateIdsForStage`, `isAgentName`.
- Produces: `parseGateTable(text) → Map<string, GateRow>`; `recordGates(state, stage, reportText, now) → GateSummary`. Бросает, если нет валидной строки для применимого (не `n/a`) гейта; попытка при этом не засчитывается. PASS сбрасывает счётчик; `MAX_RETRIES + 1`-й провал подряд → `blocked` + `state.failure`.
- Produces (`tests/support/gate-fixtures`): `gateReport(stage, failing?)`, `withoutGateRow(report, id)`.

- [ ] **Step 1: `tests/support/gate-fixtures.ts`**

```ts
import { DAG } from "@/config/dag";
import { GATE_IDS } from "@/types/workflow";
import type { GatedStage, GateId } from "@/types/workflow";

// Отчёт валидатора: все гейты стадии PASS, кроме перечисленных (гейт → владельцы, которых назвал валидатор).
export const gateReport = (stage: GatedStage, failing: Partial<Record<GateId, string>> = {}): string =>
  [
    "## Gate results",
    "| Gate | Status | Owners | Finding |",
    "|---|---|---|---|",
    ...GATE_IDS.filter((id) => DAG.gates[id].stage === stage).map((id) => {
      const owners = failing[id];
      return owners === undefined
        ? `| ${id} | PASS | ${DAG.gates[id].owners.join(", ")} | — |`
        : `| ${id} | FAIL | ${owners} | problem in ${id} |`;
    }),
  ].join("\n");

export const withoutGateRow = (report: string, id: GateId): string =>
  report
    .split("\n")
    .filter((line) => !line.includes(`| ${id} |`))
    .join("\n");
```

- [ ] **Step 2: Падающие тесты `tests/lib/gates.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { MAX_RETRIES } from "@/config/workflow";
import { parseGateTable, recordGates } from "@/lib/gates";
import { createInitialState, recordArtifactWrite } from "@/lib/state";
import type { WorkflowState } from "@/types/workflow";
import { gateReport, withoutGateRow } from "@tests/support/gate-fixtures";
import { confirmWithPlan } from "@tests/support/plan-fixtures";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

let state: WorkflowState;
beforeEach(() => {
  state = createInitialState("run-1", NOW);
  markDone(state, DOMAIN_AGENTS);
  confirmWithPlan(state);
});

describe("parseGateTable", () => {
  test("ignores header rows", () => {
    assert.equal(parseGateTable("| Gate | Status |\n|---|---|\n").size, 0);
  });
});

describe("recordGates", () => {
  test("a failing gate makes only its owners and their downstream stale", () => {
    const summary = recordGates(
      state,
      "domain",
      gateReport("domain", { "G5-dietary-coverage": "catering-planner" }),
      NOW,
    );
    assert.deepEqual(summary.failed, [{ id: "G5-dietary-coverage", owners: ["catering-planner"] }]);
    assert.equal(state.agents["catering-planner"].status, "stale");
    assert.equal(state.agents["budget-aggregator"].status, "stale");
    assert.equal(state.agents["venue-scout"].status, "done");
    assert.match(state.agents["catering-planner"].lastError ?? "", /G5-dietary-coverage/);
  });

  test("owners outside the gate's owner list fall back to all of its owners", () => {
    const summary = recordGates(state, "domain", gateReport("domain", { "G3-weather-grounded": "venue-scout" }), NOW);
    assert.deepEqual(summary.failed[0]?.owners, ["weather-analyst"]);
  });

  test("a passing gate clears its failure counter", () => {
    recordGates(state, "domain", gateReport("domain", { "G3-weather-grounded": "weather-analyst" }), NOW);
    markDone(state, DOMAIN_AGENTS);
    recordGates(state, "domain", gateReport("domain"), NOW);
    assert.deepEqual(state.gates["G3-weather-grounded"], { status: "pass", attempts: 0, findings: [] });
  });

  test("the run is blocked after MAX_RETRIES consecutive failures", () => {
    const failing = { "G3-weather-grounded": "weather-analyst" };
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      recordGates(state, "domain", gateReport("domain", failing), NOW);
      assert.equal(state.failure, null);
      markDone(state, DOMAIN_AGENTS);
    }
    const summary = recordGates(state, "domain", gateReport("domain", failing), NOW);
    assert.deepEqual(summary.blocked, ["G3-weather-grounded"]);
    assert.equal(state.failure?.kind, "gate");
  });

  test("a report with a missing gate row throws and does not count an attempt", () => {
    const partial = withoutGateRow(gateReport("domain"), "G4-venue-fit");
    assert.throws(() => recordGates(state, "domain", partial, NOW), /G4-venue-fit/);
    assert.equal(state.gates["G4-venue-fit"].attempts, 0);
  });

  test("not-applicable gates need no row", () => {
    state = createInitialState("run-2", NOW);
    markDone(
      state,
      DOMAIN_AGENTS.filter((name) => name !== "catering-planner"),
    );
    confirmWithPlan(state, ["venue", "entertainment", "logistics"]);
    const report = withoutGateRow(gateReport("domain"), "G5-dietary-coverage");
    assert.deepEqual(recordGates(state, "domain", report, NOW).failed, []);
    assert.equal(state.gates["G5-dietary-coverage"].status, "n/a");
  });

  test("rewriting an agent resets only the passed gates it owns", () => {
    recordGates(state, "domain", gateReport("domain"), NOW);
    recordArtifactWrite(
      state,
      { runId: "run-1", area: "artifacts", fileName: "02-weather-outlook.md" },
      "new",
      "test",
      NOW,
    );
    assert.equal(state.gates["G3-weather-grounded"].status, "pending");
    assert.equal(state.gates["G1-requirements-complete"].status, "pass");
  });
});
```

- [ ] **Step 3: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/gates.test.ts` → Expected: FAIL (`Cannot find module '@/lib/gates'`).

- [ ] **Step 4: `src/lib/gates.ts`**

```ts
import { DAG } from "@/config/dag";
import { MAX_RETRIES } from "@/config/workflow";
import { downstreamOf, gateIdsForStage, isAgentName } from "@/lib/dag-queries";
import { appendLog, markStale } from "@/lib/state";
import type { AgentName, GatedStage, GateId, GateSummary, WorkflowState } from "@/types/workflow";

type GateRow = {
  status: string;
  owners: string[];
  finding: string;
};

const GATE_ROW_ID = /^G\d+-/;
const MIN_GATE_ROW_CELLS = 6;
const VERDICTS: readonly string[] = ["PASS", "FAIL"];

// Строка отчёта валидатора: | G5-dietary-coverage | FAIL | catering-planner | finding |
export const parseGateTable = (reportText: string): Map<string, GateRow> => {
  const rows = new Map<string, GateRow>();
  for (const line of reportText.split(/\r?\n/)) {
    const cells = line.split("|").map((cell) => cell.trim());
    const [, id = "", status = "", owners = "", finding = ""] = cells;
    if (cells.length < MIN_GATE_ROW_CELLS || !GATE_ROW_ID.test(id)) continue;
    const ownerList = owners
      .split(",")
      .map((owner) => owner.trim())
      .filter((owner) => owner.length > 0);
    rows.set(id, { status: status.toUpperCase(), owners: ownerList, finding });
  }
  return rows;
};

const activeOwners = (state: WorkflowState, id: GateId): AgentName[] =>
  DAG.gates[id].owners.filter((owner) => state.agents[owner].status !== "skipped");

// Владельцы из отчёта, пересечённые с допустимыми; если валидатор назвал чужих — все допустимые.
const ownersToRetry = (state: WorkflowState, id: GateId, reported: readonly string[]): AgentName[] => {
  const allowed = activeOwners(state, id);
  const named = reported.filter(isAgentName).filter((owner) => allowed.includes(owner));
  return named.length > 0 ? named : allowed;
};

const requireRows = (state: WorkflowState, stage: GatedStage, rows: Map<string, GateRow>): GateId[] => {
  const expected = gateIdsForStage(stage).filter((id) => state.gates[id].status !== "n/a");
  const missing = expected.filter((id) => !VERDICTS.includes(rows.get(id)?.status ?? ""));
  if (missing.length > 0) throw new Error(`Validator report lacks valid rows for gates: ${missing.join(", ")}`);
  return expected;
};

const retryAffectedAgents = (state: WorkflowState, findingsByOwner: Map<AgentName, string[]>): void => {
  const owners = [...findingsByOwner.keys()];
  const affected = [...new Set([...owners, ...owners.flatMap(downstreamOf)])];
  markStale(
    state,
    affected,
    (name) => findingsByOwner.get(name)?.join("; ") ?? "an upstream artifact is being fixed — regenerate",
  );
};

export const recordGates = (state: WorkflowState, stage: GatedStage, reportText: string, now: string): GateSummary => {
  const rows = parseGateTable(reportText);
  const expected = requireRows(state, stage, rows);
  const summary: GateSummary = { passed: [], failed: [], blocked: [] };
  const findingsByOwner = new Map<AgentName, string[]>();

  for (const id of expected) {
    const row = rows.get(id);
    const gate = state.gates[id];
    if (row === undefined) continue;
    if (row.status === "PASS") {
      state.gates[id] = { status: "pass", attempts: 0, findings: [] };
      summary.passed.push(id);
      continue;
    }
    gate.attempts += 1;
    gate.findings = [row.finding];
    if (gate.attempts > MAX_RETRIES) {
      gate.status = "blocked";
      summary.blocked.push(id);
      state.failure ??= { kind: "gate", gate: id, findings: gate.findings, attempts: gate.attempts, at: now };
      continue;
    }
    gate.status = "fail";
    const owners = ownersToRetry(state, id, row.owners);
    summary.failed.push({ id, owners });
    for (const owner of owners) {
      findingsByOwner.set(owner, [...(findingsByOwner.get(owner) ?? []), `${id}: ${row.finding}`]);
    }
  }

  if (state.failure === null) retryAffectedAgents(state, findingsByOwner);
  state.validation[stage] = { sha256: state.validation[stage]?.sha256 ?? null, recorded: true, at: now };
  const failedIds = summary.failed.map((failure) => failure.id);
  appendLog(
    state,
    "gates-recorded",
    { stage, passed: summary.passed.length, failed: failedIds, blocked: summary.blocked },
    now,
  );
  return summary;
};
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/gates.ts tests/support/gate-fixtures.ts tests/lib/gates.test.ts
git commit -m "feat(workflow): quality gate recording with targeted retries and retry limit"
```

---

### Задача 1.6: Вычисление следующего шага `nextAction`

**Files:**
- Create: `src/types/approval.ts`, `src/lib/hash.ts`, `src/lib/approval-status.ts`, `src/lib/next-action.ts`, `tests/support/approval-fixtures.ts`
- Test: `tests/lib/next-action.test.ts`

**Interfaces:**
- Consumes: Задачи 1.1–1.5.
- Produces (`types/approval`): `Decision`, `DecisionRequest`, `ApprovalRecord`, `ApprovalFile`, `ApprovalCommand`.
- Produces: `sha256(content)`; `isApprovalCurrent(approval, planSha256)`; `nextAction(state, approval) → Action`. Порядок: `failed` → `check` (артефакт без структурной проверки) → formalizer → `clarify` → `plan` → группы по зависимостям → `validate` / `record-gates` → `await-approval` → `html-builder` → `done`. `Brief.inputs` не содержит артефактов пропущенных агентов.
- Produces (`tests/support/approval-fixtures`): `PLAN_TEXT`, `approvedFile(runId, planSha256)`, `buildAwaitingApprovalState(runId, planText?)`.

- [ ] **Step 1: `src/types/approval.ts`**

```ts
export type Decision = "approved" | "rejected";

export type DecisionRequest = { decision: "approved" } | { decision: "rejected"; feedback: string };

export type ApprovalRecord = {
  decision: Decision;
  planSha256: string;
  round: number;
  feedback: string | null;
  recordedAt: string;
  recordedBy: string;
};

export type ApprovalFile = {
  runId: string;
  current: ApprovalRecord;
  history: ApprovalRecord[];
};

export type ApprovalCommand =
  { runId: string; decision: "approved" } | { runId: string; decision: "rejected"; feedback: string | null };
```

- [ ] **Step 2: `src/lib/hash.ts`**

```ts
import { createHash } from "node:crypto";

export const sha256 = (content: string | Uint8Array): string => createHash("sha256").update(content).digest("hex");
```

- [ ] **Step 3: `tests/support/approval-fixtures.ts`**

```ts
import { ARTIFACTS_AREA, PLAN_AGENT } from "@/config/workflow";
import { requireArtifactOf } from "@/lib/dag-queries";
import { recordGates } from "@/lib/gates";
import { sha256 } from "@/lib/hash";
import { createInitialState, recordArtifactWrite } from "@/lib/state";
import type { ApprovalFile, ApprovalRecord } from "@/types/approval";
import type { WorkflowState } from "@/types/workflow";
import { gateReport } from "@tests/support/gate-fixtures";
import { confirmWithPlan } from "@tests/support/plan-fixtures";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

export const PLAN_TEXT = "# Event plan\n";

export const approvedFile = (runId: string, planSha256: string): ApprovalFile => {
  const current: ApprovalRecord = {
    decision: "approved",
    planSha256,
    round: 1,
    feedback: null,
    recordedAt: NOW,
    recordedBy: "test",
  };
  return { runId, current, history: [current] };
};

// Run, чей план прошёл все гейты и ждёт человека; хэш плана = sha256(planText).
export const buildAwaitingApprovalState = (runId: string, planText: string = PLAN_TEXT): WorkflowState => {
  const state = createInitialState(runId, NOW);
  markDone(state, DOMAIN_AGENTS);
  confirmWithPlan(state);
  recordGates(state, "domain", gateReport("domain"), NOW);
  const location = { runId, area: ARTIFACTS_AREA, fileName: requireArtifactOf(PLAN_AGENT) };
  recordArtifactWrite(state, location, sha256(planText), "test", NOW);
  state.agents[PLAN_AGENT].structureOk = true;
  recordGates(state, "final", gateReport("final"), NOW);
  return state;
};
```

- [ ] **Step 4: Падающие тесты `tests/lib/next-action.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { MAX_RETRIES } from "@/config/workflow";
import { recordGates } from "@/lib/gates";
import { sha256 } from "@/lib/hash";
import { nextAction } from "@/lib/next-action";
import { createInitialState, invalidateAgents, recordArtifactWrite } from "@/lib/state";
import type { Action, AgentName, Brief, WorkflowState } from "@/types/workflow";
import { approvedFile, buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { gateReport } from "@tests/support/gate-fixtures";
import { confirmWithPlan } from "@tests/support/plan-fixtures";
import { DOMAIN_AGENTS, markDone, NOW } from "@tests/support/state-fixtures";

const briefs = (action: Action): Brief[] => (action.action === "run" ? action.agents : []);
const names = (action: Action): AgentName[] => briefs(action).map((brief) => brief.name);

let state: WorkflowState;
beforeEach(() => {
  state = createInitialState("run-1", NOW);
});

describe("before planning", () => {
  test("starts with the formalizer in initial mode", () => {
    const action = nextAction(state, null);
    assert.deepEqual(names(action), ["requirements-formalizer"]);
    assert.equal(briefs(action)[0]?.mode, "initial");
  });
  test("checks an artifact that was written but never structure-checked (crash after write)", () => {
    recordArtifactWrite(state, { runId: "run-1", area: "artifacts", fileName: "01-requirements.md" }, "h", "test", NOW);
    assert.deepEqual(nextAction(state, null), { action: "check", agents: ["requirements-formalizer"] });
  });
  test("asks for clarification until requirements are confirmed", () => {
    markDone(state, ["requirements-formalizer"]);
    assert.deepEqual(nextAction(state, null), { action: "clarify" });
  });
  test("asks for an execution plan after confirmation", () => {
    markDone(state, ["requirements-formalizer"]);
    state.requirementsConfirmed = true;
    assert.deepEqual(nextAction(state, null), { action: "plan" });
  });
});

describe("dependency groups", () => {
  test("walks the groups and runs the three service planners in parallel", () => {
    markDone(state, ["requirements-formalizer"]);
    confirmWithPlan(state);
    assert.deepEqual(names(nextAction(state, null)), ["weather-analyst"]);
    markDone(state, ["weather-analyst"]);
    assert.deepEqual(names(nextAction(state, null)), ["venue-scout"]);
    markDone(state, ["venue-scout"]);
    assert.deepEqual(names(nextAction(state, null)), [
      "catering-planner",
      "entertainment-planner",
      "logistics-planner",
    ]);
    markDone(state, ["catering-planner", "entertainment-planner", "logistics-planner"]);
    assert.deepEqual(names(nextAction(state, null)), ["budget-aggregator"]);
  });
  test("runs only the requested service planners and feeds the budget only their artifacts", () => {
    markDone(state, ["requirements-formalizer", "weather-analyst", "venue-scout"]);
    confirmWithPlan(state, ["venue", "entertainment", "logistics"]);
    assert.deepEqual(names(nextAction(state, null)), ["entertainment-planner", "logistics-planner"]);
    markDone(state, ["entertainment-planner", "logistics-planner"]);
    const [budget] = briefs(nextAction(state, null));
    assert.ok(budget);
    assert.equal(budget.name, "budget-aggregator");
    assert.ok(!budget.inputs.includes("04-catering.md"));
  });
  test("resume re-runs only the agent that was running when the process died", () => {
    markDone(state, ["requirements-formalizer", "weather-analyst", "venue-scout", "catering-planner"]);
    confirmWithPlan(state);
    state.agents["entertainment-planner"].status = "running";
    assert.deepEqual(names(nextAction(state, null)), ["entertainment-planner", "logistics-planner"]);
  });
});

describe("gates", () => {
  beforeEach(() => {
    markDone(state, DOMAIN_AGENTS);
    confirmWithPlan(state);
  });

  test("validates the domain stage once all domain agents are done", () => {
    const action = nextAction(state, null);
    assert.equal(action.action, "validate");
    assert.equal(action.stage, "domain");
    assert.equal(action.recheck.length, 9);
  });
  test("not-applicable gates are not re-checked", () => {
    state = createInitialState("run-2", NOW);
    markDone(
      state,
      DOMAIN_AGENTS.filter((name) => name !== "catering-planner"),
    );
    confirmWithPlan(state, ["venue", "entertainment", "logistics"]);
    const action = nextAction(state, null);
    assert.equal(action.action, "validate");
    assert.ok(!action.recheck.includes("G5-dietary-coverage"));
    assert.deepEqual(action.notApplicable, ["G5-dietary-coverage"]);
  });
  test("records an unrecorded validator report instead of re-running the validator", () => {
    recordArtifactWrite(
      state,
      { runId: "run-1", area: "artifacts", fileName: "validation-domain.md" },
      "h",
      "validator",
      NOW,
    );
    assert.deepEqual(nextAction(state, null), { action: "record-gates", stage: "domain" });
  });
  test("after a failing gate only the owner re-runs, in retry mode", () => {
    recordGates(state, "domain", gateReport("domain", { "G5-dietary-coverage": "catering-planner" }), NOW);
    const [brief] = briefs(nextAction(state, null));
    assert.ok(brief);
    assert.equal(brief.name, "catering-planner");
    assert.equal(brief.mode, "retry");
    assert.match(brief.reason ?? "", /G5-dietary-coverage/);
  });
  test("a blocked gate stops the run", () => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      recordGates(state, "domain", gateReport("domain", { "G3-weather-grounded": "weather-analyst" }), NOW);
      markDone(state, DOMAIN_AGENTS);
    }
    assert.equal(nextAction(state, null).action, "failed");
  });
});

describe("approval and revision", () => {
  beforeEach(() => {
    state = buildAwaitingApprovalState("run-1");
  });

  test("awaits approval for the current plan hash", () => {
    assert.deepEqual(nextAction(state, null), { action: "await-approval", planSha256: sha256(PLAN_TEXT) });
  });
  test("renders once the current plan hash is approved", () => {
    assert.deepEqual(names(nextAction(state, approvedFile("run-1", sha256(PLAN_TEXT)))), ["html-builder"]);
  });
  test("an approval of an older plan version is ignored", () => {
    assert.equal(nextAction(state, approvedFile("run-1", "old")).action, "await-approval");
  });
  test("invalidating the venue after a rejection regenerates everything downstream in revise mode", () => {
    invalidateAgents(state, ["venue-scout"], "Pick the second venue", NOW);
    assert.equal(state.agents["weather-analyst"].status, "done");
    const downstream = [
      "catering-planner",
      "entertainment-planner",
      "logistics-planner",
      "budget-aggregator",
      "event-plan-builder",
    ] as const;
    for (const name of downstream) assert.equal(state.agents[name].status, "stale", name);
    assert.equal(state.gates["G4-venue-fit"].status, "pending");
    const [brief] = briefs(nextAction(state, null));
    assert.ok(brief);
    assert.equal(brief.name, "venue-scout");
    assert.equal(brief.mode, "revise");
    assert.equal(brief.feedback, "Pick the second venue");
  });
});
```

- [ ] **Step 5: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/next-action.test.ts` → Expected: FAIL (`Cannot find module '@/lib/next-action'`).

- [ ] **Step 6: `src/lib/approval-status.ts`**

```ts
import type { ApprovalFile } from "@/types/approval";

// Одобрение действует только для тех байтов плана, которые видел человек.
export const isApprovalCurrent = (approval: ApprovalFile | null, planSha256: string | null): boolean =>
  approval !== null &&
  planSha256 !== null &&
  approval.current.decision === "approved" &&
  approval.current.planSha256 === planSha256;
```

- [ ] **Step 7: `src/lib/next-action.ts`**

```ts
import { DAG } from "@/config/dag";
import { OUTPUT_AGENT, PLAN_AGENT, REQUIREMENTS_AGENT, STAGE_ORDER } from "@/config/workflow";
import { isApprovalCurrent } from "@/lib/approval-status";
import { agentNamesForStage, artifactOf, gateIdsForStage, outputFiles } from "@/lib/dag-queries";
import { AGENT_NAMES } from "@/types/workflow";
import type { ApprovalFile } from "@/types/approval";
import type { Action, AgentName, Brief, BriefMode, GatedStage, WorkflowState } from "@/types/workflow";

const briefMode = (state: WorkflowState, name: AgentName): BriefMode => {
  const agent = state.agents[name];
  if (agent.feedback !== null) return "revise";
  return agent.status === "pending" ? "initial" : "retry";
};

const buildBrief = (state: WorkflowState, name: AgentName): Brief => ({
  name,
  artifact: artifactOf(name),
  inputs: DAG.agents[name].deps
    .filter((dependency) => state.agents[dependency].status !== "skipped")
    .map(artifactOf)
    .filter((artifact) => artifact !== null),
  mode: briefMode(state, name),
  reason: state.agents[name].lastError,
  feedback: state.agents[name].feedback,
});

const isDone = (state: WorkflowState, name: AgentName): boolean =>
  state.agents[name].status === "done" || state.agents[name].status === "skipped";

// Падение между записью артефакта и его проверкой не должно пропустить непроверенную работу дальше.
const uncheckedAgents = (state: WorkflowState): AgentName[] =>
  AGENT_NAMES.filter(
    (name) => artifactOf(name) !== null && state.agents[name].status === "done" && !state.agents[name].structureOk,
  );

const stageAction = (state: WorkflowState, stage: GatedStage): Action | null => {
  const runnable = agentNamesForStage(stage).filter(
    (name) => !isDone(state, name) && DAG.agents[name].deps.every((dependency) => isDone(state, dependency)),
  );
  if (runnable.length > 0) return { action: "run", agents: runnable.map((name) => buildBrief(state, name)) };

  const gateIds = gateIdsForStage(stage);
  const recheck = gateIds.filter((id) => state.gates[id].status !== "pass" && state.gates[id].status !== "n/a");
  if (recheck.length === 0) return null;
  const report = state.validation[stage];
  if (report !== null && !report.recorded) return { action: "record-gates", stage };
  const notApplicable = gateIds.filter((id) => state.gates[id].status === "n/a");
  return { action: "validate", stage, recheck, notApplicable };
};

// Следующий шаг вычисляет код, а не модель: координатор только исполняет его.
export const nextAction = (state: WorkflowState, approval: ApprovalFile | null): Action => {
  if (state.failure !== null) return { action: "failed", failure: state.failure };

  const unchecked = uncheckedAgents(state);
  if (unchecked.length > 0) return { action: "check", agents: unchecked };

  if (!isDone(state, REQUIREMENTS_AGENT)) return { action: "run", agents: [buildBrief(state, REQUIREMENTS_AGENT)] };
  if (!state.requirementsConfirmed) return { action: "clarify" };
  if (state.plan === null) return { action: "plan" };

  for (const stage of STAGE_ORDER) {
    const action = stageAction(state, stage);
    if (action !== null) return action;
  }

  const planSha256 = state.agents[PLAN_AGENT].sha256;
  if (!isApprovalCurrent(approval, planSha256)) return { action: "await-approval", planSha256 };
  if (!isDone(state, OUTPUT_AGENT)) return { action: "run", agents: [buildBrief(state, OUTPUT_AGENT)] };
  return { action: "done", outputs: outputFiles() };
};
```

- [ ] **Step 8: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 9: Commit**

```bash
npm run format
git add src/types/approval.ts src/lib/hash.ts src/lib/approval-status.ts src/lib/next-action.ts tests/support/approval-fixtures.ts tests/lib/next-action.test.ts
git commit -m "feat(workflow): deterministic next-step computation (groups, gates, approval, resume)"
```

---

### Задача 1.7: Правила одобрения человеком

**Files:**
- Create: `src/lib/approval.ts`
- Test: `tests/lib/approval.test.ts`

**Interfaces:**
- Consumes: `nextAction`, `gateIdsForStage`, `appendLog`.
- Produces: `applyDecision(state, approval, request, planSha256OnDisk, now) → ApprovalFile`. Бросает, если run не ждёт одобрения или план на диске отличается от проверенного. Отказ переоткрывает `event-plan-builder` с отзывом и сбрасывает финальные гейты.

- [ ] **Step 1: Падающие тесты `tests/lib/approval.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { applyDecision } from "@/lib/approval";
import { isApprovalCurrent } from "@/lib/approval-status";
import { sha256 } from "@/lib/hash";
import type { WorkflowState } from "@/types/workflow";
import { buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { NOW } from "@tests/support/state-fixtures";

const PLAN_HASH = sha256(PLAN_TEXT);
let state: WorkflowState;

beforeEach(() => {
  state = buildAwaitingApprovalState("run-1");
});

describe("applyDecision", () => {
  test("an approval binds to the plan hash on disk", () => {
    const approval = applyDecision(state, null, { decision: "approved" }, PLAN_HASH, NOW);
    assert.equal(approval.current.planSha256, PLAN_HASH);
    assert.equal(isApprovalCurrent(approval, PLAN_HASH), true);
    assert.equal(isApprovalCurrent(approval, sha256("# Event plan v2\n")), false);
  });

  test("a rejection reopens the plan with feedback and keeps history", () => {
    const approval = applyDecision(
      state,
      null,
      { decision: "rejected", feedback: "add a photo booth" },
      PLAN_HASH,
      NOW,
    );
    assert.equal(state.agents["event-plan-builder"].status, "stale");
    assert.equal(state.agents["event-plan-builder"].feedback, "add a photo booth");
    assert.equal(state.gates["G10-plan-covers-requirements"].status, "pending");
    assert.equal(approval.history.length, 1);
  });

  test("refuses a decision when the run is not awaiting approval", () => {
    const rejected = applyDecision(state, null, { decision: "rejected", feedback: "x" }, PLAN_HASH, NOW);
    assert.throws(
      () => applyDecision(state, rejected, { decision: "approved" }, PLAN_HASH, NOW),
      /not awaiting approval/,
    );
  });

  test("refuses a decision when the plan file changed after validation", () => {
    assert.throws(
      () => applyDecision(state, null, { decision: "approved" }, sha256("# tampered\n"), NOW),
      /changed after its last validation/,
    );
  });
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/approval.test.ts` → Expected: FAIL (`Cannot find module '@/lib/approval'`).

- [ ] **Step 3: `src/lib/approval.ts`**

```ts
import { APPROVAL_RECORDED_BY, HASH_PREVIEW_LENGTH, PLAN_AGENT } from "@/config/workflow";
import { gateIdsForStage } from "@/lib/dag-queries";
import { nextAction } from "@/lib/next-action";
import { appendLog } from "@/lib/state";
import type { ApprovalFile, ApprovalRecord, DecisionRequest } from "@/types/approval";
import type { WorkflowState } from "@/types/workflow";

const reopenPlanForRevision = (state: WorkflowState, feedback: string): void => {
  const plan = state.agents[PLAN_AGENT];
  plan.status = "stale";
  plan.feedback = feedback;
  for (const id of gateIdsForStage("final")) state.gates[id].status = "pending";
  state.validation.final = null;
};

// Решение человека: проверяет, что run ждёт одобрения именно этого плана, и возвращает новый approval.json.
export const applyDecision = (
  state: WorkflowState,
  approval: ApprovalFile | null,
  request: DecisionRequest,
  planSha256OnDisk: string | null,
  now: string,
): ApprovalFile => {
  const action = nextAction(state, approval);
  if (action.action !== "await-approval") {
    throw new Error(`Run ${state.runId} is not awaiting approval (next step: ${action.action}).`);
  }
  if (planSha256OnDisk === null || planSha256OnDisk !== state.agents[PLAN_AGENT].sha256) {
    throw new Error(`The plan of ${state.runId} changed after its last validation — run /resume-event ${state.runId}.`);
  }

  const history = approval?.history ?? [];
  const feedback = request.decision === "rejected" ? request.feedback : null;
  const current: ApprovalRecord = {
    decision: request.decision,
    planSha256: planSha256OnDisk,
    round: history.length + 1,
    feedback,
    recordedAt: now,
    recordedBy: APPROVAL_RECORDED_BY,
  };
  if (feedback !== null) reopenPlanForRevision(state, feedback);
  const details = { round: current.round, planSha256: planSha256OnDisk.slice(0, HASH_PREVIEW_LENGTH) };
  appendLog(state, `approval-${request.decision}`, details, now);
  return { runId: state.runId, current, history: [...history, current] };
};
```

- [ ] **Step 4: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/lib/approval.ts tests/lib/approval.test.ts
git commit -m "feat(workflow): human approval rules bound to the plan's sha256"
```

---

### Задача 1.8: Слой io — хранение состояния run

**Files:**
- Create: `src/io/paths.ts`, `src/io/files.ts`, `src/io/clock.ts`, `src/lib/schemas/workflow-state.ts`, `src/io/state-store.ts`, `tests/support/temp-project.ts`
- Test: `tests/io/state-store.test.ts`

**Interfaces:**
- Produces (`io/paths`): `projectDirectory()` (из `CLAUDE_PROJECT_DIR`), `runsDirectory`, `runDirectory`, `statePath`, `approvalPath`, `artifactsDirectory`, `artifactPath`, `outputDirectory`.
- Produces (`io/files`): `fileExists`, `readText`, `readTextIfExists`, `readJson → unknown`, `sha256OfFile → string | null`, `writeJsonAtomic` (запись через временный файл).
- Produces (`io/clock`): `nowIso()`, `todayIso()`.
- Produces (`lib/schemas/workflow-state`): `isWorkflowState(value): value is WorkflowState`.
- Produces (`io/state-store`): `stateExists`, `loadState` (бросает с путём к битому файлу), `saveState(state, now?)`, `createRun(state)`, `listRunIds()`.
- Produces (`tests/support/temp-project`): `useTempProject()`.

- [ ] **Step 1: `tests/support/temp-project.ts`**

```ts
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Каждый тест получает свой пустой checkout: io резолвит runs/ через CLAUDE_PROJECT_DIR.
export const useTempProject = (): string => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "eventwright-"));
  process.env.CLAUDE_PROJECT_DIR = directory;
  return directory;
};
```

- [ ] **Step 2: Падающие тесты `tests/io/state-store.test.ts`**

```ts
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { statePath } from "@/io/paths";
import { createRun, listRunIds, loadState, saveState } from "@/io/state-store";
import { createInitialState } from "@/lib/state";
import { NOW } from "@tests/support/state-fixtures";
import { useTempProject } from "@tests/support/temp-project";

const RUN = "2026-09-28-lisbon";

beforeEach(() => {
  useTempProject();
});

test("createRun persists the initial state and lists the run", () => {
  createRun(createInitialState(RUN, NOW));
  assert.deepEqual(listRunIds(), [RUN]);
  assert.equal(loadState(RUN).runId, RUN);
});

test("saveState writes atomically and loadState reads it back", () => {
  const state = createInitialState(RUN, NOW);
  createRun(state);
  state.requirementsConfirmed = true;
  saveState(state, NOW);
  assert.equal(existsSync(`${statePath(RUN)}.tmp`), false);
  assert.deepEqual(loadState(RUN), state);
});

test("a corrupted state file is rejected with the file path", () => {
  createRun(createInitialState(RUN, NOW));
  writeFileSync(statePath(RUN), JSON.stringify({ runId: RUN }));
  assert.throws(() => loadState(RUN), /not a valid workflow state/);
});
```

- [ ] **Step 3: Запуск — тесты падают**

Run: `node --import tsx --test tests/io/state-store.test.ts` → Expected: FAIL (`Cannot find module '@/io/paths'`).

- [ ] **Step 4: `src/io/paths.ts`**

```ts
import path from "node:path";
import process from "node:process";

import { APPROVAL_FILE, ARTIFACTS_AREA, OUTPUT_AREA, RUNS_DIRECTORY, STATE_FILE } from "@/config/workflow";

// Читается при каждом вызове: hooks и тесты указывают CLAUDE_PROJECT_DIR на другой checkout.
export const projectDirectory = (): string => process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
export const runsDirectory = (): string => path.join(projectDirectory(), RUNS_DIRECTORY);
export const runDirectory = (runId: string): string => path.join(runsDirectory(), runId);
export const statePath = (runId: string): string => path.join(runDirectory(runId), STATE_FILE);
export const approvalPath = (runId: string): string => path.join(runDirectory(runId), APPROVAL_FILE);
export const artifactsDirectory = (runId: string): string => path.join(runDirectory(runId), ARTIFACTS_AREA);
export const artifactPath = (runId: string, fileName: string): string => path.join(artifactsDirectory(runId), fileName);
export const outputDirectory = (runId: string): string => path.join(runDirectory(runId), OUTPUT_AREA);
```

- [ ] **Step 5: `src/io/files.ts`**

```ts
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { sha256 } from "@/lib/hash";

const JSON_INDENT = 2;
const TEMPORARY_SUFFIX = ".tmp";

export const fileExists = (filePath: string): boolean => existsSync(filePath);

export const readText = (filePath: string): string => readFileSync(filePath, "utf8");

export const readTextIfExists = (filePath: string): string =>
  existsSync(filePath) ? readFileSync(filePath, "utf8") : "";

export const readJson = (filePath: string): unknown => {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  return parsed;
};

export const sha256OfFile = (filePath: string): string | null =>
  existsSync(filePath) ? sha256(readFileSync(filePath)) : null;

// Запись через временный файл: прерванный процесс не оставит половину JSON.
export const writeJsonAtomic = (filePath: string, value: unknown): void => {
  const temporary = `${filePath}${TEMPORARY_SUFFIX}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, JSON_INDENT)}\n`);
  renameSync(temporary, filePath);
};
```

- [ ] **Step 6: `src/io/clock.ts`**

```ts
const ISO_DATE_LENGTH = 10;

export const nowIso = (): string => new Date().toISOString();

export const todayIso = (): string => nowIso().slice(0, ISO_DATE_LENGTH);
```

- [ ] **Step 7: `src/lib/schemas/workflow-state.ts`**

```ts
import { SCHEMA_VERSION } from "@/config/workflow";
import { isOneOf, isRecord } from "@/lib/narrow";
import { AGENT_NAMES, AGENT_STATUSES, GATE_IDS, GATE_STATUSES } from "@/types/workflow";
import type { WorkflowState } from "@/types/workflow";

const hasEntries = (value: unknown, keys: readonly string[], isEntry: (entry: unknown) => boolean): boolean =>
  isRecord(value) && keys.every((key) => isEntry(value[key]));

const isAgentState = (value: unknown): boolean =>
  isRecord(value) &&
  isOneOf(AGENT_STATUSES, value.status) &&
  typeof value.attempts === "number" &&
  typeof value.structureOk === "boolean";

const isGateState = (value: unknown): boolean =>
  isRecord(value) && isOneOf(GATE_STATUSES, value.status) && typeof value.attempts === "number";

// Состояние с диска проверяется до использования: битый или чужой файл даёт понятную ошибку, а не падение позже.
export const isWorkflowState = (value: unknown): value is WorkflowState =>
  isRecord(value) &&
  value.schemaVersion === SCHEMA_VERSION &&
  typeof value.runId === "string" &&
  typeof value.requirementsConfirmed === "boolean" &&
  hasEntries(value.agents, AGENT_NAMES, isAgentState) &&
  hasEntries(value.gates, GATE_IDS, isGateState) &&
  isRecord(value.validation) &&
  Array.isArray(value.log);
```

- [ ] **Step 8: `src/io/state-store.ts`**

```ts
import { mkdirSync, readdirSync } from "node:fs";

import { SCHEMA_VERSION } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readJson, writeJsonAtomic } from "@/io/files";
import { artifactsDirectory, outputDirectory, runsDirectory, statePath } from "@/io/paths";
import { isWorkflowState } from "@/lib/schemas/workflow-state";
import type { WorkflowState } from "@/types/workflow";

export const stateExists = (runId: string): boolean => fileExists(statePath(runId));

export const loadState = (runId: string): WorkflowState => {
  const raw = readJson(statePath(runId));
  if (!isWorkflowState(raw)) {
    throw new Error(`${statePath(runId)} is not a valid workflow state (schema ${SCHEMA_VERSION}).`);
  }
  return raw;
};

export const saveState = (state: WorkflowState, now: string = nowIso()): void => {
  state.updatedAt = now;
  writeJsonAtomic(statePath(state.runId), state);
};

// Новый run: папки артефактов и итогового документа плюс начальное состояние.
export const createRun = (state: WorkflowState): void => {
  mkdirSync(artifactsDirectory(state.runId), { recursive: true });
  mkdirSync(outputDirectory(state.runId), { recursive: true });
  saveState(state, state.createdAt);
};

export const listRunIds = (): string[] =>
  fileExists(runsDirectory()) ? readdirSync(runsDirectory()).filter(stateExists) : [];
```

- [ ] **Step 9: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npm run format
git add src/io/paths.ts src/io/files.ts src/io/clock.ts src/lib/schemas/workflow-state.ts src/io/state-store.ts tests/support/temp-project.ts tests/io/state-store.test.ts
git commit -m "feat(io): validated, atomic persistence of run state"
```

---

### Задача 1.9: Слой io — хранение одобрения

**Files:**
- Create: `src/lib/schemas/approval-file.ts`, `src/io/approval-store.ts`
- Test: `tests/io/approval-store.test.ts`

**Interfaces:**
- Consumes: `applyDecision` (1.7), `isApprovalCurrent` (1.6), `loadState`/`saveState` (1.8).
- Produces: `isApprovalFile(value): value is ApprovalFile`; `readApproval(runId) → ApprovalFile | null`; `isApproved(runId)` — одобрен ли план, **который сейчас лежит на диске**; `recordDecision(runId, request, now) → ApprovalRecord`.

- [ ] **Step 1: Падающие тесты `tests/io/approval-store.test.ts`**

```ts
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { isApproved, readApproval, recordDecision } from "@/io/approval-store";
import { artifactPath } from "@/io/paths";
import { createRun, loadState } from "@/io/state-store";
import { buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { NOW } from "@tests/support/state-fixtures";
import { useTempProject } from "@tests/support/temp-project";

const RUN = "run-approval";
const planFile = (): string => artifactPath(RUN, "08-event-plan.md");

beforeEach(() => {
  useTempProject();
  createRun(buildAwaitingApprovalState(RUN));
  writeFileSync(planFile(), PLAN_TEXT);
});

test("an approval is recorded and binds to the plan file", () => {
  recordDecision(RUN, { decision: "approved" }, NOW);
  assert.equal(readApproval(RUN)?.current.decision, "approved");
  assert.equal(isApproved(RUN), true);
});

test("editing the plan after approval revokes it", () => {
  recordDecision(RUN, { decision: "approved" }, NOW);
  writeFileSync(planFile(), "# Event plan v2\n");
  assert.equal(isApproved(RUN), false);
});

test("a rejection is persisted in both approval.json and the state", () => {
  recordDecision(RUN, { decision: "rejected", feedback: "add a photo booth" }, NOW);
  assert.equal(readApproval(RUN)?.history.length, 1);
  assert.equal(loadState(RUN).agents["event-plan-builder"].feedback, "add a photo booth");
  assert.equal(isApproved(RUN), false);
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/io/approval-store.test.ts` → Expected: FAIL (`Cannot find module '@/io/approval-store'`).

- [ ] **Step 3: `src/lib/schemas/approval-file.ts`**

```ts
import { isOneOf, isRecord } from "@/lib/narrow";
import type { ApprovalFile, ApprovalRecord, Decision } from "@/types/approval";

const DECISIONS: readonly Decision[] = ["approved", "rejected"];

const isApprovalRecord = (value: unknown): value is ApprovalRecord =>
  isRecord(value) &&
  isOneOf(DECISIONS, value.decision) &&
  typeof value.planSha256 === "string" &&
  typeof value.round === "number";

export const isApprovalFile = (value: unknown): value is ApprovalFile =>
  isRecord(value) &&
  typeof value.runId === "string" &&
  isApprovalRecord(value.current) &&
  Array.isArray(value.history) &&
  value.history.every(isApprovalRecord);
```

- [ ] **Step 4: `src/io/approval-store.ts`**

```ts
import { PLAN_AGENT } from "@/config/workflow";
import { fileExists, readJson, sha256OfFile, writeJsonAtomic } from "@/io/files";
import { approvalPath, artifactPath } from "@/io/paths";
import { loadState, saveState } from "@/io/state-store";
import { applyDecision } from "@/lib/approval";
import { isApprovalCurrent } from "@/lib/approval-status";
import { requireArtifactOf } from "@/lib/dag-queries";
import { isApprovalFile } from "@/lib/schemas/approval-file";
import type { ApprovalFile, ApprovalRecord, DecisionRequest } from "@/types/approval";

const planFilePath = (runId: string): string => artifactPath(runId, requireArtifactOf(PLAN_AGENT));

export const readApproval = (runId: string): ApprovalFile | null => {
  if (!fileExists(approvalPath(runId))) return null;
  const raw = readJson(approvalPath(runId));
  if (!isApprovalFile(raw)) throw new Error(`${approvalPath(runId)} is not a valid approval file.`);
  return raw;
};

// Одобрено ли то, что сейчас лежит на диске, а не то, что видел человек раньше.
export const isApproved = (runId: string): boolean =>
  isApprovalCurrent(readApproval(runId), sha256OfFile(planFilePath(runId)));

export const recordDecision = (runId: string, request: DecisionRequest, now: string): ApprovalRecord => {
  const state = loadState(runId);
  const approval = applyDecision(state, readApproval(runId), request, sha256OfFile(planFilePath(runId)), now);
  writeJsonAtomic(approvalPath(runId), approval);
  saveState(state, now);
  return approval.current;
};
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/schemas/approval-file.ts src/io/approval-store.ts tests/io/approval-store.test.ts
git commit -m "feat(io): approval persistence bound to the plan file on disk"
```

---

### Задача 2.1: Структурная проверка артефактов

**Files:**
- Create: `src/types/checks.ts`, `src/lib/artifact-check.ts`
- Test: `tests/lib/artifact-check.test.ts`

**Interfaces:**
- Produces (`types/checks`): `Money`, `BudgetStatus`, `ArtifactRules`.
- Produces: `checkArtifact(text, rules) → string[]` (пустой массив — артефакт годен); `extractRequirementIds(text) → string[]`.

- [ ] **Step 1: `src/types/checks.ts`**

```ts
export type Money = {
  amount: number;
  currency: string;
};

export type BudgetStatus = {
  limit: Money | null;
  total: Money | null;
  withinLimit: boolean;
  issues: string[];
};

export type ArtifactRules = {
  sections: readonly string[];
  requiredLines: readonly string[];
  runId: string;
  agent: string;
  requirementIds?: readonly string[];
};
```

- [ ] **Step 2: Падающие тесты `tests/lib/artifact-check.test.ts`**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkArtifact, extractRequirementIds } from "@/lib/artifact-check";
import type { ArtifactRules } from "@/types/checks";

const VALID = [
  "# Catering",
  "",
  "## Meta",
  "- Run: run-1",
  "- Agent: catering-planner",
  "## Summary",
  "Text.",
  "## Menu",
  "Covers R-01 and R-02.",
  "## Cost",
  "- Catering cost: 2400 EUR",
  "## Sources",
  "- https://example.com/menu — menu prices",
  "## Open questions",
  "None",
].join("\n");

const RULES: ArtifactRules = {
  sections: ["Menu", "Cost"],
  requiredLines: ["- Catering cost:"],
  runId: "run-1",
  agent: "catering-planner",
};

const issuesOf = (text: string, rules: ArtifactRules = RULES): string => checkArtifact(text, rules).join("\n");

test("accepts a well-formed artifact", () => {
  assert.deepEqual(checkArtifact(VALID, RULES), []);
});
test("rejects wrong section order", () => {
  const swapped = VALID.replace("## Menu", "## TMP").replace("## Cost", "## Menu").replace("## TMP", "## Cost");
  assert.match(issuesOf(swapped), /sections/i);
});
test("rejects a missing required line", () => {
  assert.match(issuesOf(VALID.replace("- Catering cost: 2400 EUR", "about 2400")), /Catering cost/);
});
test("rejects sources without a citation", () => {
  assert.match(issuesOf(VALID.replace("- https://example.com/menu — menu prices", "- the internet")), /Sources/);
});
test("rejects a wrong run id", () => {
  assert.match(issuesOf(VALID.replace("- Run: run-1", "- Run: other")), /Run: run-1/);
});
test("rejects template placeholders", () => {
  assert.match(issuesOf(VALID.replace("Text.", "TODO")), /placeholder/i);
});
test("reports uncovered requirement ids", () => {
  assert.match(issuesOf(VALID, { ...RULES, requirementIds: ["R-01", "R-03"] }), /R-03/);
});
test("extractRequirementIds returns unique sorted ids", () => {
  assert.deepEqual(extractRequirementIds("- R-02: x\n- R-01 [MUST]: y\nsee R-02"), ["R-01", "R-02"]);
});
```

- [ ] **Step 3: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/artifact-check.test.ts` → Expected: FAIL (`Cannot find module '@/lib/artifact-check'`).

- [ ] **Step 4: `src/lib/artifact-check.ts`**

```ts
import type { ArtifactRules } from "@/types/checks";

const HEAD_SECTIONS = ["Meta", "Summary"];
const TAIL_SECTIONS = ["Sources", "Open questions"];
const SECTION_PREFIX = "## ";
const TITLE_PREFIX = "# ";
const CITATION = /(https?:\/\/\S+|open-meteo:[a-z_]+|user-input)/;
const PLACEHOLDER = /\b(?:TODO|TBD|FIXME)\b|\?\?\?|<(?:runId|agent name|Artifact title)[^>\n]*>/;
const REQUIREMENT_ID = /\bR-\d{2}\b/g;

const sectionBody = (lines: readonly string[], heading: string): string[] => {
  const start = lines.findIndex((line) => line.trim() === `${SECTION_PREFIX}${heading}`);
  if (start === -1) return [];
  const end = lines.findIndex((line, index) => index > start && line.startsWith(SECTION_PREFIX));
  return lines.slice(start + 1, end === -1 ? lines.length : end);
};

export const extractRequirementIds = (text: string): string[] => [...new Set(text.match(REQUIREMENT_ID) ?? [])].sort();

const sectionIssues = (lines: readonly string[], sections: readonly string[]): string[] => {
  const expected = [...HEAD_SECTIONS, ...sections, ...TAIL_SECTIONS];
  const actual = lines
    .filter((line) => line.startsWith(SECTION_PREFIX))
    .map((line) => line.slice(SECTION_PREFIX.length).trim());
  if (actual.join("|") === expected.join("|")) return [];
  const found = actual.length > 0 ? actual.join(" | ") : "none";
  return [`'##' sections must be exactly, in order: ${expected.join(" | ")}. Found: ${found}.`];
};

const metaIssues = (lines: readonly string[], runId: string, agent: string): string[] => {
  const meta = sectionBody(lines, "Meta").map((line) => line.trim());
  return [`- Run: ${runId}`, `- Agent: ${agent}`]
    .filter((line) => !meta.includes(line))
    .map((line) => `'## Meta' lacks the line '${line}'.`);
};

const hasCitation = (lines: readonly string[]): boolean =>
  sectionBody(lines, "Sources").some((line) => line.trim().startsWith("- ") && CITATION.test(line));

// Детерминированная структурная проверка: пустой массив — артефакт годен.
export const checkArtifact = (text: string, rules: ArtifactRules): string[] => {
  const lines = text.split(/\r?\n/);
  const issues = [...sectionIssues(lines, rules.sections), ...metaIssues(lines, rules.runId, rules.agent)];
  if (!lines[0]?.startsWith(TITLE_PREFIX)) issues.unshift("The first line must be a '# ' title.");
  const missingLines = rules.requiredLines.filter((prefix) => !lines.some((line) => line.trim().startsWith(prefix)));
  issues.push(...missingLines.map((prefix) => `Missing required line starting with '${prefix}'.`));
  if (!hasCitation(lines)) issues.push("'## Sources' has no citation (URL, open-meteo:<tool> or user-input).");
  if (PLACEHOLDER.test(text)) issues.push("The artifact still contains placeholders (TODO/TBD/???/template <…>).");
  const missing = (rules.requirementIds ?? []).filter((id) => !text.includes(id));
  if (missing.length > 0) issues.push(`Requirements not addressed: ${missing.join(", ")}.`);
  return issues;
};
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/types/checks.ts src/lib/artifact-check.ts tests/lib/artifact-check.test.ts
git commit -m "feat(workflow): deterministic artifact structure check"
```

---

### Задача 2.2: Детерминированная проверка бюджета

**Files:**
- Create: `src/lib/text.ts`, `src/lib/budget.ts`
- Test: `tests/lib/budget.test.ts`

**Interfaces:**
- Produces: `escapeRegExp(text)`; `parseMoney(text, label) → Money | null`; `budgetStatus(requirementsText, budgetText) → BudgetStatus` (основа G7).

- [ ] **Step 1: Падающие тесты `tests/lib/budget.test.ts`**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { budgetStatus, parseMoney } from "@/lib/budget";

test("parseMoney reads a strict money line", () => {
  assert.deepEqual(parseMoney("x\n- Budget: 9000 EUR\n", "Budget"), { amount: 9000, currency: "EUR" });
  assert.deepEqual(parseMoney("- Total with contingency: 8712.5 EUR", "Total with contingency"), {
    amount: 8712.5,
    currency: "EUR",
  });
});
test("parseMoney rejects thousands separators and missing lines", () => {
  assert.equal(parseMoney("- Budget: 9,000 EUR", "Budget"), null);
  assert.equal(parseMoney("nothing", "Budget"), null);
});
test("budgetStatus passes when the total fits the limit", () => {
  const status = budgetStatus("- Budget: 9000 EUR", "- Total with contingency: 8800 EUR");
  assert.equal(status.withinLimit, true);
  assert.deepEqual(status.issues, []);
});
test("budgetStatus fails over the limit and on currency mismatch", () => {
  assert.equal(budgetStatus("- Budget: 9000 EUR", "- Total with contingency: 9100 EUR").withinLimit, false);
  const mismatch = budgetStatus("- Budget: 9000 EUR", "- Total with contingency: 8000 PLN");
  assert.equal(mismatch.withinLimit, false);
  assert.match(mismatch.issues.join(), /currency/);
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/budget.test.ts` → Expected: FAIL (`Cannot find module '@/lib/budget'`).

- [ ] **Step 3: `src/lib/text.ts`**

```ts
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export const escapeRegExp = (text: string): string => text.replace(REGEXP_SPECIAL, "\\$&");
```

- [ ] **Step 4: `src/lib/budget.ts`**

```ts
import { escapeRegExp } from "@/lib/text";
import type { BudgetStatus, Money } from "@/types/checks";

const LIMIT_LABEL = "Budget";
const TOTAL_LABEL = "Total with contingency";

// Строгий формат «- <Label>: 9000 EUR» без разделителей тысяч — иначе G7 не проверить детерминированно.
export const parseMoney = (text: string, label: string): Money | null => {
  const pattern = new RegExp(`^\\s*- ${escapeRegExp(label)}:\\s*(\\d+(?:\\.\\d+)?)\\s+([A-Z]{3})\\s*$`, "m");
  const [, amount, currency] = pattern.exec(text) ?? [];
  if (amount === undefined || currency === undefined) return null;
  return { amount: Number(amount), currency };
};

export const budgetStatus = (requirementsText: string, budgetText: string): BudgetStatus => {
  const limit = parseMoney(requirementsText, LIMIT_LABEL);
  const total = parseMoney(budgetText, TOTAL_LABEL);
  const issues: string[] = [];
  if (limit === null) issues.push(`requirements lack a '- ${LIMIT_LABEL}: <amount> <CUR>' line`);
  if (total === null) issues.push(`budget lacks a '- ${TOTAL_LABEL}: <amount> <CUR>' line`);
  if (limit !== null && total !== null && limit.currency !== total.currency) {
    issues.push(`currency mismatch: limit ${limit.currency}, total ${total.currency}`);
  }
  const withinLimit = issues.length === 0 && limit !== null && total !== null && total.amount <= limit.amount;
  return { limit, total, withinLimit, issues };
};
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/text.ts src/lib/budget.ts tests/lib/budget.test.ts
git commit -m "feat(workflow): deterministic budget limit check"
```

---

### Задача 3.1: CLI — каркас и команды `init`, `list`, `status`, `next`

**Files:**
- Create: `src/io/output.ts`, `src/lib/status-report.ts`, `src/cli/command.ts`, `src/cli/require-run.ts`, `src/cli/commands/run-commands.ts`, `src/cli/main.ts`, `tests/support/run-cli.ts`
- Test: `tests/cli/run-commands.test.ts`

**Interfaces:**
- Produces: вызов `npm run -s wf -- <command> …` (stdout — JSON, ошибки — stderr и exit 1):
  - `init <slug>` → `{runId}` (`runs/<YYYY-MM-DD>-<slug>/{artifacts,output}/` + state)
  - `list` → `[{runId, phase, updatedAt, failure}]`
  - `status <runId>` → текстовая таблица агентов, гейтов и execution plan
  - `next <runId> [--resume]` → `Action`; сохраняет `state.phase`, `--resume` пишет событие `resume`
- Produces: `Command`, `CommandRegistry`, `requireRun(runId)`, `formatStatus(state)`, `printJson`, `printText`, `printError`.
- Produces (`tests/support/run-cli`): `runCli(...args)`, `cliJson(...args)`, `initRun(slug)`, `readRunState`, `writeArtifact`, `requirementsFixture(runId, services?)`.

- [ ] **Step 1: `tests/support/run-cli.ts`**

```ts
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { artifactPath } from "@/io/paths";
import { loadState } from "@/io/state-store";
import { isRecord } from "@/lib/narrow";
import type { WorkflowState } from "@/types/workflow";

const CLI_ENTRY = path.join(process.cwd(), "src", "cli", "main.ts");

export type CliResult = { code: number | null; out: string; err: string };

// CLI запускается так же, как его вызывает координатор: отдельный процесс node + tsx.
export const runCli = (...args: string[]): CliResult => {
  const result = spawnSync(process.execPath, ["--import", "tsx", CLI_ENTRY, ...args], {
    encoding: "utf8",
    env: { ...process.env },
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
};

export const cliJson = (...args: string[]): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(runCli(...args).out);
  if (!isRecord(parsed)) throw new Error(`CLI ${args.join(" ")} did not print a JSON object`);
  return parsed;
};

export const initRun = (slug: string): string => {
  const { runId } = cliJson("init", slug);
  if (typeof runId !== "string") throw new Error("init did not return a runId");
  return runId;
};

export const readRunState = (runId: string): WorkflowState => loadState(runId);

export const writeArtifact = (runId: string, fileName: string, text: string): void => {
  writeFileSync(artifactPath(runId, fileName), text);
};

export const requirementsFixture = (runId: string, services = "venue, catering, entertainment, logistics"): string =>
  [
    "# Requirements",
    "## Meta",
    `- Run: ${runId}`,
    "- Agent: requirements-formalizer",
    "## Summary",
    "Birthday dinner for 30 guests.",
    "## Event profile",
    "40th birthday dinner.",
    "## Guests",
    "- Guests: 30",
    "## Date and location",
    "- Date: 2027-06-12",
    "- City: Lisbon, Portugal",
    "## Budget and currency",
    "- Budget: 9000 EUR",
    "## Services needed",
    `- Services: ${services}`,
    "## Constraints",
    "None.",
    "## Clarification log",
    "No clarifications yet.",
    "## Requirements",
    "- R-01 [MUST]: Seat 30 guests.",
    "## Sources",
    "- user-input — original request",
    "## Open questions",
    "None",
  ].join("\n");
```

- [ ] **Step 2: Падающие тесты `tests/cli/run-commands.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { cliJson, initRun, readRunState, runCli } from "@tests/support/run-cli";
import { useTempProject } from "@tests/support/temp-project";

beforeEach(() => {
  useTempProject();
});

test("init creates a run and next starts with the formalizer", () => {
  const runId = initRun("lisbon-birthday");
  assert.match(runId, /^\d{4}-\d{2}-\d{2}-lisbon-birthday$/);
  assert.match(runCli("next", runId).out, /"name": "requirements-formalizer"/);
});

test("init rejects bad slugs and duplicate runs", () => {
  assert.equal(runCli("init", "Bad Slug").code, 1);
  initRun("dup");
  assert.match(runCli("init", "dup").err, /already exists/);
});

test("list and status describe existing runs", () => {
  const runId = initRun("listed");
  assert.match(runCli("list").out, new RegExp(runId));
  assert.match(runCli("status", runId).out, /requirements-formalizer/);
  assert.equal(runCli("status", "missing").code, 1);
});

test("next saves the phase and --resume logs a resume event", () => {
  const runId = initRun("resume-me");
  assert.equal(cliJson("next", runId, "--resume").action, "run");
  const state = readRunState(runId);
  assert.equal(state.phase, "run");
  assert.ok(state.log.some((entry) => entry.event === "resume"));
});

test("an unknown command lists the available ones", () => {
  assert.match(runCli("nope").err, /Commands: init, list, status, next/);
});
```

- [ ] **Step 3: Запуск — тесты падают**

Run: `node --import tsx --test tests/cli/run-commands.test.ts` → Expected: FAIL (CLI не найден).

- [ ] **Step 4: `src/io/output.ts`**

```ts
import process from "node:process";

const JSON_INDENT = 2;

export const printJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, JSON_INDENT)}\n`);
};

export const printText = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

export const printError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};
```

- [ ] **Step 5: `src/lib/status-report.ts`**

```ts
import { MAX_RETRIES } from "@/config/workflow";
import { AGENT_NAMES, GATE_IDS } from "@/types/workflow";
import type { AgentState, WorkflowState } from "@/types/workflow";

const STATUS_COLUMN_WIDTH = 8;

const agentNote = (agent: AgentState): string => {
  if (agent.feedback !== null) return ` — feedback: ${agent.feedback}`;
  return agent.lastError !== null ? ` — ${agent.lastError}` : "";
};

export const formatStatus = (state: WorkflowState): string => {
  const lines = [`Run ${state.runId} — phase: ${state.phase}`];
  if (state.plan !== null) {
    const skipped = state.plan.skipped.length > 0 ? state.plan.skipped.join(", ") : "none";
    lines.push(`Execution plan: ${state.plan.selected.join(", ")}; skipped: ${skipped}`);
  }
  lines.push("", "Agents:");
  for (const name of AGENT_NAMES) {
    const agent = state.agents[name];
    lines.push(`  ${agent.status.padEnd(STATUS_COLUMN_WIDTH)} ${name} (runs: ${agent.attempts})${agentNote(agent)}`);
  }
  lines.push("", "Gates:");
  for (const id of GATE_IDS) {
    const gate = state.gates[id];
    lines.push(`  ${gate.status.padEnd(STATUS_COLUMN_WIDTH)} ${id} (failures: ${gate.attempts}/${MAX_RETRIES})`);
  }
  if (state.failure !== null) lines.push("", `STOPPED: ${JSON.stringify(state.failure)}`);
  return lines.join("\n");
};
```

- [ ] **Step 6: `src/cli/command.ts` и `src/cli/require-run.ts`**

```ts
export type Command = (args: readonly string[]) => void;

export type CommandRegistry = Readonly<Record<string, Command>>;
```

```ts
import { loadState, stateExists } from "@/io/state-store";
import type { WorkflowState } from "@/types/workflow";

export const requireRun = (runId: string | undefined): WorkflowState => {
  if (runId === undefined || !stateExists(runId)) throw new Error(`Run '${runId ?? ""}' not found under runs/.`);
  return loadState(runId);
};
```

- [ ] **Step 7: `src/cli/commands/run-commands.ts`**

```ts
import type { CommandRegistry } from "@/cli/command";
import { requireRun } from "@/cli/require-run";
import { readApproval } from "@/io/approval-store";
import { nowIso, todayIso } from "@/io/clock";
import { printJson, printText } from "@/io/output";
import { createRun, listRunIds, loadState, saveState, stateExists } from "@/io/state-store";
import { nextAction } from "@/lib/next-action";
import { appendLog, createInitialState } from "@/lib/state";
import { formatStatus } from "@/lib/status-report";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESUME_FLAG = "--resume";

// Жизненный цикл run: создание, список, статус и вычисление следующего шага.
export const RUN_COMMANDS: CommandRegistry = {
  init: ([slug = ""]) => {
    if (!SLUG.test(slug)) throw new Error("slug must be lowercase kebab-case, e.g. lisbon-birthday");
    const runId = `${todayIso()}-${slug}`;
    if (stateExists(runId)) throw new Error(`Run ${runId} already exists — use /resume-event ${runId}`);
    createRun(createInitialState(runId, nowIso()));
    printJson({ runId });
  },

  list: () => {
    printJson(
      listRunIds().map((runId) => {
        const state = loadState(runId);
        return { runId, phase: state.phase, updatedAt: state.updatedAt, failure: state.failure };
      }),
    );
  },

  status: ([runId]) => {
    printText(formatStatus(requireRun(runId)));
  },

  next: ([runId, flag]) => {
    const state = requireRun(runId);
    const action = nextAction(state, readApproval(state.runId));
    if (flag === RESUME_FLAG) appendLog(state, "resume", { next: action.action }, nowIso());
    state.phase = action.action;
    saveState(state);
    printJson(action);
  },
};
```

- [ ] **Step 8: `src/cli/main.ts`** (пока только команды жизненного цикла run)

```ts
import process from "node:process";

import type { CommandRegistry } from "@/cli/command";
import { RUN_COMMANDS } from "@/cli/commands/run-commands";
import { printError } from "@/io/output";

const COMMANDS: CommandRegistry = { ...RUN_COMMANDS };
const FAILURE_EXIT_CODE = 1;

// CLI координатора: stdout — JSON для модели, ошибки — stderr и exit 1.
const [commandName = "", ...args] = process.argv.slice(2);
const command = COMMANDS[commandName];

try {
  if (command === undefined) throw new Error(`Commands: ${Object.keys(COMMANDS).join(", ")}`);
  command(args);
} catch (error) {
  printError(error instanceof Error ? error.message : String(error));
  process.exit(FAILURE_EXIT_CODE);
}
```

- [ ] **Step 9: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS. Ручная проверка: `npm run -s wf -- nope` → `Commands: init, list, status, next`.

- [ ] **Step 10: Commit**

```bash
npm run format
git add src/io/output.ts src/lib/status-report.ts src/cli tests/support/run-cli.ts tests/cli/run-commands.test.ts
git commit -m "feat(cli): coordinator CLI skeleton — init, list, status, next"
```

---

### Задача 3.2: CLI — `start`, `lint`, `check` (запуски агентов и структурный гейт)

**Files:**
- Create: `src/lib/agent-runs.ts`, `src/cli/commands/agent-commands.ts`
- Modify: `src/cli/main.ts`
- Test: `tests/cli/agent-commands.test.ts`

**Interfaces:**
- Consumes: `checkArtifact`, `extractRequirementIds` (2.1), хелперы `tests/support/run-cli` (3.1).
- Produces: `recordAgentStarts(state, names, now)` — `running`, `attempts++`, `startsWithoutArtifact++`, при `> MAX_RETRIES + 1` → `failure`; `recordStructureCheck(state, name, issues, now)` — OK: `structureOk`, счётчик сброшен; ошибка: `done → stale`, `structuralFailures++`, при `> MAX_RETRIES` → `failure`.
- Produces (CLI): `start <runId> <agent…>`, `lint <runId> <agent>` (самопроверка агента, state не меняется), `check <runId> <agent>` (exit 1 при ошибках).

- [ ] **Step 1: Падающие тесты `tests/cli/agent-commands.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { MAX_RETRIES } from "@/config/workflow";
import { cliJson, initRun, readRunState, requirementsFixture, runCli, writeArtifact } from "@tests/support/run-cli";
import { useTempProject } from "@tests/support/temp-project";

beforeEach(() => {
  useTempProject();
});

test("check reports a malformed artifact and counts the failure", () => {
  const runId = initRun("check-bad");
  writeArtifact(runId, "01-requirements.md", "# Requirements\n");
  const result = runCli("check", runId, "requirements-formalizer");
  assert.equal(result.code, 1);
  assert.match(result.err, /sections/);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].structuralFailures, 1);
});

test("check of a valid artifact records the passed structure check", () => {
  const runId = initRun("check-good");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId));
  assert.equal(runCli("check", runId, "requirements-formalizer").code, 0);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].structureOk, true);
});

test("lint reports issues without touching the state", () => {
  const runId = initRun("lint-me");
  writeArtifact(runId, "01-requirements.md", "# Requirements\n");
  assert.equal(runCli("lint", runId, "requirements-formalizer").code, 1);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].structuralFailures, 0);
});

test("start stops the run when an agent keeps failing without an artifact", () => {
  const runId = initRun("flaky");
  for (let attempt = 0; attempt <= MAX_RETRIES + 1; attempt += 1) runCli("start", runId, "requirements-formalizer");
  assert.equal(cliJson("next", runId).action, "failed");
});

test("start and check reject unknown agents", () => {
  const runId = initRun("unknown-agent");
  assert.match(runCli("start", runId, "nope").err, /Unknown agent: nope/);
  assert.match(runCli("check", runId, "html-builder").err, /does not own an artifact/);
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/cli/agent-commands.test.ts` → Expected: FAIL (команды неизвестны).

- [ ] **Step 3: `src/lib/agent-runs.ts`**

```ts
import { MAX_RETRIES } from "@/config/workflow";
import { appendLog } from "@/lib/state";
import type { AgentName, WorkflowState } from "@/types/workflow";

const NO_ARTIFACT_FINDING = "agent failed to produce its artifact";

// Агент, который раз за разом падает без артефакта, не доходит до гейтов — лимит считаем здесь.
export const recordAgentStarts = (state: WorkflowState, names: readonly AgentName[], now: string): void => {
  for (const name of names) {
    const agent = state.agents[name];
    agent.status = "running";
    agent.attempts += 1;
    agent.startsWithoutArtifact += 1;
    if (agent.startsWithoutArtifact <= MAX_RETRIES + 1) continue;
    state.failure ??= {
      kind: "agent",
      agent: name,
      findings: [NO_ARTIFACT_FINDING],
      attempts: agent.startsWithoutArtifact,
      at: now,
    };
  }
  appendLog(state, "agents-started", { agents: names }, now);
};

// Структурный гейт после каждой группы: провал возвращает агента в работу, лимит — MAX_RETRIES подряд.
export const recordStructureCheck = (
  state: WorkflowState,
  name: AgentName,
  issues: readonly string[],
  now: string,
): void => {
  const agent = state.agents[name];
  if (issues.length === 0) {
    agent.structureOk = true;
    agent.structuralFailures = 0;
    appendLog(state, "structure-ok", { agent: name }, now);
    return;
  }
  if (agent.status === "done") agent.status = "stale";
  agent.structureOk = false;
  agent.structuralFailures += 1;
  agent.lastError = `Structure check: ${issues.join(" ")}`;
  if (agent.structuralFailures > MAX_RETRIES) {
    state.failure ??= {
      kind: "agent",
      agent: name,
      findings: [...issues],
      attempts: agent.structuralFailures,
      at: now,
    };
  }
  appendLog(state, "structure-failed", { agent: name, issues }, now);
};
```

- [ ] **Step 4: `src/cli/commands/agent-commands.ts`**

```ts
import type { CommandRegistry } from "@/cli/command";
import { requireRun } from "@/cli/require-run";
import { REQUIREMENTS_AGENT } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readText, readTextIfExists } from "@/io/files";
import { printJson } from "@/io/output";
import { artifactPath } from "@/io/paths";
import { saveState } from "@/io/state-store";
import { recordAgentStarts, recordStructureCheck } from "@/lib/agent-runs";
import { checkArtifact, extractRequirementIds } from "@/lib/artifact-check";
import { artifactDefinition, parseAgentName, requireArtifactOf } from "@/lib/dag-queries";
import type { AgentName } from "@/types/workflow";

const inspectArtifact = (runId: string, name: AgentName): string[] => {
  const definition = artifactDefinition(name);
  if (definition === null) throw new Error(`${name} does not own an artifact.`);
  const file = artifactPath(runId, definition.artifact);
  if (!fileExists(file)) return [`${definition.artifact} was not written.`];
  const requirementIds = definition.coversRequirements
    ? extractRequirementIds(readTextIfExists(artifactPath(runId, requireArtifactOf(REQUIREMENTS_AGENT))))
    : [];
  return checkArtifact(readText(file), {
    sections: definition.sections,
    requiredLines: definition.requiredLines,
    runId,
    agent: name,
    requirementIds,
  });
};

// Запуски агентов и структурный гейт после каждой группы.
export const AGENT_COMMANDS: CommandRegistry = {
  start: ([runId, ...names]) => {
    const state = requireRun(runId);
    const agents = names.map(parseAgentName);
    recordAgentStarts(state, agents, nowIso());
    saveState(state);
    printJson({ ok: true, started: agents });
  },

  // Самопроверка агента: состояние не меняется.
  lint: ([runId, name = ""]) => {
    const state = requireRun(runId);
    const issues = inspectArtifact(state.runId, parseAgentName(name));
    if (issues.length > 0) throw new Error(issues.join("\n"));
    printJson({ ok: true });
  },

  check: ([runId, name = ""]) => {
    const state = requireRun(runId);
    const agent = parseAgentName(name);
    const issues = inspectArtifact(state.runId, agent);
    recordStructureCheck(state, agent, issues, nowIso());
    saveState(state);
    if (issues.length > 0) throw new Error(issues.join("\n"));
    printJson({ ok: true });
  },
};
```

- [ ] **Step 5: `src/cli/main.ts`** — зарегистрировать команды агентов (файл целиком)

```ts
import process from "node:process";

import type { CommandRegistry } from "@/cli/command";
import { AGENT_COMMANDS } from "@/cli/commands/agent-commands";
import { RUN_COMMANDS } from "@/cli/commands/run-commands";
import { printError } from "@/io/output";

const COMMANDS: CommandRegistry = { ...RUN_COMMANDS, ...AGENT_COMMANDS };
const FAILURE_EXIT_CODE = 1;

// CLI координатора: stdout — JSON для модели, ошибки — stderr и exit 1.
const [commandName = "", ...args] = process.argv.slice(2);
const command = COMMANDS[commandName];

try {
  if (command === undefined) throw new Error(`Commands: ${Object.keys(COMMANDS).join(", ")}`);
  command(args);
} catch (error) {
  printError(error instanceof Error ? error.message : String(error));
  process.exit(FAILURE_EXIT_CODE);
}
```

- [ ] **Step 6: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run format
git add src/lib/agent-runs.ts src/cli tests/cli/agent-commands.test.ts
git commit -m "feat(cli): agent start tracking and structural gate (start, lint, check)"
```

---

### Задача 3.3: CLI — `confirm-requirements`, `plan`, `budget`, `record-gates`, `invalidate`

**Files:**
- Create: `src/cli/commands/flow-commands.ts`
- Modify: `src/cli/main.ts`
- Test: `tests/cli/flow-commands.test.ts`

**Interfaces:**
- Consumes: `budgetStatus` (2.2), `applyExecutionPlan`, `parseServices` (1.4), `recordGates` (1.5), `confirmRequirements`, `invalidateAgents` (1.3).
- Produces (CLI):
  - `confirm-requirements <runId>` → `{ok:true}`
  - `plan <runId>` → `ExecutionPlan`; ошибка, если требования не подтверждены, план уже задан или нет строки `- Services:`
  - `budget <runId>` → `BudgetStatus` (всегда exit 0)
  - `record-gates <runId> <domain|final>` → `GateSummary`
  - `invalidate <runId> <agent…> --feedback <text…>` → `{ok:true, invalidated}`

- [ ] **Step 1: Падающие тесты `tests/cli/flow-commands.test.ts`**

```ts
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { cliJson, initRun, readRunState, requirementsFixture, runCli, writeArtifact } from "@tests/support/run-cli";
import { useTempProject } from "@tests/support/temp-project";

beforeEach(() => {
  useTempProject();
});

test("plan requires confirmed requirements", () => {
  const runId = initRun("plan-early");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId));
  assert.match(runCli("plan", runId).err, /not confirmed/);
});

test("plan skips the planners of services that were not requested, once", () => {
  const runId = initRun("plan-skip");
  writeArtifact(runId, "01-requirements.md", requirementsFixture(runId, "venue, entertainment, logistics"));
  runCli("confirm-requirements", runId);
  assert.deepEqual(cliJson("plan", runId).skipped, ["catering-planner"]);
  assert.equal(readRunState(runId).agents["catering-planner"].status, "skipped");
  assert.match(runCli("plan", runId).err, /already set/);
});

test("invalidate stores feedback for revise mode", () => {
  const runId = initRun("inv");
  const result = runCli("invalidate", runId, "requirements-formalizer", "--feedback", "budget", "is", "10000", "EUR");
  assert.equal(result.code, 0);
  assert.equal(readRunState(runId).agents["requirements-formalizer"].feedback, "budget is 10000 EUR");
});

test("invalidate without feedback is rejected", () => {
  const runId = initRun("inv-empty");
  assert.match(runCli("invalidate", runId, "venue-scout").err, /usage/);
});

test("budget reports a missing budget artifact without failing", () => {
  const runId = initRun("budget");
  const result = runCli("budget", runId);
  assert.equal(result.code, 0);
  assert.match(result.out, /"withinLimit": false/);
});

test("record-gates needs a known stage and a validator report", () => {
  const runId = initRun("no-report");
  assert.match(runCli("record-gates", runId, "later").err, /Stage must be one of/);
  assert.match(runCli("record-gates", runId, "domain").err, /validation-domain\.md/);
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/cli/flow-commands.test.ts` → Expected: FAIL (команды неизвестны).

- [ ] **Step 3: `src/cli/commands/flow-commands.ts`**

```ts
import type { CommandRegistry } from "@/cli/command";
import { requireRun } from "@/cli/require-run";
import { BUDGET_AGENT, REQUIREMENTS_AGENT, STAGE_ORDER, validationFileName } from "@/config/workflow";
import { nowIso } from "@/io/clock";
import { fileExists, readText, readTextIfExists } from "@/io/files";
import { printJson } from "@/io/output";
import { artifactPath } from "@/io/paths";
import { saveState } from "@/io/state-store";
import { budgetStatus } from "@/lib/budget";
import { parseAgentName, requireArtifactOf } from "@/lib/dag-queries";
import { applyExecutionPlan, parseServices } from "@/lib/execution-plan";
import { recordGates } from "@/lib/gates";
import { confirmRequirements, invalidateAgents } from "@/lib/state";
import type { GatedStage } from "@/types/workflow";

const FEEDBACK_FLAG = "--feedback";

const requirementsText = (runId: string): string =>
  readTextIfExists(artifactPath(runId, requireArtifactOf(REQUIREMENTS_AGENT)));

const parseStage = (value: string | undefined): GatedStage => {
  const stage = STAGE_ORDER.find((item) => item === value);
  if (stage === undefined) throw new Error(`Stage must be one of: ${STAGE_ORDER.join(", ")}.`);
  return stage;
};

// Переходы workflow: подтверждение требований, план выполнения, гейты, инвалидация.
export const FLOW_COMMANDS: CommandRegistry = {
  "confirm-requirements": ([runId]) => {
    const state = requireRun(runId);
    confirmRequirements(state, nowIso());
    saveState(state);
    printJson({ ok: true });
  },

  plan: ([runId]) => {
    const state = requireRun(runId);
    if (!state.requirementsConfirmed)
      throw new Error("Requirements are not confirmed yet — finish the clarify phase first.");
    if (state.plan !== null) throw new Error(`Execution plan already set: ${state.plan.selected.join(", ")}`);
    const services = parseServices(requirementsText(state.runId));
    if (services === null) throw new Error(`${requireArtifactOf(REQUIREMENTS_AGENT)} lacks a '- Services: …' line.`);
    const plan = applyExecutionPlan(state, services, nowIso());
    saveState(state);
    printJson(plan);
  },

  // Всегда exit 0: валидатор читает результат G7 из JSON.
  budget: ([runId]) => {
    const state = requireRun(runId);
    const budgetText = readTextIfExists(artifactPath(state.runId, requireArtifactOf(BUDGET_AGENT)));
    printJson(budgetStatus(requirementsText(state.runId), budgetText));
  },

  "record-gates": ([runId, stageName]) => {
    const state = requireRun(runId);
    const stage = parseStage(stageName);
    const reportFile = artifactPath(state.runId, validationFileName(stage));
    if (!fileExists(reportFile)) throw new Error(`No ${validationFileName(stage)} — run the validator first.`);
    const summary = recordGates(state, stage, readText(reportFile), nowIso());
    saveState(state);
    printJson(summary);
  },

  invalidate: ([runId, ...rest]) => {
    const state = requireRun(runId);
    const flagIndex = rest.indexOf(FEEDBACK_FLAG);
    const names = flagIndex === -1 ? rest : rest.slice(0, flagIndex);
    const feedback =
      flagIndex === -1
        ? ""
        : rest
            .slice(flagIndex + 1)
            .join(" ")
            .trim();
    if (names.length === 0 || feedback.length === 0) {
      throw new Error("usage: invalidate <runId> <agent...> --feedback <text>");
    }
    const agents = names.map(parseAgentName);
    invalidateAgents(state, agents, feedback, nowIso());
    saveState(state);
    printJson({ ok: true, invalidated: agents });
  },
};
```

- [ ] **Step 4: `src/cli/main.ts`** — финальная версия (файл целиком)

```ts
import process from "node:process";

import type { CommandRegistry } from "@/cli/command";
import { AGENT_COMMANDS } from "@/cli/commands/agent-commands";
import { FLOW_COMMANDS } from "@/cli/commands/flow-commands";
import { RUN_COMMANDS } from "@/cli/commands/run-commands";
import { printError } from "@/io/output";

const COMMANDS: CommandRegistry = { ...RUN_COMMANDS, ...AGENT_COMMANDS, ...FLOW_COMMANDS };
const FAILURE_EXIT_CODE = 1;

// CLI координатора: stdout — JSON для модели, ошибки — stderr и exit 1.
const [commandName = "", ...args] = process.argv.slice(2);
const command = COMMANDS[commandName];

try {
  if (command === undefined) throw new Error(`Commands: ${Object.keys(COMMANDS).join(", ")}`);
  command(args);
} catch (error) {
  printError(error instanceof Error ? error.message : String(error));
  process.exit(FAILURE_EXIT_CODE);
}
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS. `npm run -s wf -- nope` → полный список из 12 команд.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/cli tests/cli/flow-commands.test.ts
git commit -m "feat(cli): requirements confirmation, execution plan, budget, gate recording, invalidation"
```

---

### Задача 4.1: Разбор payload hooks + `state-integrity-guard` (PreToolUse)

**Files:**
- Create: `src/types/hooks.ts`, `src/config/hooks.ts`, `src/lib/hook-input.ts`, `src/io/hook-io.ts`, `src/lib/guards/state-integrity.ts`, `src/hooks/state-integrity-guard.ts`, `tests/support/run-hook.ts`
- Test: `tests/lib/hook-input.test.ts`, `tests/lib/guards/state-integrity.test.ts`, `tests/hooks/state-integrity-guard.test.ts`

**Interfaces:**
- Produces: `HookInput` (нормализованный payload); `parseHookInput(raw: unknown) → HookInput`; `readHookInput()`, `denyToolUse(reason): never`, `blockPrompt(source, message): never`, `reportToContext(source, message)`; `stateIntegrityViolation(input) → string | null`.
- Контракт Claude Code: отказ PreToolUse — JSON `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"…"}}` + exit 0. Блокировка UserPromptSubmit — exit 2 + stderr. Разрешение — exit 0 без вывода.
- Produces (`tests/support/run-hook`): `RUN`, `runHook(name, payload) → {code, stdout, stderr, decision}`, `setupRun()`, `prepareAwaitingApproval()`, `outputPath(file)`, `writePayload(file, content)`.

- [ ] **Step 1: `src/types/hooks.ts` и `src/config/hooks.ts`**

```ts
// Нормализованный payload hook: поля Claude Code в snake_case приводятся к camelCase при разборе.
export type HookInput = {
  toolName: string | null;
  filePath: string | null;
  command: string | null;
  skill: string | null;
  writtenText: string;
  prompt: string | null;
  agentType: string | null;
};
```

```ts
export const FILE_TOOLS: readonly string[] = ["Write", "Edit", "MultiEdit"];
export const SHELL_TOOLS: readonly string[] = ["Bash", "PowerShell"];
export const COMMAND_TOOLS: readonly string[] = ["Skill", "SlashCommand"];

// Команды, которые может набрать только человек (§ одобрение).
export const HUMAN_ONLY_COMMANDS: readonly string[] = ["approve-event", "reject-event"];

// Единственный разрешённый способ менять состояние из shell.
export const WORKFLOW_CLI_PREFIX = /^\s*npm run -s wf -- /;

export const HOOK_BLOCK_EXIT_CODE = 2;
```

- [ ] **Step 2: `tests/support/run-hook.ts`**

```ts
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { artifactPath, outputDirectory } from "@/io/paths";
import { createRun, saveState } from "@/io/state-store";
import { isRecord } from "@/lib/narrow";
import { createInitialState } from "@/lib/state";
import { buildAwaitingApprovalState, PLAN_TEXT } from "@tests/support/approval-fixtures";
import { NOW } from "@tests/support/state-fixtures";
import { useTempProject } from "@tests/support/temp-project";

const HOOKS_DIRECTORY = path.join(process.cwd(), "src", "hooks");
export const RUN = "2026-09-28-lisbon";

export type HookResult = { code: number | null; stdout: string; stderr: string; decision: string | null };

const permissionDecision = (stdout: string): string | null => {
  if (!stdout.trim().startsWith("{")) return null;
  const parsed: unknown = JSON.parse(stdout);
  const output = isRecord(parsed) ? parsed.hookSpecificOutput : null;
  return isRecord(output) && typeof output.permissionDecision === "string" ? output.permissionDecision : null;
};

// Hook запускается так же, как его вызывает Claude Code: payload в stdin, ответ в stdout/stderr/exit code.
export const runHook = (name: string, payload: unknown): HookResult => {
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(HOOKS_DIRECTORY, `${name}.ts`)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env },
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    decision: permissionDecision(result.stdout),
  };
};

export const setupRun = (): void => {
  useTempProject();
  createRun(createInitialState(RUN, NOW));
};

export const prepareAwaitingApproval = (): void => {
  writeFileSync(artifactPath(RUN, "08-event-plan.md"), PLAN_TEXT);
  saveState(buildAwaitingApprovalState(RUN), NOW);
};

export const outputPath = (fileName: string): string => path.join(outputDirectory(RUN), fileName);

export const writePayload = (filePath: string, content: string): unknown => ({
  tool_name: "Write",
  tool_input: { file_path: filePath, content },
});
```

- [ ] **Step 3: Падающие тесты**

`tests/lib/hook-input.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseHookInput } from "@/lib/hook-input";

test("normalizes a Write payload", () => {
  const input = parseHookInput({
    tool_name: "Write",
    agent_type: "venue-scout",
    tool_input: { file_path: "/p/runs/r/artifacts/03-venues.md", content: "# Venues" },
  });
  assert.equal(input.toolName, "Write");
  assert.equal(input.filePath, "/p/runs/r/artifacts/03-venues.md");
  assert.equal(input.writtenText, "# Venues");
  assert.equal(input.agentType, "venue-scout");
});

test("collects the text of every MultiEdit replacement", () => {
  const input = parseHookInput({
    tool_name: "MultiEdit",
    tool_input: { edits: [{ new_string: "a" }, { new_string: "b" }, 7] },
  });
  assert.equal(input.writtenText, "a\nb");
});

test("reads the prompt from prompt or prompt_text", () => {
  assert.equal(parseHookInput({ prompt: "/approve-event r" }).prompt, "/approve-event r");
  assert.equal(parseHookInput({ prompt_text: "/approve-event r" }).prompt, "/approve-event r");
});

test("tolerates malformed payloads", () => {
  const input = parseHookInput(["not", "an", "object"]);
  assert.equal(input.toolName, null);
  assert.equal(input.writtenText, "");
});
```

`tests/lib/guards/state-integrity.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { stateIntegrityViolation } from "@/lib/guards/state-integrity";
import { parseHookInput } from "@/lib/hook-input";

const RUN = "2026-09-28-lisbon";
const violation = (payload: unknown): string | null => stateIntegrityViolation(parseHookInput(payload));
const write = (file: string): unknown => ({ tool_name: "Write", tool_input: { file_path: file, content: "{}" } });
const bash = (command: string): unknown => ({ tool_name: "Bash", tool_input: { command } });

test("blocks direct writes to state and approval files, including Windows paths", () => {
  assert.match(violation(write(`/p/runs/${RUN}/workflow-state.json`)) ?? "", /workflow-state\.json/);
  assert.match(violation(write(`C:\\p\\runs\\${RUN}\\approval.json`)) ?? "", /approval\.json/);
});

test("allows ordinary artifact writes", () => {
  assert.equal(violation(write(`/p/runs/${RUN}/artifacts/03-venues.md`)), null);
});

test("allows the workflow CLI and blocks other shell access to state", () => {
  assert.equal(violation(bash(`npm run -s wf -- next ${RUN}`)), null);
  assert.notEqual(violation(bash(`echo {} > runs/${RUN}/workflow-state.json`)), null);
  assert.notEqual(violation(bash(`cat runs/${RUN}/approval.json`)), null);
});

test("blocks the model from invoking the approval commands via Skill or SlashCommand", () => {
  assert.notEqual(violation({ tool_name: "Skill", tool_input: { skill: "approve-event" } }), null);
  assert.notEqual(violation({ tool_name: "SlashCommand", tool_input: { command: `/reject-event ${RUN} x` } }), null);
  assert.equal(violation({ tool_name: "Skill", tool_input: { skill: "workflow-orchestration" } }), null);
});
```

`tests/hooks/state-integrity-guard.test.ts`:
```ts
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { statePath } from "@/io/paths";
import { RUN, runHook, setupRun, writePayload } from "@tests/support/run-hook";

beforeEach(setupRun);

test("denies a direct state write with the PreToolUse JSON contract", () => {
  const result = runHook("state-integrity-guard", writePayload(statePath(RUN), "{}"));
  assert.equal(result.code, 0);
  assert.equal(result.decision, "deny");
  assert.match(result.stdout, /workflow-state\.json/);
});

test("allows everything else silently", () => {
  const result = runHook("state-integrity-guard", {
    tool_name: "Bash",
    tool_input: { command: `npm run -s wf -- next ${RUN}` },
  });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
});
```

- [ ] **Step 4: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/hook-input.test.ts tests/lib/guards/state-integrity.test.ts tests/hooks/state-integrity-guard.test.ts` → Expected: FAIL (модулей нет).

- [ ] **Step 5: `src/lib/hook-input.ts`**

```ts
import { isRecord, listOf, stringOrNull } from "@/lib/narrow";
import type { HookInput } from "@/types/hooks";

const editedTexts = (edits: unknown): string[] =>
  listOf(edits)
    .map((edit) => (isRecord(edit) ? stringOrNull(edit.new_string) : null))
    .filter((text) => text !== null);

// Payload Claude Code приходит как unknown: берём только нужные поля и только нужных типов.
export const parseHookInput = (raw: unknown): HookInput => {
  const payload = isRecord(raw) ? raw : {};
  const toolInput = isRecord(payload.tool_input) ? payload.tool_input : {};
  const texts = [stringOrNull(toolInput.content), stringOrNull(toolInput.new_string), ...editedTexts(toolInput.edits)];
  return {
    toolName: stringOrNull(payload.tool_name),
    filePath: stringOrNull(toolInput.file_path),
    command: stringOrNull(toolInput.command),
    skill: stringOrNull(toolInput.skill),
    writtenText: texts.filter((text) => text !== null).join("\n"),
    prompt: stringOrNull(payload.prompt) ?? stringOrNull(payload.prompt_text),
    agentType: stringOrNull(payload.agent_type),
  };
};
```

- [ ] **Step 6: `src/io/hook-io.ts`**

```ts
import process from "node:process";

import { HOOK_BLOCK_EXIT_CODE } from "@/config/hooks";
import { parseHookInput } from "@/lib/hook-input";
import type { HookInput } from "@/types/hooks";

export const readHookInput = async (): Promise<HookInput> => {
  let raw = "";
  for await (const chunk of process.stdin) raw += String(chunk);
  const payload: unknown = raw.trim().length > 0 ? JSON.parse(raw) : {};
  return parseHookInput(payload);
};

// Отказ PreToolUse по контракту Claude Code: JSON с permissionDecision и exit 0.
export const denyToolUse = (reason: string): never => {
  const decision = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput: decision }));
  process.exit(0);
};

// Блокировка UserPromptSubmit: exit 2, сообщение уходит человеку через stderr.
export const blockPrompt = (source: string, message: string): never => {
  process.stderr.write(`[${source}] ${message}\n`);
  process.exit(HOOK_BLOCK_EXIT_CODE);
};

export const reportToContext = (source: string, message: string): void => {
  process.stdout.write(`[${source}] ${message}\n`);
};
```

- [ ] **Step 7: `src/lib/guards/state-integrity.ts`**

```ts
import { COMMAND_TOOLS, FILE_TOOLS, HUMAN_ONLY_COMMANDS, SHELL_TOOLS, WORKFLOW_CLI_PREFIX } from "@/config/hooks";
import { APPROVAL_FILE, STATE_FILE } from "@/config/workflow";
import type { HookInput } from "@/types/hooks";

const TEMPORARY_SUFFIX = ".tmp";
const PROTECTED_FILES = [STATE_FILE, APPROVAL_FILE].flatMap((file) => [file, `${file}${TEMPORARY_SUFFIX}`]);

const baseName = (filePath: string): string => filePath.replace(/\\/g, "/").split("/").at(-1) ?? "";

const invokedCommand = (input: HookInput): string =>
  (input.skill ?? input.command ?? "").trim().replace(/^\//, "").split(/\s+/)[0] ?? "";

const fileViolation = (input: HookInput): string | null => {
  const name = baseName(input.filePath ?? "");
  return PROTECTED_FILES.includes(name)
    ? `state-integrity-guard: ${name} is changed only by the workflow CLI and hooks.`
    : null;
};

const shellViolation = (command: string): string | null => {
  if (command.includes(APPROVAL_FILE)) {
    return `state-integrity-guard: ${APPROVAL_FILE} is written only by the record-approval hook; read it with the Read tool.`;
  }
  if (command.includes(STATE_FILE) && !WORKFLOW_CLI_PREFIX.test(command)) {
    return "state-integrity-guard: change state only via `npm run -s wf -- …`; read it with Read or `wf status`.";
  }
  return null;
};

// PreToolUse: workflow-state.json и approval.json меняют только CLI и hooks; одобряет только человек.
export const stateIntegrityViolation = (input: HookInput): string | null => {
  const tool = input.toolName ?? "";
  if (FILE_TOOLS.includes(tool)) return fileViolation(input);
  if (SHELL_TOOLS.includes(tool)) return shellViolation(input.command ?? "");
  if (COMMAND_TOOLS.includes(tool) && HUMAN_ONLY_COMMANDS.includes(invokedCommand(input))) {
    return "state-integrity-guard: only a human may approve or reject a plan by typing the command.";
  }
  return null;
};
```

- [ ] **Step 8: `src/hooks/state-integrity-guard.ts`**

```ts
// PreToolUse: состояние и одобрение меняют только CLI и hooks; команды одобрения — только человек.
import { denyToolUse, readHookInput } from "@/io/hook-io";
import { stateIntegrityViolation } from "@/lib/guards/state-integrity";

const violation = stateIntegrityViolation(await readHookInput());
if (violation !== null) denyToolUse(violation);
```

- [ ] **Step 9: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 10: Commit**

```bash
npm run format
git add src/types/hooks.ts src/config/hooks.ts src/lib/hook-input.ts src/io/hook-io.ts src/lib/guards/state-integrity.ts src/hooks/state-integrity-guard.ts tests/support/run-hook.ts tests/lib/hook-input.test.ts tests/lib/guards/state-integrity.test.ts tests/hooks/state-integrity-guard.test.ts
git commit -m "feat(hooks): typed hook payloads and state-integrity-guard"
```

---

### Задача 4.2: `post-write-state` (PostToolUse)

**Files:**
- Create: `src/hooks/post-write-state.ts`
- Test: `tests/hooks/post-write-state.test.ts`

**Interfaces:**
- Consumes: `recordArtifactWrite`, `parseRunPath`, `sha256OfFile`, `loadState`, `saveState`, `stateExists`, `readHookInput`.
- Produces: запись артефакта → агент `done` + sha256, downstream `stale`, затронутые PASS-гейты → `pending`. Автор записи — `agent_type` из payload или `coordinator`.

- [ ] **Step 1: Падающие тесты `tests/hooks/post-write-state.test.ts`**

```ts
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, test } from "node:test";

import { artifactPath, projectDirectory, statePath } from "@/io/paths";
import { loadState } from "@/io/state-store";
import { sha256 } from "@/lib/hash";
import { RUN, runHook, setupRun } from "@tests/support/run-hook";

beforeEach(setupRun);

test("marks the owning agent done with the file hash and the writer", () => {
  const file = artifactPath(RUN, "02-weather-outlook.md");
  writeFileSync(file, "# Weather\n");
  runHook("post-write-state", { tool_name: "Write", agent_type: "weather-analyst", tool_input: { file_path: file } });
  const state = loadState(RUN);
  assert.equal(state.agents["weather-analyst"].status, "done");
  assert.equal(state.agents["weather-analyst"].sha256, sha256("# Weather\n"));
  assert.equal(state.log.at(-1)?.details.writer, "weather-analyst");
});

test("ignores files outside a run and runs without state", () => {
  const before = readFileSync(statePath(RUN), "utf8");
  const outside = path.join(projectDirectory(), "README.md");
  writeFileSync(outside, "x");
  assert.equal(runHook("post-write-state", { tool_name: "Write", tool_input: { file_path: outside } }).code, 0);
  const foreign = path.join(projectDirectory(), "runs", "other", "artifacts", "01-requirements.md");
  assert.equal(runHook("post-write-state", { tool_name: "Write", tool_input: { file_path: foreign } }).code, 0);
  assert.equal(readFileSync(statePath(RUN), "utf8"), before);
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/hooks/post-write-state.test.ts` → Expected: FAIL.

- [ ] **Step 3: `src/hooks/post-write-state.ts`**

```ts
// PostToolUse: каждая запись артефакта фиксируется в workflow-state.json (статус, sha256, инвалидация downstream).
import { nowIso } from "@/io/clock";
import { sha256OfFile } from "@/io/files";
import { readHookInput } from "@/io/hook-io";
import { loadState, saveState, stateExists } from "@/io/state-store";
import { parseRunPath } from "@/lib/run-path";
import { recordArtifactWrite } from "@/lib/state";

const COORDINATOR_WRITER = "coordinator";

const recordWrite = async (): Promise<void> => {
  const input = await readHookInput();
  const location = parseRunPath(input.filePath ?? "");
  if (location === null || !stateExists(location.runId)) return;
  const hash = sha256OfFile(input.filePath ?? "");
  if (hash === null) return;
  const state = loadState(location.runId);
  const writer = input.agentType ?? COORDINATOR_WRITER;
  if (recordArtifactWrite(state, location, hash, writer, nowIso())) saveState(state);
};

await recordWrite();
```

- [ ] **Step 4: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/hooks/post-write-state.ts tests/hooks/post-write-state.test.ts
git commit -m "feat(hooks): post-write-state persists every artifact write"
```

---

### Задача 4.3: `record-approval` (UserPromptSubmit)

**Files:**
- Create: `src/lib/approval-command.ts`, `src/hooks/record-approval.ts`
- Test: `tests/lib/approval-command.test.ts`, `tests/hooks/record-approval.test.ts`

**Interfaces:**
- Consumes: `recordDecision` (1.9), `stateExists` (1.8), `readHookInput`, `blockPrompt`, `reportToContext` (4.1).
- Produces: `parseApprovalCommand(prompt) → ApprovalCommand | null`. Hook — единственный писатель `approval.json`; читает сырой текст человека (`prompt`, запасной `prompt_text`); блокирует (exit 2) неизвестный runId, отказ без отзыва и решение не в фазе одобрения.

- [ ] **Step 1: Падающие тесты**

`tests/lib/approval-command.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseApprovalCommand } from "@/lib/approval-command";

test("parses an approval", () => {
  assert.deepEqual(parseApprovalCommand("  /approve-event run-1 "), { runId: "run-1", decision: "approved" });
});

test("parses a rejection with multi-line feedback", () => {
  assert.deepEqual(parseApprovalCommand("/reject-event run-1 add a photo booth\nand a DJ"), {
    runId: "run-1",
    decision: "rejected",
    feedback: "add a photo booth\nand a DJ",
  });
});

test("a rejection without feedback keeps feedback null", () => {
  assert.deepEqual(parseApprovalCommand("/reject-event run-1"), {
    runId: "run-1",
    decision: "rejected",
    feedback: null,
  });
});

test("ignores ordinary prompts and approvals with extra words", () => {
  assert.equal(parseApprovalCommand("please approve"), null);
  assert.equal(parseApprovalCommand("/approve-event run-1 now"), null);
});
```

`tests/hooks/record-approval.test.ts`:
```ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { readApproval } from "@/io/approval-store";
import { approvalPath } from "@/io/paths";
import { prepareAwaitingApproval, RUN, runHook, setupRun } from "@tests/support/run-hook";

beforeEach(setupRun);

test("ignores ordinary prompts", () => {
  assert.equal(runHook("record-approval", { prompt: "hello" }).code, 0);
  assert.equal(existsSync(approvalPath(RUN)), false);
});

test("blocks unknown run ids", () => {
  const result = runHook("record-approval", { prompt: "/approve-event nope" });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /not found/);
});

test("blocks a rejection without feedback", () => {
  prepareAwaitingApproval();
  const result = runHook("record-approval", { prompt: `/reject-event ${RUN}` });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /feedback/);
  assert.equal(existsSync(approvalPath(RUN)), false);
});

test("blocks a decision when the run is not awaiting approval", () => {
  const result = runHook("record-approval", { prompt: `/approve-event ${RUN}` });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /not awaiting approval/);
});

test("records an approval and reports it to the context", () => {
  prepareAwaitingApproval();
  const result = runHook("record-approval", { prompt: `/approve-event ${RUN}` });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /'approved' recorded/);
  assert.equal(readApproval(RUN)?.current.decision, "approved");
});

test("records a rejection with feedback (prompt_text field also accepted)", () => {
  prepareAwaitingApproval();
  assert.equal(runHook("record-approval", { prompt_text: `/reject-event ${RUN} add a photo booth` }).code, 0);
  assert.equal(readApproval(RUN)?.current.feedback, "add a photo booth");
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/approval-command.test.ts tests/hooks/record-approval.test.ts` → Expected: FAIL.

- [ ] **Step 3: `src/lib/approval-command.ts`**

```ts
import type { ApprovalCommand } from "@/types/approval";

const APPROVE = /^\/approve-event\s+(\S+)\s*$/;
const REJECT = /^\/reject-event\s+(\S+)(?:\s+([\s\S]+))?$/;

// Разбирает сырой текст, набранный человеком; всё остальное — не команда одобрения.
export const parseApprovalCommand = (prompt: string): ApprovalCommand | null => {
  const text = prompt.trim();
  const [, approvedRun] = APPROVE.exec(text) ?? [];
  if (approvedRun !== undefined) return { runId: approvedRun, decision: "approved" };
  const [, rejectedRun, feedback] = REJECT.exec(text) ?? [];
  if (rejectedRun === undefined) return null;
  const trimmed = feedback?.trim() ?? "";
  return { runId: rejectedRun, decision: "rejected", feedback: trimmed.length > 0 ? trimmed : null };
};
```

- [ ] **Step 4: `src/hooks/record-approval.ts`**

```ts
// UserPromptSubmit срабатывает на сырой текст, набранный ЧЕЛОВЕКОМ, до раскрытия slash-команды.
// Это единственный писатель approval.json: модель не может подделать одобрение.
import { HASH_PREVIEW_LENGTH } from "@/config/workflow";
import { recordDecision } from "@/io/approval-store";
import { nowIso } from "@/io/clock";
import { blockPrompt, readHookInput, reportToContext } from "@/io/hook-io";
import { stateExists } from "@/io/state-store";
import { parseApprovalCommand } from "@/lib/approval-command";
import type { DecisionRequest } from "@/types/approval";

const SOURCE = "record-approval";

const recordApproval = async (): Promise<void> => {
  const command = parseApprovalCommand((await readHookInput()).prompt ?? "");
  if (command === null) return;
  if (!stateExists(command.runId)) {
    blockPrompt(SOURCE, `Run '${command.runId}' not found. List runs: npm run -s wf -- list`);
  }
  if (command.decision === "rejected" && command.feedback === null) {
    blockPrompt(SOURCE, `Add your feedback: /reject-event ${command.runId} <what to change>`);
  }
  const request: DecisionRequest =
    command.decision === "rejected"
      ? { decision: "rejected", feedback: command.feedback ?? "" }
      : { decision: "approved" };
  try {
    const current = recordDecision(command.runId, request, nowIso());
    const hash = current.planSha256.slice(0, HASH_PREVIEW_LENGTH);
    reportToContext(
      SOURCE,
      `${command.runId}: '${current.decision}' recorded for plan sha256 ${hash} (round ${current.round}).`,
    );
  } catch (error) {
    blockPrompt(SOURCE, error instanceof Error ? error.message : String(error));
  }
};

await recordApproval();
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/approval-command.ts src/hooks/record-approval.ts tests/lib/approval-command.test.ts tests/hooks/record-approval.test.ts
git commit -m "feat(hooks): record-approval captures human-typed approve/reject deterministically"
```

---

### Задача 4.4: `approval-gate-guard` (PreToolUse)

**Files:**
- Create: `src/lib/guards/output-target.ts`, `src/hooks/approval-gate-guard.ts`
- Test: `tests/lib/guards/output-target.test.ts`, `tests/hooks/approval-gate-guard.test.ts`

**Interfaces:**
- Consumes: `isApproved` (1.9), `parseRunPath` (1.2), `denyToolUse`, `readHookInput` (4.1).
- Produces: `outputRunId(input) → string | null` — run, в чей `output/` пишет инструмент (файлом или через shell). Hook запрещает такую запись, пока текущий план не одобрен человеком.

- [ ] **Step 1: Падающие тесты**

`tests/lib/guards/output-target.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { outputRunId } from "@/lib/guards/output-target";
import { parseHookInput } from "@/lib/hook-input";

const target = (payload: unknown): string | null => outputRunId(parseHookInput(payload));

test("finds the run of a file write into output", () => {
  assert.equal(
    target({ tool_name: "Write", tool_input: { file_path: "C:\\p\\runs\\r1\\output\\event-plan.html" } }),
    "r1",
  );
});

test("finds the run of a shell write into output", () => {
  assert.equal(target({ tool_name: "Bash", tool_input: { command: "echo x > runs/r2/output/event-plan.md" } }), "r2");
});

test("ignores artifacts and other tools", () => {
  assert.equal(
    target({ tool_name: "Write", tool_input: { file_path: "/p/runs/r1/artifacts/08-event-plan.md" } }),
    null,
  );
  assert.equal(target({ tool_name: "Read", tool_input: { file_path: "/p/runs/r1/output/event-plan.md" } }), null);
});
```

`tests/hooks/approval-gate-guard.test.ts`:
```ts
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import { artifactPath } from "@/io/paths";
import { outputPath, prepareAwaitingApproval, RUN, runHook, setupRun, writePayload } from "@tests/support/run-hook";

const guard = (payload: unknown): string | null => runHook("approval-gate-guard", payload).decision;
const approve = (): void => {
  runHook("record-approval", { prompt: `/approve-event ${RUN}` });
};

beforeEach(() => {
  setupRun();
  prepareAwaitingApproval();
});

test("blocks output before approval", () => {
  assert.equal(guard(writePayload(outputPath("event-plan.html"), "<html>")), "deny");
});

test("allows output after a human approval of the current plan", () => {
  approve();
  assert.equal(guard(writePayload(outputPath("event-plan.html"), "<html>")), null);
});

test("an edit of the plan after approval blocks output again", () => {
  approve();
  writeFileSync(artifactPath(RUN, "08-event-plan.md"), "# Event plan v2\n");
  assert.equal(guard(writePayload(outputPath("event-plan.md"), "x")), "deny");
});

test("blocks shell writes into output", () => {
  assert.equal(
    guard({ tool_name: "Bash", tool_input: { command: `echo x > runs/${RUN}/output/event-plan.md` } }),
    "deny",
  );
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/guards/output-target.test.ts tests/hooks/approval-gate-guard.test.ts` → Expected: FAIL.

- [ ] **Step 3: `src/lib/guards/output-target.ts`**

```ts
import { FILE_TOOLS, SHELL_TOOLS } from "@/config/hooks";
import { OUTPUT_AREA, RUNS_DIRECTORY } from "@/config/workflow";
import { parseRunPath } from "@/lib/run-path";
import type { HookInput } from "@/types/hooks";

const SHELL_OUTPUT_PATH = new RegExp(`${RUNS_DIRECTORY}[\\\\/]([^\\\\/\\s"']+)[\\\\/]${OUTPUT_AREA}[\\\\/]`);

// Run, в чей итоговый документ пытается писать инструмент (файлом или через shell), либо null.
export const outputRunId = (input: HookInput): string | null => {
  const tool = input.toolName ?? "";
  if (FILE_TOOLS.includes(tool)) {
    const location = parseRunPath(input.filePath ?? "");
    return location?.area === OUTPUT_AREA ? location.runId : null;
  }
  if (!SHELL_TOOLS.includes(tool)) return null;
  const [, runId] = SHELL_OUTPUT_PATH.exec(input.command ?? "") ?? [];
  return runId ?? null;
};
```

- [ ] **Step 4: `src/hooks/approval-gate-guard.ts`**

```ts
// PreToolUse: итоговый документ можно создать только для плана, чей точный sha256 одобрил человек.
import { isApproved } from "@/io/approval-store";
import { denyToolUse, readHookInput } from "@/io/hook-io";
import { outputRunId } from "@/lib/guards/output-target";

const runId = outputRunId(await readHookInput());
if (runId !== null && !isApproved(runId)) {
  denyToolUse(
    `approval-gate-guard: the final document for ${runId} cannot be created — the current plan is not approved by a human. ` +
      `Show the plan and ask the user to type /approve-event ${runId} or /reject-event ${runId} <feedback>.`,
  );
}
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/guards/output-target.ts src/hooks/approval-gate-guard.ts tests/lib/guards/output-target.test.ts tests/hooks/approval-gate-guard.test.ts
git commit -m "feat(hooks): approval-gate-guard blocks final output until the current plan is approved"
```

---

### Задача 4.5: `no-leak-guard` (PreToolUse)

**Files:**
- Create: `src/lib/guards/leaks.ts`, `src/hooks/no-leak-guard.ts`
- Test: `tests/lib/guards/leaks.test.ts`, `tests/hooks/no-leak-guard.test.ts`

**Interfaces:**
- Consumes: `escapeRegExp` (2.2), `parseRunPath` (1.2), `denyToolUse`, `readHookInput` (4.1).
- Produces: `findLeaks(text) → string[]` — имена артефактов, `validation-*.md`, файлы состояния, `runs/…`, `mcp__…`, `open-meteo:<tool>`, имена агентов. Hook запрещает запись таких деталей в `runs/<id>/output/*`.

- [ ] **Step 1: Падающие тесты**

`tests/lib/guards/leaks.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { findLeaks } from "@/lib/guards/leaks";

test("lists every internal detail once", () => {
  assert.deepEqual(findLeaks("See 03-venues.md from venue-scout; venue-scout again"), ["03-venues.md", "venue-scout"]);
});

test("catches tool names, run paths and state files", () => {
  const leaks = findLeaks(
    "mcp__open-meteo__geocoding, runs/2026-09-28-x, workflow-state.json, open-meteo:weather_archive",
  );
  assert.deepEqual(leaks, [
    "workflow-state.json",
    "runs/2026-09-28-x",
    "mcp__open-meteo__geocoding",
    "open-meteo:weather_archive",
  ]);
});

test("allows clean user-facing text", () => {
  assert.deepEqual(findLeaks("Venue: Rooftop 360. Weather source: Open-Meteo historical weather (2016–2025)."), []);
});
```

`tests/hooks/no-leak-guard.test.ts`:
```ts
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { artifactPath } from "@/io/paths";
import { outputPath, RUN, runHook, setupRun, writePayload } from "@tests/support/run-hook";

beforeEach(setupRun);

test("denies internal names in the final document and lists them", () => {
  const result = runHook(
    "no-leak-guard",
    writePayload(outputPath("event-plan.md"), "See 03-venues.md from venue-scout"),
  );
  assert.equal(result.decision, "deny");
  assert.match(result.stdout, /03-venues\.md, venue-scout/);
});

test("ignores internal names inside workflow artifacts", () => {
  assert.equal(
    runHook("no-leak-guard", writePayload(artifactPath(RUN, "08-event-plan.md"), "03-venues.md")).decision,
    null,
  );
});
```

- [ ] **Step 2: Запуск — тесты падают**

Run: `node --import tsx --test tests/lib/guards/leaks.test.ts tests/hooks/no-leak-guard.test.ts` → Expected: FAIL.

- [ ] **Step 3: `src/lib/guards/leaks.ts`**

```ts
import { VALIDATOR_NAME } from "@/config/workflow";
import { escapeRegExp } from "@/lib/text";
import { AGENT_NAMES } from "@/types/workflow";

// Внутренняя кухня workflow, которой не место в документе для человека.
const LEAK_PATTERNS: readonly RegExp[] = [
  /\b0\d-[a-z-]+\.md\b/g,
  /\bvalidation-(?:domain|final)\.md\b/g,
  /workflow-state\.json/g,
  /approval\.json/g,
  /\bruns\/[\w-]+/g,
  /\bmcp__[\w-]+/g,
  /\bopen-meteo:[a-z_]+/g,
  ...[...AGENT_NAMES, VALIDATOR_NAME].map((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "g")),
];

export const findLeaks = (text: string): string[] => [
  ...new Set(LEAK_PATTERNS.flatMap((pattern) => text.match(pattern) ?? [])),
];
```

- [ ] **Step 4: `src/hooks/no-leak-guard.ts`**

```ts
// PreToolUse: в документе для человека не должно быть внутренней кухни workflow.
import { FILE_TOOLS } from "@/config/hooks";
import { OUTPUT_AREA } from "@/config/workflow";
import { denyToolUse, readHookInput } from "@/io/hook-io";
import { findLeaks } from "@/lib/guards/leaks";
import { parseRunPath } from "@/lib/run-path";

const input = await readHookInput();
const isOutputWrite =
  FILE_TOOLS.includes(input.toolName ?? "") && parseRunPath(input.filePath ?? "")?.area === OUTPUT_AREA;
const leaks = isOutputWrite ? findLeaks(input.writtenText) : [];
if (leaks.length > 0) {
  denyToolUse(
    `no-leak-guard: the user-facing document mentions internal workflow details: ${leaks.join(", ")}. Rephrase for a human reader.`,
  );
}
```

- [ ] **Step 5: Всё зелёное**

Run: `npm run typecheck && npm run lint && npm test` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/lib/guards/leaks.ts src/hooks/no-leak-guard.ts tests/lib/guards/leaks.test.ts tests/hooks/no-leak-guard.test.ts
git commit -m "feat(hooks): no-leak-guard keeps workflow internals out of the final document"
```

---

### Задача 4.6: Регистрация hooks в `.claude/settings.json`

**Files:**
- Modify: `.claude/settings.json` (к SessionStart из Задачи 0.1 добавить hooks workflow)
- Test: `tests/config/settings.test.ts`

**Interfaces:**
- Consumes: 5 скриптов `src/hooks/*.ts` (Задачи 4.1–4.5).
- Produces: SessionStart (облако) + 3 PreToolUse + 1 PostToolUse + 1 UserPromptSubmit, hooks workflow — через `node --import tsx`; разрешения для CLI (`npm run -s wf -- *`), MCP и web-поиска.

- [ ] **Step 1: Падающий тест `tests/config/settings.test.ts`**

```ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { isRecord, listOf } from "@/lib/narrow";

const ROOT = process.cwd();
const HOOK_SCRIPT = /--import tsx "\$\{CLAUDE_PROJECT_DIR\}\/(\S+?\.ts)"/;
const WORKFLOW_EVENTS = ["PreToolUse", "PostToolUse", "UserPromptSubmit"];

const commandOf = (hook: unknown): string => (isRecord(hook) && typeof hook.command === "string" ? hook.command : "");

const hookCommands = (settings: unknown): Record<string, string[]> => {
  const hooks = isRecord(settings) && isRecord(settings.hooks) ? settings.hooks : {};
  return Object.fromEntries(
    Object.entries(hooks).map(([event, entries]) => [
      event,
      listOf(entries)
        .flatMap((entry) => (isRecord(entry) ? listOf(entry.hooks) : []))
        .map(commandOf),
    ]),
  );
};

test("cloud sessions install dependencies on start, local sessions skip it", () => {
  const settings: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const [command = ""] = hookCommands(settings).SessionStart ?? [];
  assert.match(command, /CLAUDE_CODE_REMOTE" = "true"/);
  assert.match(command, /npm ci/);
});

test("settings.json registers every hook script through tsx", () => {
  const settings: unknown = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  const commands = hookCommands(settings);
  assert.equal(commands.PreToolUse?.length, 3);
  assert.equal(commands.PostToolUse?.length, 1);
  assert.equal(commands.UserPromptSubmit?.length, 1);
  for (const command of WORKFLOW_EVENTS.flatMap((event) => commands[event] ?? [])) {
    const [, script = ""] = HOOK_SCRIPT.exec(command) ?? [];
    assert.ok(existsSync(path.join(ROOT, script)), command);
  }
});
```

Run: `node --import tsx --test tests/config/settings.test.ts` → Expected: FAIL (в `settings.json` пока только SessionStart).

- [ ] **Step 2: `.claude/settings.json`** (файл целиком)

```json
{
  "permissions": {
    "allow": ["mcp__open-meteo", "Bash(npm run -s wf -- *)", "WebSearch", "WebFetch"]
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "if [ \"$CLAUDE_CODE_REMOTE\" = \"true\" ] && [ ! -d \"$CLAUDE_PROJECT_DIR/node_modules\" ]; then cd \"$CLAUDE_PROJECT_DIR\" && npm ci --no-audit --no-fund; fi",
            "timeout": 600
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|Bash|PowerShell|Skill|SlashCommand",
        "hooks": [
          {
            "type": "command",
            "command": "node --import tsx \"${CLAUDE_PROJECT_DIR}/src/hooks/state-integrity-guard.ts\""
          }
        ]
      },
      {
        "matcher": "Write|Edit|MultiEdit|Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "node --import tsx \"${CLAUDE_PROJECT_DIR}/src/hooks/approval-gate-guard.ts\""
          }
        ]
      },
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node --import tsx \"${CLAUDE_PROJECT_DIR}/src/hooks/no-leak-guard.ts\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node --import tsx \"${CLAUDE_PROJECT_DIR}/src/hooks/post-write-state.ts\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node --import tsx \"${CLAUDE_PROJECT_DIR}/src/hooks/record-approval.ts\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Всё зелёное**

Run: `npm run format && npm run typecheck && npm run lint && npm test` → Expected: PASS (128 тестов).

- [ ] **Step 4: Commit**

```bash
git add .claude/settings.json tests/config/settings.test.ts
git commit -m "feat(hooks): register PreToolUse/PostToolUse/UserPromptSubmit hooks"
```

---

### Задача 5: Проверка интеграции MCP Open-Meteo в Claude Code

**Files:** — (только проверка; при расхождениях правятся `.claude/mcp.json`/README)

- [ ] **Step 1:** В корне репозитория открыть новую сессию `npm run claude`. `/mcp` → `open-meteo`: connected.
- [ ] **Step 2:** Попросить Claude: «Use the open-meteo MCP: geocode Lisbon, then get the daily max temperature and precipitation sum for 2025-06-09..2025-06-15 from the archive». Expected: вызовы `mcp__open-meteo__geocoding` и `mcp__open-meteo__weather_archive` проходят, возвращаются числа.
- [ ] **Step 3:** Записать реальные имена и параметры (`daily` переменные: `temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`, `sunset`; `timezone`) для Задачи 6. Если имена иные, использовать реальные.

---

### Задача 6: Переиспользуемые skills (5 шт.)

**Files:**
- Create: `.claude/skills/{workflow-orchestration,artifact-validator,web-research,weather-lookup,event-html-theme}/SKILL.md`, `.claude/skills/artifact-validator/template.md`, `.claude/skills/event-html-theme/template.html`

**Кто использует (поле `skills:` агентов и команды):**
- `workflow-orchestration` → `/plan-event`, `/resume-event`, `/approve-event`, `/reject-event`
- `artifact-validator` → все 8 агентов с артефактами + validator
- `web-research` → venue-scout, catering-planner, entertainment-planner, logistics-planner, validator
- `weather-lookup` → weather-analyst, validator
- `event-html-theme` → html-builder

- [ ] **Step 1: `.claude/skills/artifact-validator/SKILL.md`**

````markdown
---
name: artifact-validator
description: Reusable structure + citation rules and self-check for Eventwright workflow artifacts (runs/<runId>/artifacts/*.md). Use right after writing or rewriting any workflow artifact, before replying DONE to the coordinator.
---

# artifact-validator

Every workflow artifact has the same predictable shape so humans and agents can read it and the coordinator can check it deterministically.

## Required structure (strict section order)

```
# <Title>
## Meta
- Run: <runId>
- Agent: <agent name>
- Mode: initial | retry | revise
- Inputs: <files>
## Summary
## <your sections — exactly src/config/dag.ts → DAG.agents["<name>"].sections, same order>
## Sources
## Open questions
```

Skeleton: `template.md` in this skill's folder. No other `##` headings (use `###` inside sections).
Required lines: `src/config/dag.ts → DAG.agents["<name>"].requiredLines` must each appear at the start of a line, e.g. `- Budget: 9000 EUR`.

## Money format (deterministic budget check)

`- <Label>: <amount> <CUR>` — amount is digits with an optional `.` decimal part, **no thousands separators**, CUR is the ISO code from the requirements. Example: `- Catering cost: 2400 EUR`.

## Citation rules

- Every venue, vendor, price or factual claim from the web → a `## Sources` bullet: `- https://… — what was taken (accessed YYYY-MM-DD)`. Only URLs you actually opened (WebFetch) or got from WebSearch. Never invent URLs.
- Weather figures → `- open-meteo:<tool> — lat, lon, period`.
- Facts from the user → `- user-input — original request` / `- user-input — clarification round N`.
- `## Open questions`: `None` or a list. Do not leave questions you could have resolved from your inputs.
- Forbidden: TODO, TBD, FIXME, `???`, unfilled `<…>` template tokens, and the `|` character inside table cells.

## Self-check (run AFTER writing the file)

1. `npm run -s wf -- lint <runId> <agent>`
2. On exit code 1: fix every listed issue with **one** full rewrite (Write), then repeat step 1. At most 2 fixes.
3. If issues remain after 2 fixes: reply `FAILED <short reason>`; the coordinator decides on a retry.

`lint` never changes workflow state; only the coordinator's `check` does.
````

- [ ] **Step 1b: `.claude/skills/artifact-validator/template.md`** — скелет артефакта, на него ссылается skill

```markdown
# <Artifact title>

## Meta

- Run: <runId>
- Agent: <agent name>
- Mode: initial | retry | revise
- Inputs: <input files, comma-separated>

## Summary

<2–4 sentences: the key conclusion of this artifact>

## <Section 1 from src/config/dag.ts → sections>

...

## <Section N>

...

## Sources

- https://real-page.example/path — what was taken from it (accessed YYYY-MM-DD)
- open-meteo:weather_archive — lat 38.72, lon -9.14, 2016–2025, Jun 9–15
- user-input — original request / clarification round N

## Open questions

None
```

- [ ] **Step 2: `.claude/skills/web-research/SKILL.md`**

````markdown
---
name: web-research
description: How Eventwright agents research real vendors, venues and prices on the web — search, verify by opening the page, capture price with date and currency, cite. Use whenever an artifact contains a vendor, venue, price or availability claim.
---

# web-research

The model's memory is not a source. Every vendor, venue and price must come from a page you opened in this run.

## Procedure

1. **Search** with WebSearch using the city + category + qualifier from the requirements, e.g. `garden restaurant private dining 30 guests Lisbon`, `vegetarian catering menu price per person Lisbon`. Run 2–4 queries with different wording.
2. **Open** the 3–6 most relevant results with WebFetch. Prefer the vendor's own site; aggregators (maps, booking, event marketplaces) are acceptable for price ranges.
3. **Capture** for each candidate: name, URL, what the page states (capacity, price, package contents, accessibility), the currency on the page, and today's date.
4. **Convert** currencies only when the page's currency differs from the requirements' currency: note the rate and its source URL in `## Sources`.
5. **Estimate honestly**: when a page gives a range or "from" price, use the upper end for budgeting and say so. When no price is published, write `price on request` and estimate from comparable vendors, labelled `estimate` with their URLs.
6. **Cite**: numbered sources `- [N] https://… — what was taken (accessed YYYY-MM-DD)` and refer to `[N]` next to each claim.

## Rules

- Never invent a vendor, URL, price, capacity or accessibility feature.
- Exclude candidates that clearly violate a `[MUST]` requirement; mention them only if nothing compliant exists.
- Keep sorting deterministic: rank by requirement fit, then by price ascending, then by name.
````

- [ ] **Step 3: `.claude/skills/weather-lookup/SKILL.md`**

````markdown
---
name: weather-lookup
description: How to get grounded weather for an event date and place via the Open-Meteo MCP server — geocoding, choosing forecast vs. 10-year climatology, computing rain risk and the outdoor verdict. Use for any weather statement in the Eventwright workflow.
---

# weather-lookup

Weather comes only from the `open-meteo` MCP server (no API key). Tools: `mcp__open-meteo__geocoding`, `mcp__open-meteo__weather_forecast`, `mcp__open-meteo__weather_archive`.

## Procedure

1. **Geocode** the city from `- City:` → take the top result's latitude, longitude, timezone. Record them in `## Location`.
2. **Pick the method** from days until the event (`- Date:` minus `Today` given by the coordinator):
   - `≤ 14 days` → **forecast**: `weather_forecast` with `daily = temperature_2m_max, temperature_2m_min, precipitation_probability_max, precipitation_sum, sunset` for the event date.
   - `> 14 days` → **climatology**: `weather_archive` for the same calendar window (event date ± 3 days) in each of the last **10** full years, `daily = temperature_2m_max, temperature_2m_min, precipitation_sum, sunset`.
3. **Compute**:
   - forecast: rain risk = `precipitation_probability_max` of the event day.
   - climatology: rain risk = share of days with `precipitation_sum ≥ 1.0 mm` across all fetched days (e.g. 17 of 70 → 24%). Also mean max/min temperature and typical sunset.
4. **Verdict** (exact tokens):
   - rain risk `< 20%` and mean max between 15 °C and 32 °C → `outdoor-ok`
   - rain risk `20–45%`, or temperature outside that band → `outdoor-with-plan-b`
   - rain risk `> 45%` → `indoor-recommended`
5. **Write required lines** in `## Method` / `## Outdoor suitability`:
   - `- Method: forecast` or `- Method: climatology-10y`
   - `- Rain risk: <integer>%`
   - `- Verdict: outdoor-ok | outdoor-with-plan-b | indoor-recommended`
6. **Cite** every call in `## Sources`: `- open-meteo:weather_archive — lat 38.72, lon -9.14, 2016–2025, Jun 9–15`.

Never state weather numbers that did not come from these calls.
````

- [ ] **Step 4: `.claude/skills/workflow-orchestration/SKILL.md`**

````markdown
---
name: workflow-orchestration
description: Coordinator loop for the Eventwright event-planning workflow — reads persisted state through the workflow CLI (npm run -s wf --), launches subagents in dependency order (parallel groups in one message), runs structural checks and quality gates with targeted retries, handles clarification, human approval and revision, and resumes interrupted runs. Use from /plan-event, /resume-event, /approve-event and /reject-event.
---

# workflow-orchestration

You are the **coordinator**. You never write event content (venues, menus, prices, weather, schedules). You orchestrate. All state lives in `runs/<runId>/workflow-state.json` and only `npm run -s wf -- …` and hooks change it — direct edits are blocked by the `state-integrity-guard` hook; do not try to work around it.

## Main loop

Repeat until the action is `await-approval`, `done` or `failed`:

1. `npm run -s wf -- next <runId>` (first call when resuming: `next <runId> --resume`). Read the JSON action.
2. Execute it per the table.
3. Tell the user in one line what finished and what comes next (e.g. "Venue shortlist ready → catering, program and logistics in parallel").

| action | What to do |
|---|---|
| `check` | For each listed agent: `npm run -s wf -- check <runId> <agent>` (an artifact was written but never checked — typically after a crash). |
| `plan` | `npm run -s wf -- plan <runId>`. Show the user one line: which planners run and which are skipped because the service was not requested (e.g. "Catering skipped — you bring your own food"). If it fails (missing or unknown service), run `npm run -s wf -- invalidate <runId> requirements-formalizer --feedback "<the error>"` and continue the loop. |
| `run` | `npm run -s wf -- start <runId> <names…>`, then launch **all** listed agents **in one message** (several Agent tool calls) so independent agents run in parallel. Build each prompt from the template below. Wait for all of them. Then for every agent with an artifact: `npm run -s wf -- check <runId> <agent>` (skip for `html-builder`). A failed check needs no extra handling — `next` returns the agent again with `mode: "retry"` and the reason. |
| `clarify` | Clarification phase (below). |
| `validate` | Launch subagent `validator` with: `Run: <runId>` / `Stage: <stage>` / `Recheck gates: <recheck, comma-separated>` / `Not applicable: <notApplicable, comma-separated or —>` / `Today: <YYYY-MM-DD>`. Then `npm run -s wf -- record-gates <runId> <stage>`. If `record-gates` fails because the report is malformed, relaunch the validator with the error text (max 2 times in a row). Show the user a one-line gate summary. |
| `record-gates` | Only `npm run -s wf -- record-gates <runId> <stage>` — the report already exists; do not re-run the validator. |
| `await-approval` | Approval phase (below). **End your turn.** |
| `done` | Report `runs/<runId>/output/event-plan.html` and `event-plan.md`. Stop. |
| `failed` | Failure report (below). Stop. Launch nothing else. |

## Subagent prompt template

```
Run: <runId>
Your artifact: runs/<runId>/artifacts/<brief.artifact>
Inputs: runs/<runId>/input.md, runs/<runId>/clarifications.md (if it exists), <each brief.inputs as runs/<runId>/artifacts/<file>>
Mode: <brief.mode>
Retry reason: <brief.reason or —>
User feedback: <brief.feedback or —>
Today: <YYYY-MM-DD>
```
For `requirements-formalizer` add `Phase: draft` (first run) or `Phase: finalize` (after clarifications).
For `html-builder` replace the artifact line with `Output directory: runs/<runId>/output/`.
Never paste other artifacts' content into prompts — agents read the files. Expect a one-line reply `DONE <file>` or `FAILED <reason>`.

## Clarification phase (`clarify`)

1. Read `runs/<runId>/artifacts/01-requirements.md` → `## Open questions`.
2. If there are questions: ask them with **AskUserQuestion** (≤ 4 per call; use the options listed in the artifact). Append questions and answers to `runs/<runId>/clarifications.md` (`## Round N`, then `- Q: … / A: …`). Then `npm run -s wf -- start <runId> requirements-formalizer`, relaunch it with `Phase: finalize`, then `check`. At most 2 question rounds.
3. Show the user the requirement list (`R-NN` lines) and ask with AskUserQuestion: "Are these requirements correct?" → options "Confirm" / "Needs changes".
4. "Needs changes" → append the correction to `clarifications.md` → finalize again → back to step 3.
5. "Confirm" → `npm run -s wf -- confirm-requirements <runId>` → continue the loop (the next action is `plan`).

Rewritten requirements (a gate retry or a revision) always need a new confirmation: `next` returns `clarify` again, so show the updated `R-NN` list and the `- Services:` line and ask once more.

## Approval phase (`await-approval`)

1. Read `runs/<runId>/artifacts/08-event-plan.md` and show a compact summary: overview, weather verdict, chosen venue, menu highlights, program, run of show (times only), budget total vs. limit.
2. Print exactly:
   > To approve this plan, type: `/approve-event <runId>`
   > To request changes, type: `/reject-event <runId> <what to change>`
3. **End your turn.** Never invoke these commands yourself — it is forbidden and blocked by hooks. Only a human-typed command counts.

## After a rejection (`/reject-event`)

The hook already marked the plan builder for revision with the feedback. Decide whether the feedback also changes upstream work, using the ownership table:

| Feedback is about | Invalidate |
|---|---|
| date, city, guest count, budget, must-haves, adding or dropping a whole service | `requirements-formalizer` |
| choice or type of venue | `venue-scout` |
| food, drinks, dietary needs | `catering-planner` |
| music, host, activities | `entertainment-planner` |
| transport, parking, decor, rentals, deadlines | `logistics-planner` |
| only wording/order/level of detail of the plan | nothing extra |

If any row matches: `npm run -s wf -- invalidate <runId> <agents…> --feedback <the user's feedback verbatim>`. Downstream artifacts are regenerated automatically. Then continue the main loop.

## Failure report (`failed`)

Print `npm run -s wf -- status <runId>` and explain:
- which gate or agent is blocked and after how many attempts (of 3),
- the findings,
- which steps did **not** run because of it (all downstream work),
- what the user can do (relax the conflicting requirement and start a new run with `/plan-event`).

## Resume

`/resume-event <runId>` = the same loop with `next <runId> --resume` first. Completed (`done`) agents are never re-run — `next` guarantees that. If the next action is `await-approval`, show the summary and the instructions again.
````

- [ ] **Step 5: `.claude/skills/event-html-theme/SKILL.md`**

````markdown
---
name: event-html-theme
description: Rendering rules and the fixed HTML template for the user-facing Eventwright event plan (event-plan.md + event-plan.html). Use when producing the final output of the workflow.
---

# event-html-theme

The final document has the **same structure for every run**.

## Sections (strict order, identical in MD and HTML)

| # | HTML id | Heading | From the plan section |
|---|---|---|---|
| 1 | `overview` | Overview | Event overview |
| 2 | `weather` | Weather & Plan B | Weather and plan B |
| 3 | `venue` | Venue | Venue |
| 4 | `menu` | Menu | Menu |
| 5 | `program` | Program | Program |
| 6 | `run-of-show` | Run of Show | Run of show (table: Time · What · Who) |
| 7 | `checklist` | Preparation Checklist | Preparation checklist (grouped by deadline) |
| 8 | `budget` | Budget | Budget (table: Item · Cost; totals row; limit) |
| 9 | `sources` | Sources | external URLs only |

The "Requirements matrix" is an internal check and is **not** rendered.

## Rules

1. Write `event-plan.md` first: first line `# <Event name> — Event Plan`, then the 9 `##` headings exactly as in the table.
2. Then write `event-plan.html`: a copy of `template.html` from this folder with **only** these placeholders replaced: `{{TITLE}}` (twice), `{{SUBTITLE}}`, `{{GENERATED_AT}}`, `{{OVERVIEW}}`, `{{WEATHER}}`, `{{VENUE}}`, `{{MENU}}`, `{{PROGRAM}}`, `{{RUN_OF_SHOW}}`, `{{CHECKLIST}}`, `{{BUDGET}}`, `{{SOURCES}}`. Do not change CSS, layout or section order.
3. Section content is plain HTML: `<p>`, `<ul>/<ol>/<li>`, `<table>` with `<thead>`, `<strong>`, `<a href="…" target="_blank" rel="noopener">`. No scripts, no external assets. Escape `&`, `<`, `>` in text.
4. Never mention workflow internals: artifact file names, `runs/`, state files, agent names, `mcp__…`, `open-meteo:<tool>`. Weather sources are written as "Open-Meteo historical weather (2016–2025)" or "Open-Meteo forecast". The `no-leak-guard` hook blocks violations — on a block, rephrase and write again.
````

- [ ] **Step 6: `.claude/skills/event-html-theme/template.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  :root { --bg:#f6f5f2; --card:#ffffff; --text:#1c1c1e; --muted:#6a6a70; --accent:#b4532a; --border:#e4e1da; --soft:#fbf3ee; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#141414; --card:#1e1e20; --text:#ededee; --muted:#a2a2a8; --accent:#f0915f; --border:#2d2d31; --soft:#2a211c; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  header, nav, main, footer { max-width:960px; margin:0 auto; padding-left:16px; padding-right:16px; }
  header { padding-top:40px; padding-bottom:20px; }
  header h1 { margin:0 0 6px; font-size:clamp(24px, 4vw, 36px); }
  header p { margin:0; color:var(--muted); }
  nav { display:flex; flex-wrap:wrap; gap:8px; padding-bottom:16px; }
  nav a { color:var(--accent); text-decoration:none; border:1px solid var(--border); border-radius:999px; padding:4px 12px; font-size:14px; }
  main { display:grid; gap:16px; padding-bottom:48px; }
  section { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:20px 24px; }
  section h2 { margin:0 0 12px; font-size:20px; }
  table { width:100%; border-collapse:collapse; font-size:14px; display:block; overflow-x:auto; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); }
  th { color:var(--muted); font-weight:600; }
  tr.total td { font-weight:700; background:var(--soft); }
  li { margin:6px 0; }
  a { color:var(--accent); }
  footer { color:var(--muted); font-size:13px; padding-bottom:32px; }
  @media print { nav { display:none; } section { break-inside:avoid; } }
</style>
</head>
<body>
<header>
  <h1>{{TITLE}}</h1>
  <p>{{SUBTITLE}}</p>
</header>
<nav>
  <a href="#overview">Overview</a><a href="#weather">Weather</a><a href="#venue">Venue</a><a href="#menu">Menu</a><a href="#program">Program</a><a href="#run-of-show">Run of Show</a><a href="#checklist">Checklist</a><a href="#budget">Budget</a><a href="#sources">Sources</a>
</nav>
<main>
  <section id="overview"><h2>Overview</h2>{{OVERVIEW}}</section>
  <section id="weather"><h2>Weather &amp; Plan B</h2>{{WEATHER}}</section>
  <section id="venue"><h2>Venue</h2>{{VENUE}}</section>
  <section id="menu"><h2>Menu</h2>{{MENU}}</section>
  <section id="program"><h2>Program</h2>{{PROGRAM}}</section>
  <section id="run-of-show"><h2>Run of Show</h2>{{RUN_OF_SHOW}}</section>
  <section id="checklist"><h2>Preparation Checklist</h2>{{CHECKLIST}}</section>
  <section id="budget"><h2>Budget</h2>{{BUDGET}}</section>
  <section id="sources"><h2>Sources</h2>{{SOURCES}}</section>
</main>
<footer>Generated {{GENERATED_AT}} · Plan approved by the organizer</footer>
</body>
</html>
```

- [ ] **Step 7: Проверка**

Run: `grep -o "{{[A-Z_]*}}" .claude/skills/event-html-theme/template.html | sort -u | wc -l` → Expected: `12`.
Run: `npm run format:check` → Expected: PASS (при необходимости `npm run format`).

- [ ] **Step 8: Commit**

```bash
npm run format
git add .claude/skills
git commit -m "feat(workflow): reusable skills — orchestration, artifact-validator, web-research, weather-lookup, html theme"
```

---

### Задача 7: Subagents (10 шт.)

**Files:**
- Create: `.claude/agents/{requirements-formalizer,weather-analyst,venue-scout,catering-planner,entertainment-planner,logistics-planner,budget-aggregator,validator,event-plan-builder,html-builder}.md`

**Interfaces:**
- Consumes: шаблон промпта из `workflow-orchestration` (`Run`, `Your artifact`, `Inputs`, `Mode`, `Retry reason`, `User feedback`, `Today`, `Phase`, `Output directory`); `sections`/`requiredLines` из `src/config/dag.ts`.
- Produces: ровно свой артефакт + ответ `DONE <file>` / `FAILED <reason>`.

**Общий блок `## Contract`** (дословно в конце каждого агента с артефактом, т.е. всех, кроме validator и html-builder):

```markdown
## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 1: `.claude/agents/requirements-formalizer.md`**

```markdown
---
name: requirements-formalizer
description: Eventwright workflow — turns the raw event request and clarification answers into structured, numbered requirements (01-requirements.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash
model: sonnet
skills:
  - artifact-validator
---

You formalize event requirements. You invent nothing: everything comes from `input.md` and `clarifications.md`.

## What to capture

- **Event profile:** occasion, style/formality, event name if given.
- **Guests:** count, composition (kids with ages, seniors), accessibility needs, dietary restrictions with counts.
- **Date and location:** required lines `- Date: YYYY-MM-DD`, `- City: <city>, <country>`, `- Guests: <number>`; start/end time if given.
- **Budget and currency:** required line `- Budget: <amount> <CUR>` (ISO code; if the user gave no currency, infer from the country: PT/ES/FR/DE/IT → EUR, PL → PLN, GB → GBP, US → USD, otherwise ask).
- **Services needed:** required line `- Services: <comma-separated subset of venue, catering, entertainment, logistics>` — this line decides which planning agents run. `venue` is always included. Drop a service only when the user clearly handles it or does not want it ("we bring our own food" → no `catering`; "no music or program needed" → no `entertainment`; "everyone lives next door, no rentals" → no `logistics`). When unsure, keep the service and ask in `## Open questions` (draft). Below the line, list details: transport, decor, photo, etc.
- **Constraints:** anything that limits choices (noise, time, travel, venue type).
- **Clarification log:** table `Question | Answer | Round` from `clarifications.md` ("No clarifications yet" in draft).
- **Requirements:** `- R-01: …` numbered list, one checkable statement each. Mark explicit must-haves (user said "must", "need", "required", "obligatory") as `- R-05 [MUST]: …`.

## Phases

- `Phase: draft` — every missing fact needed for planning (date, city, guest count, budget, dietary needs, indoor/outdoor preference) goes to `## Open questions` as a numbered list with 2–3 answer options each: `1. What is the total budget? (options: up to 3000 EUR; 3000–8000 EUR; more)`. Max 8 questions, most important first. Never guess a value: in draft, write an unknown required value as `unknown` (e.g. `- Budget: unknown`).
- `Phase: finalize` — apply all answers; `## Open questions` is `None` when everything is resolved; required lines must hold real values.

`## Sources`: `- user-input — original request` and `- user-input — clarification round N`.

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 2: `.claude/agents/weather-analyst.md`**

```markdown
---
name: weather-analyst
description: Eventwright workflow — produces a grounded weather outlook and outdoor verdict for the event date and city using the Open-Meteo MCP server (02-weather-outlook.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash, mcp__open-meteo__geocoding, mcp__open-meteo__weather_forecast, mcp__open-meteo__weather_archive
model: sonnet
skills:
  - artifact-validator
  - weather-lookup
---

You assess weather for the event using only the Open-Meteo MCP server, following skill `weather-lookup` exactly.

## Sections

- **Location:** city, country, latitude, longitude, timezone (from geocoding).
- **Method:** `- Method: forecast` or `- Method: climatology-10y`, why (days until the event vs. 14), exact periods queried.
- **Outlook:** table `Metric | Value` — mean max °C, mean min °C, rain risk %, typical sunset (local time); for climatology also a per-year table `Year | Rainy days (of 7) | Mean max °C`.
- **Outdoor suitability:** `- Rain risk: <n>%`, `- Verdict: <token>`, then 2–3 sentences on what the verdict means for venue and activities (e.g. "needs a covered fallback area for 30 guests").

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 3: `.claude/agents/venue-scout.md`**

```markdown
---
name: venue-scout
description: Eventwright workflow — finds and ranks three real venues matching guests, budget, accessibility and the weather verdict, with sources (03-venues.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash, WebSearch, WebFetch
model: sonnet
skills:
  - artifact-validator
  - web-research
---

You shortlist venues with skill `web-research`.

## Sections

- **Shortlist:** exactly 3 options, table `# | Venue | Type (indoor/outdoor/both) | Capacity | Price | Accessibility | Source`. Price is for the whole event in the requirements' currency (rental or minimum spend); say which.
- **Recommendation:** required lines `- Recommended venue: <name>` and `- Venue cost: <amount> <CUR>`; 3–5 sentences why (fit to `[MUST]` requirements, guests, style, budget share). If the weather verdict is not `outdoor-ok`, the recommended venue must have a covered/indoor area for all guests — say where.
- **Accessibility and logistics:** step-free access, accessible toilet, parking, public transport, opening hours on the event day, noise/curfew limits — each with a source or "not stated on the venue page".

Keep the budget in mind: the venue should normally take no more than ~40% of the total budget unless the requirements say otherwise.

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 4: `.claude/agents/catering-planner.md`**

```markdown
---
name: catering-planner
description: Eventwright workflow — plans catering for the recommended venue (in-house or external), a concrete menu covering every dietary need, and its cost (04-catering.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash, WebSearch, WebFetch
model: sonnet
skills:
  - artifact-validator
  - web-research
---

You plan food and drinks for the **recommended venue** in `03-venues.md`.

## Sections

- **Catering option:** in-house menu of the venue or an external caterer (only if the venue allows it — cite). Format: seated dinner / buffet / cocktail, with reason.
- **Menu:** courses with named dishes; drinks package if relevant. Use real menu items from the source when available.
- **Dietary coverage:** table `Restriction | Guests | Dishes that cover it` — every restriction from the requirements appears, with a count.
- **Cost:** per-person price × guests (+ drinks, service), required line `- Catering cost: <amount> <CUR>`.

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 5: `.claude/agents/entertainment-planner.md`**

```markdown
---
name: entertainment-planner
description: Eventwright workflow — plans the event program, performers/host and activities suited to the guests, the venue and the weather verdict, with costs and sources (05-entertainment.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash, WebSearch, WebFetch
model: sonnet
skills:
  - artifact-validator
  - web-research
---

You plan what happens during the event at the **recommended venue**.

## Sections

- **Program:** ordered blocks (welcome, main part, highlights, closing) with durations; kid-friendly items when kids attend.
- **Vendors:** table `Role | Vendor | What is included | Price | Source` (musicians, host, photographer, kids' animator — only what the requirements imply).
- **Weather plan B:** for every outdoor element, its indoor/covered alternative. If the verdict is `outdoor-ok`, write "No outdoor element depends on weather" or list light fallbacks.
- **Cost:** line items, required line `- Entertainment cost: <amount> <CUR>`.

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 6: `.claude/agents/logistics-planner.md`**

```markdown
---
name: logistics-planner
description: Eventwright workflow — plans guest transport and parking, accessibility, rentals and decor, and the vendor booking timeline for the recommended venue (06-logistics.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash, WebSearch, WebFetch
model: sonnet
skills:
  - artifact-validator
  - web-research
---

You make the event physically work at the **recommended venue**.

## Sections

- **Guest transport and parking:** how guests arrive (public transport lines, taxi, shuttle if needed), parking capacity and cost — sourced.
- **Accessibility:** how each accessibility requirement is met (ramp, lift, accessible toilet, reserved seating); gaps and fixes.
- **Rentals and decor:** items needed beyond the venue (tables, heaters/umbrellas if the weather verdict requires, decor, sound) with prices and sources.
- **Vendor booking timeline:** table `Deadline (YYYY-MM-DD) | Action | Owner`. Deadlines must be after `Today` and before the event date; typical lead times: venue 8–12 weeks, catering 6 weeks, entertainment 6 weeks, rentals 3 weeks, final headcount 7 days.
- **Cost:** line items, required line `- Logistics cost: <amount> <CUR>`.

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 7: `.claude/agents/budget-aggregator.md`**

```markdown
---
name: budget-aggregator
description: Eventwright workflow — aggregates all costs from venue, catering, entertainment and logistics into one budget with a 10% contingency and savings options (07-budget.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash
model: sonnet
skills:
  - artifact-validator
---

You add up costs. You do not research or change prices — you copy them from 03–06.

## Sections

- **Line items:** table `Category | Item | Amount | Source artifact section` — venue (from `- Venue cost:`) plus catering, entertainment and logistics lines **only from the artifacts listed in your Inputs**. A service whose artifact is not an input was not requested: add a row `<Category> | Not requested — handled by the organizer | 0 <CUR> | —`.
- **Totals:** required lines, exact format:
  - `- Subtotal: <amount> <CUR>`
  - `- Contingency (10%): <amount> <CUR>` (round to 2 decimals)
  - `- Total with contingency: <amount> <CUR>`
  - `- Budget limit: <amount> <CUR>` (copied from `- Budget:` in the requirements)
  Then one sentence: within budget / over by X.
- **Savings options:** if over the limit or within 5% of it — 2–4 concrete cuts with the amount each saves and which requirement it touches (never cut a `[MUST]`); otherwise "Not needed".

After writing and linting, run `npm run -s wf -- budget <runId>` and make sure it parses both numbers (`issues: []`).

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 8: `.claude/agents/validator.md`**

````markdown
---
name: validator
description: Eventwright workflow — independently checks workflow artifacts against the named quality gates (G1–G12) and writes a PASS/FAIL report naming the responsible agents (validation-<stage>.md). Invoked only by the workflow coordinator.
tools: Read, Write, Grep, Bash, WebFetch, mcp__open-meteo__geocoding, mcp__open-meteo__weather_archive, mcp__open-meteo__weather_forecast
model: sonnet
skills:
  - artifact-validator
  - web-research
  - weather-lookup
---

You are an independent checker. You never fix artifacts; you only report.

## Input

`Run`, `Stage: domain | final`, `Recheck gates`, `Not applicable`, `Today`. Read `runs/<runId>/artifacts/*.md`. Gates and owners: `src/config/dag.ts` → `gates`. Agents skipped by the execution plan have no artifact: never name them as owners and never fail a gate because their artifact is missing.

## How to check

- **G1-requirements-complete:** all sections filled; `- Date/City/Guests/Budget` hold real values; every requirement has `R-NN`; `## Open questions` is `None`.
- **G2-sources-cited:** every venue/vendor/price in 03–06 has a numbered source; open 2 random URLs with WebFetch and confirm they exist and match the claim.
- **G3-weather-grounded:** method matches days until the event (≤14 → forecast, else climatology-10y); re-run one Open-Meteo call from `## Sources` and confirm the numbers are consistent (±10%).
- **G4-venue-fit:** recommended venue capacity ≥ guests; every accessibility requirement met; covered area when verdict ≠ `outdoor-ok`.
- **G5-dietary-coverage:** every dietary restriction from 01 appears in 04 with named dishes; portions for all guests.
- **G6-weather-plan-b:** when verdict ≠ `outdoor-ok`, every outdoor element in 03/05/06 has a plan B.
- **G7-budget-within-limit:** run `npm run -s wf -- budget <runId>`; PASS only if `withinLimit` is `true`. On FAIL name the owners whose line items should shrink (largest overruns first) plus `budget-aggregator`.
- **G8-currency-consistent:** every amount in 03–07 uses the requirements' currency.
- **G9-must-haves-covered:** every `[MUST]` requirement is satisfied by a concrete item in 03–06.
- **G10-plan-covers-requirements (final):** every `R-NN` from 01 appears in the plan's "Requirements matrix" with a section reference.
- **G11-plan-consistent-with-artifacts (final):** names, times, amounts and the weather verdict in 08 equal those in 02–07.
- **G12-timeline-feasible (final):** run of show fits the venue's hours; every checklist deadline is after `Today` and before the event date.

## Report — `runs/<runId>/artifacts/validation-<stage>.md`

```
# Validation report — <stage>

## Meta

- Run: <runId>
- Agent: validator
- Stage: <stage>

## Gate results

| Gate | Status | Owners | Finding |
|---|---|---|---|
| <gate id> | PASS | <owners from src/config/dag.ts> | — |
| <gate id> | FAIL | <only the owners whose artifact violates the gate> | <what is wrong, where, how to fix — one line, no pipe character> |

## Details

<for each FAIL: quotes from the artifacts and a precise fix instruction>
```

The table has **one row for every gate of the stage except those listed under `Not applicable`** (domain: G1–G9, final: G10–G12). Gates not in `Recheck gates` already passed: re-check them quickly and report `PASS` unless you see a clear regression. Status is exactly `PASS` or `FAIL`. Reply: `DONE validation-<stage>.md`.
````

- [ ] **Step 9: `.claude/agents/event-plan-builder.md`**

```markdown
---
name: event-plan-builder
description: Eventwright workflow synthesis agent — merges all validated artifacts into one coherent event plan with a run of show, a preparation checklist and a requirements matrix (08-event-plan.md). Invoked only by the workflow coordinator.
tools: Read, Write, Bash
model: sonnet
skills:
  - artifact-validator
---

You are the synthesis agent. You add no new facts: you combine 01–07 into one coherent plan and copy names, times, amounts and sources **unchanged**.

## Sections

- **Event overview:** 3–5 sentences — occasion, date, city, guests, style, budget total vs. limit.
- **Weather and plan B:** method, key numbers, verdict, and the consolidated plan B from 03/05/06.
- **Venue:** recommended venue, why, address/access, cost.
- **Menu:** format, dishes, dietary coverage table.
- **Program:** blocks from 05 with vendors.
- **Run of show:** table `Time | What | Who` for the event day, from arrival of vendors to venue close; must fit the venue hours.
- **Preparation checklist:** merged deadlines from 06 plus invitations (6–8 weeks before) and final headcount, grouped `### By YYYY-MM-DD` in chronological order.
- **Budget:** line items and the totals block copied from 07.
- **Requirements matrix:** table `Requirement | Where addressed (section) | Status` — every `R-NN` from 01 exactly once.

`## Sources`: union of 02–06 sources without duplicates.

All nine sections are always present (the document structure never changes). If a section's source artifact is not in your Inputs because the service was not requested, write one sentence: "Not part of this plan — handled by the organizer." and mark the related requirements as such in the matrix.

Mode `revise`: apply the "User feedback"; add a line "Revised per feedback: …" to `## Summary`. If the feedback needs new facts that no input artifact contains, list them in `## Open questions` instead of inventing them.

## Contract

- Read only the files listed under "Inputs". Write only your own artifact, with a single Write call (a self-fix rewrites the whole file).
- Structure: skill `artifact-validator`; your sections and required lines: `src/config/dag.ts` → your name.
- Mode `retry`: read your previous artifact and the "Retry reason"; fix exactly that, keep everything else.
- Mode `revise`: apply the "User feedback"; keep everything the feedback does not touch.
- After writing: `npm run -s wf -- lint <runId> <your-name>` (procedure in `artifact-validator`).
- Reply to the coordinator with one line: `DONE <file>` or `FAILED <reason>`. Do not summarize the content.
- Write in English regardless of the request language; keep proper names as given.
```

- [ ] **Step 10: `.claude/agents/html-builder.md`**

```markdown
---
name: html-builder
description: Eventwright workflow — renders the human-approved event plan into the user-facing event-plan.md and event-plan.html using the fixed theme template. Invoked only by the workflow coordinator after approval.
tools: Read, Write
model: sonnet
skills:
  - event-html-theme
---

You turn the approved `08-event-plan.md` into the organizer's document, following skill `event-html-theme` literally.

1. Read the plan and `.claude/skills/event-html-theme/template.html`.
2. Write `<Output directory>/event-plan.md` (the 9 sections).
3. Write `<Output directory>/event-plan.html` (template with placeholders replaced).
4. If a write is blocked by a hook:
   - `no-leak-guard` → remove the listed internal mentions and write again;
   - `approval-gate-guard` → **stop** and reply `FAILED plan not approved`.

Reply: `DONE event-plan.md, event-plan.html` or `FAILED <reason>`.
```

- [ ] **Step 11: Проверка имён**

```bash
for f in .claude/agents/*.md; do sed -n 2p "$f"; done
```
Expected: 10 строк `name: …`; все имена, кроме `validator`, совпадают с ключами `src/config/dag.ts → agents`.

- [ ] **Step 12: Commit**

```bash
npm run format
git add .claude/agents
git commit -m "feat(workflow): ten single-responsibility subagents with explicit artifact ownership"
```

---

### Задача 8: Координатор — slash-команды

**Files:**
- Create: `.claude/commands/{plan-event,resume-event,approve-event,reject-event}.md`

- [ ] **Step 1: `.claude/commands/plan-event.md`**

```markdown
---
description: Plan an event end-to-end — requirements → weather & venue → catering, program, logistics → budget → quality gates → plan → your approval → HTML guide.
argument-hint: <describe the event: occasion, date, city, guests, budget, wishes>
---

You are the **coordinator** of the Eventwright workflow. You never write event content yourself.

The user's request:

<request>
$ARGUMENTS
</request>

1. If the request is empty, ask the user to describe the event and stop.
2. Derive a short lowercase kebab-case slug from the request (e.g. `lisbon-40th-birthday`) and run `npm run -s wf -- init <slug>`. Take `runId` from the JSON.
3. Write the request verbatim to `runs/<runId>/input.md` (Write) under the heading `# Original request` with a line `Received: <ISO date>`.
4. Tell the user: `Run <runId> created. Progress is saved — if the session is interrupted, continue with /resume-event <runId>.`
5. Load skill `workflow-orchestration` and run its main loop for `<runId>`.
```

- [ ] **Step 2: `.claude/commands/resume-event.md`**

```markdown
---
description: Resume an interrupted Eventwright run from its saved state.
argument-hint: [runId]
---

You are the **coordinator** of the Eventwright workflow.

1. runId: `$ARGUMENTS`. If empty, run `npm run -s wf -- list` and take the most recently updated run whose `phase` is not `done` and whose `failure` is null. If there is none, say so and stop.
2. Run `npm run -s wf -- status <runId>` and briefly show the user what is already done.
3. Load skill `workflow-orchestration` and run its main loop; the first call is `npm run -s wf -- next <runId> --resume`.
```

- [ ] **Step 3: `.claude/commands/approve-event.md`**

```markdown
---
description: (Human only) Approve the current version of the event plan and generate the final guide.
argument-hint: <runId>
disable-model-invocation: true
---

The user typed the approval command for run `$ARGUMENTS`. The `record-approval` hook has already validated and recorded the decision — its output is in the context above (if the hook had rejected the command, you would not see this text).

You are the **coordinator**. Load skill `workflow-orchestration` and continue the main loop for run `$ARGUMENTS` (first call `npm run -s wf -- next $ARGUMENTS`). Expected next step: `run` → `html-builder`.
```

- [ ] **Step 4: `.claude/commands/reject-event.md`**

```markdown
---
description: (Human only) Reject the current plan with feedback — it will be revised and submitted for approval again.
argument-hint: <runId> <what to change>
disable-model-invocation: true
---

The user rejected the plan. Arguments: `$ARGUMENTS` (the first word is the runId, the rest is the feedback). The `record-approval` hook has already recorded the rejection and marked the plan for revision.

You are the **coordinator**. Load skill `workflow-orchestration`, follow its section "After a rejection" (decide which upstream agents the feedback touches and run `invalidate` if needed), then continue the main loop for this runId.
```

- [ ] **Step 5: Commit**

```bash
npm run format
git add .claude/commands
git commit -m "feat(workflow): /plan-event coordinator with resume/approve/reject commands"
```

---

### Задача 9: Smoke-проверка в живом Claude Code

Выполняется в **новой** сессии `npm run claude` в корне Eventwright.

- [ ] **Step 1:** `/mcp` → `open-meteo` connected. `/agents` → 10 агентов. `/hooks` → 3 PreToolUse, 1 PostToolUse, 1 UserPromptSubmit. `npm run -s wf -- list` → `[]`.
- [ ] **Step 2: Поля payload hooks.** Временно добавить в `readHookInput` (`src/io/hook-io.ts`) сразу после чтения stdin строку `appendFileSync(path.join(projectDirectory(), ".hook-debug.log"), `${raw}\n`);` (импорты `node:fs`, `node:path`, `@/io/paths`).
  1. Набрать `/approve-event nope`. Expected: hook блокирует («Run 'nope' not found»); в `.hook-debug.log` видно поле с текстом (`prompt` или `prompt_text` — `parseHookInput` читает оба). Если текст пришёл в **другом** поле, поправить `parseHookInput` и `tests/lib/hook-input.test.ts`.
  2. Попросить Claude запустить subagent, который пишет файл. Expected: в payload PostToolUse есть `agent_type` с именем агента (`post-write-state` пишет его в лог как `writer`). Если поля нет — описать это в README (автором записи будет `coordinator`).
  Удалить отладку и `.hook-debug.log`.
- [ ] **Step 3: Guards.** Попросить Claude «write {} to runs/x/workflow-state.json» → отказ `state-integrity-guard`. Попросить «run /approve-event x» → отказ.
- [ ] **Step 4:** Всё найденное исправить (с тестом, если исправление в коде) и закоммитить `fix(workflow): …`.

---

### Задача 10: Сквозной отладочный прогон и доводка промптов

- [ ] **Step 1:** `/plan-event Birthday dinner for 20 people in Porto on 2027-05-22, budget 4000 EUR, one vegan guest.`
- [ ] **Step 2:** Проверить по ходу: уточнения задаются через AskUserQuestion; группа 4 (catering ∥ entertainment ∥ logistics) стартует **одним сообщением** с тремя вызовами Agent; `check` проходит; `validate` → `record-gates` работает; перед одобрением есть сводка; `/approve-event` → HTML создан; `no-leak-guard` не мешает нормальному тексту.
- [ ] **Step 3:** Проблемы поведения модели чинить в промптах agents/skills. Детерминированные проблемы чинить в коде с тестом. Каждую правку коммитить отдельно.
- [ ] **Step 4:** Удалить отладочный run: `rm -rf runs/<runId>`.

---

### Задача 11: Демонстрационные run (≥3, делаем 4) — вместе с пользователем

Каждый run — в чистой сессии. После run вручную добавить `runs/<runId>/SCENARIO.md`: цель сценария, что делал человек, чем закончилось, ключевые события из `workflow-state.json → log`.

- [ ] **Run A — happy path, климатология, параллельность.**
  `/plan-event 40th birthday dinner in Lisbon on 2027-06-12 for 30 guests. Budget 9000 EUR. Rooftop or garden restaurant, live acoustic music, 3 vegetarians and 1 gluten-free guest, one guest uses a wheelchair.`
  Ожидается: `Method: climatology-10y`; группа 4 параллельно; гейты PASS (допустим 1 retry); сразу `/approve-event`.

- [ ] **Run B — уточнения + отказ, затрагивающий upstream + повторное одобрение.**
  `/plan-event Organize our team's New Year party.` (нет города, даты, числа гостей, бюджета → уточнения).
  На одобрении: `/reject-event <runId> Use the second venue from the shortlist and add a photo booth.` Координатор должен вызвать `invalidate` для `venue-scout` и `entertainment-planner`. Кейтеринг, логистика и бюджет перегенерируются как downstream. Затем `/approve-event <runId>`.
  Ожидается в логе: `approval-rejected` → `invalidated` → `artifact-written` для 03–08 → `approval-approved`; в `approval.json.history` 2 раунда.

- [ ] **Run C — динамический выбор агентов + прерывание и возобновление + метод forecast.**
  `/plan-event Kids' birthday party (8 years old) in Barcelona on <дата через 7–10 дней от дня прогона>, 15 kids and 10 adults, outdoor park party, budget 1500 EUR. We will bring our own food and drinks.`
  Ожидается после `plan`: `- Services: venue, entertainment, logistics`, `catering-planner` = `skipped`, G5 = `n/a`, группа 4 = entertainment ∥ logistics.
  Во время группы 4 закрыть Claude Code (Ctrl+C дважды). Новая сессия: `/resume-event <runId>`.
  Ожидается: `Method: forecast`; в логе `execution-plan` и `resume`; `weather-analyst` и `venue-scout` с `attempts = 1`; прерванные агенты группы 4 с `attempts = 2`; в итоговом плане раздел Menu = «Not part of this plan»; run завершён.

- [ ] **Run D — нерешаемый провал гейта → остановка и отчёт.**
  `/plan-event Wedding for 150 guests in Paris on 2027-09-18. Total budget 5000 EUR. It MUST be in a château and MUST include a full seated dinner.`
  Ожидается: G7 (бюджет) проваливается 4 раза → `blocked`; synthesis, одобрение и HTML **не выполняются**; координатор выводит отчёт о провале. Нет `08-event-plan.md`, `approval.json`, `output/*`.

- [ ] `npm run -s wf -- list` → 4 run: A/B/C `done`, D `failed`.
- [ ] Commit:

```bash
npm run format
git add runs/
git commit -m "docs(runs): four sample runs — happy path, clarify+reject+revise, resume, blocked budget gate"
```

---

### Задача 12: Документация — CLAUDE.md и README.md

**Files:**
- Modify: `CLAUDE.md`
- Create: `README.md`

- [ ] **Step 1: `CLAUDE.md` — дописать разделы workflow.** Файл уже содержит обязательный префикс, описание, **Code style** и **Tooling** — их не удалять. Добавить:
  - **Commands:** `npm install`, `npm run claude`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm run -s wf -- list|status|next <runId>`; один тест-файл: `node --import tsx --test tests/lib/next-action.test.ts`.
  - **Workflow architecture:** таблица компонентов (команды, 10 агентов, 5 skills, 5 hooks, Open-Meteo MCP, CLI, `src/config/dag.ts`, `runs/`), фактический порядок групп `[formalizer] → clarify → execution plan → [weather] → [venue] → [catering ∥ entertainment ∥ logistics, только выбранные] → [budget] → validate → plan → validate → approval → html`, таблица гейтов (с правилом `n/a`).
  - **Execution rules (invariants):**
    1. The coordinator never writes content; only `wf next` decides the next step.
    2. Agents of one group are launched in a single message.
    3. `check` after every group; the next group starts only after its inputs pass.
    4. `workflow-state.json` and `approval.json` change only via the CLI and hooks.
    5. Approval = a human-typed `/approve-event <runId>` bound to the plan's sha256; any plan change revokes it.
    6. Retry limit 3 consecutive failures per gate / structural check / agent start without an artifact; beyond it the run stops with a report.
    7. Which service planners run is decided by the confirmed `- Services:` line and applied by `wf plan`; skipped agents are never started or invalidated.
    8. After a rejection, the coordinator invalidates upstream owners per the ownership table; downstream regenerates automatically.
    9. Never format or hand-edit `runs/**` (hashes).
    10. Changing `src/config/dag.ts` (agents, sections, requiredLines, gates) requires updating agents, `validator.md` and tests.
- [ ] **Step 2: `README.md`**:
  - Что это + пример входа/выхода (скриншот не обязателен; ссылка на `runs/<A>/output/event-plan.html`).
  - **Prerequisites:** Node ≥ 22, npm, Git, Claude Code (актуальная версия, выполнен вход в аккаунт).
  - **Setup:** `git clone https://github.com/vilkasts/Eventwright.git && cd Eventwright && npm install` → `npm run claude` (все настройки Claude Code — в `.claude/`) → принять доверие к проекту → `/mcp` показывает `open-meteo` connected.
  - **Environment / secrets:** секреты не нужны (объяснение из `.env.example`); `.env*` игнорируются.
  - **Run:** `/plan-event <description>`; ответы на уточнения.
  - **Approve / reject:** `/approve-event <runId>` / `/reject-event <runId> <feedback>`.
  - **Resume:** `/resume-event [runId]`, `npm run -s wf -- list`, `status <runId>`.
  - **Output:** `runs/<runId>/output/event-plan.{html,md}`; структура папки run (`input.md`, `clarifications.md`, `artifacts/`, `workflow-state.json`, `approval.json`, `output/`).
  - **Sample runs:** таблица 4 run со ссылками на их `SCENARIO.md`.
  - **How it works:** диаграмма потока + ссылки на CLAUDE.md.
- [ ] **Step 3:** `npm run lint && npm run format:check && npm run typecheck && npm test` → зелёное.
- [ ] **Step 4: Commit**

```bash
npm run format
git add CLAUDE.md README.md
git commit -m "docs: CLAUDE.md workflow rules and README setup/run/resume"
```

---

### Задача 13: Чистый checkout + чек-лист DoD + push

- [ ] **Step 1: Чистый клон**

```bash
git clone . ../Eventwright-clean && cd ../Eventwright-clean && npm install && npm run typecheck && npm run lint && npm test
```
Expected: всё зелёное, никаких секретов не требуется.

- [ ] **Step 2: Хэши демо-run не поехали**

```bash
node --import tsx -e "import { isApproved, readApproval } from '@/io/approval-store'; import { listRunIds } from '@/io/state-store'; for (const id of listRunIds()) console.log(id, readApproval(id) === null ? 'no-approval' : isApproved(id));"
```
Expected: `true` для A, B, C; `no-approval` для D.

- [ ] **Step 3:** В чистом клоне `npm run claude` → `/mcp` → `open-meteo` connected; `/plan-event …` доходит до уточнений. Удалить `../Eventwright-clean`.
- [ ] **Step 4: Секреты:** `git log -p | grep -iE "sk-ant-|api[_-]?key\s*=\s*\S"` → пусто.
- [ ] **Step 5: Одинаковая структура:** `grep "^## " runs/*/output/event-plan.md` → у A, B, C одинаковый список из 9 заголовков.
- [ ] **Step 6: Чек-лист DoD** (отметить со ссылкой на файл):
  - [ ] CLAUDE.md документирует workflow и правила → `CLAUDE.md`
  - [ ] ≥5 subagents + 1 координатор → 10 в `.claude/agents/` + `/plan-event`
  - [ ] Динамический выбор subagents → `state.plan` в Run C (`catering-planner` skipped)
  - [ ] ≥2 skills используются → 5 в `.claude/skills/`
  - [ ] PreToolUse и PostToolUse hooks используются → `.claude/settings.json`, `src/hooks/`
  - [ ] MCP-сервер интегрирован и используется → `.claude/mcp.json`, `weather-analyst`, `validator`
  - [ ] Web search используется → venue/catering/entertainment/logistics
  - [ ] Всё под версионным контролем → `git status` чистый
  - [ ] ≥3 run с входами, артефактами, состоянием → `runs/` (4)
  - [ ] README: setup/run/resume/prerequisites/env → `README.md`
  - [ ] Нет секретов → Step 4
  - [ ] Работает из чистого checkout → Steps 1–3
- [ ] **Step 7: Удалить этот временный план**

```bash
git rm -r docs/superpowers
git commit -m "chore: remove temporary implementation plan"
```

- [ ] **Step 8: Отправить на GitHub** (репозиторий `vilkasts/Eventwright` уже создан; push — после подтверждения пользователя)

```bash
git push origin main
```
Expected: ссылка из README (`git clone https://github.com/vilkasts/Eventwright.git`) открывается.

---

## Вне рамок

- PDF-вывод (выбраны HTML + Markdown).
- Реализация на Claude Agent SDK (выбрана slash-команда Claude Code; API-ключ не нужен).
- Собственный MCP-сервер (используется community Open-Meteo; web-данные через встроенные WebSearch/WebFetch).
- Бронирование или оплата у реальных поставщиков: workflow только планирует.
