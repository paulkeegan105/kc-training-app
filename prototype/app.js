/* Screens and interaction. Everything re-renders from `state`; nothing is persisted. */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (id) => document.getElementById(id);
const STATUS_LABEL = { accepted: "Accepted", declined: "Declined", none: "No response" };
const pill = (s) => `<span class="pill ${s}">${STATUS_LABEL[s]}</span>`;
const ratingChip = (r) => `<span class="rating r${r}">${r}</span>`;
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

const state = {
  teamId: "u9",
  eventId: null,
  settings: null,
  mode: null,
  groupCount: 0,
  pins: new Map(),
  result: null,
  lastMove: null,
  inviteChildId: null,
  inviteStep: "ask",
  inviteDraft: "",
  rerunNotice: null,
  editingId: null,
  editError: ""
};

const team = () => TEAM_BY_ID.get(state.teamId);
const ev = () => team().events.find((e) => e.id === state.eventId);
const teamChildren = () => team().people.filter((p) => p.type === "child");
const teamAdults = () => team().people.filter((p) => p.type === "adult");
const coachesNow = () => teamAdults().filter((a) => a.coachIn[state.teamId]);
const invitedNow = () => teamChildren().concat(coachesNow());
const statusOf = (id) => ev().status.get(id) || "none";
const acceptedChildren = () => teamChildren().filter((c) => statusOf(c.id) === "accepted");
const acceptedCoaches = () => coachesNow().filter((a) => statusOf(a.id) === "accepted");
const parentsOf = (child) => child.parentIds.map((id) => BY_ID.get(id)).filter(Boolean);

function selectTeam(id) {
  state.teamId = id;
  const t = team();
  state.settings = { ...t.settings };
  state.mode = t.mode;
  state.groupCount = 0;
  selectEvent(nextEventFor(t).id);
}
function selectEvent(id) {
  state.eventId = id;
  state.pins.clear();
  state.lastMove = null;
  state.inviteChildId = null;
  state.inviteStep = "ask";
  state.rerunNotice = null;
  rerun();
}

function placementSnapshot() {
  if (!state.result) return null;
  const map = new Map();
  state.result.groups.forEach((g) => g.children.forEach((c) => map.set(c.id, g.name)));
  return { map, count: state.result.groups.length };
}

/* what actually changed, so a re-run is never silent */
function describeRerun(reason, before, after) {
  if (!after) return { reason, detail: "there are no groups to show" };
  const bits = [];
  if (before && before.count !== after.count) {
    bits.push(before.count + (before.count === 1 ? " group became " : " groups became ") + after.count);
  } else {
    bits.push(plural(after.count, "group", "groups"));
  }
  if (before) {
    let moved = 0, added = 0, gone = 0;
    after.map.forEach((g, id) => {
      if (!before.map.has(id)) added++;
      else if (before.map.get(id) !== g) moved++;
    });
    before.map.forEach((g, id) => { if (!after.map.has(id)) gone++; });
    if (added) bits.push(plural(added, "child", "children") + " added");
    if (gone) bits.push(plural(gone, "child", "children") + " taken out");
    if (moved) bits.push(plural(moved, "child", "children") + " changed group");
    if (!added && !gone && !moved) bits.push("nobody changed group");
  }
  return { reason, detail: bits.join(", ") };
}

function rerun(keepPins = true, reason = null) {
  const before = placementSnapshot();
  if (!keepPins) state.pins.clear();
  const e = ev();
  if (!e || !e.published || e.cancelled) {
    state.result = null;
    if (reason) state.rerunNotice = describeRerun(reason, before, null);
    return;
  }
  state.result = allocate({
    children: acceptedChildren(), coaches: acceptedCoaches(), byId: BY_ID,
    settings: state.settings, mode: state.mode, pins: state.pins,
    forcedCount: state.groupCount || null,
    groupLabel: e.type === "Game" ? "Team" : "Station"
  });
  if (reason) state.rerunNotice = describeRerun(reason, before, placementSnapshot());
}

/* the other age group's allocation, for a parent with a child in each */
function allocationFor(t, e) {
  if (!e || !e.published || e.cancelled) return null;
  const kids = t.people.filter((p) => p.type === "child" && e.status.get(p.id) === "accepted");
  const coaches = t.people.filter((p) => p.type === "adult" && p.coachIn[t.id] && e.status.get(p.id) === "accepted");
  return allocate({ children: kids, coaches, byId: BY_ID, settings: t.settings, mode: t.mode,
    pins: new Map(), groupLabel: e.type === "Game" ? "Team" : "Station" });
}

function renderWhoami() {
  const role = CURRENT_USER.roleIn[state.teamId];
  el("whoami").innerHTML = `<b>${esc(CURRENT_USER.name)}</b>${role ? esc(ROLE_LABEL[role]) : "Member"}`
    + (CURRENT_USER.coachIn[state.teamId] ? " &middot; coach" : "");
}

function renderAll() {
  const y = window.scrollY;
  renderWhoami();
  renderCalendar(); renderMembers(); renderInvite(); renderGroups(); renderParent();
  window.scrollTo(0, y);
}

/* ---------------- calendar ---------------- */

function eventTitle(e) {
  if (e.title) return e.title;
  if (e.type === "Game") return (e.away ? "Away to " : "Home to ") + e.opposition;
  return "Training";
}

