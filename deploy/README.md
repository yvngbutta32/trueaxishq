# Independent deployment

This project runs as a standard Node.js service and does not require Manus.

## Docker Compose

1. Copy `.env.example` to `.env`.
2. Set `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, and provider credentials.
3. Start the services:

   ```sh
   docker compose up -d --build
   ```

4. Apply the schema from the application container:

   ```sh
   docker compose exec app pnpm db:push
   ```

5. Put HTTPS in front of port `3000` using the server's reverse proxy or a managed TLS proxy.

The `mysql-data` and `uploads` volumes must be included in backups.

## Deployment verification

After startup, confirm both containers are healthy:

```sh
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

The application container reports `healthy` only after it can reach its database.
If it stays unhealthy, inspect the logs with:

```sh
docker compose logs --tail=100 app
docker compose logs --tail=100 db
```

## Backup before upgrades

Create a database dump and archive uploads before changing the image or schema:

```sh
mkdir -p backups
docker compose exec -T db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" trueaxis' > backups/trueaxis-$(date +%Y%m%d-%H%M%S).sql
docker run --rm -v trueaxishq_uploads:/data -v "$PWD/backups:/backup" alpine tar czf /backup/uploads-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

Keep the backup files outside the server as well. A backup is only useful if it
can be restored, so periodically test the SQL dump against a separate database.
