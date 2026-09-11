/* Screens and interaction. Everything re-renders from `state`; nothing is persisted. */

const byId = EVENT.byId;
const allChildren = TEAM.people.filter((p) => p.type === "child");
const allAdults = TEAM.people.filter((p) => p.type === "adult");

const state = {
  status: new Map(EVENT.status),
  coach: new Map(allAdults.map((a) => [a.id, !!a.isCoach])),
  settings: { ...DEFAULT_SETTINGS },
  groupCount: 0,          // 0 = let the app work it out
  mode: "ability",
  pins: new Map(),        // personId -> group index, from manual moves
  result: null,
  lastMove: null
};

const coachesNow = () => allAdults.filter((a) => state.coach.get(a.id));
const invitedNow = () => allChildren.concat(coachesNow());
const statusOf = (id) => state.status.get(id) || "none";
const acceptedChildren = () => allChildren.filter((c) => statusOf(c.id) === "accepted");
const acceptedCoaches = () => coachesNow().filter((a) => statusOf(a.id) === "accepted");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (id) => document.getElementById(id);
const STATUS_LABEL = { accepted: "Accepted", declined: "Declined", none: "No response" };
const pill = (s) => `<span class="pill ${s}">${STATUS_LABEL[s]}</span>`;
const ratingChip = (r) => `<span class="rating r${r}">${r}</span>`;
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
const parentsOf = (child) => child.parentIds.map((id) => byId.get(id));

function rerun(keepPins = true) {
  if (!keepPins) state.pins.clear();
  state.result = allocate({
    children: acceptedChildren(), coaches: acceptedCoaches(), byId,
    settings: state.settings, mode: state.mode, pins: state.pins,
    forcedCount: state.groupCount || null
  });
}

function renderAll() {
  const y = window.scrollY;
  renderMembers(); renderEvent(); renderGroups(); renderParent();
  window.scrollTo(0, y);
}

/* ---------------- members ---------------- */

let memberFilter = "all", memberSearch = "";

