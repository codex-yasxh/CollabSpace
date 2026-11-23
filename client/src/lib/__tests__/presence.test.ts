import { describe, it, expect } from "vitest";
import { getPresenceColor, PRESENCE_PALETTE } from "../presence.js";
import { resolveAvatarColor } from "../../components/ui/Avatar.js";

describe("Presence & Avatar Color Unification", () => {
  it("deterministically produces the exact same color for a given userId", () => {
    const userId = "3ae73478-9258-4b63-b2fe-a3da86c49316";
    const color1 = getPresenceColor(userId);
    const color2 = getPresenceColor(userId);
    expect(color1.name).toBe(color2.name);
    expect(color1.hex).toBe(color2.hex);
  });

  it("ensures AvatarStack and User Menu produce the EXACT same color for one user", () => {
    const testUsers = [
      { id: "3ae73478-9258-4b63-b2fe-a3da86c49316", name: "Alice Chen" },
      { id: "a532f2d1-4587-49b7-b706-a936b616b11f", name: "Bob Smith" },
      { id: "c18f3a02-2309-4a92-b481-998982aef120", name: "Carol Davis" },
      { id: "d991b2c4-0000-4000-8000-111122223333", name: "David Kim" },
    ];

    for (const user of testUsers) {
      // 1. Color computed in AvatarStack via useActiveCollaborators
      const stackColor = getPresenceColor(user.id).name;

      // 2. Color resolved by Avatar component in the user menu dropdown
      const menuColor = resolveAvatarColor({
        userId: user.id,
      });

      // Assert they are identical
      expect(stackColor).toBe(menuColor);
    }
  });

  it("all presence colors belong to the defined PRESENCE_PALETTE", () => {
    const validNames = new Set(PRESENCE_PALETTE.map((p) => p.name));
    for (let i = 0; i < 50; i++) {
      const color = getPresenceColor(`test-user-${i}`);
      expect(validNames.has(color.name)).toBe(true);
    }
  });
});
