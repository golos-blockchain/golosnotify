### Build

```bash
docker-compose build
```

### Run

```bash
docker-compose up
```

### Use

Tarantool database should be available on port 3301 of your local host.

To access the data via console please to the following:

```bash
$ docker-compose exec datastore /bin/sh
$ tarantoolctl connect guest@localhost:3301

or

$ docker-compose exec datastore tarantoolctl connect guest@localhost:3301
```

### Docker Compose (recommended)

https://github.com/golos-blockchain/golosnotify/blob/master/docker-compose.yml