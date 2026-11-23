import { createUser, findByEmail, findById } from "../modules/users/userRepository.js";
import { closePool } from "../database/db.js";

async function main() {
  const testEmail = `test_${Date.now()}@example.com`;
  console.log(`Creating test user with email: ${testEmail}...`);

  const created = await createUser({
    name: "Aditya Test",
    email: `  ${testEmail}  `,
    password_hash: "hash_placeholder_123456",
  });

  console.log("Inserted user:", created);

  if (created.email !== testEmail) {
    throw new Error(`Email was not trimmed! Expected: ${testEmail}, Got: ${created.email}`);
  }

  const byEmail = await findByEmail(testEmail.toUpperCase());
  if (!byEmail || byEmail.id !== created.id) {
    throw new Error(`findByEmail failed with case insensitivity!`);
  }
  console.log("Successfully retrieved user by lowercase comparison:", byEmail.email);

  const byId = await findById(created.id);
  if (!byId || byId.id !== created.id) {
    throw new Error(`findById failed!`);
  }
  console.log("Successfully retrieved user by ID:", byId.id);

  console.log("All T2.1 user repository tests passed successfully!");
}

main()
  .catch((err) => {
    console.error("Error in testUserRepo:", err);
    process.exit(1);
  })
  .finally(() => closePool());
