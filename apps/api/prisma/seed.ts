import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'test@paggo.local';
  const password = await bcrypt.hash('123456', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password },
  });

  console.log('seed user:', user.email, user.id);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
