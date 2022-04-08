import { readFile, writeFile } from 'fs/promises';

type Domain = { name: string; node: string; exists: boolean };
const fileName = 'domains.json';

const run = async () => {
  const domains = JSON.parse(await readFile(fileName, 'utf8'));

  const domainsToStore = domains.filter((domain: Domain, i: number) => {
    return !domain.exists && domain.name.includes('.');
  });

  await writeFile(fileName, JSON.stringify(domainsToStore), 'utf8');
  console.log(`Filtered ${domainsToStore.length} domains to ${fileName}`);
};

run();
