const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const sources = [
    { name: 'RemoteOK', apiUrl: 'https://remoteok.com/api', meta: { type: 'api' } },
    { name: 'Remotive', apiUrl: 'https://remotive.io/api/remote-jobs', meta: { type: 'api' } },
    { name: 'WeWorkRemotely', apiUrl: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', meta: { type: 'rss' } },
  ]

  for (const s of sources) {
    await prisma.jobSource.upsert({
      where: { name: s.name },
      update: { apiUrl: s.apiUrl, meta: s.meta },
      create: { name: s.name, apiUrl: s.apiUrl, meta: s.meta },
    })
    console.log('Upserted JobSource:', s.name)
  }

  console.log('Seeding complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