function renderMembers() {
  let rows = TEAM.people.slice();
  if (memberFilter === "children") rows = rows.filter((p) => p.type === "child");
  if (memberFilter === "adults") rows = rows.filter((p) => p.type === "adult");
  if (memberFilter === "coaches") rows = rows.filter((p) => state.coach.get(p.id));
  if (memberFilter === "unregistered") rows = rows.filter((p) => p.type === "adult" && !p.registered);
  if (memberSearch) {
    const q = memberSearch.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || (p.school || "").toLowerCase().includes(q));
  }
  rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const body = rows.map((p) => {
    if (p.type === "child") {
      const ps = parentsOf(p).map((a) => a.name + (state.coach.get(a.id) ? " (coach)" : "")).join(", ");
      return `<tr>
        <td><div class="name">${esc(p.name)}</div><div class="sub">Child &middot; ${esc(ps)}</div></td>
        <td>${esc(p.school)}</td>
        <td>${ratingChip(p.rating)}</td>
        <td><span class="tag unreg">Player</span></td>
        <td class="sub">via parent</td>
      </tr>`;
    }
    const kids = p.childIds.map((id) => byId.get(id).name).join(", ");
    const on = state.coach.get(p.id);
    return `<tr>
      <td><div class="name">${esc(p.name)}</div><div class="sub">Adult &middot; parent of ${esc(kids)}</div></td>
      <td class="sub">&mdash;</td>
      <td class="sub">&mdash;</td>
      <td><label class="switch"><input type="checkbox" data-coach="${p.id}" ${on ? "checked" : ""}>
        <span class="tag ${on ? "coach" : "unreg"}">${on ? "Coach" : "Player"}</span></label></td>
      <td>
        ${p.registered ? '<span class="tag reg">Registered</span>' : '<span class="tag unreg">Unregistered</span>'}
        <div class="sub">${esc(p.email)}</div>
      </td>
    </tr>`;
  }).join("");

  el("view-members").innerHTML = `
    <div class="page-head">
      <div><h2>Team members</h2>
        <div class="count">${allChildren.length} children and ${allAdults.length} adults,
          ${coachesNow().length} of them flagged as coaches</div></div>
      <div class="spacer"></div>
      <button class="btn">Import CSV</button>
      <button class="btn primary">Add member</button>
    </div>
    <div class="toolbar">
      ${[["all", "All"], ["children", "Children"], ["adults", "Adults"], ["coaches", "Coaches"], ["unregistered", "Unregistered"]]
        .map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${memberFilter === k}">${l}</button>`).join("")}
      <div class="spacer" style="flex:1"></div>
      <input class="search" id="member-search" placeholder="Search name or school" value="${esc(memberSearch)}">
    </div>
    <div class="card">
      <table>
        <thead><tr>
          <th>Name</th><th>School <span class="lock">Admin only</span></th>
          <th>Rating <span class="lock">Admin only</span></th><th>Coach</th><th>Account</th>
        </tr></thead>
        <tbody>${body || '<tr><td colspan="5" class="sub" style="padding:22px">Nobody matches that.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="notice">Tick a parent to flag them as a coach. They are invited as a coach from then on,
      and answer for themselves separately from their child.</div>`;

  el("view-members").querySelectorAll("[data-filter]").forEach((b) =>
    b.onclick = () => { memberFilter = b.dataset.filter; renderMembers(); });

  el("view-members").querySelectorAll("[data-coach]").forEach((cb) =>
    cb.onchange = () => {
      const id = Number(cb.dataset.coach);
      state.coach.set(id, cb.checked);
      if (cb.checked && !state.status.has(id)) state.status.set(id, "none");
      rerun(); renderAll();
    });

  const s = el("member-search");
  s.oninput = () => {
    memberSearch = s.value;
    const at = s.selectionStart;
    renderMembers();
    const ns = el("member-search"); ns.focus(); ns.setSelectionRange(at, at);
  };
}

/* ---------------- event ---------------- */

let eventTab = "children";

function renderEvent() {
  const kids = allChildren, coaches = coachesNow();
  const count = (people, st) => people.filter((p) => statusOf(p.id) === st).length;
  const tot = (st) => count(kids, st) + count(coaches, st);

  const list = (eventTab === "children" ? kids : coaches)
    .slice().sort((a, b) => {
      const rank = { accepted: 0, declined: 1, none: 2 };
      return rank[statusOf(a.id)] - rank[statusOf(b.id)] || a.lastName.localeCompare(b.lastName);
    })
    .map((p) => {
      const st = statusOf(p.id);
      const why = EVENT.reason.get(p.id);
      const sub = p.type === "child"
        ? "Child &middot; " + esc(parentsOf(p).map((a) => a.name).join(", "))
        : "Coach &middot; parent of " + esc(p.childIds.map((id) => byId.get(id).name).join(", "));
      return `<tr>
        <td><div class="name">${esc(p.name)}</div><div class="sub">${sub}</div></td>
        <td>${pill(st)}</td>
        <td class="sub">${st === "declined" && why ? esc(why) + ' <span class="lock">Admin only</span>' : ""}</td>
        <td style="text-align:right">
          <select class="status-pick" data-person="${p.id}">
            ${["accepted", "declined", "none"].map((k) =>
              `<option value="${k}" ${st === k ? "selected" : ""}>${STATUS_LABEL[k]}</option>`).join("")}
          </select>
        </td>
      </tr>`;
    }).join("");

  el("view-event").innerHTML = `
    <div class="page-head"><div><h2>Training</h2>
      <div class="count">Published &middot; ${invitedNow().length} people invited</div></div></div>

    <div class="card card-pad">
      <div class="event-head">
        <div><div class="when">${EVENT.date}</div>
          <div class="sub">${EVENT.time}&ndash;${EVENT.endTime} at ${esc(EVENT.venue)}</div></div>
        <div class="spacer" style="flex:1"></div>
        <span class="badge">${state.mode === "ability" ? "Balanced ability" : "School affinity"}</span>
        <span class="badge">Published</span>
      </div>
      <div class="meta">
        <div><div class="k">Type</div>${EVENT.type}</div>
        <div><div class="k">Meet</div>${EVENT.meetTime}</div>
        <div><div class="k">Duration</div>${EVENT.duration}</div>
        <div><div class="k">Venue</div>${esc(EVENT.venue)}</div>
      </div>
    </div>

    <div class="stats">
      ${[["accepted", "Accepted"], ["declined", "Declined"], ["none", "No response"]].map(([k, l]) => `
        <div class="stat ${k}"><div class="n">${tot(k)}</div><div class="l">${l}</div>
          <div class="b">${plural(count(kids, k), "child", "children")} &middot; ${plural(count(coaches, k), "coach", "coaches")}</div>
        </div>`).join("")}
    </div>

    <div class="toolbar">
      <button class="chip" data-etab="children" aria-pressed="${eventTab === "children"}">Children (${kids.length})</button>
      <button class="chip" data-etab="coaches" aria-pressed="${eventTab === "coaches"}">Coaches (${coaches.length})</button>
    </div>

    <div class="card">
      <table><thead><tr><th>Name</th><th>Status</th><th>Reason given</th><th style="text-align:right">Change</th></tr></thead>
      <tbody>${list}</tbody></table>
    </div>
    <div class="notice">Change any response and the allocation re-runs. A coach whose own child isn't
      attending can't be placed, so they stand down for the night.</div>`;

  el("view-event").querySelectorAll("[data-etab]").forEach((b) =>
    b.onclick = () => { eventTab = b.dataset.etab; renderEvent(); });

  el("view-event").querySelectorAll(".status-pick").forEach((sel) =>
    sel.onchange = () => {
      state.status.set(Number(sel.dataset.person), sel.value);
      rerun(); renderAll();
    });
}

