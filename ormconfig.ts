import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { env } from "./src/env";
import SnakeNamingStrategy from "./src/database/SnakeNamingStrategy";
import * as path from "path";

export = {
  ...env.TYPEORM,
  entities: [
    path.join(__dirname, "/src/models/index.ts"),
    path.join(__dirname, "/src/models/index.js"),
  ] as string[],
  migrations: [
    path.join(__dirname, "/src/database/migrations/*.ts"),
    path.join(__dirname, "/src/database/migrations/*.js"),
  ] as string[],
  migrationsTableName: "typeorm_migration",
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  cli: {
    entitiesDir: "src/models",
    migrationsDir: "src/database/migrations",
  },
} as PostgresConnectionOptions;
