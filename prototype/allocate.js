/* Group allocation, following allocation-rules.md.
   Modes: balanced ability and school affinity. */

const DEFAULT_SETTINGS = {
  maxGroups: 10,
  minCoachesPerGroup: 1,
  ratio: 8,            // ceiling on children per coach, checked within each group
  targetGroupSize: 8,
  minGroupSize: 6
};

/* sizes as even as the numbers allow, remainder one per group */
function splitEven(total, parts) {
  const base = Math.floor(total / parts), rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

/* coaches: minimum each, then whatever the ratio demands, then spread the rest evenly */
function assignCoachCounts(sizes, coachCount, s) {
  const counts = sizes.map(() => s.minCoachesPerGroup);
  let used = counts.reduce((a, b) => a + b, 0);
  if (used > coachCount) return null;

  sizes.forEach((size, i) => {
    const needed = Math.ceil(size / s.ratio);
    const extra = Math.max(0, needed - counts[i]);
    counts[i] += extra; used += extra;
  });
  if (used > coachCount) return null;

  while (used < coachCount) {
    let best = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] < counts[best] || (counts[i] === counts[best] && sizes[i] > sizes[best])) best = i;
    }
    counts[best]++; used++;
  }
  return counts;
}

/* spread coaches evenly with no regard for the ratio — only used when the admin
   forces a group count the rules can't satisfy */
function spreadCoachesAnyway(groupCount, coachCount) {
  return splitEven(coachCount, groupCount);
}

function evaluateGroupCounts(nChildren, nCoaches, s) {
  const rows = [];
  for (let g = 1; g <= Math.max(1, s.maxGroups); g++) {
    const sizes = splitEven(nChildren, g);
    const row = { groups: g, sizes, avg: nChildren / g, feasible: false, reason: "" };
    if (nChildren === 0) { row.reason = "nobody has accepted"; rows.push(row); continue; }
    if (Math.min(...sizes) < s.minGroupSize) {
      row.reason = "would put a squad below the minimum of " + s.minGroupSize;
    } else if (nCoaches < g * s.minCoachesPerGroup) {
      row.reason = "not enough coaches for " + s.minCoachesPerGroup + " per squad";
    } else {
      const counts = assignCoachCounts(sizes, nCoaches, s);
      if (!counts) row.reason = "can't meet the 1:" + s.ratio + " ratio with " + nCoaches + " coaches";
      else { row.feasible = true; row.coachCounts = counts; }
    }
    rows.push(row);
  }
  return rows;
}

/* what would fix it, in the plain words the spec asks for */
function suggestFix(nChildren, nCoaches, s) {
  for (let extra = 1; extra <= 40; extra++) {
    if (evaluateGroupCounts(nChildren, nCoaches + extra, s).some((r) => r.feasible)) {
      return extra + (extra === 1 ? " more coach" : " more coaches") + " would make it work";
    }
  }
  for (let m = s.minGroupSize - 1; m >= 1; m--) {
    if (evaluateGroupCounts(nChildren, nCoaches, { ...s, minGroupSize: m }).some((r) => r.feasible)) {
      return "dropping the minimum squad size to " + m + " would make it work";
    }
  }
  for (let r = s.ratio + 1; r <= s.ratio + 12; r++) {
    if (evaluateGroupCounts(nChildren, nCoaches, { ...s, ratio: r }).some((x) => x.feasible)) {
      return "a 1:" + r + " ratio would make it work";
    }
  }
  return "no combination of the current settings works for this turnout";
}

/* ---------------- placement helpers ---------------- */

const roomIn = (g) => g.capacity - g.children.length;
const schoolCount = (g, school) => g.children.filter((c) => c.school === school).length;

function bestRoom(groups, filter) {
  const pool = filter ? groups.filter(filter) : groups;
  const from = pool.length ? pool : groups;
  return from.slice().sort((a, b) => roomIn(b) - roomIn(a) || a.id - b.id)[0];
}

