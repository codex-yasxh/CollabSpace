import http from "node:http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { setupCollaboration } from "./modules/collaboration/index.js";

const app = createApp();
const server = http.createServer(app);

setupCollaboration(server);

server.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
