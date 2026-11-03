# KAIDA.KZ: реестр экранов и состояний

Снимок: 03.11.2026. Версия атласа: 0.2.

База реализованного интерфейса: `dcd26adba9fe124a37a800df047810d6b30ae481`.
Принятые дополнения: Feature Map из PR #202 на `10a7cfd09d71f8236534f079f61857459859e717`.

[Открыть Miro](https://miro.com/app/board/uXjVES0IAlE=/)

Этот документ и вайрфреймы описывают интерфейс и трассировку. Они не меняют порядок разработки, закрытые контракты и не являются утверждённым новым визуальным эталоном.

Проверено чтением исходников: 19 файлов страниц; 79 frontend TS/TSX-файлов; 28 относящихся к работе Slice Contracts; русские подписи i18n. Дополнительно 03.11.2026 выполнена браузерная сверка пути покупателя на изолированном синтетическом стенде: поиск → предложение → вход → Избранное → выключение продавцом → недоступность. RU, 360×800; одно недоступное состояние также 320×800. Точный SHA исполняемого стенда через UI не подтверждён; сверка не заменяет приёмку baseline целиком.

Вайрфреймы показывают основные композиции; дополнительные состояния перечислены рядом с ними. Для наблюдавшегося пути добавлены 12 отдельных кадров с суффиксами. Для остальных условий наличие в реестре ещё не означает отдельный графический кадр.

## Статусы

- CODE: реализовано в указанной версии кода.
- FLAG: реализовано, но доступность зависит от конфигурации/сессии. Production seller text input остаётся выключен.
- TARGET: направление принято владельцем продукта, реализация и детали ещё требуют собственных контрактов.

## Охват

| ID | Роль | Экран / поверхность | Статус | Контекст |
|---|---|---|---|---|
| [B01](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209405661) | Покупатель | Первое посещение | CODE | `/welcome` |
| [B02](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209405662) | Покупатель | Главная поиска | CODE | `/` |
| [B03](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209405663) | Покупатель | Результаты поиска | CODE | `/?q=…` |
| [B04](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209405664) | Покупатель | Меню сортировки | CODE | `Поиск: anchored popover` |
| [B05](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209405665) | Покупатель | Товар есть, предложений нет | CODE | `/?q=…` |
| [B06](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209405666) | Покупатель | Неизвестный запрос | CODE | `/?q=…` |
| [B07](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209607957) | Покупатель | Рядом: текущая реализация | CODE | `/nearby` |
| [B08](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209607958) | Покупатель | Подробное предложение | CODE | `/offers/[id]` |
| [B09](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209607959) | Покупатель | Избранное | CODE | `/favourites` |
| [B10](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209607960) | Покупатель | Недоступное в Избранном | CODE | `/favourites: вариант карточки` |
| [B11](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209607961) | Покупатель | Ещё покупателя: baseline | CODE | `/more` |
| [B12](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209607962) | Покупатель | Жалоба: причина | FLAG | `Поверх /offers/[id]` |
| [B13](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608269) | Покупатель | Жалоба: фото и комментарий | FLAG | `Поверх /offers/[id]` |
| [B14](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608270) | Покупатель | Жалоба отправлена | FLAG | `Поверх /offers/[id]` |
| [A01](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608271) | Общий вход | Вход: телефон | CODE | `Общая модалка /login` |
| [A02](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608272) | Общий вход | Вход: код | CODE | `Общая модалка /login` |
| [S01](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608273) | Продавец | Моя витрина | CODE | `/seller` |
| [S02](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608274) | Продавец | Выбор способа ввода | CODE | `Sheet над витриной` |
| [S03](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608681) | Продавец | Новая карточка и черновик | CODE | `/seller?new=1 или ?draft=…` |
| [S04](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608682) | Продавец | Правка карточки во всех точках | CODE | `/seller?edit=…` |
| [S05](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608683) | Продавец | Правка предложения одной точки | CODE | `/seller?point=…` |
| [S06](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608684) | Продавец | Выбор торговых точек | CODE | `Sheet внутри редактора` |
| [S07](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608685) | Продавец | Цены по точкам | CODE | `Шаг новой карточки` |
| [S08](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209608686) | Продавец | Своя цена в новой карточке | CODE | `Шаг Цены по точкам` |
| [S09](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744152) | Продавец | Быстро создать точку из карточки | CODE | `Вложенный шаг редактора` |
| [S10](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744153) | Продавец | Предпросмотр: выбор точки | CODE | `Предпросмотр внутри редактора` |
| [S11](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744154) | Продавец | Предпросмотр карточки | CODE | `Предпросмотр / published preview` |
| [S12](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744155) | Продавец | Подтверждение изменений | CODE | `/seller/change-sets/[id]` |
| [S13](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744156) | Продавец | Конфликт при подтверждении | CODE | `Состояние Change Set` |
| [S14](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744157) | Продавец | Управление карточкой | CODE | `/seller?card=…` |
| [S15](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744486) | Продавец | Подтвердить актуальность | CODE | `/seller?actuality=1` |
| [S16](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744487) | Продавец | Системный архив | CODE | `/seller?archive=1` |
| [S17](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744488) | Продавец | Мои точки | CODE | `/seller/points` |
| [S18](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744489) | Продавец | Полная форма торговой точки | CODE | `/seller/points: add/edit` |
| [S19](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744490) | Продавец | Редактор режима работы | CODE | `Внутри формы торговой точки` |
| [S20](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744491) | Продавец | Подтверждение контакта точки | CODE | `Inline в форме точки` |
| [S21](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744848) | Продавец | Местоположение торговой точки | CODE | `Inline в Точках / форме` |
| [S22](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744849) | Продавец | Товары торговой точки | CODE | `/seller/points/[id]/products` |
| [S23](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744850) | Продавец | Ещё продавца | CODE | `/seller/more` |
| [S24](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744851) | Продавец | Ручной пакет изменений | CODE | `/seller/batch` |
| [S25](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744852) | Продавец | Ввод текстового списка | FLAG | `/seller/text-input` |
| [S26](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209744853) | Продавец | Разбор текста: общий экран | FLAG | `/seller/text-input/review` |
| [S27](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798451) | Продавец | Уже есть в точке: цена / дубль | FLAG | `Раздел текстового разбора` |
| [S28](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798452) | Продавец | Нет в наличии из текста | FLAG | `Раздел текстового разбора` |
| [S29](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798453) | Продавец | Возврат карточки из текста | FLAG | `Раздел Уже есть в точке` |
| [S30](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798454) | Продавец | Закрытие правки и удаление черновика | CODE | `Диалоги редакторов` |
| [O01](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798455) | Оператор | Пост-проверка карточек | CODE | `/operator` |
| [O02](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798456) | Оператор | Карточка у оператора | CODE | `/operator?card=…` |
| [O03](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798760) | Оператор | Снять карточку с витрины | CODE | `Шаг /operator` |
| [O04](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798761) | Оператор | Очередь жалоб | FLAG | `/operator/reports` |
| [O05](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798762) | Оператор | Рассмотрение жалобы | FLAG | `Внутри /operator/reports` |
| [O06](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798763) | Оператор | Подтверждение решения по жалобе | FLAG | `Внутри /operator/reports` |
| [T01](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798764) | Принятая цель | Принятая цель: поиск и навигация | TARGET | `Будущая композиция поиска` |
| [T02](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209798765) | Принятая цель | Принятая цель: сетка Рядом | TARGET | `Будущий /nearby` |
| [T03](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209941180) | Принятая цель | Принятая цель: Ещё покупателя | TARGET | `Будущий /more` |
| [T04](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689209941181) | Принятая цель | Принятые дополнения предложения | TARGET | `Будущий /offers/[id]` |
| [B03-R](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227058679) | Покупатель | Выдача: проверенная композиция | CODE | `/?q=…` |
| [B08-G](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227058680) | Покупатель | Предложение: гость | CODE | `/offers/[id]` |
| [B08-S](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227058681) | Покупатель | Предложение: сохранено после входа | CODE | `/offers/[id]` |
| [B09-A](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098095) | Покупатель | Избранное: доступное предложение | CODE | `/favourites` |
| [B09-E](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098096) | Покупатель | Избранное: пусто | CODE | `/favourites` |
| [B09-G](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098097) | Покупатель | Избранное: гостевой вход | CODE | `/favourites` |
| [B10-O](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098254) | Покупатель | Избранное: продавец выключил | CODE | `/favourites: вариант карточки` |
| [B08-U](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098255) | Покупатель | Прямая ссылка: недоступно | CODE | `/offers/[id]` |
| [A01-P](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098256) | Общий вход | Контекстный вход: телефон | CODE | `Общая модалка /login` |
| [A01-E](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098483) | Общий вход | Вход: неверный телефон | CODE | `Общая модалка /login` |
| [A02-C](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098484) | Общий вход | Вход: код и ожидание повтора | CODE | `Общая модалка /login` |
| [A02-E](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227098485) | Общий вход | Вход: неверный код | CODE | `Общая модалка /login` |

## B01. Первое посещение

Роль: Покупатель. Статус: **CODE**. Контекст: `/welcome`.
Вход: Первый визит без поискового запроса.

Содержание:

- РУ  /  ҚАЗ
- Найти нужный товар поблизости
- Что ищете?
- Искать
- Иллюстративный пример выдачи
- Демонстрационная карточка предложения
- Я продавец

Состояния и условия:

- Поиск ещё не начат
- Демонстрация играет / завершена
- Некорректный или пустой запрос
- Переход к результатам
- Вход перед переходом продавцу

Действия:

- Искать → B03.
- Я продавец → S01.

Текст заголовка и примеры сверять с i18n; геро-блок здесь схематический. Демонстрация не выдаётся за реальный ассортимент.

Источники:

- [src/app/(buyer)/_ui/FirstEntryScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/FirstEntryScreen.tsx)
- [Контракт first-entry-mobile](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/first-entry-mobile/SLICE_CONTRACT.md)
- [Контракт first-entry-correction](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/first-entry-correction/SLICE_CONTRACT.md)

## B02. Главная поиска

Роль: Покупатель. Статус: **CODE**. Контекст: `/`.
Вход: Возврат покупателя или завершение первого посещения.

Содержание:

- Что ищете?
- Популярные запросы из текущего набора
- Искать

Состояния и условия:

- Без запроса и без ленты
- Каталожные подсказки при вводе
- Выбрана подсказка / свободный запрос
- Восстановление предыдущей выдачи
- Ошибка ввода

Действия:

- Поиск по слову / подсказке → B03.
- Рядом → B07.
- Ещё → B11.

Запрос сам не создаёт товар каталога. Уровни подсказок не смешивать с результатами.

Источники:

- [src/app/(buyer)/_ui/SearchScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/SearchScreen.tsx)
- [Контракт search-home-last-state](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-home-last-state/SLICE_CONTRACT.md)
- [Контракт s15b3-buyer-autocomplete](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/s15b3-buyer-autocomplete/SLICE_CONTRACT.md)

## B03. Результаты поиска

Роль: Покупатель. Статус: **CODE**. Контекст: `/?q=…`.
Вход: Поиск по запросу или выбранному Product.

Содержание:

- Запрос  /  очистить  /  искать
- Популярные запросы
- По умолчанию  ·  порядок результатов
- Исправление опечатки, если применено
- Фото · название · цена за единицу · фасовка
- Точка · адрес · продавец · часы · актуальность
- Маршрут  /  доступные контакты
- Следующее предложение

Состояния и условия:

- Загрузка / скелетоны
- Непустая выдача
- Автоисправление + искать как введено
- Ошибка запроса с Повторить
- Неизвестная геопозиция
- Возврат из предложения с тем же запросом

Действия:

- Открыть предложение → B08.
- Выбрать порядок → B04.
- Нет результатов: товар известен → B05.
- Нет результатов: запрос неизвестен → B06.

Фото слева уже реализовано: ResultCard использует миниатюру 112×112 px. На стенде это подтверждено. Четыре нижние вкладки остаются целью T01; дальнейшие размеры и оформление требуют решения.

Источники:

- [src/app/(buyer)/_ui/SearchScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/SearchScreen.tsx)
- [src/app/(buyer)/_ui/buyer-ui.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/buyer-ui.tsx)
- [Контракт search-sort-control-refresh](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-sort-control-refresh/SLICE_CONTRACT.md)
- [Контракт search-typo-suggestions](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-typo-suggestions/SLICE_CONTRACT.md)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)

