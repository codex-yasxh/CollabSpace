import type { User } from "../modules/users/userRepository.js";
import type { DocumentRole } from "../modules/access/resolveRole.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      docRole?: DocumentRole;
    }
  }
}
