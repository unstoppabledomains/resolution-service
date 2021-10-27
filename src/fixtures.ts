import { getConnection } from 'typeorm';
import { znsNamehash } from './utils/namehash';

export default async (): Promise<void> => {
  await getConnection().query(
    `INSERT INTO "domains" (id, name, node)
       VALUES (0, 'zil', '${znsNamehash('zil')}')
       ON CONFLICT (name) DO NOTHING
    `,
  );
};
