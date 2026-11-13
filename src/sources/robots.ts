/**
 * Minimal robots.txt support (RFC 9309): user-agent groups, Allow/Disallow with * and $,
 * longest match wins, Allow wins ties. Pure.
 */
export type Robots = { groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] };

export function parseRobots(txt: string): Robots {
  const groups: Robots["groups"] = [];
  let cur: Robots["groups"][number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      if (value) cur.rules.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return { groups };
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Is `path` (incl. query string) allowed for `agent`? No matching group = allowed. */
export function isAllowed(robots: Robots, agent: string, path: string): boolean {
  const a = agent.toLowerCase();
  const specific = robots.groups.filter((g) => g.agents.some((x) => x !== "*" && a.includes(x)));
  const groups = specific.length ? specific : robots.groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of groups) {
    for (const r of g.rules) {
      if (!toRegex(r.path).test(path)) continue;
      const len = r.path.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
    }
  }
  return best ? best.allow : true;
}
