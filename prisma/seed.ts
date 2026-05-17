import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

async function main() {
  const adminId = '00000000-0000-0000-0000-000000000001'

  await prisma.profile.upsert({
    where: { id: adminId },
    update: {},
    create: {
      id: adminId,
      googleId: 'admin-pampatec',
      email: 'emersonrizzatti@unipampa.edu.br',
      name: 'Equipe PampaTec',
      role: 'admin',
    },
  })

  const skillPath = join(__dirname, '..', 'skill-desafio-ao-mvp.md')
  const skillContent = readFileSync(skillPath, 'utf-8')

  const existingActive = await prisma.skillVersion.findFirst({ where: { isActive: true } })
  if (!existingActive) {
    await prisma.skillVersion.create({
      data: {
        versionLabel: 'v1.1.0 — inicial',
        contentMd: skillContent,
        createdBy: adminId,
        isActive: true,
      },
    })
  }

  console.log('Seed concluído: admin + skill inicial criados.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
