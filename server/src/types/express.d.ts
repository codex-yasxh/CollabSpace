import type { User } from "../modules/users/userRepository.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
