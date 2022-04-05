import { writeFile } from 'fs';
import { Client } from 'pg';

const {
  RESOLUTION_POSTGRES_USERNAME: user,
  RESOLUTION_POSTGRES_HOST: host,
  RESOLUTION_POSTGRES_DATABASE: database,
  RESOLUTION_POSTGRES_PASSWORD: password,
  RESOLUTION_POSTGRES_PORT: port_number,
} = process.env;

const port = Number(port_number);
const fileName = 'domains.json';
const client = new Client({ user, host, database, password, port });

const exportQuery = `
SELECT DISTINCT ON (domains.id)
       domains.id,
       domains.created_at,
       domains.updated_at,
       domains.name,
       domains.node,
       domains.parent_id,
       domains_resolution.owner_address,
       domains_resolution.resolver,
       domains_resolution.registry,
       domains_resolution.resolution,
       domains_resolution.blockchain,
       domains_resolution.network_id
FROM domains
         JOIN domains_resolution on domains.id = domains_resolution.domain_id
ORDER BY domains.id;
`;

const run = async () => {
  await client.connect();
  const { rows } = await client.query(exportQuery);
  writeFile('domains.json', JSON.stringify(rows), 'utf8', (err) => {
    if (err) {
      console.log('Export failed!', err);
    } else {
      console.log(`Exported ${rows.length} domains to ${fileName}`);
    }
  });
  await client.end();
};

run();