function renderCalendar() {
  const t = team();
  const months = [];
  t.events.forEach((e) => {
    const m = e.longDate.split(" ").slice(2).join(" ");
    if (!months.length || months[months.length - 1].label !== m) months.push({ label: m, events: [] });
    months[months.length - 1].events.push(e);
  });

  const body = months.map((m) => `
    <div class="month">${m.label}</div>
    ${m.events.map((e) => {
      const open = e.id === state.eventId;
      const counts = ["accepted", "declined", "none"].map((k) =>
        [...e.status.entries()].filter(([, v]) => v === k).length);
      const tags = [];
      if (e.cancelled) tags.push('<span class="tag cancelled">Cancelled</span>');
      else if (e.draft) tags.push('<span class="tag draft">Draft &middot; not published</span>');
      else if (e.past) tags.push('<span class="tag unreg">Finished</span>');
      if (e.published && !e.cancelled) tags.push(`<span class="pill accepted">${counts[0]} in</span>`);

      return `<div class="evrow ${open ? "is-open" : ""} ${e.draft ? "is-draft" : ""} ${e.cancelled ? "is-cancelled" : ""} ${e.past ? "is-past" : ""}">
        <button class="evhead" data-event="${e.id}">
          <span class="evdate"><span class="d">${e.date.slice(8)}</span><span class="m">${e.dayName.slice(0, 3)}</span></span>
          <span class="evmain">
            <span class="t">${esc(eventTitle(e))}</span>
            <span class="s">${eventTitle(e) === e.type ? "" : e.type + " &middot; "}${e.time}&ndash;${e.endTime} &middot; ${esc(e.venue)}</span>
          </span>
          <span class="evtags">${tags.join(" ")}</span>
        </button>
        ${open ? `<div class="evbody">
          ${e.cancelled ? `<div class="alert stop" style="margin-top:14px"><b>Cancelled.</b> ${esc(e.cancelled)} Everyone invited was notified.</div>` : ""}
          ${e.draft ? `<div class="alert warn" style="margin-top:14px"><b>This is a draft.</b>
            No member can see it, it can still be edited freely and it can be deleted outright.
            Publishing is what sends the invitations, to every child and every flagged coach.</div>` : ""}
          <div class="meta">
            <div><div class="k">Type</div>${e.type}</div>
            <div><div class="k">Meet</div>${e.meetTime}</div>
            <div><div class="k">Duration</div>${e.duration} min</div>
            <div><div class="k">Venue</div>${esc(e.venue)}</div>
            ${e.opposition ? `<div><div class="k">Opposition</div>${esc(e.opposition)}</div>` : ""}
            <div><div class="k">Mode</div>${e.mode === "ability" ? "Balanced ability" : "School affinity"}</div>
          </div>
          ${e.published && !e.cancelled ? `<div class="mini-stats">
            <div class="accepted"><b>${counts[0]}</b> accepted</div>
            <div class="declined"><b>${counts[1]}</b> declined</div>
            <div><b>${counts[2]}</b> no response</div>
          </div>` : ""}
          <div class="toolbar" style="margin:0 0 4px">
            ${e.draft ? `<button class="btn primary" data-publish="${e.id}">Publish and invite</button>
              <button class="btn" data-delete="${e.id}">Delete</button>` : ""}
            ${e.published && !e.cancelled ? `<button class="btn" data-go="groups">See the groups</button>
              <button class="btn" data-go="invite">See what a parent gets</button>` : ""}
          </div>
          ${e.published && !e.cancelled ? responseList(e) : ""}
        </div>` : ""}
      </div>`;
    }).join("")}`).join("");

  el("view-calendar").innerHTML = `
    <div class="page-head">
      <div><h2>Season calendar</h2>
        <div class="count">${t.name} &middot; ${plural(t.events.length, "event", "events")} &middot;
          ${t.events.filter((e) => e.draft).length} in draft</div></div>
      <div class="spacer"></div>
      <button class="btn">Import CSV</button>
      <button class="btn primary">New event</button>
    </div>
    ${body}
    <div class="notice">A draft is invisible to members and can be deleted. Once published it can only be
      cancelled, which asks for a reason and notifies everyone.</div>`;

  el("view-calendar").querySelectorAll("[data-event]").forEach((b) =>
    b.onclick = () => { selectEvent(b.dataset.event); renderAll(); });
  el("view-calendar").querySelectorAll("[data-publish]").forEach((b) =>
    b.onclick = () => { publishEvent(ev()); rerun(); renderAll(); });
  el("view-calendar").querySelectorAll("[data-delete]").forEach((b) =>
    b.onclick = () => {
      const t2 = team(), e = ev();
      t2.events.splice(t2.events.indexOf(e), 1);
      selectEvent(nextEventFor(t2).id); renderAll();
    });
  el("view-calendar").querySelectorAll("[data-go]").forEach((b) =>
    b.onclick = () => showView(b.dataset.go));
  el("view-calendar").querySelectorAll("[data-caltab]").forEach((b) =>
    b.onclick = () => { calTab = b.dataset.caltab; renderCalendar(); });
  el("view-calendar").querySelectorAll(".status-pick").forEach((sel) =>
    sel.onchange = () => {
      const id = Number(sel.dataset.person);
      ev().status.set(id, sel.value);
      if (sel.value !== "declined") ev().reason.delete(id);
      const who = BY_ID.get(id);
      rerun(true, who.name + " was set to " + STATUS_LABEL[sel.value].toLowerCase() + " by an admin");
      renderAll();
    });
}

function publishEvent(e) {
  e.published = true; e.draft = false;
  const t = TEAM_BY_ID.get(e.teamId);
  t.people.filter((p) => p.type === "child").forEach((c) => e.status.set(c.id, "none"));
  t.people.filter((p) => p.type === "adult" && p.coachIn[t.id]).forEach((a) => e.status.set(a.id, "none"));
}

function responseList(e) {
  const t = team();
  const kids = t.people.filter((p) => p.type === "child");
  const coaches = t.people.filter((p) => p.type === "adult" && p.coachIn[t.id]);
  const rank = { accepted: 0, declined: 1, none: 2 };

  const rows = (calTab === "children" ? kids : coaches).slice()
    .sort((a, b) => rank[e.status.get(a.id) || "none"] - rank[e.status.get(b.id) || "none"]
      || a.lastName.localeCompare(b.lastName))
    .map((p) => {
      const st = e.status.get(p.id) || "none";
      const why = e.reason.get(p.id);
      const sub = p.type === "child"
        ? "Child &middot; " + esc(parentsOf(p).map((a) => a.name).join(", "))
        : "Coach &middot; parent of " + esc(p.childIds.map((id) => BY_ID.get(id)).filter(Boolean).map((c) => c.name).join(", "));
      return `<tr>
        <td><div class="name">${esc(p.name)}</div><div class="sub">${sub}</div></td>
        <td>${pill(st)}</td>
        <td class="sub">${st === "declined" && why ? esc(why) + ' <span class="lock">Admin only</span>' : ""}</td>
        <td style="text-align:right"><select class="status-pick" data-person="${p.id}">
          ${["accepted", "declined", "none"].map((k) =>
            `<option value="${k}" ${st === k ? "selected" : ""}>${STATUS_LABEL[k]}</option>`).join("")}
        </select></td></tr>`;
    }).join("");

  return `
    <div class="toolbar" style="margin:14px 0 8px">
      <button class="chip" data-caltab="children" aria-pressed="${calTab === "children"}">Children (${kids.length})</button>
      <button class="chip" data-caltab="coaches" aria-pressed="${calTab === "coaches"}">Coaches (${coaches.length})</button>
    </div>
    <div class="card" style="max-height:360px;overflow:auto"><table>
      <thead><tr><th>Name</th><th>Status</th><th>Reason given</th><th style="text-align:right">Change</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="notice">An admin can override anyone's response. The override is visible to that person,
      shown as set by an admin, and feeds the allocation exactly like a real answer.</div>`;
}