/* ---------------- groups ---------------- */

function renderGroups() {
  const r = state.result, s = state.settings;
  const sizes = r.groups.map((g) => g.children.length);
  const nChildren = acceptedChildren().length, nCoaches = acceptedCoaches().length;

  const controls = `
    <div class="card card-pad settings">
      <div class="set-grid">
        <label>Mode
          <select id="set-mode">
            <option value="ability" ${state.mode === "ability" ? "selected" : ""}>Balanced ability</option>
            <option value="school" ${state.mode === "school" ? "selected" : ""}>School affinity</option>
          </select></label>
        <label>Groups
          <select id="set-count">
            <option value="0" ${state.groupCount === 0 ? "selected" : ""}>Auto</option>
            ${Array.from({ length: Math.max(s.maxGroups, 1) }, (_, i) => i + 1).map((n) =>
              `<option value="${n}" ${state.groupCount === n ? "selected" : ""}>${n}</option>`).join("")}
          </select></label>
        <label>Target size <input type="number" id="set-target" min="1" max="60" value="${s.targetGroupSize}"></label>
        <label>Minimum size <input type="number" id="set-min" min="1" max="60" value="${s.minGroupSize}"></label>
        <label>Coach ratio 1: <input type="number" id="set-ratio" min="1" max="40" value="${s.ratio}"></label>
        <label>Min coaches <input type="number" id="set-mincoach" min="0" max="6" value="${s.minCoachesPerGroup}"></label>
        <label>Max groups <input type="number" id="set-max" min="1" max="20" value="${s.maxGroups}"></label>
      </div>
      <div class="set-actions">
        <button class="btn" id="btn-clear">Clear pins${state.pins.size ? " (" + state.pins.size + ")" : ""}</button>
        <button class="btn primary" id="btn-rerun">Re-run allocation</button>
      </div>
    </div>`;

  const fail = r.failed ? `<div class="alert stop"><b>The rules can't all be met.</b> ${esc(r.failure)}
      This is a normal outcome on a bad night, not an error &mdash; the groups below are still shown so you can proceed.</div>` : "";

  const move = state.lastMove ? `<div class="alert ${state.lastMove.broke.length ? "stop" : "ok"}">
      <b>${esc(state.lastMove.what)}</b>
      ${state.lastMove.broke.length
        ? " That move breaks: " + esc(state.lastMove.broke.join("; ")) + "."
        : " No rule broken."}
      ${state.lastMove.pairNote ? " " + esc(state.lastMove.pairNote) : ""}
      <button class="link" id="undo-note">dismiss</button></div>` : "";

  const stand = r.standDown && r.standDown.length ? `<div class="alert warn">
      ${plural(r.standDown.length, "coach", "coaches")} accepted but ${r.standDown.length === 1 ? "their child isn't" : "their children aren't"} attending,
      so ${r.standDown.length === 1 ? "they aren't" : "they aren't"} coaching tonight:
      ${esc(r.standDown.map((c) => c.name).join(", "))}.</div>` : "";

  const notes = (r.notes || []).map((n) => `<div class="alert warn">${esc(n)}</div>`).join("");

  const cands = r.candidates.map((c) => `
    <tr class="${c.groups === r.chosen.groups ? "chosen" : ""}">
      <td>${plural(c.groups, "station", "stations")}</td>
      <td class="${c.feasible ? "yes" : "no"}">${c.feasible
        ? "averages " + c.avg.toFixed(1) + " children"
          + (c.groups === r.chosen.groups && !r.forced ? " &larr; closest to the target of " + s.targetGroupSize : "")
        : c.reason}${c.groups === r.chosen.groups && r.forced ? " &larr; set by hand" : ""}</td>
    </tr>`).join("");

  const checks = r.checks.map((c) => `
    <div class="check ${c.ok ? "" : (c.soft ? "warn" : "fail")}">
      <span class="mark">${c.ok ? "&check;" : (c.soft ? "!" : "&times;")}</span>
      <span><b>${c.rule}</b> &mdash; <span class="d">${c.detail}</span></span>
    </div>`).join("");

  const cards = r.groups.map((g) => {
    const counts = [1, 2, 3, 4, 5].map((x) => g.children.filter((c) => c.rating === x).length);
    const spread = counts.map((n, i) => n
      ? `<span style="flex:${n};background:var(--r${i + 1})" title="${n} rated ${i + 1}"></span>` : "").join("");
    const schools = [...new Set(g.children.map((c) => c.school))].map((sc) => {
      const n = g.children.filter((c) => c.school === sc).length;
      return `<span class="schooltag ${n === 1 ? "lone" : ""}">${esc(sc.split(",")[0])} ${n}</span>`;
    }).join("");

    const coaches = g.coaches.map((c) => {
      const kids = c.childIds.map((id) => byId.get(id)).filter((k) => g.children.some((x) => x.id === k.id));
      return `<div class="person coach" draggable="true" data-person="${c.id}" data-kind="coach">
        <span class="tag coach">Coach</span>
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="pinned by a manual move">&#9679;</span>' : ""}</span>
        <span class="sub">${kids.length ? "with " + kids.map((k) => esc(k.firstName)).join(" &amp; ") : ""}</span>
      </div>`;
    }).join("") || '<div class="sub" style="padding:3px 0">No coach</div>';

    const kids = g.children.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `
      <div class="person" draggable="true" data-person="${c.id}" data-kind="child">
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="pinned by a manual move">&#9679;</span>' : ""}</span>
        ${state.mode === "school" ? `<span class="mini">${esc(c.school.split(",")[0].slice(0, 12))}</span>` : ""}
        ${ratingChip(c.rating)}
      </div>`).join("");

    const bad = g.coaches.length < s.minCoachesPerGroup
      || (g.children.length > (g.coaches.length || 0) * s.ratio);

    return `<div class="group ${bad ? "bad" : ""}" data-group="${g.id}">
      <header><h3>${g.name}</h3>
        <span class="n">${plural(g.children.length, "child", "children")} &middot; ${plural(g.coaches.length, "coach", "coaches")}</span></header>
      <div class="spread">${spread}</div>
      <div class="section">
        ${state.mode === "school" ? `<div class="schools">${schools}</div>` : ""}
        <h4>Coaching</h4>${coaches}
        <h4>Players <span class="lock">Ratings admin only</span></h4>${kids}
      </div>
    </div>`;
  }).join("");

  el("view-groups").innerHTML = `
    <div class="page-head"><div><h2>Groups for Wednesday</h2>
      <div class="count">${EVENT.date} &middot; ${state.mode === "ability" ? "balanced ability" : "school affinity"}</div></div>
      <div class="spacer"></div>
      <button class="btn primary">Publish groups</button>
    </div>
    ${controls}${fail}${move}${stand}${notes}
    <div class="banner">
      <div class="lead"><b>${plural(nChildren, "child", "children")}</b> and <b>${plural(nCoaches, "coach", "coaches")}</b> accepted${
        r.coachesUsed !== nCoaches ? " (" + r.coachesUsed + " able to coach)" : ""},
        split into <b>${plural(r.groups.length, "station", "stations")}</b>${sizes.length
          ? " of " + Math.min(...sizes) + "&ndash;" + Math.max(...sizes) : ""}.</div>
      <details class="why"><summary>Why ${r.groups.length} stations?</summary>
        <table class="cand">${cands}</table></details>
    </div>
    <div class="checks">${checks}</div>
    <div class="groups" id="groups-grid">${cards}</div>
    <div class="notice">Drag a child or a coach onto another station to move them. A manual move is pinned and
      survives a re-run. Moving one of a coach and child pair moves the other with it.</div>`;

  wireSettings();
  wireDragDrop();
}

