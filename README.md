# Golos Notify Service

Сервис уведомлений для проектов на блокчейне Golos Blockchain. Позволяет:
- показывать всплывающие уведомления о различных действиях пользователей (например, "alice отблагодарила вас 1.000 GOLOS")
- мгновенно отображать личные сообщения в мессенджерах, чатах и т.д. на основе [Golos Messenger](https://github.com/golos-blockchain/golos-js/tree/master/doc#private-messages)

## Разворачивание своей копии сервиса

**Примечание:** Необходимо лишь в том случае, если вас не устраивает https://notify.golos.today/, требуется внести какие-то изменения, или принять участие в разработке самого сервиса. В ином случае используйте API (см. ниже).

### Сборка

Сервису требуются [Docker](https://docs.docker.com/engine/install/) и [Docker-Compose](https://docs.docker.com/compose/install/).

```bash
docker-compose build
```

### Запуск

```bash
docker-compose up
```

## Для контрибьюторов

### Тестирование 

dataserver покрыт тестами Cypress. Для запуска тестов требуются [Node.js 16](https://github.com/nodesource/distributions/blob/master/README.md) и Cypress, установленный по [инструкции](https://docs.cypress.io/guides/getting-started/installing-cypress).

```bash
cd dataserver
npm install
npm test
```

### Доступ к Tarantool

Tarantool запускается на 3301 порту.

Для осмотра содержимого БД Tarantool при разработке, тестировании и диагностике можно пользоваться консолью:

```bash
$ docker-compose exec datastore tarantoolctl connect 3301
```

## API для разработчиков

Все запросы и ответы имеют формат JSON.
В случае успеха все запросы возвращают объект, содержащий поле `"status": "ok"`, а в случае ошибки - `"status": "err"`, поле `error`, содержащее текст ошибки, и HTTP-статус ошибки:
- 429 (слишком много запросов с вашего IP - более 240 (в т. ч. OPTIONS) в 1 минуту),
- 404 (неверный маршрут или метод запроса),
- 500 (внутренняя ошибка сервера),
- 400 (любые другие ошибки).

**Примечание:** Большинство запросов API требуют авторизацию аккаунтов в сервисе. Для авторизации ваш клиент, использующий сервис, должен быть в белом списке сервиса. Для использования API в своем клиенте следует обратиться к сообществу с целью добавления вашего клиента (его доменного имени) в этот список, или же развернуть свою копию данного сервиса.

Хранение состояния авторизации осуществляется в заголовке `X-Session` (который играет роль cookies), поэтому при каждом запросе следует сохранять в localStorage значение данного заголовка ответа (но если заголовка в ответе нет, то очищать НЕ следует), а при каждом запросе добавлять сохраненное значение к запросу.

Примеры работы с API (используя Fetch и async-await) можно найти в тестах:  
https://github.com/golos-blockchain/golosnotify/blob/dev/dataserver/cypress/support/index.js  
https://github.com/golos-blockchain/golosnotify/tree/dev/dataserver/cypress/integration

#### `POST /login_account` - авторизация аккаунта пользователя.

Для того, чтобы пользователь мог получать большинство уведомлений, ему нужно будет авторизоваться в вашем клиенте, используя для этого данный маршрут API.

Авторизация осуществляется в 2 этапа.

Этап 1. Сделать POST-запрос с телом `{"account": "имя аккаунта"}`, в ответе будут поля:
- `login_challenge` - рандомная строка, необходимая для этапа 2
- `already_authorized` - если какой-то аккаунт с данным X-Session уже авторизован, то содержит имя этого аккаунта.

Этап 2. Подписать `login_challenge` posting-ключом аккаунта (а если авторизация происходит по паролю, то сперва извлечь из пароля posting-ключ), и отправить новый POST-запрос: `{"account": "имя аккаунта", "signatures": {"posting":"<подпись>"}}`.

#### `GET /logout_account` - выход из аккаунта пользователя.

В случае, если аккаунт и не был авторизован, ошибки НЕ выдает. Возвращает ответ с полем `was_logged_in`, которое равно `true`, если аккаунт действительно был авторизован.

#### `GET /counters/@:account` - получение счетчика уведомлений.

Счетчики обычно отображают рядом с аватаркой пользователя, который вошел в ваш клиент, чтобы пользователь видел, что произошли какие-то события (например, кто-то написал ему сообщение) и сколько их произошло.

Вы можете делать этот запрос периодически, пока пользователь находится на странице, чтобы сразу отображать счетчик, как только случится какое-то событие. Рекомендуемая периодичность этих запросов - 1 раз при заходе на страницу и далее не чаще, чем каждые 10 секунд.

Для получения этих данных **НЕ требуется авторизация**.

#### `PUT /counters/@:account/:scopes` - прочтение уведомлений - сброс счетчика.

`scopes` - типы counters (из `/counters/@:account`) через запятую. Пример: `message`, `message,comment_reply`.

Для сброса счетчиков **требуется авторизация**, или же пользователю для прочтения уведомлений следует заходить на соответствующие страницы сервисов Golos.

#### `GET /subscribe/@:account/:scopes` - подписка на канал уведомлений или личных сообщений.

`scopes` - `message` для личных сообщений, и другие варианты для других действий (см. счетчики).

Для этого запроса **требуется авторизация**.

После подписки следует прочитывать канал не реже, чем раз в 1 минуту, иначе канал будет автоматически отписан (удален) и потребуется снова подписываться.

#### `GET /take/@:account/:subscriber_id/:task_ids?` - получение уведомлений или личных сообщений из канала.

Метод работает по принципу long-polling: после запроса начинается ожидание ответа, пока не появятся уведомления или личные сообщения.
В случае, если уведомлений\сообщений нет и проходит некий интервал времени, запрос обрывается по тайм-ауту (может быть от 10 до 60 сек).

Если сообщения есть, то запрос надо повторить для повторного ожидания, при этом указав id-ы полученных сообщений в `task_ids` через запятую.

Для этого запроса **требуется авторизация**.
