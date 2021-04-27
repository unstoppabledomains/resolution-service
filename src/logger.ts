import winston from "winston";

export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.cli(),
    defaultMeta: { service: 'resolution-service' },
    transports: [
        new winston.transports.Console()
    ],
});