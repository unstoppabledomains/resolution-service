import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { env } from "../env";
import SnakeNamingStrategy from "./SnakeNamingStrategy";

export = {
  ...env.TYPEORM,
  namingStrategy: new SnakeNamingStrategy(),
  cli: {
    entitiesDir: "lib/entities",
    migrationsDir: "lib/migrations",
  },
} as PostgresConnectionOptions;
