import { getConnection } from 'typeorm';
import { eip137Namehash, znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (name, node, location)
       VALUES ('zil', '${znsNamehash('zil')}', 'ZNS'),
              ('crypto', '${eip137Namehash('crypto')}', 'CNS')
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