## B04. Меню сортировки

Роль: Покупатель. Статус: **CODE**. Контекст: `Поиск: anchored popover`.
Вход: Действие порядка выдачи.

Содержание:

- Порядок результатов
- По умолчанию
- По цене
- По расстоянию
- По актуальности
- Направление и текущий выбор показаны рядом

Состояния и условия:

- По умолчанию
- Цена: два направления
- Расстояние: два направления
- Актуальность: два направления
- Запрос геолокации для расстояния
- Отказ геолокации и пояснение

Действия:

- Выбор применяется сразу → B03.
- Вернуть По умолчанию → B03.

Это меню около контрола, не экран Фильтры и не bottom sheet. Отдельная кнопка Применить не добавляется.

Источники:

- [src/app/(buyer)/_ui/SortPopover.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/SortPopover.tsx)
- [Контракт search-sort-control-refresh](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-sort-control-refresh/SLICE_CONTRACT.md)
- [Контракт search-sort-distance](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-sort-distance/SLICE_CONTRACT.md)

## B05. Товар есть, предложений нет

Роль: Покупатель. Статус: **CODE**. Контекст: `/?q=…`.
Вход: Распознанный каталожный товар с нулём Offers.

Содержание:

- Название товара
- Сейчас нет предложений
- Товар есть в каталоге KAIDA
- Изменить запрос
- Посмотреть, что есть рядом

Состояния и условия:

- Известный товар / ноль предложений
- Сохраняется выбранный поисковый контекст

Действия:

- Изменить запрос → B02.
- Посмотреть рядом → B07.

Не превращать в неизвестный запрос и не обещать уведомления, которых нет. Отслеживание проверяется отдельно на B08.

Источники:

- [src/app/(buyer)/_ui/SearchScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/SearchScreen.tsx)
- [src/app/(buyer)/_ui/use-interest.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/use-interest.tsx)
- [Контракт search-empty-states](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-empty-states/SLICE_CONTRACT.md)
- [Контракт s15b2-known-zero](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/s15b2-known-zero/SLICE_CONTRACT.md)

## B06. Неизвестный запрос

Роль: Покупатель. Статус: **CODE**. Контекст: `/?q=…`.
Вход: Запрос не сопоставлен и выдача пуста.

Содержание:

- Запрос покупателя
- Ничего не найдено
- Проверьте написание или попробуйте другое слово
- Изменить запрос
- Посмотреть, что есть рядом

Состояния и условия:

- Без найденного Product
- Подсказанное исправление, если есть
- Искать исходный текст без исправления

Действия:

- Изменить запрос → B02.
- Рядом → B07.

Это обычное состояние поиска, не техническая страница 404.

Источники:

- [src/app/(buyer)/_ui/SearchScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/SearchScreen.tsx)
- [Контракт search-empty-states](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-empty-states/SLICE_CONTRACT.md)
- [Контракт search-typo-suggestions](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-typo-suggestions/SLICE_CONTRACT.md)

## B07. Рядом: текущая реализация

Роль: Покупатель. Статус: **CODE**. Контекст: `/nearby`.
Вход: Нажатие Рядом или явный запрос местоположения.

Содержание:

- Рядом с вами
- Показать товары рядом
- Результат после определения местоположения
- Подробная карточка ResultCard
- Название · цена · точка · адрес · часы
- Маршрут  /  контакты
- Обновить товары рядом

Состояния и условия:

- Геолокация ещё не включена
- Определяем местоположение
- Разрешено / есть предложения
- Отказ / таймаут / браузер не поддерживает
- Пустая выдача
- Ошибка загрузки и повтор

Действия:

- Открыть карточку → B08.
- К поиску → B02.

Цель с сеткой две карточки в ряд вынесена в T02. Карты и категорий в принятой цели нет.

Источники:

- [src/app/(buyer)/nearby/NearbyFeed.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/nearby/NearbyFeed.tsx)
- [Контракт nearby-result-first](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/nearby-result-first/SLICE_CONTRACT.md)
- [Контракт UX1C-nearby-geo-intent](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/UX1C-nearby-geo-intent/SLICE_CONTRACT.md)

## B08. Подробное предложение

Роль: Покупатель. Статус: **CODE**. Контекст: `/offers/[id]`.
Вход: Карточка из поиска / Рядом / Избранного или прямая ссылка.

Содержание:

- Галерея 0–5 фото / нейтральная заглушка
- Давность подтверждения продавцом
- Название товара
- Цена за единицу · фасовка  /  сердце
- Комментарий продавца, если есть
- Точка · адрес · расстояние · режим работы
- Маршрут  /  доступные контакты
- Продавец
- Отслеживать товар
- Пожаловаться, только при включённом флаге

Состояния и условия:

- Фото нет
- Фото не загрузилось + повтор
- Несколько фото / переходы галереи
- Гость / авторизован
- Сохранено / не сохранено
- Отслеживается / не отслеживается
- Нет каталожной связи: действия отслеживания нет
- Недоступное предложение / ошибка загрузки
- Предпросмотр продавца: иной набор действий

Действия:

- Сердце: гостю вход → A01.
- Избранное → B09.
- Пожаловаться, если включён флаг → B12.
- Вернуться к выдаче → B03.

Избранное сохраняет Offer+точку; отслеживание относится к Product. Это разные действия. Контакты и маршрут зависят от данных и прав доступа. Жалобы зависят от reportsEnabled(); на проверенном стенде флаг выключен.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerOfferView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerOfferView.tsx)
- [src/app/(buyer)/_ui/offer-details.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/offer-details.tsx)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт S13-interests](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/S13-interests/SLICE_CONTRACT.md)

## B09. Избранное

Роль: Покупатель. Статус: **CODE**. Контекст: `/favourites`.
Вход: Из меню Ещё в текущем UI; отдельная вкладка в принятой цели.

Содержание:

- Избранное
- Доступное предложение с текущими данными
- Вторая точка того же товара отдельной записью
- Убрать из избранного

Состояния и условия:

- Гость: вход вместо личного списка
- Загрузка
- Пусто + Найти товар
- Непустой список
- Ошибка загрузки / изменения
- Обновившаяся цена
- Недоступная запись B10

Действия:

- Предложение → B08.
- Гостевой вход → A01.
- Недоступная карточка → B10.
- Найти товар → B02.

Сохранения мест и отдельной вкладки Места нет. Удалённые и снятые оператором записи исключаются из видимого списка. В гостевом состоянии найдена неточность текста: «сохранить это предложение» при прямом открытии списка без выбранного предложения. Требуется решение по копирайтингу.

Источники:

- [src/app/(buyer)/favourites/FavouritesView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/FavouritesView.tsx)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)

## B10. Недоступное в Избранном

Роль: Покупатель. Статус: **CODE**. Контекст: `/favourites: вариант карточки`.
Вход: Сохранённый Offer выключен продавцом или просрочен.

Содержание:

- Сейчас недоступно
- Название · публичный продавец · название точки
- Без цены, адреса и торговых действий
- Убрать из избранного

Состояния и условия:

- Просрочено: обложка только при обычном разрешении media
- Выключено продавцом: нейтральная заглушка без URL фото
- Снова доступен тот же Offer: обычная карточка
- Удалён / снят оператором: не показывается

Действия:

- Убрать запись → B09.
- Назад к списку → B09.

Нет перехода в подробности, маршрута, контактов и отметки актуальности. Исключения не расширять на все виды недоступности.

Источники:

- [src/app/(buyer)/favourites/FavouritesView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/FavouritesView.tsx)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)

## B11. Ещё покупателя: baseline

Роль: Покупатель. Статус: **CODE**. Контекст: `/more`.
Вход: Нижняя вкладка Ещё.

Содержание:

- Ещё
- Войти / номер текущего аккаунта
- Избранное
- Русский  /  Қазақша
- Я продавец: моя витрина
- Выйти
- Тестовые данные: служебная подпись

Состояния и условия:

- Гость / вошёл
- Проверка сессии
- Выход выполняется
- Смена языка
- Контекстный вход при переходе продавцу

Действия:

- Избранное → B09.
- Войти → A01.
- Я продавец → S01.

Согласованные справка, поддержка и конфиденциальность показаны отдельно в T03.

Источники:

- [src/app/(buyer)/more/BuyerMore.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/more/BuyerMore.tsx)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)
- [Контракт inline-language](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/inline-language/SLICE_CONTRACT.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)

## B12. Жалоба: причина