/* ---------------- the two modes ---------------- */

function placeBalancedAbility(groups, unplaced) {
  [1, 5, 2, 4, 3].forEach((rating) => {
    unplaced.filter((c) => c.rating === rating).forEach((child) => {
      const open = groups.filter((g) => roomIn(g) > 0);
      const target = (open.length ? open : groups).slice().sort((a, b) => {
        const d = a.children.filter((c) => c.rating === rating).length
                - b.children.filter((c) => c.rating === rating).length;
        return d !== 0 ? d : a.children.length - b.children.length || a.id - b.id;
      })[0];
      target.children.push(child);
    });
  });
}

function placeSchoolAffinity(groups, unplaced, allAccepted) {
  const NO_SCHOOL = "(no school recorded)";
  const key = (c) => c.school || NO_SCHOOL;

  const totals = new Map();
  allAccepted.forEach((c) => totals.set(key(c), (totals.get(key(c)) || 0) + 1));
  // a child with no school recorded counts as a singleton for the session
  const isSingleton = (c) => key(c) === NO_SCHOOL || totals.get(key(c)) === 1;

  const singles = unplaced.filter(isSingleton);
  const rest = unplaced.filter((c) => !isSingleton(c));
  const notes = [];

  /* 1. the singleton pool goes first: it has the tightest constraint */
  if (singles.length === 1) {
    bestRoom(groups, (g) => roomIn(g) > 0).children.push(singles[0]);
    notes.push("Only one child was the single attendee from their school, so there was no pool to place them in. "
      + singles[0].name + " was placed normally and the floor could not be met for them.");
  } else if (singles.length > 1) {
    let queue = singles.slice();
    const order = groups.slice().sort((a, b) => roomIn(b) - roomIn(a) || a.id - b.id);
    for (const g of order) {
      if (!queue.length) break;
      let take = Math.min(roomIn(g), queue.length);
      if (queue.length - take === 1) take = Math.max(1, take - 1); // never spill a lone singleton
      queue.splice(0, take).forEach((c) => g.children.push(c));
    }
    queue.forEach((c) => (bestRoom(groups, (g) => roomIn(g) > 0) || bestRoom(groups)).children.push(c));
    notes.push(singles.length + " children were the only attendee from their school that night and were pooled together.");
  }

  const pool = new Map();
  rest.forEach((c) => {
    if (!pool.has(key(c))) pool.set(key(c), []);
    pool.get(key(c)).push(c);
  });

  /* 2. the floor first: anyone already alone from their school — a coach's child, usually —
        gets a companion before any spreading happens */
  groups.forEach((g) => {
    const counts = new Map();
    g.children.forEach((c) => counts.set(key(c), (counts.get(key(c)) || 0) + 1));
    counts.forEach((n, school) => {
      const waiting = pool.get(school);
      if (n === 1 && roomIn(g) > 0 && waiting && waiting.length) g.children.push(waiting.shift());
    });
  });

  /* 3. then each school in pairs, spread across the groups holding fewest of it.
        Group sizes outrank the mode, so a block only goes where there is room. */
  [...pool.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([school, kids]) => {
      const byPreference = (a, b) => {
        const d = schoolCount(a, school) - schoolCount(b, school);
        return d !== 0 ? d : roomIn(b) - roomIn(a) || a.id - b.id;
      };
      while (kids.length >= 2) {
        const roomy = groups.filter((g) => roomIn(g) >= 2).sort(byPreference);
        if (roomy.length) { roomy[0].children.push(kids.shift(), kids.shift()); continue; }
        const any = groups.filter((g) => roomIn(g) > 0).sort(byPreference);
        (any[0] || bestRoom(groups)).children.push(kids.shift());
      }
      while (kids.length) {
        const withSome = groups.filter((g) => schoolCount(g, school) >= 1 && roomIn(g) > 0)
          .sort((a, b) => roomIn(b) - roomIn(a));
        const g = withSome[0] || bestRoom(groups, (x) => roomIn(x) > 0) || bestRoom(groups);
        g.children.push(kids.shift());
      }
    });

  return notes;
}

