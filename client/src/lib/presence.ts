export const PRESENCE_PALETTE = [
  { name: "coral", hex: "#C4412E" },
  { name: "ochre", hex: "#936000" },
  { name: "moss", hex: "#37762A" },
  { name: "teal", hex: "#0B7480" },
  { name: "cobalt", hex: "#2B58CE" },
  { name: "violet", hex: "#7046C9" },
  { name: "magenta", hex: "#AE2F86" },
] as const;

export type PresenceColor = (typeof PRESENCE_PALETTE)[number]["name"];

export function getPresenceColor(userId: string): (typeof PRESENCE_PALETTE)[number] {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const index = hash % PRESENCE_PALETTE.length;
  return PRESENCE_PALETTE[index]!;
}
