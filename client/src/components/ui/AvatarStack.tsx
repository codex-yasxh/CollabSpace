import { Avatar } from "./Avatar.js";
import { SimpleTooltip } from "./Tooltip.js";
import type { PresenceColor } from "../../lib/presence.js";

export interface CollaboratorUser {
  id: string;
  name: string;
  presenceColor?: PresenceColor | undefined;
  isCurrentUser?: boolean | undefined;
}

export interface AvatarStackProps {
  users: CollaboratorUser[];
  max?: number | undefined;
  className?: string | undefined;
}

export function AvatarStack({ users, max = 4, className = "" }: AvatarStackProps) {
  // Current user comes first per blueprint 4.7
  const sortedUsers = [...users].sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return 0;
  });

  const visibleUsers = sortedUsers.slice(0, max);
  const overflowCount = sortedUsers.length - max;
  const overflowUsers = overflowCount > 0 ? sortedUsers.slice(max) : [];

  return (
    <div className={`flex items-center -space-x-2 ${className}`.trim()}>
      {visibleUsers.map((user) => (
        <SimpleTooltip
          key={user.id}
          content={user.isCurrentUser ? `${user.name} (You)` : user.name}
          side="bottom"
        >
          <div className="relative inline-block hover:z-10">
            <Avatar
              name={user.name}
              userId={user.id}
              presenceColor={user.presenceColor}
              isCurrentUser={user.isCurrentUser}
            />
          </div>
        </SimpleTooltip>
      ))}

      {overflowCount > 0 && (
        <SimpleTooltip
          content={overflowUsers.map((u) => u.name).join(", ")}
          side="bottom"
        >
          <div
            className="relative inline-flex items-center justify-center shrink-0 w-[28px] h-[28px] rounded-full ring-2 ring-fog bg-wash text-ink-soft text-ui-xs font-medium select-none hover:z-10"
            aria-label={`${overflowCount} more collaborator${overflowCount > 1 ? "s" : ""}`}
          >
            +{overflowCount}
          </div>
        </SimpleTooltip>
      )}
    </div>
  );
}