Роль: Покупатель. Статус: **FLAG**. Контекст: `Поверх /offers/[id]`.
Вход: Пожаловаться на предложение.

Содержание:

- Пожаловаться на карточку
- Снимок предложения
- Цена не совпадает
- Фото не соответствует товару
- Неверное описание
- Другое

Состояния и условия:

- Загрузка контекста
- Ошибка контекста + повтор
- Нет фото: причина про фото недоступна
- Выбор причины переводит сразу

Действия:

- Выбрать причину → B13.
- Назад → B08.

Содержимое жалобы не передаётся продавцу. Доступ только при reportsEnabled(); на проверенном стенде флаг выключен. Браузерная проверка этой ветки не выполнялась. Доступ только при reportsEnabled(); на проверенном стенде флаг выключен. Браузерная проверка этой ветки не выполнялась.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerReportFlow.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerReportFlow.tsx)
- [src/app/(buyer)/offers/[id]/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/page.tsx)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## B13. Жалоба: фото и комментарий

Роль: Покупатель. Статус: **FLAG**. Контекст: `Поверх /offers/[id]`.
Вход: Причина уже выбрана.

Содержание:

- Комментарий / Какое фото?
- Выбранная причина
- Выбор спорного фото при нескольких фото
- Комментарий · необязательно · до 300 символов
- Не указывайте личные данные
- Сообщение увидит оператор
- Отправить жалобу

Состояния и условия:

- Фото выбирается только для причины про фото
- Одно фото: выбрано автоматически
- Вход при отправке с сохранённым черновиком
- После входа нужно явное Отправить
- Контекст изменился: проверить заново
- Лимит жалоб / ошибка отправки

Действия:

- Отправить → B14.
- Войти при необходимости → A01.
- Назад к причинам → B12.

После входа жалоба автоматически не отправляется. Доступ только при reportsEnabled(); на проверенном стенде флаг выключен. Браузерная проверка этой ветки не выполнялась. Доступ только при reportsEnabled(); на проверенном стенде флаг выключен. Браузерная проверка этой ветки не выполнялась.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerReportFlow.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerReportFlow.tsx)
- [src/app/(buyer)/offers/[id]/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/page.tsx)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## B14. Жалоба отправлена

Роль: Покупатель. Статус: **FLAG**. Контекст: `Поверх /offers/[id]`.
Вход: Сервер принял жалобу.

Содержание:

- Жалоба отправлена
- Спасибо, мы проверим предложение
- При повторе: первое сообщение сохранено
- Вернуться к карточке

Состояния и условия:

- Успех
- Уже отправляли ту же жалобу

Действия:

- К карточке → B08.

Этот экран не обещает автоматического снятия карточки или снижения рейтинга. Доступ только при reportsEnabled(); на проверенном стенде флаг выключен. Браузерная проверка этой ветки не выполнялась. Доступ только при reportsEnabled(); на проверенном стенде флаг выключен. Браузерная проверка этой ветки не выполнялась.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerReportFlow.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerReportFlow.tsx)
- [src/app/(buyer)/offers/[id]/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/page.tsx)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## A01. Вход: телефон

Роль: Общий вход. Статус: **CODE**. Контекст: `Общая модалка /login`.
Вход: Личное действие, вход из Ещё или переход продавцу.

Содержание:

- Вход в KAIDA.KZ
- Контекстное объяснение причины входа
- Телефон +7
- Получить код
- Закрыть

Состояния и условия:

- Телефон не заполнен / неверный
- Запрос выполняется
- Повторный запрос ограничен
- Ограничение источника
- Ошибка сети
- Отмена возвращает к исходному действию

Действия:

- Получить код → A02.
- Отмена: к исходному экрану → B08.

Единый аккаунт покупателя и продавца; номер входа не подставляется скрыто во все контакты.

Источники:

- [src/app/_components/AuthModal.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/_components/AuthModal.tsx)
- [Контракт UX1A2-auth-modal](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/UX1A2-auth-modal/SLICE_CONTRACT.md)
- [Контракт auth-otp-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-protection/SLICE_CONTRACT.md)
- [Контракт auth-otp-source-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-source-protection/SLICE_CONTRACT.md)

## A02. Вход: код

Роль: Общий вход. Статус: **CODE**. Контекст: `Общая модалка /login`.
Вход: Код запрошен для введённого телефона.

Содержание:

- Код для указанного номера
- Тестовый режим: код показан интерфейсом
- Код из 6 цифр
- Войти
- Изменить номер
- Новый код через N сек. / Запросить новый код

Состояния и условия:

- Ожидание ввода
- Проверка кода
- Неверный / истёкший код
- Попытки исчерпаны
- Повтор после таймера
- Вход успешен: контекстное возвращение

Действия:

- Изменить номер → A01.
- Возврат к личному действию → B08.

Тестовый OTP не изображается как работающая SMS-доставка. Путь возврата зависит от исходного намерения.

Источники:

- [src/app/_components/AuthModal.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/_components/AuthModal.tsx)
- [Контракт auth-otp-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-protection/SLICE_CONTRACT.md)
- [Контракт auth-otp-source-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-source-protection/SLICE_CONTRACT.md)

## S01. Моя витрина

Роль: Продавец. Статус: **CODE**. Контекст: `/seller`.
Вход: Переход в кабинет продавца.

Содержание:

- Моя витрина
- Сформировать карточки товаров
- Пора подтвердить актуальность
- Все · N  /  Черновики · N  /  Архив · N
- Фото · товар · цена · точки · статус
- Черновик: чего не хватает
- Разборы списков за 24 часа, если включён ввод

Состояния и условия:

- Гость / вход
- Пустая витрина
- Загрузка / ошибка
- Опубликовано / выключено
- Пора подтвердить / скрыто
- Снято оператором
- Черновики готовы / неполные
- Уведомление об успешном изменении

Действия:

- Добавить → S02.
- Карточка → S14.
- Черновик → S03.
- Актуальность → S15.
- Архив → S16.

Карточки группируются между точками; Offer остаётся предложением конкретной точки.

Источники:

- [src/app/seller/_components/SellerShowcase.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerShowcase.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт offer-actuality](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-actuality/SLICE_CONTRACT.md)

## S02. Выбор способа ввода

Роль: Продавец. Статус: **CODE**. Контекст: `Sheet над витриной`.
Вход: Сформировать карточки товаров.

Содержание:

- Как сформировать карточки?
- Доступность способов ввода
- Написать списком: только при включённом флаге
- Видео · временно недоступно
- Фото с AI · временно недоступно
- Голос · временно недоступно
- Заполнить вручную

Состояния и условия:

- Production: AI-ввод выключен
- Текст разрешён для сессии: отдельный рабочий пункт
- Видео / фото / голос выключены
- Закрытие выбора

Действия:

- Вручную → S03.
- Текст при разрешённом флаге → S25.
- Закрыть → S01.

Загрузка фото вручную работает в редакторе; это не AI-распознавание фотографии.

Источники:

- [src/app/seller/_components/SellerShowcase.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerShowcase.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт seller-ai-text-input](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-ai-text-input/SLICE_CONTRACT.md)

## S03. Новая карточка и черновик

Роль: Продавец. Статус: **CODE**. Контекст: `/seller?new=1 или ?draft=…`.
Вход: Вручную или открыть черновик.

Содержание:

- Фото: добавить · обложка · порядок · удалить
- Название + необязательная подсказка каталога
- Цена, ₸
- Цена за: кг / л / шт. / упак. / другое
- Фасовка: количество и единица при необходимости
- Комментарий · необязательно
- Торговые точки и число создаваемых предложений
- Как увидят покупатели
- Сохранить черновик / Проверить и опубликовать

Состояния и условия:

- Новая / сохранённый черновик
- Название свободное / связано с каталогом
- Ошибки полей и фокус на первой
- Без фото / загрузка / ошибка фото / 5 фото
- Нет точки: создать
- Несколько выбранных точек
- Сохранение / ошибка / конфликт
- Закрытие с несохранённым вводом / удаление черновика

Действия:

- Выбрать точки → S06.
- Быстрая новая точка → S09.
- Предпросмотр → S10.
- Проверить → S12.
- Закрыть / удалить → S30.

Название, цена, единица и точка обязательны для публикации. Фото и комментарий необязательны; отдельный чекбокс проверки AI не добавляется.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт card-price-packaging](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/card-price-packaging/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)

## S04. Правка карточки во всех точках

Роль: Продавец. Статус: **CODE**. Контекст: `/seller?edit=…`.
Вход: Из опубликованной карточки.

Содержание:

- Общие фото
- Общее название
- Общая цена и единица
- Фасовка
- Общий комментарий
- Какие точки затронет цена
- Добавить в другие точки
- Как увидят покупатели
- Проверить изменения

Состояния и условия:

- Общие поля / свои цены по точкам
- Предыдущая цена
- Точка со своей ценой не затёрта молча
- Добавление точки к этому товару
- Нет изменений
- Ошибка / устаревшая версия

Действия:

- Правка точки → S18.
- Предпросмотр → S10.
- Подтверждение → S12.

Общие название, фото и комментарий не становятся разными товарами по точкам.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт seller-card-point-link](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-card-point-link/SLICE_CONTRACT.md)

## S05. Правка предложения одной точки

Роль: Продавец. Статус: **CODE**. Контекст: `/seller?point=…`.
Вход: Из строки конкретной точки в карточке.

Содержание:

- Изменить только в этой точке
- Товар · выбранная торговая точка
- Цена в этой точке
- Общие сведения товара
- Проверить изменения

Состояния и условия:

- Своя цена / общее значение
- Нет изменения цены
- Изменено с другого устройства
- Ошибка отправки

Действия:

- Проверить → S12.
- К карточке → S14.

Точные доступные поля задаёт mode point; не добавлять самостоятельные фото, название и комментарий этой точки.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-offer-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-offer-editor/SLICE_CONTRACT.md)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)

## S06. Выбор торговых точек

Роль: Продавец. Статус: **CODE**. Контекст: `Sheet внутри редактора`.
Вход: Торговые точки в новой карточке.

Содержание:

- Торговые точки
- Выбрать все / отдельные точки
- Название точки · адрес · изменить точку
- Добавить торговую точку
- Будет создано N предложений
- Готово

Состояния и условия:

- Нет точек
- Одна точка
- Несколько / все / ни одной
- Новая точка создана и выбрана
- Возврат из правки точки с сохранённой карточкой

Действия:

