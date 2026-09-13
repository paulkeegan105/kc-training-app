/* Screens and interaction. Everything re-renders from `state`; nothing is persisted. */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (id) => document.getElementById(id);
const STATUS_LABEL = { accepted: "Accepted", declined: "Declined", none: "No response" };
const pill = (s) => `<span class="pill ${s}">${STATUS_LABEL[s]}</span>`;
const ratingChip = (r) => `<span class="rating r${r}">${r}</span>`;
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
const NO_SCHOOL_LABEL = "No school recorded";
const schoolOf = (c) => c.school || NO_SCHOOL_LABEL;
/* what a parent sees: the school they gave, whether or not it is on the club list yet */
const schoolForParent = (c) => (c.school || c.schoolPending)
  ? esc(c.school || c.schoolPending)
  : `<span class="tag unreg">${NO_SCHOOL_LABEL}</span>`;

/* what an admin sees: the same, plus the queue of schools waiting to join the list */
const schoolDisplay = (c) => c.school ? esc(c.school)
  : c.schoolPending ? esc(c.schoolPending) + ' <span class="tag unreg">awaiting club confirmation</span>'
  : `<span class="tag unreg">${NO_SCHOOL_LABEL}</span>`;

/* A school typed into "Other" is recorded against the child but never added to the club
   list. It waits for a Club Admin to map it or add it; until then the child has no
   confirmed school, so allocation treats them as a singleton. */
function setSchool(child, value, fromOther) {
  if (fromOther) { child.school = ""; child.schoolPending = value; }
  else { child.school = value; child.schoolPending = null; }
}

/* wherever a rating is shown, say which end is which */
const ratingLegend = (style = "") => `<div class="legend" ${style ? `style="${style}"` : ""}>
    <span class="lk">Ability rating</span>
    <span class="rating r1">1</span><span class="lt">strongest</span>
    <span class="lsep">&rarr;</span>
    <span class="rating r5">5</span><span class="lt">weakest</span>
    <span class="lock">Admin only</span>
  </div>`;

const state = {
  signedInId: null,
  editScope: "admin",
  familyOpenId: null,
  familyShowEarlier: false,
  familyChild: "all",
  familyEditing: null,
  menuOpen: false,
  menuPanel: null,
  editDraft: null,
  editErrorField: null,
  editReturnTo: null,
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
  rerunNotice: null,
  editingId: null,
  editError: ""
};

const signedIn = () => BY_ID.get(state.signedInId);
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
    groupLabel: "Squad"
  });
  if (reason) state.rerunNotice = describeRerun(reason, before, placementSnapshot());
}

/* Publishing freezes what parents see. The snapshot is what the family view reads,
   so a later re-run doesn't quietly change a squad someone was already told about. */
function publishSquads(e, result) {
  if (!result || !result.groups) return;
  e.squads = result.groups.map((g, i) => ({
    name: g.name, index: i,
    childIds: g.children.map((c) => c.id),
    coachIds: g.coaches.map((c) => c.id)
  }));
  e.squadsPublished = true;
  e.squadsPublishedAt = NOW;
}

function squadForChild(e, childId) {
  if (!e.squadsPublished || !e.squads) return null;
  return e.squads.find((sq) => sq.childIds.includes(childId)) || null;
}

/* the other age group's allocation, for a parent with a child in each */
function allocationFor(t, e) {
  if (!e || !e.published || e.cancelled) return null;
  const kids = t.people.filter((p) => p.type === "child" && e.status.get(p.id) === "accepted");
  const coaches = t.people.filter((p) => p.type === "adult" && p.coachIn[t.id] && e.status.get(p.id) === "accepted");
  return allocate({ children: kids, coaches, byId: BY_ID, settings: t.settings, mode: t.mode,
    pins: new Map(), groupLabel: "Squad" });
}