/* ---------------- members ---------------- */

let memberFilter = "all", memberSearch = "";
let calTab = "children";

function renderMembers() {
  const t = team();
  let rows = t.people.slice();
  if (memberFilter === "children") rows = rows.filter((p) => p.type === "child");
  if (memberFilter === "adults") rows = rows.filter((p) => p.type === "adult");
  if (memberFilter === "coaches") rows = rows.filter((p) => p.coachIn && p.coachIn[t.id]);
  if (memberFilter === "unregistered") rows = rows.filter((p) => p.type === "adult" && !p.registered);
  if (memberSearch) {
    const q = memberSearch.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || (p.school || "").toLowerCase().includes(q));
  }
  rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

  const body = rows.map((p) => {
    if (p.type === "child") {
      const ps = parentsOf(p).map((a) => a.name + (a.coachIn[t.id] ? " (coach)" : "")).join(", ");
      return `<tr>
        <td><div class="name">${esc(p.name)}</div><div class="sub">Child &middot; ${esc(ps)}</div></td>
        <td>${esc(p.school)}</td>
        <td>${ratingChip(p.rating)}</td>
        <td class="rolecell">Player</td>
        <td></td>
        <td class="sub">via parent</td>
        <td style="text-align:right"><button class="btn tiny" data-edit="${p.id}">Edit</button></td></tr>`;
    }
    const kids = p.childIds.map((id) => BY_ID.get(id)).filter(Boolean);
    const here = kids.filter((k) => k.teamId === t.id).map((k) => k.name).join(", ");
    const away = kids.filter((k) => k.teamId !== t.id);
    const on = !!p.coachIn[t.id];
    const role = p.roleIn[t.id];
    return `<tr>
      <td><div class="name">${esc(p.name)}</div>
        <div class="sub">Adult &middot; parent of ${esc(here)}${away.length
          ? " &middot; also " + esc(away.map((k) => k.name + " in " + TEAM_BY_ID.get(k.teamId).name).join(", ")) : ""}</div></td>
      <td class="sub">&mdash;</td>
      <td class="sub">&mdash;</td>
      <td class="rolecell">${role ? esc(ROLE_LABEL[role]) : ""}</td>
      <td><label class="toggle">
        <input type="checkbox" data-coach="${p.id}" ${on ? "checked" : ""}>
        <span class="track"></span>
        <span class="tl">${on ? "Coach" : "Not coaching"}</span></label></td>
      <td>${p.registered ? '<span class="tag reg">Registered</span>' : '<span class="tag unreg">Unregistered</span>'}
        <div class="sub">${esc(p.email)}</div></td>
      <td style="text-align:right"><button class="btn tiny" data-edit="${p.id}">Edit</button></td></tr>`;
  }).join("");

  el("view-members").innerHTML = `
    <div class="page-head">
      <div><h2>Team members</h2>
        <div class="count">${t.name} &middot; ${teamChildren().length} children and ${teamAdults().length} adults,
          ${coachesNow().length} of them flagged as coaches</div></div>
      <div class="spacer"></div>
      <button class="btn">Import CSV</button><button class="btn primary">Add member</button>
    </div>
    <div class="toolbar">
      ${[["all", "All"], ["children", "Children"], ["adults", "Adults"], ["coaches", "Coaches"], ["unregistered", "Unregistered"]]
        .map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${memberFilter === k}">${l}</button>`).join("")}
      <div class="spacer"></div>
      <input class="search" id="member-search" placeholder="Search name or school" value="${esc(memberSearch)}">
    </div>
    <div class="card"><table>
      <thead><tr><th>Name</th><th>School <span class="lock">Admin only</span></th>
        <th>Rating <span class="lock">Admin only</span></th><th>Role</th><th>Coaching</th>
        <th>Account</th><th></th></tr></thead>
      <tbody>${body || '<tr><td colspan="7" class="sub" style="padding:22px">Nobody matches that.</td></tr>'}</tbody>
    </table></div>
    ${editModal()}
    <div class="notice">Coaching is a flag, not a role: it says what someone does at a session, and it is set
      per age group. Roles say what someone can do in the app. Children are players; adults never are.</div>`;

  el("view-members").querySelectorAll("[data-filter]").forEach((b) =>
    b.onclick = () => { memberFilter = b.dataset.filter; renderMembers(); });
  el("view-members").querySelectorAll("[data-coach]").forEach((cb) =>
    cb.onchange = () => {
      const p = BY_ID.get(Number(cb.dataset.coach));
      p.coachIn[state.teamId] = cb.checked;
      if (cb.checked && !ev().status.has(p.id)) ev().status.set(p.id, "none");
      rerun(true, p.name + (cb.checked ? " was flagged as a coach" : " is no longer flagged as a coach"));
      renderAll();
    });
  el("view-members").querySelectorAll("[data-edit]").forEach((b) =>
    b.onclick = () => { state.editingId = Number(b.dataset.edit); state.editError = ""; renderMembers(); });
  wireEditModal();

  const s = el("member-search");
  s.oninput = () => {
    memberSearch = s.value;
    const at = s.selectionStart;
    renderMembers();
    const ns = el("member-search"); ns.focus(); ns.setSelectionRange(at, at);
  };
}

function editModal() {
  if (!state.editingId) return "";
  const p = BY_ID.get(state.editingId);
  if (!p) return "";
  const t = team();
  const err = state.editError ? `<div class="field"><div class="err">${esc(state.editError)}</div></div>` : "";
  const actions = `<div class="modal-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn primary" id="f-save">Save changes</button></div>`;

  if (p.type === "child") {
    const known = t.schools.includes(p.school);
    return `<div class="modal-backdrop" id="edit-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Edit member">
      <h3>Edit ${esc(p.name)}</h3>
      <div class="msub">Child in ${t.name}</div>
      <div class="row2">
        <div class="field"><label for="f-first">First name</label><input id="f-first" value="${esc(p.firstName)}"></div>
        <div class="field"><label for="f-last">Surname</label><input id="f-last" value="${esc(p.lastName)}"></div>
      </div>
      <div class="field"><label for="f-school">School</label>
        <select id="f-school">
          ${t.schools.map((s) => `<option value="${esc(s)}" ${s === p.school ? "selected" : ""}>${esc(s)}</option>`).join("")}
          <option value="__other" ${known ? "" : "selected"}>Other&hellip;</option>
        </select>
        <input id="f-school-other" placeholder="School name" value="${known ? "" : esc(p.school)}" ${known ? "hidden" : ""}>
        <div class="hint">The club list is kept by a Club Admin. A school is never shown to another child's parent.</div>
      </div>
      <div class="field"><label for="f-rating">Ability rating</label>
        <select id="f-rating">${[1, 2, 3, 4, 5].map((n) =>
          `<option value="${n}" ${n === p.rating ? "selected" : ""}>${n}${n === 1 ? " — strongest" : n === 5 ? " — needs most support" : ""}</option>`).join("")}</select>
        <div class="hint">Admin only. Never shown to any parent, and never given as the reason for a placement.</div>
      </div>
      ${err}${actions}</div></div>`;
  }

  return `<div class="modal-backdrop" id="edit-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Edit member">
    <h3>Edit ${esc(p.name)}</h3>
    <div class="msub">Adult${p.roleIn[t.id] ? " &middot; " + esc(ROLE_LABEL[p.roleIn[t.id]]) : ""} in ${t.name}</div>
    ${p.registered ? `<div class="alert warn" style="margin-bottom:14px">This member has signed up, so under the
      current spec they manage their own details and an admin cannot edit them. Editing is left open here so the
      prototype stays testable.</div>` : ""}
    <div class="row2">
      <div class="field"><label for="f-first">First name</label><input id="f-first" value="${esc(p.firstName)}"></div>
      <div class="field"><label for="f-last">Surname</label><input id="f-last" value="${esc(p.lastName)}"></div>
    </div>
    <div class="field"><label for="f-email">Email address</label><input id="f-email" type="email" value="${esc(p.email)}">
      <div class="hint">Required. It is how they are notified and how a signup is matched to this record.</div></div>
    <div class="field"><label for="f-phone">Phone number</label><input id="f-phone" value="${esc(p.phone || "")}">
      <div class="hint">Optional, and used for tap-to-call only. There is no SMS anywhere in the app.</div></div>
    ${err}${actions}</div></div>`;
}

function wireEditModal() {
  const back = el("edit-backdrop");
  if (!back) return;
  const close = () => { state.editingId = null; state.editError = ""; renderMembers(); };
  back.onclick = (e) => { if (e.target === back) close(); };
  el("f-cancel").onclick = close;
  document.onkeydown = (e) => { if (e.key === "Escape" && state.editingId) close(); };

  const schoolSel = el("f-school");
  if (schoolSel) schoolSel.onchange = () => {
    const other = el("f-school-other");
    other.hidden = schoolSel.value !== "__other";
    if (!other.hidden) other.focus();
  };

  el("f-save").onclick = () => {
    const p = BY_ID.get(state.editingId);
    const first = el("f-first").value.trim(), last = el("f-last").value.trim();
    if (!first || !last) { state.editError = "A first name and a surname are both needed."; return renderMembers(); }

    let reason = null;
    const wasName = p.name;
    p.firstName = first; p.lastName = last; p.name = first + " " + last;

    if (p.type === "child") {
      const sel = el("f-school").value;
      const school = sel === "__other" ? el("f-school-other").value.trim() : sel;
      if (!school) { state.editError = "Give the school a name, or pick one from the list."; return renderMembers(); }
      const rating = Number(el("f-rating").value);
      const schoolChanged = school !== p.school, ratingChanged = rating !== p.rating;
      p.school = school; p.rating = rating;
      if (ratingChanged || schoolChanged) {
        reason = p.name + "'s " + (ratingChanged && schoolChanged ? "rating and school were"
          : ratingChanged ? "rating was" : "school was") + " changed by an admin";
      }
    } else {
      const email = el("f-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        state.editError = "That email address doesn't look right. Every adult needs one.";
        return renderMembers();
      }
      p.email = email;
      p.phone = el("f-phone").value.trim();
    }

    state.editingId = null; state.editError = "";
    if (reason) { rerun(true, reason); renderAll(); }
    else if (wasName !== p.name) renderAll();
    else renderMembers();
  };
}

/* ---------------- the parent's invitation ---------------- */

function inviteChild() {
  const e = ev();
  if (state.inviteChildId) {
    const c = BY_ID.get(state.inviteChildId);
    if (c && c.teamId === state.teamId) return c;
  }
  const kids = teamChildren();
  const mine = kids.find((c) => c.parentIds.includes(SHARED_PARENT.parent.id));
  const waiting = kids.find((c) => e.status.get(c.id) === "none");
  return mine || waiting || kids[0];
}

function answer(child, value, reason) {
  const e = ev();
  e.status.set(child.id, value);
  if (value === "declined" && reason) e.reason.set(child.id, reason);
  if (value !== "declined") e.reason.delete(child.id);
  state.inviteStep = "done";
  state.inviteDraft = "";
  rerun(true, child.name + " " + (value === "accepted" ? "accepted" : "declined") + " on their own invitation");
  renderAll();
}

function renderInvite() {
  const e = ev(), t = team();
  const wrap = el("view-invite");

  if (!e.published) {
    wrap.innerHTML = `<div class="page-head"><div><h2>The parent's invitation</h2>
      <div class="count">${esc(eventTitle(e))} &middot; ${e.longDate}</div></div></div>
      <div class="alert warn"><b>Nothing has been sent yet.</b> This event is still a draft, so no member can
      see it. Publish it on the calendar and the invitation below goes out.</div>`;
    return;
  }

  const child = inviteChild();
  const parent = parentsOf(child)[0];
  const st = e.status.get(child.id) || "none";
  const step = st !== "none" && state.inviteStep !== "reason" ? "done" : state.inviteStep;
  const subject = t.name + " " + (e.type === "Game" ? "match" : e.type.toLowerCase()) + " — " + e.dayName + " " + e.shortDate;

  const facts = `
    <div class="mfacts">
      <div><span class="k">What</span><span>${esc(eventTitle(e))}</span></div>
      <div><span class="k">When</span><span>${e.longDate}, ${e.time}&ndash;${e.endTime}</span></div>
      <div><span class="k">Meet</span><span>${e.meetTime}</span></div>
      <div><span class="k">Where</span><span>${esc(e.venue)}</span></div>
    </div>`;

  let panel;
  if (step === "reason") {
    panel = `
      <div class="pcard">
        <div class="ev">${esc(eventTitle(e))} &middot; ${e.dayName} ${e.shortDate}</div>
        <div class="ask">Thanks &mdash; what's the reason?</div>
        <textarea class="reasonbox" id="reason-box" placeholder="A quick line is enough">${esc(state.inviteDraft)}</textarea>
        <div class="note" style="margin:10px 0">Only the team admin sees this. It is never shown to other parents.</div>
        <div class="answer-btns">
          <button class="btn primary" id="send-decline">Send</button>
          <button class="btn" id="back-ask">Back</button>
        </div>
      </div>`;
  } else if (step === "done") {
    const yes = st === "accepted";
    panel = `
      <div class="pcard">
        <div class="done ${yes ? "yes" : "no"}">
          <div class="tick">${yes ? "&check;" : "&times;"}</div>
          <div style="font-weight:700;font-size:16px">${yes ? esc(child.firstName) + " is down as going" : esc(child.firstName) + " is marked as not going"}</div>
          <div class="sub" style="margin-top:5px">${esc(eventTitle(e))} &middot; ${e.dayName} ${e.shortDate}, ${e.time}</div>
        </div>
      </div>
      ${!yes && e.reason.get(child.id) ? `<div class="pcard"><h4>Reason you gave</h4>
        <div style="font-size:13.5px">${esc(e.reason.get(child.id))}</div></div>` : ""}
      <div class="pcard">
        <h4>Changed your mind?</h4>
        <div class="answer-btns"><button class="btn" id="change-answer">Change your answer</button></div>
      </div>`;
  } else {
    panel = `
      <div class="pcard">
        <div class="ev">${t.name} &middot; ${e.type}</div>
        <div class="grp" style="font-size:19px">${esc(eventTitle(e))}</div>
        <div class="sub">${e.longDate}<br>${e.time}&ndash;${e.endTime} &middot; meet at ${e.meetTime}<br>${esc(e.venue)}</div>
      </div>
      <div class="pcard">
        <div class="ask">Can ${esc(child.firstName)} make it?</div>
        <div class="answer-btns">
          <button class="btn gold" id="say-yes">Yes, ${esc(child.firstName)} will be there</button>
          <button class="btn" id="say-no">No, can't make it</button>
        </div>
        <div class="note" style="margin-top:11px">You are answering for ${esc(child.name)}.
          ${parent && parent.coachIn[t.id] ? "You are asked separately about coaching on the night." : ""}</div>
      </div>`;
  }

  wrap.innerHTML = `
    <div class="page-head">
      <div><h2>The parent's invitation</h2>
        <div class="count">${esc(eventTitle(e))} &middot; ${e.longDate}</div></div>
      <div class="spacer"></div>
      <select class="pick" id="invite-child">
        ${teamChildren().slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) =>
          `<option value="${c.id}" ${c.id === child.id ? "selected" : ""}>${esc(c.name)} — ${STATUS_LABEL[e.status.get(c.id) || "none"]}</option>`).join("")}
      </select>
    </div>

    <div class="invite-wrap">
      <div>
        <div class="phone-label">1. The email that arrives</div>
        <div class="phone"><div class="screen">
          <div class="pbar"><img src="Kilmacud_crokes_logo.png" alt="">Inbox</div>
          <div class="pbody">
            <div class="mail">
              <div class="mhead">
                <div class="msub">${esc(subject)}</div>
                <div class="mfrom">Kilmacud Crokes &lt;noreply@kilmacudcrokes.ie&gt;<br>to ${esc(parent ? parent.email : "")}</div>
              </div>
              <div class="mbody">
                <p>Hi ${esc(parent ? parent.firstName : "there")},</p>
                <p>${esc(child.firstName)} is invited to ${t.name} ${e.type === "Game" ? "match" : e.type.toLowerCase()}.</p>
                ${facts}
                <p>Can ${esc(child.firstName)} make it?</p>
                <div class="mbtns">
                  <button class="btn gold" id="mail-yes">Yes</button>
                  <button class="btn" id="mail-no">Can't make it</button>
                </div>
              </div>
              <div class="foot">You are getting this because ${esc(child.firstName)} is on the ${t.name} team.
                No app to install &mdash; the buttons open the page on the right.</div>
            </div>
          </div>
        </div></div>
      </div>

      <div>
        <div class="phone-label">2. The screen the buttons open</div>
        <div class="phone"><div class="screen">
          <div class="pbar"><img src="Kilmacud_crokes_logo.png" alt="">Kilmacud Crokes &middot; ${t.name}</div>
          <div class="pbody">${panel}</div>
        </div></div>
      </div>

      <div style="flex:1;min-width:240px">
        <div class="card card-pad">
          <h3 style="font-size:15px;margin-bottom:10px">What this screen does</h3>
          <div class="note" style="margin-bottom:9px">Answers are <b>per child</b>, not per account. Either parent on
            the account can answer, and either can change it afterwards.</div>
          <div class="note" style="margin-bottom:9px">A decline asks for a reason. Only the admin sees it.</div>
          <div class="note" style="margin-bottom:9px">A coaching parent answers for themselves separately, because
            they can be unavailable on a night their child still attends.</div>
          <div class="note">Answering here re-runs the allocation straight away &mdash; check the Groups tab.</div>
        </div>
      </div>
    </div>`;

  const pickC = el("invite-child");
  pickC.onchange = () => {
    state.inviteChildId = Number(pickC.value);
    state.inviteStep = "ask"; state.inviteDraft = "";
    renderInvite();
  };
  const yes = () => answer(child, "accepted");
  const no = () => { state.inviteStep = "reason"; renderInvite(); };
  ["say-yes", "mail-yes"].forEach((id) => { if (el(id)) el(id).onclick = yes; });
  ["say-no", "mail-no"].forEach((id) => { if (el(id)) el(id).onclick = no; });
  if (el("send-decline")) el("send-decline").onclick = () => answer(child, "declined", el("reason-box").value.trim());
  if (el("back-ask")) el("back-ask").onclick = () => { state.inviteStep = "ask"; renderInvite(); };
  if (el("change-answer")) el("change-answer").onclick = () => {
    ev().status.set(child.id, "none"); ev().reason.delete(child.id);
    state.inviteStep = "ask";
    rerun(true, child.name + "'s answer was cleared"); renderAll();
  };
  if (el("reason-box")) el("reason-box").oninput = (e2) => { state.inviteDraft = e2.target.value; };
}

/* ---------------- groups ---------------- */

function renderGroups() {
  const e = ev(), t = team();
  const head = `<div class="page-head">
      <div><h2>Groups</h2><div class="count">${esc(eventTitle(e))} &middot; ${e.longDate} &middot; ${t.name}</div></div>
      <div class="spacer"></div>
      <button class="btn primary">Publish groups</button></div>`;

  if (!e.published) {
    el("view-groups").innerHTML = head + `<div class="alert warn"><b>This event is a draft.</b>
      Nobody has been invited, so there are no responses to allocate. Publish it on the calendar first.</div>`;
    return;
  }
  if (e.cancelled) {
    el("view-groups").innerHTML = head + `<div class="alert stop"><b>This event was cancelled.</b>
      ${esc(e.cancelled)}</div>`;
    return;
  }

  const r = state.result, s = state.settings;
  const sizes = r.groups.map((g) => g.children.length);
  const nChildren = acceptedChildren().length, nCoaches = acceptedCoaches().length;

  const controls = `
    <div class="card card-pad settings">
      <div class="set-grid">
        <label>Mode<select id="set-mode">
          <option value="ability" ${state.mode === "ability" ? "selected" : ""}>Balanced ability</option>
          <option value="school" ${state.mode === "school" ? "selected" : ""}>School affinity</option></select></label>
        <label>Groups<select id="set-count">
          <option value="0" ${state.groupCount === 0 ? "selected" : ""}>Auto</option>
          ${Array.from({ length: Math.max(s.maxGroups, 1) }, (_, i) => i + 1).map((n) =>
            `<option value="${n}" ${state.groupCount === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Target size <input type="number" id="set-target" min="1" max="60" value="${s.targetGroupSize}"></label>
        <label>Minimum size <input type="number" id="set-min" min="1" max="60" value="${s.minGroupSize}"></label>
        <label>Coach ratio 1: <input type="number" id="set-ratio" min="1" max="40" value="${s.ratio}"></label>
        <label>Min coaches <input type="number" id="set-mincoach" min="0" max="6" value="${s.minCoachesPerGroup}"></label>
        <label>Max groups <input type="number" id="set-max" min="1" max="20" value="${s.maxGroups}"></label>
      </div>
    </div>`;

  const fail = r.failed ? `<div class="alert stop"><b>The rules can't all be met.</b> ${esc(r.failure)}
      This is a normal outcome on a bad night, not an error &mdash; the groups below are still shown so you can proceed.</div>` : "";

  const updated = state.rerunNotice ? `<div class="alert info">
      <b>Groups updated.</b> ${esc(state.rerunNotice.reason)} &mdash; ${esc(state.rerunNotice.detail)}.
      <button class="link" id="dismiss-rerun">dismiss</button></div>` : "";

  const move = state.lastMove ? `<div class="alert ${state.lastMove.broke.length ? "stop" : "ok"}">
      <b>${esc(state.lastMove.what)}</b>
      ${state.lastMove.broke.length ? " That move breaks: " + esc(state.lastMove.broke.join("; ")) + "." : " No rule broken."}
      ${state.lastMove.pairNote ? " " + esc(state.lastMove.pairNote) : ""}
      <button class="link" id="undo-note">dismiss</button></div>` : "";

  const stand = r.standDown && r.standDown.length ? `<div class="alert warn">
      ${plural(r.standDown.length, "coach", "coaches")} accepted but their own children aren't attending,
      so they aren't coaching tonight: ${esc(r.standDown.map((c) => c.name).join(", "))}.</div>` : "";

  const notes = (r.notes || []).map((n) => `<div class="alert warn">${esc(n)}</div>`).join("");

  const cands = r.candidates.map((c) => `
    <tr class="${c.groups === r.chosen.groups ? "chosen" : ""}">
      <td>${plural(c.groups, "group", "groups")}</td>
      <td class="${c.feasible ? "yes" : "no"}">${c.feasible
        ? "averages " + c.avg.toFixed(1) + " children"
          + (c.groups === r.chosen.groups && !r.forced ? " &larr; closest to the target of " + s.targetGroupSize : "")
        : c.reason}${c.groups === r.chosen.groups && r.forced ? " &larr; set by hand" : ""}</td></tr>`).join("");

  const checks = r.checks.map((c) => `
    <div class="check ${c.ok ? "" : (c.soft ? "warn" : "fail")}">
      <span class="mark">${c.ok ? "&check;" : (c.soft ? "!" : "&times;")}</span>
      <span><b>${c.rule}</b> &mdash; <span class="d">${c.detail}</span></span></div>`).join("");

  const cards = r.groups.map((g) => {
    const counts = [1, 2, 3, 4, 5].map((x) => g.children.filter((c) => c.rating === x).length);
    const spread = counts.map((n, i) => n ? `<span style="flex:${n};background:var(--r${i + 1})" title="${n} rated ${i + 1}"></span>` : "").join("");
    const schools = [...new Set(g.children.map((c) => c.school))].map((sc) => {
      const n = g.children.filter((c) => c.school === sc).length;
      return `<span class="schooltag ${n === 1 ? "lone" : ""}">${esc(sc.split(",")[0])} ${n}</span>`;
    }).join("");
    const coaches = g.coaches.map((c) => {
      const kids = c.childIds.map((id) => BY_ID.get(id)).filter((k) => k && g.children.some((x) => x.id === k.id));
      return `<div class="person coach" draggable="true" data-person="${c.id}" data-kind="coach">
        <span class="tag coach">Coach</span>
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="Pinned by a manual move">&#9679;</span>' : ""}</span>
        <span class="sub">${kids.length ? "with " + kids.map((k) => esc(k.firstName)).join(" &amp; ") : ""}</span></div>`;
    }).join("") || '<div class="sub" style="padding:3px 0">No coach</div>';
    const kids = g.children.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `
      <div class="person" draggable="true" data-person="${c.id}" data-kind="child">
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="Pinned by a manual move">&#9679;</span>' : ""}</span>
        ${state.mode === "school" ? `<span class="mini">${esc(c.school.split(",")[0].slice(0, 12))}</span>` : ""}
        ${ratingChip(c.rating)}</div>`).join("");
    const bad = g.coaches.length < s.minCoachesPerGroup || g.children.length > (g.coaches.length || 0) * s.ratio;

    return `<div class="group ${bad ? "bad" : ""}" data-group="${g.id}">
      <header><h3>${g.name}</h3>
        <span class="n">${plural(g.children.length, "child", "children")} &middot; ${plural(g.coaches.length, "coach", "coaches")}</span></header>
      <div class="spread">${spread}</div>
      <div class="section">
        ${state.mode === "school" ? `<div class="schools">${schools}</div>` : ""}
        <h4>Coaching</h4>${coaches}
        <h4>Players <span class="lock">Ratings admin only</span></h4>${kids}
      </div></div>`;
  }).join("");

  el("view-groups").innerHTML = head + controls + updated + fail + move + stand + notes + `
    <div class="banner">
      <div class="lead"><b>${plural(nChildren, "child", "children")}</b> and <b>${plural(nCoaches, "coach", "coaches")}</b> accepted${
        r.coachesUsed !== nCoaches ? " (" + r.coachesUsed + " able to coach)" : ""},
        split into <b>${plural(r.groups.length, "group", "groups")}</b>${sizes.length
          ? " of " + Math.min(...sizes) + "&ndash;" + Math.max(...sizes) : ""}.</div>
      <details class="why"><summary>Why ${r.groups.length} groups?</summary>
        <table class="cand">${cands}</table></details>
    </div>
    <div class="checks">${checks}</div>
    <div class="groups-head">
      <h3>${r.groups.length} ${e.type === "Game" ? (r.groups.length === 1 ? "team" : "teams") : (r.groups.length === 1 ? "station" : "stations")}</h3>
      <div class="spacer"></div>
      <button class="btn" id="btn-undo" ${state.pins.size ? "" : "disabled"}>Undo manual moves${state.pins.size ? " (" + state.pins.size + ")" : ""}</button>
    </div>
    <div class="groups" id="groups-grid">${cards}</div>
    <div class="notice">Drag a child or a coach onto another group to move them. A manual move is pinned and
      survives a re-run. Moving one of a coach and child pair moves the other with it.</div>`;

  wireSettings(); wireDragDrop();
}