- Новая точка → S09.
- Изменить точку → S18.
- К редактору → S03.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)

## S07. Цены по точкам

Роль: Продавец. Статус: **CODE**. Контекст: `Шаг новой карточки`.
Вход: Выбрано несколько точек.

Содержание:

- Цены по точкам
- Общие: товар · цена · фото · комментарий
- Точка A · как у всех
- Точка B · своя цена
- Будет создано N предложений
- Готово

Состояния и условия:

- Все используют общую цену
- У отдельных точек своя цена

Действия:

- Открыть цену точки → S08.
- Вернуться в редактор → S03.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)

## S08. Своя цена в новой карточке

Роль: Продавец. Статус: **CODE**. Контекст: `Шаг Цены по точкам`.
Вход: Выбор точки в списке цен.

Содержание:

- Название торговой точки
- Название товара · общее
- Цена этой точки, ₸
- Вернуть общее значение
- Цена за · фото · комментарий: общие
- Сохранить

Состояния и условия:

- Общая цена / своё значение
- Своя цена стала равна общей: сброс отличия

Действия:

- Сохранить и вернуться → S07.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)

## S09. Быстро создать точку из карточки

Роль: Продавец. Статус: **CODE**. Контекст: `Вложенный шаг редактора`.
Вход: В карточке ещё нет нужной точки.

Содержание:

- Новая торговая точка
- Название для покупателей
- Где находится точка + подсказки адреса
- Тип точки
- Имя продавца · если профиля ещё нет
- Остальное можно заполнить позже
- Сохранить точку

Состояния и условия:

- Профиль ещё не создан
- Каталожный адрес / свободный ввод
- Нет подсказок / ошибка справочника
- Ошибки названия и адреса
- Сохранение / ошибка
- Возврат без потери карточки

Действия:

- Сохранить точку → S03.
- Назад без потери ввода → S03.

Этот краткий шаг не заменяет полную форму контактов и режима работы S18.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт address-directory](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/address-directory/SLICE_CONTRACT.md)

## S10. Предпросмотр: выбор точки

Роль: Продавец. Статус: **CODE**. Контекст: `Предпросмотр внутри редактора`.
Вход: Как увидят покупатели, если точек несколько.

Содержание:

- Предпросмотр карточки
- Черновик / изменения ещё не видны покупателям
- Точка A · цена · адрес
- Точка B · своя цена
- Вернуться к редактированию

Состояния и условия:

- Несколько точек: выбор
- Одна точка: сразу S11
- Не хватает обязательных данных
- Ошибка сборки предпросмотра

Действия:

- Выбрать точку → S11.
- Редактировать → S03.

Источники:

- [src/app/seller/_components/CardPreviewScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardPreviewScreen.tsx)
- [Контракт pre-publication-buyer-preview](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/pre-publication-buyer-preview/SLICE_CONTRACT.md)

## S11. Предпросмотр карточки

Роль: Продавец. Статус: **CODE**. Контекст: `Предпросмотр / published preview`.
Вход: Выбрана точка или открыта опубликованная карточка.

Содержание:

- Предпросмотр: покупатели пока не видят изменения
- Галерея / заглушка
- Название · цена · фасовка
- Комментарий
- Точка · адрес · режим · контакты
- До публикации кнопки связи и маршрута не работают
- Редактировать / Перейти к публикации

Состояния и условия:

- До публикации: черновик
- До публикации: покупатели видят прежнее
- После публикации: реальная buyer-страница с возвратом
- Ошибки / незаполненные поля
- Несколько точек

Действия:

- К редактору → S03.
- К списку точек предпросмотра → S10.
- Проверить публикацию → S12.

Опубликованный preview и приватный предпросмотр до публикации имеют разные ограничения действий.

Источники:

- [src/app/seller/_components/CardPreviewScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardPreviewScreen.tsx)
- [src/app/(buyer)/offers/[id]/BuyerOfferView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerOfferView.tsx)
- [Контракт pre-publication-buyer-preview](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/pre-publication-buyer-preview/SLICE_CONTRACT.md)
- [Контракт post-publication-buyer-preview](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/post-publication-buyer-preview/SLICE_CONTRACT.md)

## S12. Подтверждение изменений

Роль: Продавец. Статус: **CODE**. Контекст: `/seller/change-sets/[id]`.
Вход: Подготовлен Change Set из редактора / текста / пакета.

Содержание:

- Проверьте карточку / изменения
- Точка · товар · фасовка · единица
- Старая цена → новая / статус до → после
- Фото и комментарий по типу действия
- Покупатели увидят только после подтверждения
- Ответственность продавца при публикации без предварительной модерации
- Подтвердить / Отмена

Состояния и условия:

- Создание карточки
- Изменение / включение / выключение
- Пакет: все действия вместе
- Без фото: напоминание, публикация разрешена
- Pending / сохранённое подтверждение
- Успех / уже подтверждено
- Ошибка без применения
- Конфликт версии S13

Действия:

- Подтвердить → S01.
- Отмена: вернуться к исходному редактору → S03.
- К разбору текста → S26.
- Конфликт → S13.

Никакие изменения Offers не применяются от самого просмотра. Контекстный возврат зависит от источника.

Источники:

- [src/app/seller/change-sets/[id]/_components/SellerConfirmChange.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/change-sets/[id]/_components/SellerConfirmChange.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт S12-batch-seller-input](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/S12-batch-seller-input/SLICE_CONTRACT.md)
- [Контракт text-switch-on](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-switch-on/SLICE_CONTRACT.md)

## S13. Конфликт при подтверждении

Роль: Продавец. Статус: **CODE**. Контекст: `Состояние Change Set`.
Вход: Данные изменились во время проверки.

Содержание:

- Предложение уже изменилось
- Мы ничего не применили
- Сейчас в предложении
- Ваша правка
- Обновить и проверить заново
- Вернуться к правке

Состояния и условия:

- Изменена цена
- Изменён статус / точка / версия
- Весь пакет отклонён
- После stale/refused текстовый выбор сброшен

Действия:

- Проверить заново → S03.
- Вернуться к текстовому разбору → S26.

Источники:

- [src/app/seller/change-sets/[id]/_components/SellerConfirmChange.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/change-sets/[id]/_components/SellerConfirmChange.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт text-price-update](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-price-update/SLICE_CONTRACT.md)
- [Контракт text-switch-on](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-switch-on/SLICE_CONTRACT.md)

## S14. Управление карточкой

Роль: Продавец. Статус: **CODE**. Контекст: `/seller?card=…`.
Вход: Открыть опубликованную карточку или архивную запись.

Содержание:

- Фото / заглушка
- Товар · фасовка
- Статус и актуальность
- Точки: цены · доступность · своя цена
- Как видят покупатели
- Товар есть, цена та же / Выключить / Включить
- Изменить во всех точках
- Изменить только в этой точке

Состояния и условия:

- На витрине
- Выключено
- Просрочено / архивировано
- Снято оператором + причина / комментарий
- Одна / несколько точек
- Pending / ошибка операции

Действия:

- Редактировать общие → S04.
- Только точка → S05.
- Предпросмотр → S11.
- Изменение статуса → S12.
- Подтвердить актуальность → S15.

Выключение продавцом и снятие оператором имеют разные пути восстановления.

Источники:

- [src/app/seller/_components/SellerShowcase.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerShowcase.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт offer-actuality](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-actuality/SLICE_CONTRACT.md)
- [Контракт operator-post-check](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/operator-post-check/SLICE_CONTRACT.md)

## S15. Подтвердить актуальность

Роль: Продавец. Статус: **CODE**. Контекст: `/seller?actuality=1`.
Вход: Задача на витрине / напоминание.

Содержание:

- Актуальность · N
- Проверьте наличие и цены
- Товар · точка · цена · давность
- Товар есть, цена та же / Изменить
- Как работает актуальность
- Всё актуально · N

Состояния и условия:

- Нет ожидающих карточек
- Пора подтвердить
- Скрыто до подтверждения
- Одно действие / допустимый пакет
- Ошибка сети
- Успех и исчезновение задачи

Действия:

- Изменить товар → S04.
- Вернуться → S01.

Пакетное подтверждение не подменяет проверку наличия продавцом. Число N берётся из допустимого набора.

Источники:

- [src/app/seller/_components/ActualityScreens.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/ActualityScreens.tsx)
- [Контракт offer-actuality](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-actuality/SLICE_CONTRACT.md)
- [Контракт actuality-reminders](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/actuality-reminders/SLICE_CONTRACT.md)

## S16. Системный архив

Роль: Продавец. Статус: **CODE**. Контекст: `/seller?archive=1`.
Вход: Архивный чип на витрине.

Содержание:

- Архив · N
- Карточки без подтверждения 14 дней
- Товар · дата последнего подтверждения
- Открыть карточку для возврата или правки

Состояния и условия:

- Пустой архив
- Системно архивированные карточки
- Возврат через актуальность / правку

Действия:

- Открыть карточку → S14.
- К витрине → S01.

Это существующий ограниченный список. Ручное архивирование, удаление через 30 дней и полноценный жизненный цикл не объявляются готовыми.

Источники:

- [src/app/seller/_components/ActualityScreens.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/ActualityScreens.tsx)
- [Контракт offer-actuality](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-actuality/SLICE_CONTRACT.md)

## S17. Мои точки

Роль: Продавец. Статус: **CODE**. Контекст: `/seller/points`.
Вход: Вкладка Точки.

Содержание:

- Мои точки
- Добавить торговую точку
- Название · адрес · местоположение
- Контакты · подтверждение · режим работы
- Изменить / Товары точки
- После создания: добавить товары или позже

Состояния и условия:

- Нет точек
- Одна / несколько
- Загрузка / ошибка
- Точка только что создана
- Нет координат
- Контакт ждёт подтверждения
- Режим требует проверки

Действия:

- Добавить / изменить → S18.
- Товары точки → S22.
- Местоположение → S21.

Источники:

- [src/app/seller/_components/SellerTradingPoints.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTradingPoints.tsx)
- [Контракт seller-trading-points-workspace](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-trading-points-workspace/SLICE_CONTRACT.md)
- [Контракт seller-card-point-link](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-card-point-link/SLICE_CONTRACT.md)

## S18. Полная форма торговой точки

Роль: Продавец. Статус: **CODE**. Контекст: `/seller/points: add/edit`.
Вход: Добавление / правка из Точек или карточки.

Содержание:

- Имя продавца · при необходимости
- Название для покупателей
- Адрес + подсказки
- Тип торговой точки
- Моё местоположение / Ввести вручную
- Телефон · необязательно
- WhatsApp · необязательно
- Telegram · необязательно
- Режим работы
- Сохранить точку

Состояния и условия:

- Новая / существующая точка
- Пустые контакты допустимы
- Номер входа / уже подтверждённый / новый
- Изменён адрес: координаты не меняются молча
- Режим скопирован / требуется проверка
- Ошибка в полях / сохранении
- Закрытие с несохранённым вводом

Действия:

- Режим работы → S19.
- Подтвердить номер → S20.
- Местоположение → S21.
- Сохранить → S17.
- Отмена с изменениями → S30.

Контакты и часы принадлежат точке и действуют для всех её предложений. Telegram-сохранение не означает подключение публичного канала связи.

Источники:

- [src/app/seller/_components/SellerTradingPoints.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTradingPoints.tsx)
- [src/app/seller/_components/PointDetailsFields.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/PointDetailsFields.tsx)
- [Контракт point-contacts-hours](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/point-contacts-hours/SLICE_CONTRACT.md)
- [Контракт seller-trading-points-workspace](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-trading-points-workspace/SLICE_CONTRACT.md)
- [Контракт contact-default](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/contact-default/SLICE_CONTRACT.md)

## S19. Редактор режима работы

Роль: Продавец. Статус: **CODE**. Контекст: `Внутри формы торговой точки`.
Вход: Задать часы для группы дней.

Содержание:

- Режим работы
- Ежедневно / По будням / Выбрать дни
- Работает / Выходной / Не указано
- Промежуток с … до …
- Добавить перерыв
- Какие дни изменятся, какие сохранятся
- Применить / Отмена
- Затем сохранить торговую точку

Состояния и условия:

- Не указано отличается от закрыто
- Круглосуточно
- Несколько интервалов
- Часы через полночь
- Пересечения / ошибки
- Несохранённый шаблон

Действия:

- Применить в форму точки → S18.

Источники:

- [src/app/seller/_components/PointDetailsFields.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/PointDetailsFields.tsx)
- [Контракт point-contacts-hours](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/point-contacts-hours/SLICE_CONTRACT.md)
- [Контракт card-opening-hours](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/card-opening-hours/SLICE_CONTRACT.md)

## S20. Подтверждение контакта точки

Роль: Продавец. Статус: **CODE**. Контекст: `Inline в форме точки`.
Вход: Внесён новый телефон / WhatsApp.

Содержание:

- Телефон / WhatsApp и состояние подтверждения
- Подтвердить
- Код отправлен на указанный номер: тестовый режим
- Код из 6 цифр
- Подтвердить номер
- Отправить код ещё раз

Состояния и условия:

- Номер входа / подтверждён ранее: без нового кода
- Новый номер: скрыт покупателям
- Код запрошен
- Неверный / истёкший
- Ошибка запроса
- Успех: контакт виден

Действия:

- К форме точки → S18.

Это подтверждение контакта торговой точки, не повторный вход в аккаунт. Telegram имеет отдельную ещё не подключённую механику.

Источники:

- [src/app/seller/_components/PointDetailsFields.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/PointDetailsFields.tsx)
- [Контракт point-contacts-hours](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/point-contacts-hours/SLICE_CONTRACT.md)
- [Контракт contact-default](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/contact-default/SLICE_CONTRACT.md)

## S21. Местоположение торговой точки

Роль: Продавец. Статус: **CODE**. Контекст: `Inline в Точках / форме`.
Вход: Задать или обновить координаты точки.

Содержание:

- Где находится торговая точка
- Использовать моё местоположение
- Я сейчас на точке: запрос разрешения
- Координаты или поддерживаемая ссылка на карту
- Проверка распознанного местоположения
- Подтвердить

Состояния и условия:

- Координаты уже есть / нет
- Запрос разрешения
- Отказ / таймаут / не поддерживается
- Ручной ввод / предварительный просмотр
- Неверный формат / ошибка сохранения
- Адрес обновлён, координаты прежние

Действия:

- Сохранить координаты → S17.
- К форме → S18.

Справочник адресов не заменяет ручной ввод. Покупателю не показывать технические координаты текстом.

Источники:

- [src/app/seller/_components/SellerTradingPoints.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTradingPoints.tsx)
- [Контракт seller-location-geo-fallback](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md)
- [Контракт address-directory](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/address-directory/SLICE_CONTRACT.md)

## S22. Товары торговой точки

Роль: Продавец. Статус: **CODE**. Контекст: `/seller/points/[id]/products`.
Вход: Товары точки в списке точек.

Содержание:

- Товары точки · N
- Название и адрес точки
- Добавить товары
- Товары, связанные с этой точкой

Состояния и условия:

- Загрузка / ошибка
- Точка не найдена / чужая
- Нет товаров
- Список товаров
- Выбор способа добавить в эту точку

Действия:

- Карточка → S14.
- Добавить → S02.
- Назад к точкам → S17.

Источники:

- [src/app/seller/_components/SellerPointProducts.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerPointProducts.tsx)
- [Контракт seller-trading-points-workspace](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-trading-points-workspace/SLICE_CONTRACT.md)

## S23. Ещё продавца

Роль: Продавец. Статус: **CODE**. Контекст: `/seller/more`.
Вход: Вкладка Ещё в кабинете.

Содержание:

- Ещё
- Номер входа
- Добавить списком
- Напоминания об актуальности на этом устройстве
- Русский / Қазақша
- Я покупатель: поиск товаров
- Выйти

Состояния и условия:

- Гость / вошёл
- Push не поддерживается
- Push выключен / включён / запрещён
- Нет Secure Context
- Выход: приватные данные исчезают
- Ошибка действия

Действия:

- Пакет изменений → S24.
- Поиск покупателя → B02.
- Вход → A01.

Пункт Добавить списком ведёт в существующий ручной batch, а не в AI-текст. Напоминания продавца не равны уведомлениям покупателя.

Источники:

- [src/app/seller/_components/SellerMore.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerMore.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт inline-language](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/inline-language/SLICE_CONTRACT.md)
- [Контракт actuality-reminders](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/actuality-reminders/SLICE_CONTRACT.md)

## S24. Ручной пакет изменений

Роль: Продавец. Статус: **CODE**. Контекст: `/seller/batch`.
Вход: Добавить списком из Ещё продавца.

Содержание:

- Изменить несколько товаров
- Минимум два изменения применятся вместе
- Действие: создать / изменить / выключить / включить
- Товар каталога / существующее предложение
- Торговая точка для нового
- Цена и комментарий по типу действия
- Не менять / Добавить изменение
- Проверить весь пакет

Состояния и условия:

- Нет точки
- Загрузка предложений / ошибка
- Разные типы изменений
- Неверная цена / нет точки
- Минимум два элемента
- Переход в атомарное подтверждение

Действия:

- Проверить пакет → S12.
- Создать точку → S18.
- Назад → S23.

Историческая поверхность сохраняется в атласе; не смешивать её с текстовым разбором и его фасовками.

Источники:

- [src/app/seller/_components/SellerBatchChangeSetCreate.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerBatchChangeSetCreate.tsx)
- [Контракт S12-batch-seller-input](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/S12-batch-seller-input/SLICE_CONTRACT.md)

## S25. Ввод текстового списка

Роль: Продавец. Статус: **FLAG**. Контекст: `/seller/text-input`.
Вход: Рабочий текстовый пункт при разрешённом флаге.

Содержание:

- Текстовый список
- Перечислите товары, цены и единицы
- Товары добавятся в точку: выбрать
- Список товаров: многострочное поле
- Разобрать в черновики
- Заполнить вручную

Состояния и условия:

- Недоступен при выключенном флаге
- Нет точки: создать с возвратом текста
- Точка выбрана / не выбрана
- Пустой / недопустимый текст
- Разбираем
- Сервис недоступен / ошибка / повтор

Действия:

- Разобрать → S26.
- Создать точку → S18.
- Вручную → S03.

Реализовано за флагом; production off. Сам ввод не публикует Offers.

Источники:

- [src/app/seller/_components/SellerTextInput.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTextInput.tsx)
- [Контракт seller-ai-text-real-parser](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-ai-text-real-parser/SLICE_CONTRACT.md)
- [Контракт seller-ai-text-input](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-ai-text-input/SLICE_CONTRACT.md)

## S26. Разбор текста: общий экран

Роль: Продавец. Статус: **FLAG**. Контекст: `/seller/text-input/review`.
Вход: Ответ парсера или восстановленный разбор за 24 часа.

Содержание:

- Черновики из текста
- Исходный текст, если доступен в сессии
- Точка и сводка результатов
- Новые товары: исправляемые черновики
- Уже есть в точке: совпадения и различия
- Нет в наличии: кандидаты на выключение
- Не распознано / Возможно, пропущено
- К витрине

Состояния и условия:

- Загрузка / ошибка
- Разбор истёк или не принадлежит пользователю
- Черновики готовы / не готовы
- Часть опубликована / удалена
- Исходный текст утрачен: явное пояснение
- Смешанный список
- Ожидающие подтверждения / изменения данных

Действия:

- Исправить черновик → S03.
- Совпадения и цены → S27.
- Нет в наличии → S28.
- Возврат выключенного → S29.
- К витрине → S01.

Результат доступен 24 часа; сами черновики остаются. Отдельные S27–S29 ниже являются разделами этого экрана, не новыми маршрутами.

Источники:

- [src/app/seller/_components/SellerTextInputReview.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTextInputReview.tsx)
- [Контракт seller-ai-text-real-parser](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-ai-text-real-parser/SLICE_CONTRACT.md)
- [Контракт text-availability](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-availability/SLICE_CONTRACT.md)
- [Контракт text-duplicates](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-duplicates/SLICE_CONTRACT.md)
- [Контракт text-price-update](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-price-update/SLICE_CONTRACT.md)
- [Контракт text-switch-on](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-switch-on/SLICE_CONTRACT.md)

## S27. Уже есть в точке: цена / дубль

Роль: Продавец. Статус: **FLAG**. Контекст: `Раздел текстового разбора`.
Вход: В тексте найден возможный кандидат существующего товара.

Содержание:

- Уже есть в точке · N
- Слова из текста и исходные фрагменты
- Различия названия, фасовки, единицы и цены
- Одна строка → одна выбранная карточка
- При конфликте сначала выбрать цену
- Обновить цены · N
- Это другой товар: создать черновик
- Открыть карточку / подтверждение