function renderWhoami() {
  /* The name is the control. No hamburger: there is nothing to navigate to, and on a
     phone shared between two parents the name is worth keeping in sight. */
  el("whoami").innerHTML = "<b>" + esc(signedIn().name) + "</b>"
    + `<svg class="caret" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.75 L6 6.25 L11 1.75"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const isNarrow = () => matchMedia("(max-width: 900px)").matches;

function themeIsDark() {
  const set = document.documentElement.getAttribute("data-theme");
  return set ? set === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

function renderUserMenu() {
  const me = signedIn();
  const kids = me.childIds.map((id) => BY_ID.get(id)).filter(Boolean);
  const narrow = isNarrow();
  const open = state.menuPanel;

  const childPanel = `<div class="menu-panel">
      ${kids.map((k) => `<div class="childrow"><div class="cr-top"><div>
        <div class="cn">${esc(k.name)}</div>
        <div class="ct">${esc(TEAM_BY_ID.get(k.teamId).name)} &middot; ${schoolForParent(k)}</div></div>
        <button class="linkbtn" data-fedit="${k.id}">Change school</button></div></div>`).join("")}
    </div>`;

  const detailPanel = `<div class="menu-panel">
      <div class="kv"><span class="k">Name</span><span class="v">${esc(me.name)}</span></div>
      <div class="kv"><span class="k">Email</span><span class="v">${esc(me.email)}</span></div>
      <div class="kv"><span class="k">Phone</span><span class="v">${esc(me.phone || "not given")}</span></div>
      <button class="linkbtn" style="margin-top:9px" data-fedit="${me.id}">Edit your details</button>
    </div>`;

  el("usermenu").innerHTML = `
    <button class="menu-item" data-menu="theme">${themeIsDark() ? "Switch to light" : "Switch to dark"}</button>
    <button class="menu-item" data-menu="children" aria-expanded="${open === "children"}">Your children</button>
    ${narrow && open === "children" ? childPanel : ""}
    <button class="menu-item" data-menu="details" aria-expanded="${open === "details"}">Your details</button>
    ${narrow && open === "details" ? detailPanel : ""}
    <div class="menu-rule"></div>
    <button class="menu-item" data-menu="signout">Sign out</button>`;

  el("usermenu").querySelectorAll("[data-menu]").forEach((b) => {
    b.onclick = () => {
      const what = b.dataset.menu;
      if (what === "theme") {
        document.documentElement.setAttribute("data-theme", themeIsDark() ? "light" : "dark");
        renderUserMenu();
        const again = el("usermenu").querySelector('[data-menu="theme"]');
        if (again) again.focus();
        return;
      }
      if (what === "signout") { closeUserMenu(false); signOut(); return; }
      if (isNarrow()) {
        state.menuPanel = state.menuPanel === what ? null : what;
        renderUserMenu();
        const again = el("usermenu").querySelector('[data-menu="' + what + '"]');
        if (again) again.focus();
      } else {
        // on a wide screen the cards are already on the page; take them there
        closeUserMenu();
        const card = document.querySelectorAll("#view-family .side-card")[what === "children" ? 0 : 1];
        if (card) {
          card.scrollIntoView({ block: "center", behavior: "smooth" });
          const h = card.querySelector("h3");
          if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
        }
      }
    };
  });

  if (isNarrow()) {
    el("usermenu").querySelectorAll("[data-fedit]").forEach((b) =>
      b.onclick = () => {
        closeUserMenu(false);
        showView("family");
        openFamilyDialog(Number(b.dataset.fedit), '[data-fedit="' + b.dataset.fedit + '"]');
      });
  }
}

function openUserMenu() {
  state.menuOpen = true;
  state.menuPanel = null;
  el("usermenu").hidden = false;
  el("whoami").setAttribute("aria-expanded", "true");
  renderUserMenu();
  const first = el("usermenu").querySelector("button");
  if (first) first.focus();
}

function closeUserMenu(restoreFocus = true) {
  state.menuOpen = false;
  state.menuPanel = null;
  el("usermenu").hidden = true;
  el("whoami").setAttribute("aria-expanded", "false");
  if (restoreFocus) el("whoami").focus();
}

function trapMenuTab(e) {
  const menu = el("usermenu");
  if (!menu || menu.hidden) return;
  const items = [el("whoami")].concat([...menu.querySelectorAll("button, a[href], input, select")])
    .filter((n) => n && !n.disabled && n.getBoundingClientRect().width);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function renderAll() {
  const me = signedIn();
  if (!me) return;
  const y = window.scrollY;
  renderWhoami();
  if (isAdmin(me)) { renderCalendar(); renderMembers(); renderInvite(); renderGroups(); }
  renderFamily();
  window.scrollTo(0, y);
}

/* ---------------- calendar ---------------- */

/* The type leads the title, so a match and a blitz are told apart on the row itself.
   The tile colour underneath is reinforcement, never the only signal. */
function eventTitle(e) {
  if (e.type === "Game") return "Match &middot; " + esc((e.away ? "Away to " : "Home to ") + e.opposition);
  if (e.type === "Blitz") return "Blitz &middot; " + esc(e.title || e.venue);
  if (e.title) return esc(e.title);
  return "Training";
}

/* matches and blitzes share the club gold; training keeps the purple */
const tileKind = (e) => (e.type === "Game" || e.type === "Blitz") ? "is-match" : "is-training";

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
      if (e.published && !e.cancelled) {
        const invited = counts[0] + counts[1] + counts[2];
        tags.push(`<span class="pill accepted">${counts[0]} of ${invited} accepted</span>`);
        const ds = deadlineState(e);
        tags.push(`<span class="tag ${ds.closed ? "unreg" : "coach"}">${ds.chip}</span>`);
      }

      return `<div class="evrow ${open ? "is-open" : ""} ${e.draft ? "is-draft" : ""} ${e.cancelled ? "is-cancelled" : ""} ${e.past ? "is-past" : ""}">
        <button class="evhead" data-event="${e.id}">
          <span class="evdate"><span class="d">${e.date.slice(8)}</span><span class="m">${e.dayName.slice(0, 3)}</span></span>
          <span class="evmain">
            <span class="t">${eventTitle(e)}</span>
            <span class="s">${e.time}&ndash;${e.endTime} &middot; ${esc(e.venue)}</span>
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
          ${e.published && !e.cancelled ? `<div class="deadline-bar">
            <div>
              <div class="k">Response deadline</div>
              <div class="dl-main">${fmtWhen(deadlineFor(e))} &middot;
                <span class="${deadlineState(e).closed ? "dl-closed" : "dl-open"}">${deadlineState(e).label}</span></div>
              <div class="sub">Reminder to non-responders goes out ${fmtWhen(reminderFor(e))}, a day before answers are due.
                Nothing locks: a parent can still change their answer, and the allocation re-runs when they do.</div>
            </div>
            <label class="dl-set">Hours before start
              <input type="number" min="1" max="336" id="dl-${e.id}" value="${deadlineHoursFor(e)}">
              <span class="sub">team default ${TEAM_BY_ID.get(e.teamId).settings.deadlineHours}</span>
            </label>
          </div>` : ""}
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
  el("view-calendar").querySelectorAll("[data-calstatus]").forEach((b) =>
    b.onclick = () => { calStatus = b.dataset.calstatus; renderCalendar(); });
  const cs = el("cal-search");
  if (cs) cs.oninput = () => {
    calSearch = cs.value;
    const at = cs.selectionStart;
    renderCalendar();
    const ns = el("cal-search"); if (ns) { ns.focus(); ns.setSelectionRange(at, at); }
  };
  const dl = el("dl-" + state.eventId);
  if (dl) dl.onchange = () => {
    const e2 = ev();
    e2.deadlineHours = Math.max(1, Math.min(336, Number(dl.value) || 24));
    renderAll();
  };
  el("view-calendar").querySelectorAll(".status-pick").forEach((sel) =>
    sel.onchange = () => {
      const id = Number(sel.dataset.person);
      ev().status.set(id, sel.value);
      if (sel.value === "none") { ev().answeredBy.delete(id); ev().answeredAt.delete(id); }
      else { ev().answeredBy.set(id, "admin"); ev().answeredAt.set(id, NOW); }
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

function answeredSummary(e, personId) {
  const st = e.status.get(personId) || "none";
  if (st === "none") return "";
  const by = e.answeredBy.get(personId), when = e.answeredAt.get(personId);
  const whoBy = by === "admin" ? "an admin" : (BY_ID.get(by) ? BY_ID.get(by).firstName : "an admin");
  return esc("by " + whoBy + (when ? ", " + fmtDay(when) : ""));
}

function responseList(e) {
  const t = team();
  const kids = t.people.filter((p) => p.type === "child");
  const coaches = t.people.filter((p) => p.type === "adult" && p.coachIn[t.id]);
  const rank = { accepted: 0, declined: 1, none: 2 };

  let people = (calTab === "children" ? kids : coaches).slice();
  const counts = { accepted: 0, declined: 0, none: 0 };
  people.forEach((p) => { counts[e.status.get(p.id) || "none"]++; });

  if (calStatus !== "all") people = people.filter((p) => (e.status.get(p.id) || "none") === calStatus);
  if (calSearch) {
    const q = calSearch.toLowerCase();
    people = people.filter((p) => p.name.toLowerCase().includes(q)
      || (p.type === "child" ? parentsOf(p) : p.childIds.map((id) => BY_ID.get(id)).filter(Boolean))
           .some((r) => r.name.toLowerCase().includes(q)));
  }

  const rows = people
    .sort((a, b) => rank[e.status.get(a.id) || "none"] - rank[e.status.get(b.id) || "none"]
      || a.lastName.localeCompare(b.lastName))
    .map((p) => {
      const st = e.status.get(p.id) || "none";
      const sub = p.type === "child"
        ? "Child &middot; " + esc(parentsOf(p).map((a) => a.name).join(", "))
        : "Coach &middot; parent of " + esc(p.childIds.map((id) => BY_ID.get(id)).filter(Boolean).map((c) => c.name).join(", "));
      return `<tr>
        <td><div class="name">${esc(p.name)}</div><div class="sub">${sub}</div></td>
        <td>${statusTag(st)}</td>
        <td class="sub">${answeredSummary(e, p.id)}</td>
        <td style="text-align:right"><select class="status-pick" data-person="${p.id}">
          ${["accepted", "declined", "none"].map((k) =>
            `<option value="${k}" ${st === k ? "selected" : ""}>${STATUS_LABEL[k]}</option>`).join("")}
        </select></td></tr>`;
    }).join("");

  return `
    <div class="toolbar" style="margin:14px 0 8px">
      <button class="chip" data-caltab="children" aria-pressed="${calTab === "children"}">Children (${kids.length})</button>
      <button class="chip" data-caltab="coaches" aria-pressed="${calTab === "coaches"}">Coaches (${coaches.length})</button>
      <span style="width:12px"></span>
      ${[["all", "All"], ["accepted", "Accepted"], ["declined", "Declined"], ["none", "No response"]]
        .map(([k, l]) => `<button class="chip" data-calstatus="${k}" aria-pressed="${calStatus === k}">${l}${
          k === "all" ? "" : " (" + counts[k] + ")"}</button>`).join("")}
      <div class="spacer"></div>
      <input class="search" id="cal-search" placeholder="Search a name" value="${esc(calSearch)}">
    </div>
    <div class="card"><table>
      <thead><tr><th>Name</th><th>Status</th><th>Answered</th><th style="text-align:right">Change</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="sub" style="padding:20px">Nobody matches that.</td></tr>`}</tbody>
    </table></div>
    <div class="notice">An admin can override anyone's response. The override is visible to that person,
      shown as set by an admin, and feeds the allocation exactly like a real answer.</div>`;
}

/* ---------------- members ---------------- */

let memberFilter = "all", memberSearch = "";
let calTab = "children", calStatus = "all", calSearch = "";

function renderMembers() {
  const t = team();
  const noSchoolCount = t.people.filter((p) => p.type === "child" && !p.school && !p.schoolPending).length;
  const pendingCount = t.people.filter((p) => p.type === "child" && p.schoolPending).length;
  let rows = t.people.slice();
  if (memberFilter === "children") rows = rows.filter((p) => p.type === "child");
  if (memberFilter === "adults") rows = rows.filter((p) => p.type === "adult");
  if (memberFilter === "coaches") rows = rows.filter((p) => p.coachIn && p.coachIn[t.id]);
  if (memberFilter === "unregistered") rows = rows.filter((p) => p.type === "adult" && !p.registered);
  if (memberFilter === "noschool") rows = rows.filter((p) => p.type === "child" && !p.school && !p.schoolPending);
  if (memberFilter === "pending") rows = rows.filter((p) => p.type === "child" && !!p.schoolPending);
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
        <td>${schoolDisplay(p)}</td>
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
      ${[["all", "All"], ["children", "Children"], ["adults", "Adults"], ["coaches", "Coaches"],
         ["unregistered", "Unregistered"], ["noschool", "No school (" + noSchoolCount + ")"],
         ["pending", "School to confirm (" + pendingCount + ")"]]
        .map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${memberFilter === k}">${l}</button>`).join("")}
      <div class="spacer"></div>
      <input class="search" id="member-search" placeholder="Search name or school" value="${esc(memberSearch)}">
    </div>
    ${ratingLegend("margin:0 0 12px")}
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
    b.onclick = () => {
      state.editingId = Number(b.dataset.edit); state.editScope = "admin"; state.editError = "";
      renderMembers();
    });
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
  if (!state.editingId || state.editScope !== "admin") return "";
  const p = BY_ID.get(state.editingId);
  if (!p) return "";
  const t = team();
  const err = state.editError ? `<div class="field"><div class="err">${esc(state.editError)}</div></div>` : "";
  const actions = `<div class="modal-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn primary" id="f-save">Save changes</button></div>`;

  if (p.type === "child") {
    const known = !!p.school && t.schools.includes(p.school);
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
        <input id="f-school-other" placeholder="School name" value="${known ? "" : esc(p.schoolPending || p.school || "")}" ${known ? "hidden" : ""}>
        <div class="hint">A school typed in here is not added to the club list. It is held against this child and
          queued for a Club Admin to map or add. Until they do, the child counts as a singleton for allocation.</div>
      </div>
      <div class="field"><label for="f-rating">Ability rating</label>
        <select id="f-rating">${[1, 2, 3, 4, 5].map((n) =>
          `<option value="${n}" ${n === p.rating ? "selected" : ""}>${n}${n === 1 ? " — strongest" : n === 5 ? " — needs most support" : ""}</option>`).join("")}</select>
        <div class="hint">1 is strongest and 5 is weakest. Admin only: never shown to any parent,
          and never given as the reason for a placement.</div>
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
      const schoolChanged = school !== (p.school || p.schoolPending), ratingChanged = rating !== p.rating;
      setSchool(p, school, sel === "__other");
      p.rating = rating;
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

function answer(child, value) {
  const e = ev();
  e.status.set(child.id, value);
  e.answeredBy.set(child.id, parentsOf(child)[0] ? parentsOf(child)[0].id : "admin");
  e.answeredAt.set(child.id, NOW);
  state.inviteStep = "done";
  rerun(true, child.name + " " + (value === "accepted" ? "accepted" : "declined") + " on their own invitation");
  renderAll();
}

function renderInvite() {
  const e = ev(), t = team();
  const wrap = el("view-invite");

  if (!e.published) {
    wrap.innerHTML = `<div class="page-head"><div><h2>The parent's invitation</h2>
      <div class="count">${eventTitle(e)} &middot; ${e.longDate}</div></div></div>
      <div class="alert warn"><b>Nothing has been sent yet.</b> This event is still a draft, so no member can
      see it. Publish it on the calendar and the invitation below goes out.</div>`;
    return;
  }

  const child = inviteChild();
  const parent = parentsOf(child)[0];
  const st = e.status.get(child.id) || "none";
  const step = st !== "none" ? "done" : "ask";
  const subject = t.name + " " + (e.type === "Game" ? "match" : e.type.toLowerCase()) + " — " + e.dayName + " " + e.shortDate;

  const facts = `
    <div class="mfacts">
      <div><span class="k">What</span><span>${eventTitle(e)}</span></div>
      <div><span class="k">When</span><span>${e.longDate}, ${e.time}&ndash;${e.endTime}</span></div>
      <div><span class="k">Meet</span><span>${e.meetTime}</span></div>
      <div><span class="k">Where</span><span>${esc(e.venue)}</span></div>
    </div>`;

  let panel;
  if (step === "done") {
    const yes = st === "accepted";
    panel = `
      <div class="pcard">
        <div class="done ${yes ? "yes" : "no"}">
          <div class="tick">${yes ? "&check;" : "&times;"}</div>
          <div style="font-weight:700;font-size:16px">${yes ? esc(child.firstName) + " is down as going" : esc(child.firstName) + " is marked as not going"}</div>
          <div class="sub" style="margin-top:5px">${eventTitle(e)} &middot; ${e.dayName} ${e.shortDate}, ${e.time}</div>
        </div>
      </div>
      <div class="pcard">
        <h4>Changed your mind?</h4>
        <div class="answer-btns"><button class="btn" id="change-answer">Change your answer</button></div>
      </div>`;
  } else {
    panel = `
      <div class="pcard">
        <div class="ev">${t.name} &middot; ${e.type}</div>
        <div class="grp" style="font-size:19px">${eventTitle(e)}</div>
        <div class="sub">${e.longDate}<br>${e.time}&ndash;${e.endTime} &middot; meet at ${e.meetTime}<br>${esc(e.venue)}</div>
      </div>
      <div class="pcard">
        <div class="ask">Can ${esc(child.firstName)} make it?</div>
        <div class="answer-btns">
          <button class="btn choice" id="say-yes">Yes, ${esc(child.firstName)} will be there</button>
          <button class="btn choice" id="say-no">No, can't make it</button>
        </div>
        <div class="note" style="margin-top:11px">You are answering for ${esc(child.name)}.
          ${parent && parent.coachIn[t.id] ? "You are asked separately about coaching on the night." : ""}</div>
      </div>`;
  }

  wrap.innerHTML = `
    <div class="page-head">
      <div><h2>The parent's invitation</h2>
        <div class="count">${eventTitle(e)} &middot; ${e.longDate}</div></div>
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
                  <button class="btn choice" id="mail-yes">Yes, coming</button>
                  <button class="btn choice" id="mail-no">Can't make it</button>
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
          <div class="note" style="margin-bottom:9px">Declining is one tap, the same as accepting. No reason is asked for.</div>
          <div class="note" style="margin-bottom:9px">A coaching parent answers for themselves separately, because
            they can be unavailable on a night their child still attends.</div>
          <div class="note">Answering here re-runs the allocation straight away &mdash; check the Groups tab.</div>
        </div>
      </div>
    </div>`;

  const pickC = el("invite-child");
  pickC.onchange = () => {
    state.inviteChildId = Number(pickC.value);
    state.inviteStep = "ask";
    renderInvite();
  };
  const yes = () => answer(child, "accepted");
  const no = () => answer(child, "declined");
  ["say-yes", "mail-yes"].forEach((id) => { if (el(id)) el(id).onclick = yes; });
  ["say-no", "mail-no"].forEach((id) => { if (el(id)) el(id).onclick = no; });
  if (el("change-answer")) el("change-answer").onclick = () => {
    ev().status.set(child.id, "none"); ev().answeredBy.delete(child.id); ev().answeredAt.delete(child.id);
    state.inviteStep = "ask";
    rerun(true, child.name + "'s answer was cleared"); renderAll();
  };
}

/* ---------------- groups ---------------- */

function renderGroups() {
  const e = ev(), t = team();
  const head = `<div class="page-head">
      <div><h2>Squads</h2><div class="count">${eventTitle(e)} &middot; ${e.longDate} &middot; ${t.name}</div></div>
      <div class="spacer"></div>
      <button class="btn primary" id="publish-squads">${e.squadsPublished ? "Re-publish squads" : "Publish squads"}</button></div>`;

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
  const noSchool = acceptedChildren().filter((c) => !c.school).length;
  const nChildren = acceptedChildren().length, nCoaches = acceptedCoaches().length;

  const controls = `
    <div class="card card-pad settings">
      <div class="set-grid">
        <label>Mode<select id="set-mode">
          <option value="ability" ${state.mode === "ability" ? "selected" : ""}>Balanced ability</option>
          <option value="school" ${state.mode === "school" ? "selected" : ""}>School affinity</option></select></label>
        <label>Squads<select id="set-count">
          <option value="0" ${state.groupCount === 0 ? "selected" : ""}>Auto</option>
          ${Array.from({ length: Math.max(s.maxGroups, 1) }, (_, i) => i + 1).map((n) =>
            `<option value="${n}" ${state.groupCount === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Target size <input type="number" id="set-target" min="1" max="60" value="${s.targetGroupSize}"></label>
        <label>Minimum size <input type="number" id="set-min" min="1" max="60" value="${s.minGroupSize}"></label>
        <label>Coach ratio 1: <input type="number" id="set-ratio" min="1" max="40" value="${s.ratio}"></label>
        <label>Min coaches <input type="number" id="set-mincoach" min="0" max="6" value="${s.minCoachesPerGroup}"></label>
        <label>Max squads <input type="number" id="set-max" min="1" max="20" value="${s.maxGroups}"></label>
      </div>
    </div>`;

  const fail = r.failed ? `<div class="alert stop"><b>The rules can't all be met.</b> ${esc(r.failure)}
      This is a normal outcome on a bad night, not an error &mdash; the squads below are still shown so you can proceed.</div>` : "";

  const updated = state.rerunNotice ? `<div class="alert info">
      <b>Squads updated.</b> ${esc(state.rerunNotice.reason)} &mdash; ${esc(state.rerunNotice.detail)}.
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
      <td>${plural(c.groups, "squad", "squads")}</td>
      <td class="${c.feasible ? "yes" : "no"}">${c.feasible
        ? "averages " + c.avg.toFixed(1) + " children"
          + (c.groups === r.chosen.groups && !r.forced ? " &larr; closest to the target of " + s.targetGroupSize : "")
        : c.reason}${c.groups === r.chosen.groups && r.forced ? " &larr; set by hand" : ""}</td></tr>`).join("");

  const checks = r.checks.map((c) => `
    <div class="check ${c.ok ? "" : (c.soft ? "warn" : "fail")}">
      <span class="mark">${c.ok ? "&check;" : (c.soft ? "!" : "&times;")}</span>
      <span><b>${c.rule}</b> &mdash; <span class="d">${c.detail}</span></span></div>`).join("");

  const moveBox = (id, kind, fromId) => `<select class="moveto" data-move="${id}" data-movekind="${kind}"
      aria-label="Move to another squad">
      <option value="">Move&hellip;</option>
      ${r.groups.filter((x) => x.id !== fromId).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}
    </select>`;

  const cards = r.groups.map((g) => {
    const counts = [1, 2, 3, 4, 5].map((x) => g.children.filter((c) => c.rating === x).length);
    const spread = counts.map((n, i) => n ? `<span style="flex:${n};background:var(--r${i + 1})" title="${n} rated ${i + 1}"></span>` : "").join("");
    const spreadLabel = `<div class="spread-label">Ability spread &middot; ${counts
      .map((n, i) => n ? n + "&times;" + (i + 1) : null).filter(Boolean).join(", ")}</div>`;
    const schools = [...new Set(g.children.map(schoolOf))].map((sc) => {
      const n = g.children.filter((c) => schoolOf(c) === sc).length;
      return `<span class="schooltag ${n === 1 ? "lone" : ""}">${esc(sc.split(",")[0])} ${n}</span>`;
    }).join("");
    const coaches = g.coaches.map((c) => {
      const kids = c.childIds.map((id) => BY_ID.get(id)).filter((k) => k && g.children.some((x) => x.id === k.id));
      return `<div class="person coach" draggable="true" data-person="${c.id}" data-kind="coach">
        <span class="tag coach">Coach</span>
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="Pinned by a manual move">&#9679;</span>' : ""}</span>
        <span class="sub">${kids.length ? "with " + kids.map((k) => esc(k.firstName)).join(" &amp; ") : ""}</span>
        ${moveBox(c.id, "coach", g.id)}</div>`;
    }).join("") || '<div class="sub" style="padding:3px 0">No coach</div>';
    const kids = g.children.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `
      <div class="person" draggable="true" data-person="${c.id}" data-kind="child">
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="Pinned by a manual move">&#9679;</span>' : ""}</span>
        ${state.mode === "school" ? `<span class="mini ${c.school ? "" : "none"}">${esc(schoolOf(c).split(",")[0].slice(0, 14))}</span>` : ""}
        ${ratingChip(c.rating)}
        ${moveBox(c.id, "child", g.id)}</div>`).join("");
    const bad = g.coaches.length < s.minCoachesPerGroup || g.children.length > (g.coaches.length || 0) * s.ratio;

    return `<div class="group ${bad ? "bad" : ""}" data-group="${g.id}">
      <header><h3>${g.name}</h3>
        <span class="n">${plural(g.children.length, "child", "children")} &middot; ${plural(g.coaches.length, "coach", "coaches")}</span></header>
      <div class="spread">${spread}</div>
      ${spreadLabel}
      <div class="section">
        ${state.mode === "school" ? `<div class="schools">${schools}</div>` : ""}
        <h4>Coaching</h4>${coaches}
        <h4>Players</h4>${kids}
      </div></div>`;
  }).join("");

  el("view-groups").innerHTML = head + controls + updated + fail + move + stand + notes + `
    <div class="banner">
      <div class="lead"><b>${plural(nChildren, "child", "children")}</b> and <b>${plural(nCoaches, "coach", "coaches")}</b> accepted${
        r.coachesUsed !== nCoaches ? " (" + r.coachesUsed + " able to coach)" : ""},
        split into <b>${plural(r.groups.length, "squad", "squads")}</b>${sizes.length
          ? " of " + Math.min(...sizes) + "&ndash;" + Math.max(...sizes) : ""}.</div>
      <details class="why"><summary>Why ${r.groups.length} squads?</summary>
        <table class="cand">${cands}</table></details>
    </div>
    <div class="checks">${checks}</div>
    <div class="groups-head">
      <h3>${plural(r.groups.length, "squad", "squads")}</h3>
      <div class="spacer"></div>
      <button class="btn" id="btn-undo" ${state.pins.size ? "" : "disabled"}>Undo manual moves${state.pins.size ? " (" + state.pins.size + ")" : ""}</button>
    </div>
    <div class="notice" style="margin-top:0">Drag a child or a coach onto another squad, or use the
      <b>Move&hellip;</b> box beside any name. A manual move is pinned and survives a re-run, and moving one of
      a coach and child pair moves the other with it.</div>
    ${ratingLegend("margin:0 0 12px")}
    ${state.mode === "school" && noSchool ? `<div class="alert warn">
      ${plural(noSchool, "child", "children")} attending ${noSchool === 1 ? "has" : "have"} no school recorded,
      so school affinity treats ${noSchool === 1 ? "them" : "them"} as singletons.
      <button class="link" id="show-noschool">show them in the member list</button></div>` : ""}
    <div class="groups" id="groups-grid">${cards}</div>`;

  wireSettings(); wireDragDrop();
  if (el("publish-squads")) el("publish-squads").onclick = () => {
    publishSquads(e, state.result);
    state.rerunNotice = { reason: "Squads published", detail: "parents can now see their child's squad and coaches" };
    renderAll();
  };
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
  if (el("show-noschool")) el("show-noschool").onclick = () => {
    memberFilter = "noschool"; renderMembers(); showView("members");
  };
  document.querySelectorAll("#groups-grid .moveto").forEach((sel) =>
    sel.onchange = () => {
      if (sel.value === "") return;
      movePerson(Number(sel.dataset.move), sel.dataset.movekind, Number(sel.value));
    });
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
  renderGroups(); renderFamily();
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

/* ---------------- a parent's own view ---------------- */

/* every upcoming published event across the teams this person's children are in */
function familyEvents(me) {
  const kids = me.childIds.map((id) => BY_ID.get(id)).filter(Boolean);
  const map = new Map();
  kids.forEach((k) => {
    const t = TEAM_BY_ID.get(k.teamId);
    if (!t) return;
    t.events.forEach((e) => {
      if (!e.published) return;                 // drafts stay invisible to a parent
      if (!map.has(e.id)) map.set(e.id, { event: e, team: t, kids: [] });
      map.get(e.id).kids.push(k);
    });
  });
  return [...map.values()].sort((a, b) =>
    a.event.date.localeCompare(b.event.date) || a.event.time.localeCompare(b.event.time));
}

/* the squad a parent is shown. A match squad is called a team, because that is what
   the club calls it on the day; everywhere else it is a squad. */
function squadLabel(e, sq) {
  return (e.type === "Game" || e.type === "Blitz") ? "Team " + (sq.index + 1) : sq.name;
}

function familyAnswer(e, personId, value) {
  const me = signedIn();
  e.status.set(personId, value);
  if (value === "none") { e.answeredBy.delete(personId); e.answeredAt.delete(personId); }
  else { e.answeredBy.set(personId, me.id); e.answeredAt.set(personId, NOW); }
  state.familyEditing = null;
  const who = BY_ID.get(personId);
  const name = who.id === me.id ? "You are" : esc(who.firstName) + " is";
  toast(name.replace("&#39;", "'") + (value === "accepted" ? " down as coming." : " marked as not coming."));
  if (isAdmin(signedIn()) && e.id === state.eventId) {
    rerun(true, who.name + " " + (value === "accepted" ? "accepted" : "declined") + " on their own invitation");
  }
  renderAll();
}

/* A brief confirmation that goes away on its own. role="status" so it is announced
   once, politely, rather than sitting on the page for the whole visit. */
function toast(message) {
  let host = el("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => t.classList.add("out"), 5000);
  setTimeout(() => t.remove(), 5800);
}

/* "base" sensitivity puts Áine with the As rather than after Z */
const NAME_ORDER = new Intl.Collator("en", { sensitivity: "base" });
const byFirstName = (a, b) =>
  NAME_ORDER.compare(a.firstName, b.firstName) || NAME_ORDER.compare(a.lastName, b.lastName);

const STATUS_MARK = { accepted: "&check;", declined: "&minus;", none: "&#9675;" };
const statusTag = (st) => `<span class="st st-${st}"><span class="st-mark" aria-hidden="true">${STATUS_MARK[st]}</span>${STATUS_LABEL[st]}</span>`;

/* who set the answer that is live now, and when */
function answeredLine(e, personId) {
  const st = e.status.get(personId) || "none";
  if (st === "none") return "";
  const when = e.answeredAt.get(personId);
  const by = e.answeredBy.get(personId);
  const word = st === "accepted" ? "Accepted" : "Declined";
  const whoBy = by === "admin" ? "an admin"
    : (BY_ID.get(by) ? (by === signedIn().id ? "you" : BY_ID.get(by).firstName) : "an admin");
  return `<div class="ans-by">${word} by ${esc(whoBy)}${when ? ", " + fmtDay(when) : ""}</div>`;
}

/* an event stops taking answers once it has started */
function hasStarted(e) { return eventStart(e) <= NOW; }

function squadPanel(entry, person) {
  const e = entry.event, me = signedIn();
  const sq = squadForChild(e, person.id);
  if (!sq) {
    /* Three different situations, and telling them apart matters: a parent told to
       wait for a squad that already went out without their child in it can turn up
       at a pitch expecting a team. */
    if (e.squadsPublished) {
      return `<div class="pending"><b>${esc(person.firstName)} isn't in a squad for this session.</b>
        Squads went out${e.squadsPublishedAt ? " on " + fmtDay(e.squadsPublishedAt) : ""}, before this answer
        came in, so ${esc(person.firstName)} wasn't included. Tell a coach ${esc(person.firstName)} is coming
        and they'll be put into one on the night.</div>`;
    }
    if (hasStarted(e)) return "";      // finished, and squads were never published
    return `<div class="pending">Squads for this session haven't been published yet.
      You'll see ${esc(person.firstName)}'s squad and coaches here as soon as they are.</div>`;
  }

  // nobody is pulled to the top: a parent reads a squad list to find a name in it
  const coaches = sq.coachIds.map((id) => BY_ID.get(id)).filter(Boolean).sort(byFirstName);
  const players = sq.childIds.map((id) => BY_ID.get(id)).filter(Boolean).sort(byFirstName);

  const nameItem = (p, mine, hiddenLabel) =>
    `<li class="${mine ? "mine" : ""}">${esc(p.name)}${mine ? `<span class="vh"> &mdash; ${hiddenLabel}</span>` : ""}</li>`;

  /* A coach can ring the other coaches on their own squad. A parent who does not coach
     sees names only — a coach's number is not a parent-facing detail. */
  const iCoachHere = !!me.coachIn[entry.team.id];
  const coachItem = (c) => {
    const mine = c.id === me.id;
    if (!iCoachHere || mine || !c.phone) return nameItem(c, mine, "you");
    return `<li>${esc(c.name)} <a class="tellink" href="tel:${esc(c.phone.replace(/\s+/g, ""))}"
      aria-label="Call ${esc(c.name)} on ${esc(c.phone)}">${esc(c.phone)}</a></li>`;
  };

  return `<div class="squad-box">
      <div class="sq">${esc(squadLabel(e, sq))}</div>
      <div class="sl">
        <h5>Coaches (${coaches.length})</h5>
        <ul class="cols">${coaches.length
          ? coaches.map(coachItem).join("")
          : "<li>Not yet assigned</li>"}</ul>
      </div>
      <hr class="hairline">
      <div class="sl">
        <h5>Players (${players.length})</h5>
        <ul class="cols">${players.map((c) => nameItem(c, c.id === person.id, "your child")).join("")}</ul>
      </div>
    </div>`;
}

