import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  const email = "admin@example.com";
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`User already exists: ${email}`);
    return;
  }

  const passwordHash = await hashPassword("password123");
  await prisma.user.create({
    data: {
      email,
      name: "Admin",
      passwordHash
    }
  });

  console.log("Seeded default user admin@example.com / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