Состояния и условия:

- Один точный кандидат: ограниченный предвыбор
- Несколько кандидатов: ручной выбор
- Фасовка неизвестна / отличается
- Разные цены в одной строке
- Возможно, слиты несколько товаров
- Без изменений
- Stale/refused: выбрать заново
- Две цены для одной карточки: отказ
- Pending: открыть подтверждение

Действия:

- Изменить цену → S12.
- Другой товар → черновик → S03.
- Открыть карточку → S14.
- К разбору → S26.

Совпадение не доказывает тождество товара. Нельзя обновлять все похожие карточки одной строкой.

Источники:

- [src/app/seller/_components/SellerTextHeld.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTextHeld.tsx)
- [Контракт text-duplicates](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-duplicates/SLICE_CONTRACT.md)
- [Контракт text-price-update](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-price-update/SLICE_CONTRACT.md)

## S28. Нет в наличии из текста

Роль: Продавец. Статус: **FLAG**. Контекст: `Раздел текстового разбора`.
Вход: Распознано сообщение об отсутствии.

Содержание:

- Нет в наличии · N
- Фрагмент текста
- Совпадающие предложения только выбранной точки
- Другая фасовка: не изменится
- Ничего не выключится до подтверждения
- Выключить отмеченные · N
- Открыть подтверждение

Состояния и условия:

- Нет совпадений
- Одна / несколько фасовок
- Указанная фасовка не распознана: без предвыбора
- На витрине / выключено раньше
- Ждёт подтверждения / выключено этим списком
- Изменились данные: отметки очищены

Действия:

- Подтвердить выключение → S12.
- К товарам точки → S22.
- К разбору → S26.

Выключение обратимо; ничего не удаляется и не архивируется из этой команды.

Источники:

- [src/app/seller/_components/SellerTextAvailability.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTextAvailability.tsx)
- [Контракт text-availability](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-availability/SLICE_CONTRACT.md)

## S29. Возврат карточки из текста

Роль: Продавец. Статус: **FLAG**. Контекст: `Раздел Уже есть в точке`.
Вход: Текст предлагает товар, чья карточка выключена.

Содержание:

- Вернуть на витрину
- Карточка выбранной точки: выключено
- Итоговая цена из текста / по цене карточки
- Выбрать допустимое предложение
- Другие точки не изменятся
- Вернуть на витрину · N
- Открыть ожидающее подтверждение

Состояния и условия:

- Та же цена
- Новая цена + включение атомарно
- Нет цены в тексте: цена карточки
- Нет допустимой цены: ручная правка
- Противоречие нет + предложение
- Другое pending действие блокирует эту карточку
- Stale: выбрать заново
- Восстановление pending после отмены / reload

Действия:

- Подтвердить возврат → S12.
- Исправить вручную → S05.
- К разбору → S26.

Ни распознавание, ни выбор кандидата не включают Offer сами.

Источники:

- [src/app/seller/_components/SellerTextHeld.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTextHeld.tsx)
- [Контракт text-switch-on](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/text-switch-on/SLICE_CONTRACT.md)

## S30. Закрытие правки и удаление черновика

Роль: Продавец. Статус: **CODE**. Контекст: `Диалоги редакторов`.
Вход: Закрытие с изменениями / удалить сохранённый черновик.

Содержание:

- Закрыть без сохранения?
- Что именно будет потеряно: карточка или правка точки
- Продолжить правку
- Закрыть
- Отдельный вариант: удалить этот черновик
- Удалить / Отмена

Состояния и условия:

- Несохранённая карточка
- Несохранённая точка поверх карточки
- Удаление сохранённого черновика
- Удаление выполняется / ошибка

Действия:

- Продолжить карточку → S03.
- Продолжить точку → S18.
- Закрыть редактор → S01.

Подтверждение удаления черновика не означает удаление опубликованного предложения.

Источники:

- [src/app/seller/_components/CardEditor.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/CardEditor.tsx)
- [src/app/seller/_components/SellerTradingPoints.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/_components/SellerTradingPoints.tsx)
- [Контракт seller-showcase-editor](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-showcase-editor/SLICE_CONTRACT.md)
- [Контракт seller-card-point-link](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/seller-card-point-link/SLICE_CONTRACT.md)

## O01. Пост-проверка карточек

Роль: Оператор. Статус: **CODE**. Контекст: `/operator`.
Вход: Доступен назначенному оператору.

Содержание:

- Пост-проверка
- Новые / Все
- Жалобы · N, если включены
- Фото · товар · тип события · время
- Статус проверки / снятия
- Показать ещё

Состояния и условия:

- Нет прав: обычная 404
- Загрузка / ошибка
- Нет карточек
- Новые / изменённые / повторно опубликованные
- Догрузка

Действия:

- Открыть карточку → O02.
- Жалобы → O04.

Текущая операторская часть RU-only. Это существующий локальный доступ, не спроектированный новый Backoffice.

Источники:

- [src/app/operator/_components/OperatorApp.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/_components/OperatorApp.tsx)
- [Контракт operator-post-check](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/operator-post-check/SLICE_CONTRACT.md)

## O02. Карточка у оператора

Роль: Оператор. Статус: **CODE**. Контекст: `/operator?card=…`.
Вход: Выбор карточки из ленты или жалобы.

Содержание:

- Все доступные фото
- Название · фасовка
- Комментарий продавца
- Телефон продавца: только оператору
- Точки: название · адрес · цена · включено
- Если снята: причина и комментарий
- Снять с витрины / Вернуть на витрину

Состояния и условия:

- Загрузка / ошибка
- Обычная карточка
- Снята оператором
- Ошибка действия
- Возврат на витрину

Действия:

- Снять → O03.
- Вернуться в ленту → O01.

Источники:

- [src/app/operator/_components/OperatorApp.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/_components/OperatorApp.tsx)
- [Контракт operator-post-check](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/operator-post-check/SLICE_CONTRACT.md)

## O03. Снять карточку с витрины

Роль: Оператор. Статус: **CODE**. Контекст: `Шаг /operator`.
Вход: Снять с витрины.

Содержание:

- Снять с витрины
- Товар и обложка
- Товар нельзя размещать
- Фото не соответствует товару
- Контакты или реклама / Другое
- Комментарий продавцу · необязательно
- Карточка исчезнет у покупателей во всех точках
- Отмена / Снять с витрины

Состояния и условия:

- Причина выбрана
- Комментарий до 300 символов
- Отправка / ошибка
- Успех с возвратом

Действия:

- Подтвердить снятие → O02.
- Отмена → O02.

Источники:

- [src/app/operator/_components/OperatorApp.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/_components/OperatorApp.tsx)
- [Контракт operator-post-check](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/operator-post-check/SLICE_CONTRACT.md)

## O04. Очередь жалоб

Роль: Оператор. Статус: **FLAG**. Контекст: `/operator/reports`.
Вход: Жалобы у оператора при включённой функции.

Содержание:

- Жалобы
- Открытые · N / Закрытые
- Сначала самые ранние
- Снимок предложения · причина · дата · итог
- Рассмотреть
- Показать ещё

Состояния и условия:

- Функция off / нет прав: 404
- Загрузка / ошибка
- Пусто
- Открытые / закрытые
- Пагинация

Действия:

- Рассмотреть → O05.
- Лента карточек → O01.

Источники:

- [src/app/operator/reports/OperatorReports.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/reports/OperatorReports.tsx)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## O05. Рассмотрение жалобы

Роль: Оператор. Статус: **FLAG**. Контекст: `Внутри /operator/reports`.
Вход: Рассмотреть жалобу.

Содержание:

- Жалоба
- Причина · время · состояние
- При отправке: сохранённые данные
- Сейчас: текущая карточка и доступность
- Спорное фото, если указано
- Сообщение покупателя: только оператору
- Исторический итог для закрытой жалобы
- Обновить жалобу
- Снять / Без снятия / Уже снята / Вернуть

Состояния и условия:

- Карточка изменилась после жалобы
- Текущие данные недоступны
- Карточка уже снята
- Жалоба закрыта: исторический итог неизменен
- Позднее возвратили / переопубликовали
- Ошибка / устаревшее решение

Действия:

- Принять решение → O06.
- Текущая карточка → O02.
- К списку → O04.

Текст покупателя и отдельный комментарий продавцу не смешиваются.

Источники:

- [src/app/operator/reports/OperatorReports.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/reports/OperatorReports.tsx)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## O06. Подтверждение решения по жалобе

Роль: Оператор. Статус: **FLAG**. Контекст: `Внутри /operator/reports`.
Вход: Выбран вариант решения.

Содержание:

- Решение по жалобе
- Причина снятия, если снимаем
- Отдельный комментарий продавцу, если снимаем
- Обоснование: только оператору
- Снятие действует на карточку во всех точках
- Подтвердить и закрыть жалобу

Состояния и условия:

- Снять: нужна причина
- Без снятия / вернуть: нужно обоснование
- Уже снята: иная обязательность полей
- Конкурирующее изменение: отказ и обновление
- Успех: исторический итог

Действия:

- Подтвердить → O05.
- Отмена → O05.

Источники:

- [src/app/operator/reports/OperatorReports.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/reports/OperatorReports.tsx)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## T01. Принятая цель: поиск и навигация

Роль: Принятая цель. Статус: **TARGET**. Контекст: `Будущая композиция поиска`.
Вход: Решения PO от 03.11.2026.

Содержание:

- Поисковый запрос
- Существующее меню сортировки
- Небольшое фото слева · название · цена
- Точка · адрес · продавец · актуальность
- Маршрут / доступные контакты
- Поиск / Рядом / Избранное / Ещё

Состояния и условия:

- Четыре нижние вкладки приняты
- Список поиска сохраняется
- Направления сортировок сохраняются
- Фото/fallback и читаемость сохраняются

Действия:

- Подробное предложение → B08.
- Рядом: целевая сетка → T02.
- Избранное → B09.
- Ещё: цель → T03.

Фото слева уже есть в baseline и подтверждено на стенде; это сохраняемый паттерн, а не новая функция. Четыре нижние вкладки и дальнейшее оформление остаются принятой целью и требуют своего slice.

Источники:

- [docs/product/FEATURE_MAP.md](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/10a7cfd09d71f8236534f079f61857459859e717/docs/product/FEATURE_MAP.md)
- [Контракт search-sort-control-refresh](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-sort-control-refresh/SLICE_CONTRACT.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)