/* The deadline line is a prompt, so it only appears while there is something to prompt
   for. Nothing locks when it passes — see open-questions item 53. */
function deadlineLine(e, personId) {
  if (hasStarted(e)) return "";
  if ((e.status.get(personId) || "none") !== "none") return "";
  const ds = deadlineState(e);
  return `<div class="dl-line ${ds.closed ? "dl-closed" : "dl-open"}">${ds.closed
    ? "Responses closed " + fmtWhen(deadlineFor(e)) + " &mdash; you can still answer"
    : "Answers due by " + fmtWhen(deadlineFor(e))}</div>`;
}

/* the provenance line as plain words, for the compressed one-line form */
function answeredWords(e, personId) {
  const st = e.status.get(personId) || "none";
  if (st === "none") return "";
  const when = e.answeredAt.get(personId), by = e.answeredBy.get(personId);
  const whoBy = by === "admin" ? "an admin"
    : (BY_ID.get(by) ? (by === signedIn().id ? "you" : BY_ID.get(by).firstName) : "an admin");
  return (st === "accepted" ? "Accepted" : "Declined") + " by " + whoBy + (when ? ", " + fmtDay(when) : "");
}

function answerBlock(entry, person, label) {
  const e = entry.event;
  const st = e.status.get(person.id) || "none";
  const started = hasStarted(e);

  /* Tapping Change opens the choice; it writes nothing. A parent who taps it and walks
     away has changed nothing, and their child is still down as they were. */
  const editKey = e.id + ":" + person.id;
  const choosing = state.familyEditing === editKey;

  /* An answer that exists is a fact, not an action: one line carrying the person, who
     said it and when, and a way to change it. The word in the provenance is the status,
     so a badge repeating it earns nothing — and the collapsed header already showed it. */
  if (st !== "none" && !choosing) {
    return `<div class="kid-block one-line">
        <div class="ans-line">
          <span class="ans-name">${esc(label)}</span>
          <span class="sep" aria-hidden="true">&middot;</span>
          <span class="ans-words">${esc(answeredWords(e, person.id))}</span>
          ${started
            ? `<span class="sep" aria-hidden="true">&middot;</span>
               <span class="finished-note">This session has finished.</span>`
            : `<span class="sep" aria-hidden="true">&middot;</span>
               <button class="linkbtn" data-change="${editKey}"
                 aria-label="Change the answer for ${esc(label)}">Change</button>`}
        </div>
      </div>`;
  }

  /* Unanswered is the primary action, so it keeps full buttons. */
  let control;
  if (started) {
    control = `<span class="finished-note">This session has finished.</span>`;
  } else {
    control = `<span class="answer-row" role="group" aria-label="Answer for ${esc(label)}">
        <button class="btn choice ${st === "accepted" ? "is-selected" : ""}" aria-pressed="${st === "accepted"}"
          data-yes="${person.id}" data-ev="${e.id}">Yes, coming</button>
        <button class="btn choice ${st === "declined" ? "is-selected" : ""}" aria-pressed="${st === "declined"}"
          data-no="${person.id}" data-ev="${e.id}">Can't make it</button>
        ${st === "none" ? "" : `<button class="linkbtn" data-cancel-change="1">Keep ${
          st === "accepted" ? "Yes, coming" : "Can't make it"}</button>`}</span>`;
  }

  return `<div class="kid-block">
      <div class="ans-row">
        <span class="ans-name">${esc(label)}</span>
        ${statusTag(st)}
        <span class="spacer"></span>
        ${control}
      </div>
      ${answeredLine(e, person.id)}
      ${deadlineLine(e, person.id)}
    </div>`;
}

