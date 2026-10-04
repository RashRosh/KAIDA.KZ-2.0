# KAIDA.KZ 2.0 — Security automation triggers

Этот документ фиксирует только security / supply-chain automation, которую нужно включать по мере появления соответствующей инфраструктуры. Это не roadmap продукта и не основание преждевременно добавлять инструменты.

## Активно сейчас

- **CodeQL** — анализ JavaScript / TypeScript на PR в `main`, push в `main` и еженедельно. Security failure считается blocker до merge.
- **Dependency Review** — проверяет новые/изменённые зависимости в PR. `high` и `critical` vulnerability должны ронять workflow и блокировать merge по процессу.
- **OpenSSF Scorecard** — периодический аудит supply-chain/security posture. Запускается еженедельно, вручную и после изменений `.github/**`, `package.json` или `pnpm-lock.yaml`. Его общий score сам по себе не является product gate; конкретная найденная уязвимость классифицируется отдельно.

## Отложенные инструменты и триггеры

| Триггер | Что добавить | Обязательность |
|---|---|---|
| В репозитории появляется production `Dockerfile` или container image начинает использоваться для deployment | **Trivy** для image/dependency vulnerabilities + **Hadolint** для Dockerfile | До первого production deploy контейнера |
| Начинаем публиковать release artifact или container image в registry как воспроизводимый релиз | **Syft / SBOM** | До первого такого production release |
| Release artifacts/images становятся отдельным доверенным каналом поставки, где нужна доказуемая provenance | **SLSA provenance** | До включения такого release channel в production process |
| Архитектурные boundaries начинают регулярно нарушаться и их можно выразить статическими правилами | **Semgrep** с собственными KAIDA rules | Только при наличии конкретных правил; не ставить как второй generic scanner |
| Нужна независимая вторая проверка dependency vulnerabilities сверх GitHub Dependency Review / Dependabot | **OSV Scanner** | Опционально, только по измеримой необходимости |

## Правило срабатывания

Как только один из триггеров выше становится фактически истинным, исполнитель обязан **до соответствующего production deploy / release**:

1. остановить инфраструктурный шаг;
2. создать маленькую maintenance-задачу на нужную automation;
3. установить только инструмент(ы), относящиеся к сработавшему триггеру;
4. прогнать их на актуальном `main`;
5. зафиксировать результат в PR/CI evidence;
6. только после green/принятого результата продолжить deploy/release.

Не устанавливать весь набор заранее. Цель — закрывать реальный risk flag без лишнего CI noise и обслуживания.