function wireSettings() {
  const num = (id, key, min, max) => {
    const node = el(id);
    if (!node) return;
    node.onchange = () => {
      const v = Math.max(min, Math.min(max, Number(node.value) || min));
      state.settings[key] = v;
      if (state.groupCount > state.settings.maxGroups) state.groupCount = 0;
      rerun(); renderAll();
    };
  };
  num("set-target", "targetGroupSize", 1, 60);
  num("set-min", "minGroupSize", 1, 60);
  num("set-ratio", "ratio", 1, 40);
  num("set-mincoach", "minCoachesPerGroup", 0, 6);
  num("set-max", "maxGroups", 1, 20);

  el("set-mode").onchange = (e) => { state.mode = e.target.value; rerun(); renderAll(); };
  el("set-count").onchange = (e) => { state.groupCount = Number(e.target.value); rerun(); renderAll(); };
  el("btn-rerun").onclick = () => { state.lastMove = null; rerun(); renderAll(); };
  el("btn-clear").onclick = () => { state.lastMove = null; rerun(false); renderAll(); };
  const undo = el("undo-note");
  if (undo) undo.onclick = () => { state.lastMove = null; renderGroups(); };
}

/* ---------------- manual moves ---------------- */

function movePerson(personId, kind, toIdx) {
  const groups = state.result.groups;
  const to = groups[toIdx];
  if (!to) return;

  const from = kind === "child"
    ? groups.find((g) => g.children.some((c) => c.id === personId))
    : groups.find((g) => g.coaches.some((c) => c.id === personId));
  if (!from || from === to) return;

  const movedChildren = [], movedCoaches = [];
  let pairNote = "";

  if (kind === "child") {
    const child = from.children.find((c) => c.id === personId);
    movedChildren.push(child);
    // a coach and child pair is never split by a manual move
    const coachParent = from.coaches.find((a) => a.childIds.includes(personId));
    if (coachParent) {
      movedCoaches.push(coachParent);
      from.children.forEach((c) => {
        if (c.id !== personId && coachParent.childIds.includes(c.id)) movedChildren.push(c);
      });
      pairNote = coachParent.name + " moved too, and stays with "
        + movedChildren.map((c) => c.firstName).join(" and ") + ".";
    }
  } else {
    const coach = from.coaches.find((c) => c.id === personId);
    movedCoaches.push(coach);
    from.children.forEach((c) => { if (coach.childIds.includes(c.id)) movedChildren.push(c); });
    if (movedChildren.length) {
      pairNote = movedChildren.map((c) => c.firstName).join(" and ") + " moved with them.";
    }
  }

  movedChildren.forEach((c) => {
    from.children.splice(from.children.indexOf(c), 1);
    to.children.push(c); state.pins.set(c.id, to.id);
  });
  movedCoaches.forEach((c) => {
    from.coaches.splice(from.coaches.indexOf(c), 1);
    to.coaches.push(c); state.pins.set(c.id, to.id);
  });

  state.result.checks = checkRules(state.result.groups, byId, state.settings, state.mode, acceptedChildren());
  const broke = state.result.checks.filter((c) => !c.ok).map((c) => c.rule + " (" + c.detail + ")");
  const who = movedCoaches.concat(movedChildren).map((p) => p.firstName || p.name);

  state.lastMove = {
    what: who.join(", ") + " moved from " + from.name + " to " + to.name + ".",
    broke, pairNote
  };
  renderGroups(); renderParent();
}

