import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://collabspace:collabspace_dev@localhost:5432/collabspace_test",
      JWT_SECRET: "super_secret_jwt_key_collabspace_dev_at_least_32_characters",
    },
  },
});