function wireSettings() {
  const SETTING_LABEL = {
    targetGroupSize: "Target group size", minGroupSize: "Minimum group size",
    ratio: "Coach ratio", minCoachesPerGroup: "Minimum coaches per group", maxGroups: "Maximum groups"
  };
  const num = (id, key, min, max) => {
    const node = el(id); if (!node) return;
    node.onchange = () => {
      const was = state.settings[key];
      const now = Math.max(min, Math.min(max, Number(node.value) || min));
      state.settings[key] = now;
      if (state.groupCount > state.settings.maxGroups) state.groupCount = 0;
      rerun(true, SETTING_LABEL[key] + " changed from " + (key === "ratio" ? "1:" + was : was)
        + " to " + (key === "ratio" ? "1:" + now : now));
      renderAll();
    };
  };
  num("set-target", "targetGroupSize", 1, 60); num("set-min", "minGroupSize", 1, 60);
  num("set-ratio", "ratio", 1, 40); num("set-mincoach", "minCoachesPerGroup", 0, 6);
  num("set-max", "maxGroups", 1, 20);
  if (el("set-mode")) el("set-mode").onchange = (e) => {
    state.mode = e.target.value;
    rerun(true, "Mode changed to " + (state.mode === "ability" ? "balanced ability" : "school affinity"));
    renderAll();
  };
  if (el("set-count")) el("set-count").onchange = (e) => {
    state.groupCount = Number(e.target.value);
    rerun(true, state.groupCount ? "Group count set to " + state.groupCount + " by hand"
      : "Group count put back to automatic");
    renderAll();
  };
  if (el("btn-undo")) el("btn-undo").onclick = () => {
    state.lastMove = null; rerun(false, "Manual moves undone"); renderAll();
  };
  if (el("undo-note")) el("undo-note").onclick = () => { state.lastMove = null; renderGroups(); };
  if (el("dismiss-rerun")) el("dismiss-rerun").onclick = () => { state.rerunNotice = null; renderGroups(); };
}

