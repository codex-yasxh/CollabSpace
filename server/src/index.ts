import { env } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
