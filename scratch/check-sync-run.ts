import { prisma } from '../src/lib/db';

async function main() {
  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(runs, null, 2));

  const state = await prisma.syncState.findUnique({
    where: { id: 'global' },
  });
  console.log('SyncState:', JSON.stringify(state, null, 2));
}

main().catch(console.error);