/* a status with the name it belongs to, for rows carrying more than one */
const labelledStatus = (who, st) =>
  `<span class="st-pair"><span class="st-who">${esc(who)}</span>${statusTag(st)}</span>`;

function groupByMonth(list) {
  const months = [];
  list.forEach((entry) => {
    const m = entry.event.longDate.split(" ").slice(2).join(" ");
    if (!months.length || months[months.length - 1].label !== m) months.push({ label: m, rows: [] });
    months[months.length - 1].rows.push(entry);
  });
  return months;
}

function renderFamily() {
  const me = signedIn();
  const kids = me.childIds.map((id) => BY_ID.get(id)).filter(Boolean);
  const all = familyEvents(me);

  // a chip left over from another account filters on a child this adult has never met
  if (state.familyChild && state.familyChild !== "all"
      && !kids.some((k) => k.id === Number(state.familyChild))) {
    state.familyChild = "all";
  }
  const filtered = state.familyChild !== "all"
    ? all.filter((x) => x.kids.some((k) => k.id === Number(state.familyChild)))
    : all;

  const firstUpcoming = filtered.findIndex((x) => !hasStarted(x.event));
  const earlier = firstUpcoming === -1 ? filtered.slice() : filtered.slice(0, firstUpcoming);
  const rest = firstUpcoming === -1 ? [] : filtered.slice(firstUpcoming);

  const answerable = rest.filter((x) => !x.event.cancelled);
  if (!state.familyOpenId || !filtered.some((x) => x.event.id === state.familyOpenId)) {
    const next = answerable[0] || rest[0] || earlier[earlier.length - 1];
    state.familyOpenId = next ? next.event.id : null;
  }

  const renderRow = (entry) => {
    const e = entry.event, t = entry.team;
    const open = e.id === state.familyOpenId;
    const started = hasStarted(e);
    const people = entry.kids.concat(me.coachIn[t.id] ? [me] : []);

    /* The name goes on the status, and only where it does work: a coaching parent's row
       carries two answers, and an adult with more than one child needs to know whose
       answer this is. One child, one answer, and a name would just be noise. */
    const nameTheStatus = people.length > 1 || kids.length > 1;
    const chips = e.cancelled
      ? '<span class="tag cancelled">Cancelled</span>'
      : nameTheStatus
        ? people.map((p) => labelledStatus(p.id === me.id ? "You" : p.firstName,
            e.status.get(p.id) || "none")).join("")
        : statusTag(e.status.get(people[0].id) || "none");
    const tagClass = e.cancelled ? "one" : people.length > 1 ? "stacked" : "one";

    // a cancelled event keeps the date, day, time range and opposition, and nothing else
    const range = e.time + "&ndash;" + e.endTime;
    const subTime = e.cancelled ? range                       // cancelled rows keep their time as it was
      : e.meetTime ? "Meet " + e.meetTime
      : e.time;
    const rel = relativeDay(eventStart(e));
    const dayWord = (rel === "today" || rel === "tomorrow")
      ? rel.charAt(0).toUpperCase() + rel.slice(1) : e.dayName;

    /* every answer for this event together, so a coaching parent sees their own beside
       their child's, with the squad cards under them rather than between them */
    const kidsHere = entry.kids.slice().sort((a, b) => a.name.localeCompare(b.name));
    const blocks = kidsHere.map((k) => answerBlock(entry, k, k.name)).join("")
      + (me.coachIn[t.id] ? answerBlock(entry, me, "You") : "")
      + kidsHere.filter((k) => (e.status.get(k.id) || "none") === "accepted")
          .map((k) => squadPanel(entry, k)).join("");

    return `<div class="fev ${open ? "is-open" : ""} ${started ? "is-past" : ""} ${e.cancelled ? "is-cancelled" : ""}"
        id="fev-${e.id}">
      <button class="fev-head" data-fev="${e.id}" aria-expanded="${open}">
        <span class="ev-when ${tileKind(e)}"><span class="dd">${e.date.slice(8)}</span><span class="mm">${e.shortDate.split(" ")[1]}</span></span>
        <span class="fev-main">
          <span class="fev-title">${eventTitle(e)}</span>
          <span class="fev-sub">${dayWord} &middot; ${subTime}</span>
        </span>
        <span class="fev-tags ${tagClass}">${chips}</span>
      </button>
      ${open ? `<div class="fev-body">
        ${e.cancelled
          ? `<div class="alert stop" style="margin:0"><b>Cancelled.</b> ${esc(e.cancelled)}</div>`
          : `<div class="fev-facts"><span>${esc(e.venue)}${e.away ? " &middot; away" : ""} &middot; ${range}</span></div>${blocks}`}
      </div>` : ""}
    </div>`;
  };

  const renderMonths = (list, skipFirstLabel) => groupByMonth(list).map((m, i) =>
    `${i === 0 && m.label === skipFirstLabel ? "" : `<div class="month">${m.label}</div>`}`
    + m.rows.map(renderRow).join("")).join("");

  const earlierBlock = earlier.length
    ? `<button class="earlier-row" id="earlier-toggle" aria-expanded="${state.familyShowEarlier}">
         <svg class="caret ${state.familyShowEarlier ? "up" : ""}" viewBox="0 0 12 8"
           aria-hidden="true" focusable="false"><path d="M1 1.75 L6 6.25 L11 1.75" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
         ${state.familyShowEarlier ? "Hide" : "Show"} ${plural(earlier.length, "earlier event", "earlier events")}
       </button>
       ${state.familyShowEarlier ? renderMonths(earlier) : ""}`
    : "";

  // expanding the earlier events must not print the same month heading twice in a row
  const lastEarlierMonth = state.familyShowEarlier && earlier.length
    ? earlier[earlier.length - 1].event.longDate.split(" ").slice(2).join(" ") : null;

  const body = filtered.length
    ? earlierBlock + renderMonths(rest, lastEarlierMonth)
    : `<div class="card card-pad">Nothing on the calendar for ${(() => {
          const c = state.familyChild !== "all" ? BY_ID.get(Number(state.familyChild)) : null;
          return c && kids.some((k) => k.id === c.id) ? esc(c.firstName) : "your family";
        })()} yet. You'll get an email when the next session is published.</div>`;

  const childCards = kids.map((k) => `
    <div class="childrow">
      <div class="cr-top">
        <div><div class="cn">${esc(k.name)}</div>
          <div class="ct">${esc(TEAM_BY_ID.get(k.teamId).name)} &middot; ${schoolForParent(k)}</div></div>
        <button class="linkbtn" data-fedit="${k.id}">Change school</button>
      </div>
    </div>`).join("");

  /* Only what is coming up this week is worth nagging about. Counted from everything,
     not from the filtered list: a filter changes what is shown, not what is owed. */
  const weekEnd = new Date(NOW.getTime() + 7 * 86400000);
  const owed = [];
  all.filter((entry) => !hasStarted(entry.event) && !entry.event.cancelled
      && eventStart(entry.event) <= weekEnd)
    .forEach((entry) => {
      entry.kids.forEach((k) => {
        if ((entry.event.status.get(k.id) || "none") === "none") owed.push({ entry, person: k });
      });
      if (me.coachIn[entry.team.id] && (entry.event.status.get(me.id) || "none") === "none") {
        owed.push({ entry, person: me });
      }
    });
  owed.sort((a, b) => eventStart(a.entry.event) - eventStart(b.entry.event));
  const outstanding = owed.length;
  const firstOwed = owed[0];
  // always exactly one name, whatever the number of children
  const owedWho = firstOwed ? (firstOwed.person.id === me.id ? "you" : firstOwed.person.firstName) : "";
  const owedWhen = firstOwed ? relativeDay(eventStart(firstOwed.entry.event)) : "";

  const chipRow = kids.length > 1
    ? `<div class="toolbar childchips" role="group" aria-label="Filter by child">
        ${[["all", "All"]].concat(kids.map((k) => [String(k.id), k.firstName]))
          .map(([v, l]) => `<button class="chip" data-childchip="${v}"
            aria-pressed="${String(state.familyChild || "all") === v}">${esc(l)}</button>`).join("")}
       </div>`
    : "";

  el("view-family").innerHTML = `
    <div class="page-head">
      <div><h2>Your family</h2>
        ${kids.length > 1 ? "" : `<div class="count">${esc(kids.map((k) => k.firstName).join(" and "))}</div>`}</div>
    </div>
    ${outstanding
      ? `<button class="alert warn alert-action" id="goto-owed">
          <span class="alert-words">${outstanding === 1
            ? `<b>1 answer still to give, for ${esc(owedWho)}, ${owedWhen}.</b>`
            : `<b>${outstanding} answers still to give.</b> The first is ${esc(owedWho)}, ${owedWhen}.`}</span>
          <span class="alert-go">Take me there &#8594;</span></button>`
      : ""}
    <div class="family">
      <div>${chipRow}${body}</div>
      <div>
        <div class="side-card">
          <h3>Your children</h3>
          ${childCards}
        </div>
        <div class="side-card">
          <div class="cr-top" style="margin-bottom:10px">
            <h3 style="margin:0">Your details</h3>
            <button class="linkbtn" data-fedit="${me.id}">Edit</button>
          </div>
          <div class="kv"><span class="k">Name</span><span class="v">${esc(me.name)}</span></div>
          <div class="kv"><span class="k">Email</span><span class="v">${esc(me.email)}</span></div>
          <div class="kv"><span class="k">Phone</span><span class="v">${esc(me.phone || "not given")}</span></div>
        </div>
      </div>
    </div>
    ${familyEditModal()}`;

  wireFamily(firstOwed);
}

function familyEditModal() {
  if (!state.editingId || state.editScope !== "family") return "";
  const p = BY_ID.get(state.editingId);
  const d = state.editDraft || {};
  const bad = (f) => state.editErrorField === f ? " has-error" : "";
  /* the message belongs under the field it is about, not at the foot of the dialog */
  const errFor = (f) => state.editErrorField === f
    ? `<div class="err" id="err-${f}">${esc(state.editError)}</div>` : "";
  const aria = (f) => state.editErrorField === f
    ? ` aria-invalid="true" aria-describedby="err-${f}"` : "";
  const actions = `<div class="modal-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn primary" id="f-save">Save</button></div>`;

  if (p.type === "child") {
    const t = TEAM_BY_ID.get(p.teamId);
    const current = d.school !== undefined ? d.school : (p.school || (p.schoolPending ? "__other" : "__none"));
    const otherText = d.schoolOther !== undefined ? d.schoolOther : (p.schoolPending || "");
    const isOther = current === "__other";
    return `<div class="modal-backdrop" id="edit-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <h3 id="dlg-title">${esc(p.firstName)}'s school</h3>
      <div class="msub">${esc(t.name)}</div>
      <div class="field${bad("school")}"><label for="f-school">School</label>
        <select id="f-school"${aria("school")}>
          ${t.schools.map((sc) => `<option value="${esc(sc)}" ${sc === current ? "selected" : ""}>${esc(sc)}</option>`).join("")}
          <option value="__other" ${isOther ? "selected" : ""}>Other&hellip;</option>
          <option value="__none" ${current === "__none" ? "selected" : ""}>Not sure yet</option>
        </select>
        <input id="f-school-other" placeholder="School name" value="${esc(otherText)}" ${isOther ? "" : "hidden"}>
        ${errFor("school")}
        <div class="hint">The club uses this to keep school friends together at training, and no other parent ever
          sees it. If you type a school in yourself, the club will confirm it before it is used.</div>
      </div>
      ${actions}</div></div>`;
  }

  const v = (k, fallback) => esc(d[k] !== undefined ? d[k] : fallback);
  return `<div class="modal-backdrop" id="edit-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <h3 id="dlg-title">Your details</h3>
    <div class="msub">These are yours to change.</div>
    <div class="row2">
      <div class="field${bad("name")}"><label for="f-first">First name</label>
        <input id="f-first" value="${v("firstName", p.firstName)}"${aria("name")}></div>
      <div class="field${bad("name")}"><label for="f-last">Surname</label>
        <input id="f-last" value="${v("lastName", p.lastName)}"></div>
    </div>
    ${errFor("name")}
    <div class="field${bad("email")}"><label for="f-email">Email address</label>
      <input id="f-email" type="email" value="${v("email", p.email)}"${aria("email")}>
      ${errFor("email")}
      <div class="hint">Where invitations and reminders go.</div></div>
    <div class="field"><label for="f-phone">Phone number</label>
      <input id="f-phone" value="${v("phone", p.phone || "")}">
      <div class="hint">Optional. Only a team admin can see it, and only to ring you.</div></div>
    ${actions}</div></div>`;
}

/* open a dialog, put focus in it, trap Tab, and give focus back when it closes */
function openFamilyDialog(id, triggerSelector) {
  state.editingId = id;
  state.editScope = "family";
  state.editError = "";
  state.editErrorField = null;
  state.editDraft = null;
  state.editReturnTo = triggerSelector;
  renderFamily();
  const first = document.querySelector("#edit-backdrop select, #edit-backdrop input");
  if (first) first.focus();
}

function closeFamilyDialog() {
  const back = state.editReturnTo;
  state.editingId = null;
  state.editError = "";
  state.editErrorField = null;
  state.editDraft = null;
  state.editReturnTo = null;
  renderFamily();
  const trigger = back && document.querySelector(back);
  if (trigger) trigger.focus();
}

function trapTab(e) {
  if (e.key !== "Tab") return;
  const modal = document.querySelector("#edit-backdrop .modal");
  if (!modal) return;
  const items = [...modal.querySelectorAll('a[href], button, select, input, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((n) => !n.disabled && !n.hidden && n.getBoundingClientRect().width);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function wireFamily(firstOwed) {
  const root = el("view-family");

  const toggle = el("earlier-toggle");
  if (toggle) toggle.onclick = () => { state.familyShowEarlier = !state.familyShowEarlier; renderFamily(); };

  root.querySelectorAll("[data-childchip]").forEach((b) =>
    b.onclick = () => {
      state.familyChild = b.dataset.childchip;
      state.familyOpenId = null;
      renderFamily();
    });

  const goto = el("goto-owed");
  if (goto && firstOwed) goto.onclick = () => {
    // the thing it counted may be hidden by the current filter, so clear it on the way
    state.familyChild = "all";
    state.familyOpenId = firstOwed.entry.event.id;
    if (hasStarted(firstOwed.entry.event)) state.familyShowEarlier = true;
    renderFamily();
    const node = el("fev-" + firstOwed.entry.event.id);
    if (node) {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
      const head = node.querySelector(".fev-head");
      if (head) head.focus();
    }
  };
  const evById = (id) => TEAMS.flatMap((t) => t.events).find((e) => e.id === id);

  root.querySelectorAll("[data-fev]").forEach((b) =>
    b.onclick = () => {
      state.familyOpenId = state.familyOpenId === b.dataset.fev ? null : b.dataset.fev;
      renderFamily();
    });
  root.querySelectorAll("[data-yes]").forEach((b) =>
    b.onclick = () => familyAnswer(evById(b.dataset.ev), Number(b.dataset.yes), "accepted"));
  root.querySelectorAll("[data-no]").forEach((b) =>
    b.onclick = () => familyAnswer(evById(b.dataset.ev), Number(b.dataset.no), "declined"));
  // opens the choice and writes nothing
  root.querySelectorAll("[data-change]").forEach((b) =>
    b.onclick = () => { state.familyEditing = b.dataset.change; renderFamily(); });
  root.querySelectorAll("[data-cancel-change]").forEach((b) =>
    b.onclick = () => { state.familyEditing = null; renderFamily(); });

  root.querySelectorAll("[data-fedit]").forEach((b) =>
    b.onclick = () => openFamilyDialog(Number(b.dataset.fedit), '[data-fedit="' + b.dataset.fedit + '"]'));

  const back = el("edit-backdrop");
  if (!back || state.editScope !== "family") return;
  back.onclick = (e2) => { if (e2.target === back) closeFamilyDialog(); };
  el("f-cancel").onclick = closeFamilyDialog;
  document.onkeydown = (e2) => {
    if (!state.editingId) return;
    if (e2.key === "Escape") closeFamilyDialog();
    else trapTab(e2);
  };

  const schoolSel = el("f-school");
  if (schoolSel) schoolSel.onchange = () => {
    const other = el("f-school-other");
    other.hidden = schoolSel.value !== "__other";
    if (!other.hidden) other.focus();
  };

  el("f-save").onclick = () => {
    const p = BY_ID.get(state.editingId);
    // keep what they typed, so a validation failure never throws their work away
    if (p.type === "child") {
      const sel = el("f-school").value, other = el("f-school-other").value;
      state.editDraft = { school: sel, schoolOther: other };
      if (sel === "__other" && !other.trim()) {
        state.editError = "Type the school's name, or pick one from the list.";
        state.editErrorField = "school";
        return renderFamily();
      }
      if (sel === "__none") { p.school = ""; p.schoolPending = null; }
      else setSchool(p, sel === "__other" ? other.trim() : sel, sel === "__other");
      const label = p.school || p.schoolPending;
      toast(p.firstName + "'s school " + (label ? "updated." : "cleared."));
    } else {
      const first = el("f-first").value, last = el("f-last").value,
            email = el("f-email").value, phone = el("f-phone").value;
      state.editDraft = { firstName: first, lastName: last, email, phone };
      if (!first.trim() || !last.trim()) {
        state.editError = "A first name and a surname are both needed.";
        state.editErrorField = "name";
        return renderFamily();
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        state.editError = "That email address doesn't look right.";
        state.editErrorField = "email";
        return renderFamily();
      }
      p.firstName = first.trim(); p.lastName = last.trim(); p.name = p.firstName + " " + p.lastName;
      p.email = email.trim(); p.phone = phone.trim();
      toast("Your details saved.");
    }
    const back2 = state.editReturnTo;
    state.editingId = null; state.editError = ""; state.editErrorField = null;
    state.editDraft = null; state.editReturnTo = null;
    renderAll();
    const trigger = back2 && document.querySelector(back2);
    if (trigger) trigger.focus();
  };
}

/* ---------------- sign in, and the chrome that depends on it ---------------- */

const TABS = [
  { id: "family", label: "My family", admin: false },
  { id: "calendar", label: "Calendar", admin: true },
  { id: "members", label: "Members", admin: true },
  { id: "invite", label: "Invitation", admin: true },
  { id: "groups", label: "Squads", admin: true }
];

function showView(name) {
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  window.scrollTo(0, 0);
}

function renderChrome() {
  const me = signedIn();
  const admin = isAdmin(me);
  const tabs = TABS.filter((t) => admin || !t.admin);
  const order = admin ? tabs.slice(1).concat(tabs[0]) : tabs;

  el("tabs").innerHTML = order.map((t, i) =>
    `<button role="tab" data-view="${t.id}" aria-selected="${i === 0}">${t.label}</button>`).join("");
  el("tabs").hidden = order.length < 2;
  el("tabs").querySelectorAll("button").forEach((b) => { b.onclick = () => showView(b.dataset.view); });

  const picker = el("team-pick");
  const mine = adminTeamsFor(me);
  picker.hidden = mine.length < 2;
  picker.innerHTML = mine.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  if (mine.length) picker.value = state.teamId;

  showView(order[0].id);
}

function signInAs(id) {
  state.signedInId = id;
  const me = signedIn();
  const home = (adminTeamsFor(me)[0] || teamsFor(me)[0] || TEAMS[0]).id;
  selectTeam(home);
  el("signin").hidden = true;
  el("app").hidden = false;
  renderChrome();
  renderAll();
}

function signOut() {
  state.menuOpen = false;
  state.menuPanel = null;
  if (el("usermenu")) { el("usermenu").hidden = true; el("whoami").setAttribute("aria-expanded", "false"); }
  state.signedInId = null;
  state.editingId = null;
  state.editDraft = null;
  state.editErrorField = null;
  // view state belongs to the session that made it
  state.familyChild = "all";
  state.familyOpenId = null;
  state.familyShowEarlier = false;
  state.familyEditing = null;
  el("app").hidden = true;
  el("signin").hidden = false;
  window.scrollTo(0, 0);
}

el("personas").innerHTML = PERSONAS.map((p) => {
  const a = BY_ID.get(p.id);
  const roles = adminTeamsFor(a).map((t) => ROLE_LABEL[a.roleIn[t.id]])
    .concat(TEAMS.filter((t) => a.coachIn[t.id]).map((t) => "Coach, " + t.name));
  const kids = a.childIds.map((id) => BY_ID.get(id))
    .map((c) => c.firstName + " (" + TEAM_BY_ID.get(c.teamId).shortName + ")").join(", ");
  return `<button class="persona" data-signin="${p.id}">
      <div class="pname">${esc(a.name)}</div>
      <div class="prole">${esc(roles.length ? [...new Set(roles)].join(" · ") : "Parent")}</div>
      <div class="pblurb">${esc(p.blurb)}<br>Children: ${esc(kids)}</div>
    </button>`;
}).join("");

el("personas").querySelectorAll("[data-signin]").forEach((b) =>
  b.onclick = () => signInAs(Number(b.dataset.signin)));

el("team-pick").onchange = () => { selectTeam(el("team-pick").value); renderAll(); };

el("whoami").onclick = () => { state.menuOpen ? closeUserMenu() : openUserMenu(); };

document.addEventListener("keydown", (e) => {
  if (!state.menuOpen) return;
  if (e.key === "Escape") { e.stopPropagation(); closeUserMenu(); }
  else if (e.key === "Tab") trapMenuTab(e);
});

document.addEventListener("mousedown", (e) => {
  if (state.menuOpen && !el("usermenu").contains(e.target) && e.target !== el("whoami")
      && !el("whoami").contains(e.target)) closeUserMenu(false);
});

/* squads are already out for the next session of each team, so a parent signing in
   has something to look at; later sessions are left unpublished on purpose */
TEAMS.forEach((t) => {
  const e = nextEventFor(t);
  if (e && e.published && !e.cancelled) publishSquads(e, allocationFor(t, e));
});

/* Seeded, and only reachable once squads exist: a second coach on the squad the
   coaching persona's child is in. The allocator gives most squads a single coach, and
   hers was that coach, so the coach-to-coach phone numbers had nowhere to appear.
   The coach is taken from a squad that has one to spare, so none is left without one,
   and their own children go with them — where the allocator puts a coach, and where
   an admin moving one by hand would leave them. */
(function seedSecondCoach() {
  const coach = BY_ID.get(PERSONAS[1].id);
  const kid = coach.childIds.map((id) => BY_ID.get(id)).filter(Boolean)[0];
  if (!kid) return;
  const e = nextEventFor(TEAM_BY_ID.get(kid.teamId));
  if (!e || !e.squadsPublished) return;

  const mine = e.squads.find((sq) => sq.childIds.includes(kid.id));
  if (!mine || mine.coachIds.length > 1) return;
  const donor = e.squads.find((sq) => sq !== mine && sq.coachIds.length > 1);
  if (!donor) return;

  const movedId = donor.coachIds.pop();
  mine.coachIds.push(movedId);
  BY_ID.get(movedId).childIds.forEach((cid) => {
    const from = e.squads.find((sq) => sq !== mine && sq.childIds.includes(cid));
    if (!from) return;
    from.childIds = from.childIds.filter((x) => x !== cid);
    mine.childIds.push(cid);
  });
})();