function wireDragDrop() {
  const grid = el("groups-grid");
  if (!grid) return;
  let dragging = null;

  grid.addEventListener("dragstart", (e) => {
    const p = e.target.closest("[data-person]");
    if (!p) return;
    dragging = { id: Number(p.dataset.person), kind: p.dataset.kind };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dragging.id));
    p.classList.add("dragging");
  });
  grid.addEventListener("dragend", (e) => {
    const p = e.target.closest("[data-person]");
    if (p) p.classList.remove("dragging");
    grid.querySelectorAll(".group.over").forEach((g) => g.classList.remove("over"));
  });
  grid.addEventListener("dragover", (e) => {
    const g = e.target.closest("[data-group]");
    if (!g || !dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    grid.querySelectorAll(".group.over").forEach((x) => { if (x !== g) x.classList.remove("over"); });
    g.classList.add("over");
  });
  grid.addEventListener("drop", (e) => {
    const g = e.target.closest("[data-group]");
    if (!g || !dragging) return;
    e.preventDefault();
    const d = dragging; dragging = null;
    movePerson(d.id, d.kind, Number(g.dataset.group));
  });
}

/* ---------------- parent view ---------------- */

let parentId = null;

function renderParent() {
  const groupOfChild = new Map();
  state.result.groups.forEach((g) => g.children.forEach((c) => groupOfChild.set(c.id, g)));

  const eligible = allAdults
    .filter((a) => a.childIds.some((id) => groupOfChild.has(id)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  if (!eligible.length) {
    el("view-parent").innerHTML = `<div class="page-head"><div><h2>What a parent sees</h2></div></div>
      <div class="card card-pad">Nobody is placed in a group, so there is nothing for a parent to see.</div>`;
    return;
  }
  if (!parentId || !eligible.some((a) => a.id === parentId)) {
    const twoKidCoach = eligible.find((a) => state.coach.get(a.id) && a.childIds.length === 2);
    parentId = (twoKidCoach || eligible[0]).id;
  }
  const parent = byId.get(parentId);
  const kids = parent.childIds.map((id) => byId.get(id)).filter((k) => groupOfChild.has(k.id));

  const byGroup = new Map();
  kids.forEach((k) => {
    const g = groupOfChild.get(k.id);
    if (!byGroup.has(g.id)) byGroup.set(g.id, { g, mine: [] });
    byGroup.get(g.id).mine.push(k);
  });

  const cards = [...byGroup.values()].map(({ g, mine }) => {
    const mineIds = new Set(mine.map((k) => k.id));
    const others = g.children.filter((c) => !mineIds.has(c.id))
      .slice().sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="pcard">
        <div class="ev">${EVENT.date} &middot; ${EVENT.time}</div>
        <div class="grp">${g.name}</div>
        <div class="sub">${mine.map((k) => esc(k.name)).join(" and ")} &middot; ${esc(EVENT.venue)}</div>
      </div>
      <div class="pcard"><h4>Coaching this station</h4>
        <ul>${g.coaches.length
          ? g.coaches.map((c) => `<li class="${c.id === parent.id ? "me" : ""}">${esc(c.name)}${c.id === parent.id ? " (you)" : ""}</li>`).join("")
          : "<li>Not yet assigned</li>"}</ul></div>
      <div class="pcard"><h4>Also in ${g.name} (${others.length})</h4>
        <ul>${others.map((c) => `<li>${esc(c.name)}</li>`).join("")}</ul></div>`;
  }).join("");

  el("view-parent").innerHTML = `
    <div class="page-head"><div><h2>What a parent sees</h2>
      <div class="count">The same session, from a parent's phone</div></div></div>
    <div class="parent-wrap">
      <div>
        <div class="card card-pad" style="margin-bottom:14px">
          <div class="k sub" style="margin-bottom:8px">Viewing as</div>
          <select class="pick" id="parent-pick">
            ${eligible.map((a) => `<option value="${a.id}" ${a.id === parentId ? "selected" : ""}>
              ${esc(a.name)}${state.coach.get(a.id) ? " — coach" : ""} (${esc(a.childIds.map((id) => byId.get(id).firstName).join(", "))})
            </option>`).join("")}
          </select>
        </div>
        <div class="card card-pad">
          <h3 style="font-size:15px;margin-bottom:10px">What is deliberately missing</h3>
          <div class="note" style="margin-bottom:9px"><b>No ability ratings.</b> Not for other children and not for their own. A rating is never given as the reason for a placement.</div>
          <div class="note" style="margin-bottom:9px"><b>No schools.</b> A parent sees their own child's school because they entered it, but never another child's.</div>
          <div class="note"><b>No decline reasons</b> and no sight of who did not respond.</div>
          ${kids.map((k) => `<div class="note" style="margin-top:9px">${esc(k.firstName)}'s school is <b>${esc(k.school)}</b> &mdash; shown here only because ${esc(parent.firstName)} entered it.</div>`).join("")}
        </div>
      </div>
      <div class="phone"><div class="screen">
        <div class="pbar">Kilcarrig GAA &middot; Under 9</div>
        <div class="pbody">${cards}</div>
      </div></div>
    </div>`;

  el("parent-pick").onchange = (e) => { parentId = Number(e.target.value); renderParent(); };
}

/* ---------------- shell ---------------- */

document.querySelectorAll(".tabs button").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
  };
});

rerun();
renderAll();