/* ---------------- the allocation ---------------- */

function allocate(opts) {
  const s = opts.settings || DEFAULT_SETTINGS;
  const children = opts.children, coaches = opts.coaches, byId = opts.byId;
  const pins = opts.pins || new Map();
  const mode = opts.mode || "ability";

  const childSet = new Set(children.map((c) => c.id));
  const attendingKids = (coach) =>
    coach.childIds.map((id) => byId.get(id)).filter((c) => childSet.has(c.id));

  // a coach whose own children aren't attending can't be placed, so they aren't coaching tonight
  const coaching = coaches.filter((c) => attendingKids(c).length);
  const standDown = coaches.filter((c) => !attendingKids(c).length);

  const candidates = evaluateGroupCounts(children.length, coaching.length, s);
  const feasible = candidates.filter((c) => c.feasible);

  let chosen = null, forced = false, failed = false, failure = "";
  if (opts.forcedCount) {
    forced = true;
    chosen = candidates.find((c) => c.groups === opts.forcedCount)
      || { groups: opts.forcedCount, sizes: splitEven(children.length, opts.forcedCount), feasible: false, reason: "" };
    if (!chosen.feasible) {
      failed = true;
      failure = "You set " + chosen.groups + " squads by hand. " +
        (chosen.reason || "That count can't satisfy the rules") + ".";
    }
  } else if (feasible.length) {
    chosen = feasible.slice().sort((a, b) => {
      const d = Math.abs(a.avg - s.targetGroupSize) - Math.abs(b.avg - s.targetGroupSize);
      return d !== 0 ? d : b.groups - a.groups;
    })[0];
  } else {
    failed = true;
    const wanted = Math.round(children.length / Math.max(1, s.targetGroupSize)) || 1;
    const fallback = Math.max(1, Math.min(s.maxGroups, coaching.length || 1, wanted));
    chosen = candidates.find((c) => c.groups === fallback) || candidates[0]
      || { groups: 1, sizes: [children.length], reason: "" };
    failure = "No squad count satisfies every rule for " + children.length + " children and "
      + coaching.length + (coaching.length === 1 ? " coach. " : " coaches. ")
      + suggestFix(children.length, coaching.length, s) + ".";
  }

  const count = Math.max(1, chosen.groups);
  const sizes = chosen.sizes && chosen.sizes.length === count ? chosen.sizes : splitEven(children.length, count);
  const coachCounts = chosen.coachCounts
    || assignCoachCounts(sizes, coaching.length, s)
    || spreadCoachesAnyway(count, coaching.length);

  const label = opts.groupLabel || "Squad";
  const groups = sizes.map((size, i) => ({
    id: i, name: label + " " + (i + 1),
    capacity: size, coachCapacity: coachCounts[i] || 0,
    children: [], coaches: []
  }));

  const placed = new Set();

  /* pinned people keep the place the admin gave them */
  coaching.forEach((c) => {
    const at = pins.get(c.id);
    if (at !== undefined && groups[at]) groups[at].coaches.push(c);
  });
  children.forEach((c) => {
    const at = pins.get(c.id);
    if (at !== undefined && groups[at]) { groups[at].children.push(c); placed.add(c.id); }
  });

  /* 1 + 2. coaches' children spread so the coaches come out evenly, then the coaches with them */
  const slots = [];
  const maxCoaches = Math.max(1, ...coachCounts);
  for (let round = 0; round < maxCoaches; round++) {
    groups.forEach((g) => { if (g.coachCapacity > round) slots.push(g); });
  }
  groups.forEach((g) => { /* pinned coaches already occupy a slot */
    g.coaches.forEach((c) => { const i = slots.indexOf(g); if (i >= 0) slots.splice(i, 1); });
  });

  const freeCoaches = coaching.filter((c) => pins.get(c.id) === undefined);
  const withKids = freeCoaches
    .map((c) => ({ coach: c, kids: attendingKids(c) }))
    .sort((a, b) => b.kids.length - a.kids.length);

  withKids.forEach((entry, i) => {
    const g = slots[i] || bestRoom(groups);
    g.coaches.push(entry.coach);
    entry.kids.forEach((k) => {
      if (!placed.has(k.id)) { g.children.push(k); placed.add(k.id); }
    });
  });

  /* 4. everyone else */
  const unplaced = children.filter((c) => !placed.has(c.id));
  const notes = [];
  if (mode === "school") notes.push(...placeSchoolAffinity(groups, unplaced, children));
  else placeBalancedAbility(groups, unplaced);

  return {
    groups, chosen, candidates, settings: s, mode, forced, failed, failure,
    standDown, coachesUsed: coaching.length, notes,
    checks: checkRules(groups, byId, s, mode, children)
  };
}