## T02. Принятая цель: сетка Рядом

Роль: Принятая цель. Статус: **TARGET**. Контекст: `Будущий /nearby`.
Вход: Решения PO от 03.11.2026.

Содержание:

- Рядом с вами
- Явный запрос геолокации
- Фото · название · цена | Фото · название · цена
- Актуальность · расстояние | Актуальность · расстояние
- Поиск / Рядом / Избранное / Ещё

Состояния и условия:

- Сетка по две карточки
- Загрузка / пусто / отказ геолокации требуют кадров
- Адрес, продавец, часы, контакты и маршрут в деталях
- Нет карты, категорий, выбора города и района

Действия:

- Открыть предложение → B08.
- Поиск → T01.

Точные размеры и состояния новой сетки предстоит согласовать; схематический кадр не заменяет визуальную приёмку.

Источники:

- [docs/product/FEATURE_MAP.md](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/10a7cfd09d71f8236534f079f61857459859e717/docs/product/FEATURE_MAP.md)
- [Контракт nearby-result-first](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/nearby-result-first/SLICE_CONTRACT.md)

## T03. Принятая цель: Ещё покупателя

Роль: Принятая цель. Статус: **TARGET**. Контекст: `Будущий /more`.
Вход: Решения PO от 03.11.2026.

Содержание:

- Войти / текущий аккаунт / выйти
- Русский / Қазақша
- Я продавец
- Как работает KAIDA
- Написать в поддержку: Telegram
- Конфиденциальность
- Уведомления: отдельная проработка
- Поиск / Рядом / Избранное / Ещё

Состояния и условия:

- Справка: черновик, финальный текст не принят
- Поддержка: username пока не задан
- Конфиденциальность: документ и URL не готовы
- Уведомления: нет событий, каналов и настроек

Действия:

- Кабинет продавца → S01.
- Избранное: отдельная вкладка → B09.

Не вставлять выдуманные контакты и юридический текст. Положение уведомлений ещё не определено.

Источники:

- [docs/product/FEATURE_MAP.md](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/10a7cfd09d71f8236534f079f61857459859e717/docs/product/FEATURE_MAP.md)
- [Контракт inline-language](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/inline-language/SLICE_CONTRACT.md)

## T04. Принятые дополнения предложения

Роль: Принятая цель. Статус: **TARGET**. Контекст: `Будущий /offers/[id]`.
Вход: Решения PO от 03.11.2026.

Содержание:

- Галерея
- До суток: минуты / часы; затем дни
- Название · цена · сердце под фотографией
- Данные точки и доступные действия
- Поделиться ссылкой на предложение
- Отслеживать товар
- Пожаловаться

Состояния и условия:

- Источник времени: подтверждение продавца
- Поделиться: системная отправка / fallback ещё не определены
- Отслеживание и Избранное сохраняют разные смыслы
- Рейтинги и отзывы не введены

Действия:

- Избранное → B09.
- Жалоба → B12.

Новые данные времени и поведение отправки ссылки требуют отдельных контрактов.

Источники:

- [docs/product/FEATURE_MAP.md](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/10a7cfd09d71f8236534f079f61857459859e717/docs/product/FEATURE_MAP.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт buyer-offer-reports](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-offer-reports/SLICE_CONTRACT.md)

## B03-R. Выдача: проверенная композиция

Роль: Покупатель. Статус: **CODE**. Контекст: `/?q=…`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Баранина / очистить / искать
- Популярные запросы
- По умолчанию
- Слева фото или fallback 112×112; справа название, цена 4 200 ₸/кг, точка и адрес
- Актуальность продавца; часы работы
- Маршрут / доступные контакты

Состояния и условия:

- Одна найденная тестовая карточка
- Фото-заглушка уже слева
- Нижняя навигация: Поиск / Рядом / Ещё

Действия:

- Открыть предложение → B08-G.

Пример выдачи с синтетическими данными. Проверено положение фото; это не новый дизайн карточки.

Источники:

- [src/app/(buyer)/_ui/SearchScreen.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/SearchScreen.tsx)
- [src/app/(buyer)/_ui/buyer-ui.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/buyer-ui.tsx)
- [Контракт search-sort-control-refresh](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-sort-control-refresh/SLICE_CONTRACT.md)
- [Контракт search-typo-suggestions](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/search-typo-suggestions/SLICE_CONTRACT.md)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)

## B08-G. Предложение: гость

Роль: Покупатель. Статус: **CODE**. Контекст: `/offers/[id]`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Фото или нейтральная заглушка
- Давность подтверждения продавцом
- Баранина
- 4 200 ₸/кг / пустое сердце
- Точка / адрес / часы / продавец
- Маршрут / доступные контакты
- Отслеживать товар

Состояния и условия:

- Сердце не нажато
- Жалобы на стенде выключены
- Отслеживание и Избранное раздельны

Действия:

- Нажать сердце → A01-P.
- Назад к результатам → B03-R.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerOfferView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerOfferView.tsx)
- [src/app/(buyer)/_ui/offer-details.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/offer-details.tsx)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт S13-interests](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/S13-interests/SLICE_CONTRACT.md)

## B08-S. Предложение: сохранено после входа

Роль: Покупатель. Статус: **CODE**. Контекст: `/offers/[id]`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Фото или нейтральная заглушка
- Давность подтверждения продавцом
- Баранина
- 4 200 ₸/кг / заполненное сердце
- Точка / адрес / часы / продавец
- Маршрут / доступные контакты
- Отслеживать товар

Состояния и условия:

- Модальное окно входа закрывается
- Сохраняется именно выбранное предложение
- Сердце: «В избранном», aria-pressed=true

Действия:

- Ещё → Избранное → B09-A.
- Отменить сохранение → B08.

Связь Offer+точка сохранена после успешного входа. Удаление в авторизованной сессии меняет только сохранение, а не статус входа.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerOfferView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerOfferView.tsx)
- [src/app/(buyer)/_ui/offer-details.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/offer-details.tsx)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт S13-interests](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/S13-interests/SLICE_CONTRACT.md)

## B09-A. Избранное: доступное предложение

Роль: Покупатель. Статус: **CODE**. Контекст: `/favourites`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Избранное
- Фото/fallback · название · текущая цена
- Точка · адрес · продавец · актуальность
- Убрать из избранного

Состояния и условия:

- Предложение открывается из личного списка
- Назад возвращает в Избранное
- Последняя запись удалена → пустой список

Действия:

- Открыть с возвратом в список → B08-S.
- Удалить последнюю запись → B09-E.
- Продавец выключил карточку → B10-O.

У перехода на подробное предложение сохраняется return=/favourites. Отдельной вкладки Избранное в baseline ещё нет.

Источники:

- [src/app/(buyer)/favourites/FavouritesView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/FavouritesView.tsx)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)

## B09-E. Избранное: пусто

Роль: Покупатель. Статус: **CODE**. Контекст: `/favourites`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Избранное
- Пустой список: ещё нет сохранённых предложений
- Найти товар

Состояния и условия:

- Получено после удаления последней записи
- Личный список пуст; пользователь авторизован

Действия:

- Найти товар → B02.

Источники:

- [src/app/(buyer)/favourites/FavouritesView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/FavouritesView.tsx)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)

## B09-G. Избранное: гостевой вход

Роль: Покупатель. Статус: **CODE**. Контекст: `/favourites`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Войдите, чтобы открыть избранное
- Войдите, чтобы сохранить это предложение и видеть своё избранное.
- Войти

Состояния и условия:

- Прямое открытие /favourites без входа
- Личные записи не показываются
- Повторно проверено после выхода

Действия:

- Войти → A01.

Текущий текст сохранён дословно. Найдена неточность: «это предложение» при открытии списка без выбранной карточки. A01-P показывает вход с намерением сохранить; для входа из списка такое намерение передавать нельзя.

Источники:

- [src/app/(buyer)/favourites/FavouritesView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/FavouritesView.tsx)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)

## B10-O. Избранное: продавец выключил

Роль: Покупатель. Статус: **CODE**. Контекст: `/favourites: вариант карточки`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Избранное
- Нейтральное фото · название · точка · продавец
- Сейчас недоступно
- Убрать из избранного

Состояния и условия:

- Переход доступно → выключено наблюдался
- Нет цены, адреса, актуальности, маршрута и контактов
- Нет ссылки на подробное предложение
- 320 px: переполнения по ширине не наблюдалось; Убрать 258×44 px

Действия:

- Убрать последнюю запись → B09-E.
- Прямая старая ссылка → B08-U.

Проверена только причина seller-off. Просрочка, удаление и снятие оператором здесь не проходились. Это ограниченная проверка одного состояния, не полная проверка доступности интерфейса.

Источники:

- [src/app/(buyer)/favourites/FavouritesView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/FavouritesView.tsx)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)

## B08-U. Прямая ссылка: недоступно

Роль: Покупатель. Статус: **CODE**. Контекст: `/offers/[id]`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Предложение больше недоступно
- Сообщение о недоступности предложения
- К поиску

Состояния и условия:

- Прямая ссылка на выключенное предложение
- Цена, контакты и содержимое предложения скрыты

Действия:

- К поиску → B02.

Проверено после выключения собственной синтетической карточки, без параметра seller preview.

Источники:

- [src/app/(buyer)/offers/[id]/BuyerOfferView.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/BuyerOfferView.tsx)
- [src/app/(buyer)/_ui/offer-details.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/_ui/offer-details.tsx)
- [Контракт buyer-screens-mockup](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md)
- [Контракт offer-photos](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-photos/SLICE_CONTRACT.md)
- [Контракт offer-favourites](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/offer-favourites/SLICE_CONTRACT.md)
- [Контракт S13-interests](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/S13-interests/SLICE_CONTRACT.md)

## A01-P. Контекстный вход: телефон

Роль: Общий вход. Статус: **CODE**. Контекст: `Общая модалка /login`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Вход поверх предложения
- Номер телефона +7
- Получить код
- Закрыть / отменить

Состояния и условия:

- Открыт нажатием сердца гостем
- Отмена закрывает окно
- При отмене сердце остаётся не нажатым

Действия:

- Получить код → A02-C.
- Неверный телефон → A01-E.
- Отмена → B08-G.

Конкретный телефон и действительный одноразовый код в схему не включены. Использовался только тестовый вход без SMS.

Источники:

