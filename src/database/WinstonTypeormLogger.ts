import { Logger, QueryRunner } from 'typeorm';
import { highlight } from 'cli-highlight';
import chalk from 'chalk';
import { logger } from '../logger';
import { env } from '../env';

const SqlTheme = {
  keyword: chalk.blueBright,
  literal: chalk.blueBright,
  string: chalk.white,
  type: chalk.magentaBright,
  built_in: chalk.magentaBright,
  comment: chalk.gray,
};

export class WinstonTypeormLogger implements Logger {
  log(
    level: 'log' | 'info' | 'warn',
    message: any,
    queryRunner?: QueryRunner,
  ): any {
    if (
      typeof message === 'string' &&
      message.startsWith('All classes found using provided glob pattern')
    ) {
      return;
    }
    logger.log(level === 'log' ? 'info' : level, message);
  }

  logMigration(message: string, queryRunner?: QueryRunner): any {
    logger.info(message);
  }

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner): any {
    // all query are logged as slow queries to ensure they have timing
    // no need to log them here too
  }

  logQueryError(
    error: string,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): any {
    logger.error(this.queryLog(query, parameters));
    logger.error(error.toString());
  }

  logQuerySlow(
    durationMs: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): any {
    logger.info(this.queryLog(query, parameters), { durationMs });
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner): any {
    logger.info(message);
  }

  protected queryLog(query: string, parameters: any[] | undefined): string {
    // Ensure query takes a single line in log
    query = query
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .join(' ');
    query = query + this.stringifyParams(parameters);
    return env.TYPEORM.LOGGING.colorize
      ? highlight(query, { language: 'sql', theme: SqlTheme })
      : query;
  }

  protected stringifyParams(parameters?: any[]) {
    if (!parameters || !parameters.length) {
      return '';
    }
    const prefix = ' -- ';
    try {
      return (
        prefix +
        JSON.stringify(
          parameters.reduce((r, v, i) => ({ ...r, [i + 1]: v }), {}),
        )
      );
    } catch (error) {
      // most probably circular objects in parameters
      return prefix + parameters.toString();
    }
  }
}
