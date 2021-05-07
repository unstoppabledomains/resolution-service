import { getConnection } from 'typeorm';
import { Resolution } from '@unstoppabledomains/resolution';

const resolution = new Resolution();

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (name, node, location)
       VALUES ('zil', '${resolution.namehash('zil')}', 'ZNS'),
              ('crypto', '${resolution.namehash('crypto')}', 'CNS')
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