- [src/app/_components/AuthModal.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/_components/AuthModal.tsx)
- [Контракт UX1A2-auth-modal](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/UX1A2-auth-modal/SLICE_CONTRACT.md)
- [Контракт auth-otp-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-protection/SLICE_CONTRACT.md)
- [Контракт auth-otp-source-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-source-protection/SLICE_CONTRACT.md)

## A01-E. Вход: неверный телефон

Роль: Общий вход. Статус: **CODE**. Контекст: `Общая модалка /login`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Вход
- Номер телефона +7 1
- Введите корректный номер телефона.
- Получить код
- Закрыть

Состояния и условия:

- Короткий телефон отклонён
- Ошибка рядом с полем
- Намерение сохранить предложение остаётся в контексте

Действия:

- Исправить и запросить код → A02-C.
- Отмена → B08-G.

Источники:

- [src/app/_components/AuthModal.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/_components/AuthModal.tsx)
- [Контракт UX1A2-auth-modal](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/UX1A2-auth-modal/SLICE_CONTRACT.md)
- [Контракт auth-otp-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-protection/SLICE_CONTRACT.md)
- [Контракт auth-otp-source-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-source-protection/SLICE_CONTRACT.md)

## A02-C. Вход: код и ожидание повтора

Роль: Общий вход. Статус: **CODE**. Контекст: `Общая модалка /login`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Введите код
- Код для синтетического тестового номера
- Одноразовый код
- На тестовом стенде код показан интерфейсом
- Таймер перед повторным запросом
- Подтвердить
- Изменить номер / закрыть

Состояния и условия:

- Успешный вход завершает выбранное сохранение
- Сеть SMS не использовалась
- Повторная отправка по таймеру отдельно не проверялась

Действия:

- Верный код: сохранить предложение → B08-S.
- Неверный код → A02-E.
- Изменить номер → A01-P.

Состояние таймера наблюдалось; это не проверка истечения таймера, resend или срока жизни кода.

Источники:

- [src/app/_components/AuthModal.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/_components/AuthModal.tsx)
- [Контракт auth-otp-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-protection/SLICE_CONTRACT.md)
- [Контракт auth-otp-source-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-source-protection/SLICE_CONTRACT.md)

## A02-E. Вход: неверный код

Роль: Общий вход. Статус: **CODE**. Контекст: `Общая модалка /login`.
Вход: Наблюдалось 03.11.2026 на изолированном стенде, RU, 360×800..

Содержание:

- Введите код
- 000000
- Неверный код.
- Таймер повторного запроса
- Подтвердить
- Изменить номер / закрыть

Состояния и условия:

- Один неверный код отклонён
- После исправления вход выполнен
- Сохранение не происходит до успеха входа

Действия:

- Исправить код: сохранено → B08-S.
- Изменить номер → A01-P.

Блокировка за много попыток и лимиты в этом прогоне не проверялись.

Источники:

- [src/app/_components/AuthModal.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/_components/AuthModal.tsx)
- [Контракт auth-otp-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-protection/SLICE_CONTRACT.md)
- [Контракт auth-otp-source-protection](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/docs/slices/auth-otp-source-protection/SLICE_CONTRACT.md)

## Выполненная браузерная сверка, 03.11.2026

[Раздел со снимками и состояниями в Miro](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227058038).

- PASS: выдача по популярному запросу; открытие предложения; отмена входа без сохранения; неверный телефон; неверный код; успешный тестовый вход и сохранение именно выбранного Offer+точки.
- PASS: открытие из Избранного и возврат в свой список; удаление последней записи и пустое состояние; прямой гостевой вход в список после выхода.
- PASS: отдельная собственная синтетическая карточка опубликована вручную, сохранена покупателем, выключена продавцом. В списке остаются название, точка, продавец и «Сейчас недоступно»; цена, адрес, актуальность, контакты, маршрут и ссылка на детали скрыты. Прямая ссылка показывает недоступность.
- LIMITED: в состоянии seller-off при ширине 320 px не наблюдалось горизонтального переполнения; кнопка удаления 258×44 px. Это не проверка доступности всего приложения.
- CORRECTED IN ATLAS: фото слева уже реализовано; buyer reports B12–B14 зависят от флага. На проверенном стенде жалобы выключены.
- OPEN COPY ISSUE: гостевое Избранное говорит «сохранить это предложение», когда предложение не выбрано. Текущий текст сохранён в baseline, решение не подменено вымышленной формулировкой.
- CLEANUP: тестовые сохранения удалены; созданная карточка выключена; выполнен выход. Синтетическая торговая точка остаётся. Исходные карточки продавцов не менялись. Тестовый номер, OTP и внутренние идентификаторы в этот реестр не включены.

Подробный журнал: `docs/design/BUYER_BROWSER_AUDIT_2026-11-03.md`. Вне прогона: SMS, resend/истечение кода, галерея с реальными фото, просрочка, модерация, удаление Offer, жалобы, KK, клавиатура/фокус, 200% текста и полная responsive-матрица.

## Проверка сквозных сценариев

Ниже перечислены связи для ручной проверки будущего макета. Это не утверждение о выполненной браузерной приёмке.

1. B01/B02 → B03 → B08 → A01/A02 → сохранение конкретного предложения → B09 → B08 с возвратом в свой список. Отмена входа не должна сохранять предложение.
2. B09 → выключение/просрочка на стороне продавца → B10 → удаление из своего списка. Снятие оператором и удаление Offer не превращаются в видимую карточку B10.
3. B08 → B12 → B13 → A01/A02 при отправке → явная повторная отправка → B14 → B08. Черновик сохраняется, текст покупателя не передаётся продавцу.
4. S01 → S02 → S03 → S09 при отсутствии точки → S03 с сохранёнными полями → S10/S11 → S12 → S01. До подтверждения публичный Offer не появляется.
5. S17 → S18 → S19/S20/S21 → S18 → сохранение → S17. Учитывать возврат в карточку, когда точка открыта оттуда.
6. S25 → S26 → S27/S28/S29 → S12 → возврат в S26; отмена, reload, pending и stale имеют явные исходы.
7. O01 → O02 → O03 → O02. Снятие действует на карточку во всех точках, не на одну её строку.
8. O04 → O05 → O06 → исторический итог. Последующая перепубликация карточки не переписывает закрытую жалобу.

## Открытые вопросы и границы передачи

- GAP-01: браузерная сверка выполнена частично: путь поиска, входа, Избранного и seller-off. Жалобы, просрочка, удаление Offer, снятие оператором и остальные роли ещё не проверены этим прогоном.
- GAP-02: добавлены 12 отдельных кадров наблюдавшихся состояний; не все остальные состояния имеют собственные графические кадры. Для конкретной передачи дизайнеру отмечать кадр для каждого существенного состояния, а общие загрузки/ошибки переиспользовать.
- GAP-03: responsive baseline и масштаб текста 200% описаны требованиями проекта; эти схемы не являются проверкой адаптивной реализации. Нужны конкретные кадры mobile/tablet/desktop там, где меняется компоновка.
- GAP-04: казахские подписи предварительные. Вайрфреймы на русском, но переход между RU/KK и длинные строки должны входить в дизайн-проверку.
- GAP-05: точные кадры целевой сетки Рядом, параметры Поделиться и формат давности подтверждения требуют собственных решений/контрактов.
- GAP-06: Telegram поддержки, окончательный текст справки и документ конфиденциальности не заданы. Не заполнять вымышленными данными.
- GAP-07: события/каналы/настройки уведомлений покупателю и репутационная политика не определены; их экранов в baseline нет.
- GAP-08: голос выбран следующим направлением, но его новый контракт ещё готовится отдельно. Здесь отражён только существующий отключённый способ ввода; новый голосовой UX не утверждён.
- GAP-09: не проектируются полный Backoffice, платежи, Pro/Boost/Business, публичное видео и будущие отзывы; текущие операторские поверхности перечислены полностью по прочитанным frontend-файлам.

## Правила обновления

1. Зафиксировать новый baseline SHA и scope обновления.
2. Сопоставить изменённые routes/components/contracts с ID этого реестра.
3. Добавить/изменить содержимое, условия показа и переходы; сохранить старые ID.
4. Обновить соответствующие кадры Miro и ссылки.
5. Проверить покрытие в обе стороны: требование → кадр/состояние; элемент кадра → источник/явный вопрос.
6. Пройти затронутый сквозной сценарий; записать кто и где действительно проверял.
7. Принятую цель превращать в CODE только после реализации и закрытия соответствующего slice.

## Страницы и перенаправления

| Файл страницы | Поверхности / назначение |
|---|---|
| [src/app/(buyer)/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/page.tsx) | B02–B06; первый визит перенаправляется на /welcome |
| [src/app/(buyer)/welcome/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/welcome/page.tsx) | B01 |
| [src/app/(buyer)/login/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/login/page.tsx) | A01/A02 над оболочкой покупателя |
| [src/app/(buyer)/nearby/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/nearby/page.tsx) | B07 |
| [src/app/(buyer)/offers/[id]/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/offers/[id]/page.tsx) | B08, B12–B14 |
| [src/app/(buyer)/favourites/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/favourites/page.tsx) | B09/B10 |
| [src/app/(buyer)/more/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/(buyer)/more/page.tsx) | B11 |
| [src/app/seller/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/page.tsx) | S01 и встроенные query-состояния S02–S16, S30 |
| [src/app/seller/offers/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/offers/page.tsx) | Перенаправление на /seller с сохранением поддержанных параметров |
| [src/app/seller/offers/new/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/offers/new/page.tsx) | Перенаправление на /seller?new=1 |
| [src/app/seller/points/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/points/page.tsx) | S17–S21 |
| [src/app/seller/points/[id]/products/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/points/[id]/products/page.tsx) | S22 |
| [src/app/seller/more/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/more/page.tsx) | S23 |
| [src/app/seller/batch/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/batch/page.tsx) | S24 |
| [src/app/seller/text-input/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/text-input/page.tsx) | S25; доступ зависит от флага |
| [src/app/seller/text-input/review/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/text-input/review/page.tsx) | S26–S29; доступ зависит от флага |
| [src/app/seller/change-sets/[id]/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/seller/change-sets/[id]/page.tsx) | S12/S13 |
| [src/app/operator/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/page.tsx) | O01–O03; для остальных 404 |
| [src/app/operator/reports/page.tsx](https://github.com/RashRosh/KAIDA.KZ-2.0/blob/dcd26adba9fe124a37a800df047810d6b30ae481/src/app/operator/reports/page.tsx) | O04–O06; права и флаг обязательны |