/* ---------------- rules, reported rather than assumed ---------------- */

function checkRules(groups, byId, s, mode, accepted) {
  const out = [];
  const live = groups.filter((g) => g.children.length || g.coaches.length);

  const short = live.filter((g) => g.coaches.length < s.minCoachesPerGroup);
  out.push({
    rule: "Every squad has at least " + s.minCoachesPerGroup
      + (s.minCoachesPerGroup === 1 ? " coach" : " coaches"),
    ok: short.length === 0,
    detail: short.length ? short.map((g) => g.name).join(", ") + " short of coaches" : "all squads staffed"
  });

  const split = [];
  groups.forEach((g) => g.coaches.forEach((c) => {
    c.childIds.forEach((id) => {
      const child = byId.get(id);
      const here = g.children.some((k) => k.id === id);
      const elsewhere = groups.some((o) => o !== g && o.children.some((k) => k.id === id));
      if (!here && elsewhere) split.push(c.name + " away from " + child.firstName);
    });
  }));
  out.push({
    rule: "A coach is in the same squad as their own children",
    ok: split.length === 0,
    detail: split.length ? split.join("; ") : "every coaching parent is with their own children"
  });

  const over = live.filter((g) => g.coaches.length === 0 ? g.children.length > 0
    : g.children.length > g.coaches.length * s.ratio);
  const worst = live.length
    ? Math.max(...live.map((g) => g.coaches.length ? g.children.length / g.coaches.length : Infinity)) : 0;
  out.push({
    rule: "Every squad meets the 1:" + s.ratio + " ratio",
    ok: over.length === 0,
    detail: over.length
      ? over.map((g) => g.name + " is " + g.children.length + " to " + g.coaches.length).join(", ")
      : "worst squad is " + worst.toFixed(1) + " children per coach"
  });

  const under = live.filter((g) => g.children.length < s.minGroupSize);
  out.push({
    rule: "No squad below the minimum of " + s.minGroupSize,
    ok: under.length === 0, soft: true,
    detail: under.length
      ? under.map((g) => g.name + " has " + g.children.length).join(", ")
      : "smallest squad is " + Math.min(...live.map((g) => g.children.length))
  });

  if (mode === "school") {
    const alone = [];
    groups.forEach((g) => g.children.forEach((c) => {
      const school = c.school || "(no school recorded)";
      if (g.children.filter((x) => (x.school || "(no school recorded)") === school).length === 1) {
        alone.push(c.firstName + " in " + g.name);
      }
    }));
    out.push({
      rule: "No child is the only one from their school in their squad",
      ok: alone.length === 0, soft: true,
      detail: alone.length ? alone.length + " alone: " + alone.slice(0, 4).join(", ")
        + (alone.length > 4 ? " and " + (alone.length - 4) + " more" : "")
        : "every child has at least one school-mate"
    });
  }
  return out;
}