/* ---------------- manual moves ---------------- */

function movePerson(personId, kind, toIdx) {
  const groups = state.result.groups, to = groups[toIdx];
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
    const coachParent = from.coaches.find((a) => a.childIds.includes(personId));
    if (coachParent) {
      movedCoaches.push(coachParent);
      from.children.forEach((c) => { if (c.id !== personId && coachParent.childIds.includes(c.id)) movedChildren.push(c); });
      pairNote = coachParent.name + " moved too, and stays with " + movedChildren.map((c) => c.firstName).join(" and ") + ".";
    }
  } else {
    const coach = from.coaches.find((c) => c.id === personId);
    movedCoaches.push(coach);
    from.children.forEach((c) => { if (coach.childIds.includes(c.id)) movedChildren.push(c); });
    if (movedChildren.length) pairNote = movedChildren.map((c) => c.firstName).join(" and ") + " moved with them.";
  }

  movedChildren.forEach((c) => { from.children.splice(from.children.indexOf(c), 1); to.children.push(c); state.pins.set(c.id, to.id); });
  movedCoaches.forEach((c) => { from.coaches.splice(from.coaches.indexOf(c), 1); to.coaches.push(c); state.pins.set(c.id, to.id); });

  state.result.checks = checkRules(state.result.groups, BY_ID, state.settings, state.mode, acceptedChildren());
  const broke = state.result.checks.filter((c) => !c.ok).map((c) => c.rule + " (" + c.detail + ")");
  const who = movedCoaches.concat(movedChildren).map((p) => p.firstName || p.name);
  state.lastMove = { what: who.join(", ") + " moved from " + from.name + " to " + to.name + ".", broke, pairNote };
  renderGroups(); renderParent();
}

