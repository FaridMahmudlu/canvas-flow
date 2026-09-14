import { syncAll } from '../src/lib/sync/engine';

async function main() {
  console.log('Starting local syncAll test...');
  const t0 = Date.now();
  const res = await syncAll('manual-perf-test');
  console.log('Sync finished in', Date.now() - t0, 'ms');
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
