const caretTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Custom remote caret flag renderer per blueprint 4.7:
 * 2px vertical bar in presence color with a 12px white-on-presence-color name flag.
 * Radius: 3px 3px 3px 0. Visible on activity, fades out after 2.5s idle with 150ms transition.
 */
export function renderCaret(user: Record<string, unknown>): HTMLElement {
  const cursor = document.createElement("span");
  cursor.classList.add("collaboration-carets__cursor");
  const color = typeof user.color === "string" ? user.color : "#C4412E";
  const name = typeof user.name === "string" ? user.name : "Anonymous";

  cursor.style.borderLeftColor = color;

  const label = document.createElement("div");
  label.classList.add("collaboration-carets__label");
  label.style.backgroundColor = color;
  label.textContent = name;

  cursor.appendChild(label);

  const key = (typeof user.userId === "string" ? user.userId : name) || "anon";
  const existingTimer = caretTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Active on render / update
  label.removeAttribute("data-idle");

  const timer = setTimeout(() => {
    label.setAttribute("data-idle", "true");
  }, 2500);

  caretTimers.set(key, timer);

  return cursor;
}

export function selectionRender(user: Record<string, unknown>) {
  const color = typeof user.color === "string" ? user.color : "#C4412E";
  return {
    nodeName: "span",
    class: "collaboration-carets__selection",
    style: `background-color: ${color}33`, // 20% alpha per blueprint 4.3
  };
}