function wireDragDrop() {
  const grid = el("groups-grid"); if (!grid) return;
  let dragging = null;
  grid.addEventListener("dragstart", (e) => {
    const p = e.target.closest("[data-person]"); if (!p) return;
    dragging = { id: Number(p.dataset.person), kind: p.dataset.kind };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(dragging.id));
    p.classList.add("dragging");
  });
  grid.addEventListener("dragend", (e) => {
    const p = e.target.closest("[data-person]"); if (p) p.classList.remove("dragging");
    grid.querySelectorAll(".group.over").forEach((g) => g.classList.remove("over"));
  });
  grid.addEventListener("dragover", (e) => {
    const g = e.target.closest("[data-group]"); if (!g || !dragging) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    grid.querySelectorAll(".group.over").forEach((x) => { if (x !== g) x.classList.remove("over"); });
    g.classList.add("over");
  });
  grid.addEventListener("drop", (e) => {
    const g = e.target.closest("[data-group]"); if (!g || !dragging) return;
    e.preventDefault();
    const d = dragging; dragging = null;
    movePerson(d.id, d.kind, Number(g.dataset.group));
  });
}

/* ---------------- parent view ---------------- */

let parentId = null;

function renderParent() {
  const e = ev(), t = team();
  const wrap = el("view-parent");
  const head = `<div class="page-head"><div><h2>What a parent sees</h2>
    <div class="count">${esc(eventTitle(e))} &middot; ${e.longDate}</div></div></div>`;

  if (!state.result) {
    wrap.innerHTML = head + `<div class="alert warn">No groups for this event yet, so there is nothing for a parent to see.</div>`;
    return;
  }
  const groupOf = new Map();
  state.result.groups.forEach((g) => g.children.forEach((c) => groupOf.set(c.id, g)));

  const eligible = teamAdults().filter((a) => a.childIds.some((id) => groupOf.has(id)))
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
  if (!eligible.length) {
    wrap.innerHTML = head + `<div class="alert warn">Nobody is placed yet.</div>`;
    return;
  }
  if (!parentId || !eligible.some((a) => a.id === parentId)) {
    parentId = (eligible.find((a) => a.id === SHARED_PARENT.parent.id) || eligible[0]).id;
  }
  const parent = BY_ID.get(parentId);
  const kids = parent.childIds.map((id) => BY_ID.get(id)).filter((k) => k && groupOf.has(k.id));

  const byGroup = new Map();
  kids.forEach((k) => {
    const g = groupOf.get(k.id);
    if (!byGroup.has(g.id)) byGroup.set(g.id, { g, mine: [] });
    byGroup.get(g.id).mine.push(k);
  });

  let cards = [...byGroup.values()].map(({ g, mine }) => {
    const mineIds = new Set(mine.map((k) => k.id));
    const others = g.children.filter((c) => !mineIds.has(c.id)).slice().sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="pcard">
        <div class="ev">${t.name} &middot; ${e.dayName} ${e.shortDate}, ${e.time}</div>
        <div class="grp">${g.name}</div>
        <div class="sub">${mine.map((k) => esc(k.name)).join(" and ")} &middot; ${esc(e.venue)}</div></div>
      <div class="pcard"><h4>Coaching this group</h4>
        <ul>${g.coaches.length ? g.coaches.map((c) => `<li class="${c.id === parent.id ? "me" : ""}">${esc(c.name)}${c.id === parent.id ? " (you)" : ""}</li>`).join("") : "<li>Not yet assigned</li>"}</ul></div>
      <div class="pcard"><h4>Also in ${g.name} (${others.length})</h4>
        <ul>${others.map((c) => `<li>${esc(c.name)}</li>`).join("")}</ul></div>`;
  }).join("");

  /* a parent with a child in another age group sees that one too */
  let crossNote = "";
  const elsewhere = parent.childIds.map((id) => BY_ID.get(id)).filter((k) => k && k.teamId !== t.id);
  elsewhere.forEach((k) => {
    const ot = TEAM_BY_ID.get(k.teamId), oe = nextEventFor(ot);
    const alloc = allocationFor(ot, oe);
    const g = alloc && alloc.groups.find((x) => x.children.some((c) => c.id === k.id));
    cards += `
      <div class="pcard" style="border-left:3px solid var(--gold)">
        <div class="ev">${ot.name} &middot; ${oe.dayName} ${oe.shortDate}, ${oe.time}</div>
        <div class="grp">${g ? g.name : "Not placed"}</div>
        <div class="sub">${esc(k.name)} &middot; ${esc(oe.venue)}</div>
        ${g ? `<div class="sub" style="margin-top:7px">Coached by ${esc(g.coaches.map((c) => c.name).join(", ") || "not yet assigned")}</div>` : ""}
      </div>`;
    crossNote = `<div class="note" style="margin-top:9px"><b>${esc(parent.firstName)} has a child in each age group.</b>
      One login shows both, so ${esc(k.name)} in ${ot.name} appears in the same list as ${esc(kids.map((x) => x.firstName).join(" and "))}.</div>`;
  });

  wrap.innerHTML = head + `
    <div class="parent-wrap">
      <div>
        <div class="card card-pad" style="margin-bottom:14px">
          <div class="sub" style="margin-bottom:8px">Viewing as</div>
          <select class="pick" id="parent-pick">
            ${eligible.map((a) => `<option value="${a.id}" ${a.id === parentId ? "selected" : ""}>
              ${esc(a.name)}${a.coachIn[t.id] ? " — coach" : ""} (${esc(a.childIds.map((id) => BY_ID.get(id)).filter(Boolean).map((c) => c.firstName).join(", "))})
            </option>`).join("")}
          </select>
        </div>
        <div class="card card-pad">
          <h3 style="font-size:15px;margin-bottom:10px">What is deliberately missing</h3>
          <div class="note" style="margin-bottom:9px"><b>No ability ratings.</b> Not for other children and not for their own.</div>
          <div class="note" style="margin-bottom:9px"><b>No schools.</b> A parent sees their own child's school because they entered it, but never another child's.</div>
          <div class="note"><b>No decline reasons</b> and no sight of who did not respond.</div>
          ${kids.map((k) => `<div class="note" style="margin-top:9px">${esc(k.firstName)}'s school is <b>${esc(k.school)}</b> &mdash; shown only because ${esc(parent.firstName)} entered it.</div>`).join("")}
          ${crossNote}
        </div>
      </div>
      <div class="phone"><div class="screen">
        <div class="pbar"><img src="Kilmacud_crokes_logo.png" alt="">Kilmacud Crokes</div>
        <div class="pbody">${cards}</div>
      </div></div>
    </div>`;

  el("parent-pick").onchange = (e2) => { parentId = Number(e2.target.value); renderParent(); };
}

/* ---------------- shell ---------------- */

function showView(name) {
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tabs button").forEach((b) => { b.onclick = () => showView(b.dataset.view); });

const tp = el("team-pick");
tp.innerHTML = TEAMS.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
tp.onchange = () => { parentId = null; selectTeam(tp.value); renderAll(); };

el("theme-toggle").onclick = () => {
  const now = document.documentElement.getAttribute("data-theme");
  const dark = now ? now === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
};

selectTeam("u9");
renderAll();
