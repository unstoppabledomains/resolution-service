import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { env } from "./src/env";
import SnakeNamingStrategy from "./src/SnakeNamingStrategy";

export = {
  ...env.TYPEORM,
  namingStrategy: new SnakeNamingStrategy(),
  cli: {
    entitiesDir: "lib/entities",
    migrationsDir: "lib/migrations",
  },
} as PostgresConnectionOptions;
