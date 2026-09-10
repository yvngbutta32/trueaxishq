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
