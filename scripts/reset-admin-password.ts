import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "password123";

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be non-empty.");
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Admin",
      passwordHash
    },
    update: {
      passwordHash
    }
  });

  console.log(`Admin credentials reset for ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
