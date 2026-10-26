import { app, logger } from "./app.js";
import { config } from "./config.js";
import { db } from "./db.js";
await db.$connect();
const server = app.listen(config.PORT, "0.0.0.0", () =>
  logger.info({ port: config.PORT }, "server started"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    }),
  );
