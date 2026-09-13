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
  familyOpen: new Set(),      // event ids, not one id: see the [data-fev] handler
  familyTouchedRows: false,   // once a parent opens or closes one, stop choosing for them
  familyShowEarlier: false,
  familyChild: "all",
  familyEditing: null,
  menuOpen: false,
  editDraft: null,
  editErrorField: null,
  editReturnTo: null,
  teamId: "u9",
  eventId: null,
  calOpen: new Set(),       // calendar rows open and close on their own — item 81
  calTouched: false,        // once an admin opens or closes one, stop choosing for them
  calShowEarlier: false,    // the season before the next event, collapsed
  squadSettingsOpen: false, // set once a season, so folded away by default
  view: null,
  settings: null,
  mode: null,
  groupCount: 0,
  pins: new Map(),
  result: null,
  lastMove: null,
  respEditing: null,        // "personId" while that row's status chooser is open
  eventPicked: false,       // an admin has chosen an event by hand, so stop defaulting
  respDefaulted: false,     // each screen picks its own first event, once per team
  squadDefaulted: false,
  rerunNotice: null,
  editingId: null,
  editError: "",
  /* the event dialog: one component, four jobs — new, edit, publish, cancel */
  evDialog: null,           // { mode, eventId, draft, errorField, error, returnTo }
  evDeselected: null        // Set of person ids an admin has taken off a publish
};

const signedIn = () => BY_ID.get(state.signedInId);
const team = () => TEAM_BY_ID.get(state.teamId);
const ev = () => team().events.find((e) => e.id === state.eventId);
/* a calendar row acts on its own event, not on whichever one the other screens hold */
const eventById = (id) => team().events.find((e) => e.id === id);
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
  state.eventPicked = false;
  state.respDefaulted = false;
  state.squadDefaulted = false;
  state.calOpen = new Set();
  state.calTouched = false;
  selectEvent(nextEventFor(t).id);
}
function selectEvent(id) {
  state.eventId = id;
  state.pins.clear();
  state.lastMove = null;
  state.respEditing = null;
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
  if (!after) return { reason, detail: "there are no squads to show" };
  const bits = [];
  if (before && before.count !== after.count) {
    bits.push(before.count + (before.count === 1 ? " squad became " : " squads became ") + after.count);
  } else {
    bits.push(plural(after.count, "squad", "squads"));
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
    if (moved) bits.push(plural(moved, "child", "children") + " changed squad");
    if (!added && !gone && !moved) bits.push("nobody moved");
  }
  return { reason, detail: bits.join(", ") };
}

function rerun(keepPins = true, reason = null) {
  const before = placementSnapshot();
  if (!keepPins) state.pins.clear();
  const e = ev();
  if (!e || !e.published || e.cancelled || isSocial(e)) {
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
function publishSquads(e, result, at) {
  if (!result || !result.groups || isSocial(e)) return;
  e.squads = result.groups.map((g, i) => ({
    name: g.name, index: i,
    childIds: g.children.map((c) => c.id),
    coachIds: g.coaches.map((c) => c.id)
  }));
  e.squadsPublished = true;
  e.squadsPublishedAt = at || NOW;
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

/* ---- TEMPORARY: theme switch in the header ------------------------------
   Here for user testing only, so a tester can flip the theme without a menu.
   To remove: delete this function, its call in renderAll, its listener at the
   foot of this file, #theme-toggle in index.html and .themebtn in styles.css. */
function renderThemeToggle() {
  const btn = el("theme-toggle");
  if (!btn) return;
  const dark = themeIsDark();
  btn.setAttribute("aria-label", dark ? "Switch to the light theme" : "Switch to the dark theme");
  btn.title = dark ? "Switch to the light theme" : "Switch to the dark theme";
  btn.innerHTML = dark
    ? `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M4.2 12H2M22 12h-2.2
         M5.6 5.6 7.2 7.2M16.8 16.8l1.6 1.6M18.4 5.6 16.8 7.2M7.2 16.8l-1.6 1.6"/></svg>`
    : `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z"/></svg>`;
}

function renderWhoami() {
  /* The name is the control, and behind it is sign-out and nothing else — the places it
     used to hold are tabs now. On a phone shared between two parents the name is worth
     keeping in sight, because it says whose answers these are. */
  el("whoami").innerHTML = "<b>" + esc(signedIn().name) + "</b>"
    + `<svg class="caret" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1 1.75 L6 6.25 L11 1.75"
       fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function themeIsDark() {
  const set = document.documentElement.getAttribute("data-theme");
  return set ? set === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

function renderUserMenu() {
  /* The menu used to carry the family cards and the theme. Both have somewhere better
     to be — the cards are a tab, the theme is a button in the header — so signing out
     is all that is left. */
  el("usermenu").innerHTML =
    `<button class="menu-item" data-menu="signout">Sign out</button>`;
  el("usermenu").querySelector('[data-menu="signout"]').onclick = () => {
    closeUserMenu(false);
    signOut();
  };
}

function openUserMenu() {
  state.menuOpen = true;
  el("usermenu").hidden = false;
  el("whoami").setAttribute("aria-expanded", "true");
  renderUserMenu();
  const first = el("usermenu").querySelector("button");
  if (first) first.focus();
}

function closeUserMenu(restoreFocus = true) {
  state.menuOpen = false;
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
  renderThemeToggle();
  if (isAdmin(me)) { renderCalendar(); renderMembers(); renderResponses(); renderGroups(); }
  renderFamily();
  /* after everything is drawn: the name button is filled by renderWhoami above, and an
     empty one measures shorter than a filled one */
  syncChromeOffset();
  window.scrollTo(0, y);
}

/* ---------------- calendar ---------------- */

/* The type leads the title, so a match and a blitz are told apart on the row itself.
   The tile colour underneath is reinforcement, never the only signal. */
function eventTitle(e) {
  if (e.type === "Game") return "Match &middot; " + esc((e.away ? "Away to " : "Home to ") + e.opposition);
  if (e.type === "Blitz") return "Blitz &middot; " + esc(e.title || e.venue);
  if (e.type === "Social") return "Social &middot; " + esc(e.title || e.venue);
  if (e.title) return esc(e.title);
  return "Training";
}

/* a social takes answers like any other event, but no allocation ever runs on it */
const isSocial = (e) => !!e && e.type === "Social";

/* the type as a word, for a sentence rather than a label */
const typeWord = (e) => e.type === "Game" ? "match"
  : e.type === "Social" ? "social event" : e.type.toLowerCase();

/* matches and blitzes share the club gold, training keeps the purple, and a social
   takes the neutral tile. The word in the title carries the meaning either way. */
const tileKind = (e) => (e.type === "Game" || e.type === "Blitz") ? "is-match"
  : e.type === "Social" ? "is-social" : "is-training";

function renderCalendar() {
  const t = team();

  /* Rows open and close on their own, exactly as the parent's do (item 81): opening one
     never closes another, and tapping a row only ever changes that row's own height,
     downward. One card starts open — the next event, because it is the one being asked
     about — and after that the admin decides. */
  const here = new Set(t.events.map((e) => e.id));
  [...state.calOpen].forEach((id) => { if (!here.has(id)) state.calOpen.delete(id); });
  if (!state.calOpen.size && !state.calTouched) {
    const next = nextEventFor(t);
    if (next) state.calOpen.add(next.id);
  }

  const renderAdminRow = (e) => {
      const open = state.calOpen.has(e.id);
      const counts = ["accepted", "declined", "none"].map((k) =>
        [...e.status.entries()].filter(([, v]) => v === k).length);
      const tags = [];
      if (e.cancelled) tags.push('<span class="tag cancelled">Cancelled</span>');
      else if (e.draft) tags.push('<span class="tag draft">Draft &middot; not published</span>');
      else if (started(e)) tags.push('<span class="tag unreg">Finished</span>');
      if (e.published && !e.cancelled) {
        const invited = counts[0] + counts[1] + counts[2];
        tags.push(`<span class="pill accepted">${counts[0]} of ${invited} accepted</span>`);
        const ds = deadlineState(e);
        tags.push(`<span class="tag ${ds.closed ? "unreg" : "due"}">${ds.chip}</span>`);
      }

      return `<div class="evrow ${open ? "is-open" : ""} ${e.draft ? "is-draft" : ""} ${e.cancelled ? "is-cancelled" : ""} ${started(e) ? "is-past" : ""}"
        id="evrow-${e.id}">
        <button class="evhead" data-event="${e.id}" aria-expanded="${open}">
          <span class="ev-when ${tileKind(e)}"><span class="dd">${e.date.slice(8)}</span><span
            class="mm">${e.dayName.slice(0, 3)}</span></span>
          <span class="evmain">
            <span class="t">${eventTitle(e)}</span>
            <span class="s">${e.time}&ndash;${e.endTime} &middot; ${esc(e.venue)}</span>
          </span>
          <span class="evtags">${tags.join(" ")}</span>
        </button>
        ${open ? `<div class="evbody">
          ${e.cancelled ? `<div class="alert stop" style="margin-top:14px"><b>Cancelled.</b> ${esc(e.cancelled)} Everyone invited was notified.</div>` : ""}
          ${e.draft ? `<div class="alert notice" style="margin-top:14px"><b>This is a draft.</b>
            No member can see it, it can still be edited freely and it can be deleted outright.
            Publishing is what sends the invitations, to every child and every flagged coach.</div>` : ""}
          <div class="evgrid">
          <div class="evfacts">
          <div class="meta">
            <div><div class="k">Type</div>${e.type}</div>
            ${e.meetTime ? `<div><div class="k">Meet</div>${e.meetTime}</div>` : ""}
            <div><div class="k">Duration</div>${e.duration} min</div>
            <div><div class="k">Venue</div>${esc(e.venue)}</div>
            ${e.opposition ? `<div><div class="k">Opposition</div>${esc(e.opposition)}${
              e.away ? " (away)" : ""}</div>` : ""}
            ${isSocial(e) ? "" : `<div><div class="k">Mode</div>${
              e.mode === "ability" ? "Balanced ability" : "School affinity"}</div>`}
          </div>
          ${venueBlock(e, true)}
          </div>
          ${e.published && !e.cancelled ? `<div class="deadline-bar">
            <div>
              <div class="k">Response deadline</div>
              <div class="dl-main">${fmtWhen(deadlineFor(e))} &middot;
                <span class="${deadlineState(e).closed ? "dl-closed" : "dl-open"}">${deadlineState(e).label}</span></div>
              <div class="sub">Reminder to non-responders goes out ${fmtWhen(reminderFor(e))}, a day before answers are due.
                Nothing locks: a parent can still change their answer${isSocial(e) ? "" : ", and the allocation re-runs when they do"}.</div>
            </div>
            <label class="dl-set">Hours before start
              <input type="number" min="1" max="336" id="dl-${e.id}" data-deadline="${e.id}" value="${deadlineHoursFor(e)}">
              <span class="sub">team default ${TEAM_BY_ID.get(e.teamId).settings.deadlineHours}</span>
            </label>
          </div>` : ""}
          </div>
          ${e.published && !e.cancelled ? `<div class="mini-stats">
            <div class="accepted"><b>${counts[0]}</b> accepted</div>
            <div class="declined"><b>${counts[1]}</b> declined</div>
            <div><b>${counts[2]}</b> no response</div>
          </div>` : ""}
          <div class="toolbar" style="margin:0 0 4px">
            ${e.draft ? `<button class="btn primary" data-publish="${e.id}">Publish and invite</button>` : ""}
            ${e.published && !e.cancelled
              ? `<button class="btn" data-go-responses="${e.id}">See who has answered</button>` : ""}
            <button class="btn" data-edit-event="${e.id}">Edit</button>
            ${e.draft ? `<button class="btn" data-delete="${e.id}">Delete</button>` : ""}
            ${e.published && !e.cancelled
              ? `<button class="btn" data-cancel-event="${e.id}">Cancel event</button>` : ""}
          </div>
        </div>` : ""}
      </div>`;
  };

  /* The list opens at the next upcoming event, and everything earlier collapses behind
     a single row that reads as the control it is — the same collapse the parent's list
     has. It is a collapse and not a filter: nothing is removed, a cancelled event stays
     inline wherever it falls, and drafts stay where they are, visible to admins only.

     The split uses hasStarted(), which is what the parent's uses, so a session earlier
     today falls on the same side of the line on both screens. */
  const started = (e) => hasStarted(e);
  const firstUpcoming = t.events.findIndex((e) => !started(e));
  const earlier = firstUpcoming === -1 ? t.events.slice() : t.events.slice(0, firstUpcoming);
  const rest = firstUpcoming === -1 ? [] : t.events.slice(firstUpcoming);

  const monthOf = (e) => e.longDate.split(" ").slice(2).join(" ");
  const renderMonths = (list, skipFirstLabel) => {
    const months = [];
    list.forEach((e) => {
      const m = monthOf(e);
      if (!months.length || months[months.length - 1].label !== m) months.push({ label: m, events: [] });
      months[months.length - 1].events.push(e);
    });
    return months.map((m, i) =>
      (i === 0 && m.label === skipFirstLabel ? "" : `<div class="month">${m.label}</div>`)
      + m.events.map(renderAdminRow).join("")).join("");
  };

  const earlierBlock = earlier.length
    ? `<button class="earlier-row" id="cal-earlier-toggle" aria-expanded="${state.calShowEarlier}">
         <svg class="caret ${state.calShowEarlier ? "up" : ""}" viewBox="0 0 12 8"
           aria-hidden="true" focusable="false"><path d="M1 1.75 L6 6.25 L11 1.75" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
         ${state.calShowEarlier ? "Hide" : "Show"} ${plural(earlier.length, "earlier event", "earlier events")}
       </button>
       ${state.calShowEarlier ? renderMonths(earlier) : ""}`
    : "";

  // expanding the earlier events must not print the same month heading twice in a row
  const lastEarlierMonth = state.calShowEarlier && earlier.length
    ? monthOf(earlier[earlier.length - 1]) : null;

  const body = earlierBlock + renderMonths(rest, lastEarlierMonth);

  el("view-calendar").innerHTML = `
    <div class="page-head">
      <div class="count">${t.name} &middot; ${plural(t.events.length, "event", "events")} &middot;
        ${t.events.filter((e) => e.draft).length} in draft</div>
      <div class="spacer"></div>
      <button class="btn" id="import-csv" title="Not built — the CSV columns are undecided, see item 35">Import CSV</button>
      <button class="btn primary" id="new-event">New event</button>
    </div>
    ${body}
    <div class="notice">A draft is invisible to members and can be deleted. Once published it can only be
      cancelled, which asks for a reason and notifies everyone.</div>
    ${eventDialogMarkup()}`;

  wireEventDialog();
  if (el("new-event")) el("new-event").onclick = () => openEventDialog("new", null, "#new-event");
  if (el("import-csv")) el("import-csv").onclick = () =>
    toast("Not built. The CSV columns are still undecided — open question 35.");
  el("view-calendar").querySelectorAll("[data-edit-event]").forEach((b) =>
    b.onclick = () => openEventDialog("edit", b.dataset.editEvent,
      '[data-edit-event="' + b.dataset.editEvent + '"]'));
  el("view-calendar").querySelectorAll("[data-cancel-event]").forEach((b) =>
    b.onclick = () => openEventDialog("cancelevent", b.dataset.cancelEvent,
      '[data-cancel-event="' + b.dataset.cancelEvent + '"]'));

  const earlierToggle = el("cal-earlier-toggle");
  if (earlierToggle) earlierToggle.onclick = () => {
    state.calShowEarlier = !state.calShowEarlier;
    renderCalendar();
    const again = el("cal-earlier-toggle");
    if (again) again.focus();
  };

  /* Tapping a row never moves it: the detail opens downward beneath it and everything
     above stays put. The scroll correction is kept for what can still shift a row — the
     document getting shorter underneath it, and the browser clamping scroll at the end. */
  el("view-calendar").querySelectorAll("[data-event]").forEach((b) =>
    b.onclick = () => {
      const id = b.dataset.event;
      const before = el("evrow-" + id).getBoundingClientRect().top;
      if (state.calOpen.has(id)) state.calOpen.delete(id);
      else state.calOpen.add(id);
      state.calTouched = true;
      renderCalendar();
      const after = el("evrow-" + id);
      if (after) window.scrollBy(0, after.getBoundingClientRect().top - before);
    });
  /* publishing is a step of its own, with the deselection and the share link on it */
  el("view-calendar").querySelectorAll("[data-publish]").forEach((b) =>
    b.onclick = () => openEventDialog("publish", b.dataset.publish,
      '[data-publish="' + b.dataset.publish + '"]'));
  el("view-calendar").querySelectorAll("[data-delete]").forEach((b) =>
    b.onclick = () => {
      const t2 = team(), e2 = eventById(b.dataset.delete);
      t2.events.splice(t2.events.indexOf(e2), 1);
      state.calOpen.delete(e2.id);
      if (e2.id === state.eventId) selectEvent(nextEventFor(t2).id);
      renderAll();
    });
  /* The card is the schedule's entry for this event; the answers live on their own
     screen. Following the link takes the event with it, so the picker over there is
     already on it and never re-defaults underneath the admin. */
  el("view-calendar").querySelectorAll("[data-go-responses]").forEach((b) =>
    b.onclick = () => {
      selectEvent(b.dataset.goResponses);
      state.eventPicked = true;
      renderAll();
      showView("responses");
    });
  el("view-calendar").querySelectorAll("[data-deadline]").forEach((dl) =>
    dl.onchange = () => {
      const e2 = eventById(dl.dataset.deadline);
      e2.deadlineHours = Math.max(1, Math.min(336, Number(dl.value) || 24));
      renderAll();
    });
}

/* ---------------- creating, editing, publishing and cancelling an event ----------------

   One dialog does all four, because they are four states of the same object and an
   admin reaches all four from the same row. It follows the Forms and dialogs rules:
   focus in on open and back to the opener on close, Tab trapped, Escape closes, a
   validation failure keeps what was typed with the message under the field it
   concerns, and every save confirms.                                                 */

const EVENT_TYPES = [
  ["Training", "Training"], ["Game", "Match"], ["Blitz", "Blitz"], ["Social", "Social"]
];
let newEventSeq = 0;

/* A new event inherits the team's duration and deadline — which is what "defaults to
   the team's setting" means: overridable here, and the team's own settings untouched. */
function blankEventDraft(t) {
  const start = new Date(NOW.getTime() + 7 * 86400000);
  return {
    type: "Training", date: isoOf(start), time: "18:30",
    venue: VENUE_NAMES[0], meetTime: "", opposition: "", title: "",
    duration: String(t.settings.duration || 75),
    deadlineHours: String(t.settings.deadlineHours),
    away: false, repeat: "once", weeks: "6"
  };
}

function eventToDraft(e) {
  return {
    type: e.type, date: e.date, time: e.time,
    venue: e.venue, meetTime: e.meetTime || "", opposition: e.opposition || "",
    title: e.title || "",
    duration: String(e.duration),
    deadlineHours: String(deadlineHoursFor(e)),
    away: !!e.away, repeat: "once", weeks: "6"
  };
}

function openEventDialog(mode, eventId, triggerSelector) {
  const t = team();
  const e = eventId ? eventById(eventId) : null;
  state.evDialog = {
    mode, eventId: eventId || null,
    draft: mode === "new" ? blankEventDraft(t) : (e ? eventToDraft(e) : blankEventDraft(t)),
    reason: "", errorField: null, error: "", returnTo: triggerSelector || null
  };
  if (mode === "publish") state.evDeselected = new Set();
  renderCalendar();
  const first = document.querySelector("#ev-backdrop select, #ev-backdrop input");
  if (first) first.focus();
}

function closeEventDialog() {
  const back = state.evDialog && state.evDialog.returnTo;
  state.evDialog = null;
  state.evDeselected = null;
  renderCalendar();
  const trigger = back && document.querySelector(back);
  if (trigger) trigger.focus();
}

/* what the form is carrying right now, so a validation failure never costs the rest */
function readEventForm() {
  /* a field the current type or repeat does not show is absent from the DOM, so fall
     back to what the draft already holds rather than blanking it */
  const prev = (state.evDialog && state.evDialog.draft) || {};
  const g = (id, key) => { const n = el(id); return n ? n.value : (prev[key] !== undefined ? prev[key] : ""); };
  return {
    type: g("ev-type", "type"), date: g("ev-date", "date"), time: g("ev-time", "time"),
    venue: g("ev-venue", "venue"), meetTime: g("ev-meet", "meetTime"),
    opposition: g("ev-opp", "opposition"), title: g("ev-title", "title"),
    duration: g("ev-duration", "duration"), deadlineHours: g("ev-deadline", "deadlineHours"),
    away: el("ev-away") ? el("ev-away").checked : !!prev.away,
    repeat: el("ev-repeat") ? el("ev-repeat").value : (prev.repeat || "once"),
    weeks: g("ev-weeks", "weeks")
  };
}

function eventFormFields(d, bad, errFor, aria) {
  const t = team();
  const isGame = d.type === "Game";
  const isNamed = d.type === "Blitz" || d.type === "Social";
  return `
    <div class="row2">
      <div class="field${bad("type")}"><label for="ev-type">Type</label>
        <select id="ev-type">${EVENT_TYPES.map(([v, l]) =>
          `<option value="${v}" ${d.type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field${bad("venue")}"><label for="ev-venue">Venue</label>
        <select id="ev-venue"${aria("venue")}>${VENUE_NAMES.map((v) =>
          `<option value="${esc(v)}" ${d.venue === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
        ${errFor("venue")}</div>
    </div>
    <div class="row2">
      <div class="field${bad("date")}"><label for="ev-date">Date</label>
        <input id="ev-date" type="date" value="${esc(d.date)}"${aria("date")}>${errFor("date")}</div>
      <div class="field${bad("time")}"><label for="ev-time">Start time</label>
        <input id="ev-time" type="time" value="${esc(d.time)}"${aria("time")}>${errFor("time")}</div>
    </div>
    <div class="row2">
      <div class="field"><label for="ev-meet">Meet time</label>
        <input id="ev-meet" type="time" value="${esc(d.meetTime)}">
        <div class="hint">Optional.</div></div>
      <div class="field${bad("duration")}"><label for="ev-duration">Duration</label>
        <input id="ev-duration" type="number" min="15" max="480" step="5" value="${esc(d.duration)}"${aria("duration")}>
        ${errFor("duration")}
        <div class="hint">Minutes. The team's default is ${t.settings.duration || 75}.</div></div>
    </div>
    ${isGame ? `<div class="field"><label for="ev-opp">Opposition</label>
        <input id="ev-opp" value="${esc(d.opposition)}" placeholder="Cuala">
        <label class="checkline"><input type="checkbox" id="ev-away" ${d.away ? "checked" : ""}>
          <span>Away fixture</span></label>
        <div class="hint">Optional.</div></div>`
      : `<input type="hidden" id="ev-opp" value="${esc(d.opposition)}">`}
    ${isNamed ? `<div class="field"><label for="ev-title">Name</label>
        <input id="ev-title" value="${esc(d.title)}" placeholder="${
          d.type === "Blitz" ? "Cuala, Naomh Olaf and Ballinteer" : "Halloween party"}">
        <div class="hint">Optional. It follows the type in the title on every row.</div></div>`
      : `<input type="hidden" id="ev-title" value="${esc(d.title)}">`}
    <div class="field${bad("deadlineHours")}"><label for="ev-deadline">Response deadline</label>
      <input id="ev-deadline" type="number" min="1" max="336" value="${esc(d.deadlineHours)}"${aria("deadlineHours")}>
      ${errFor("deadlineHours")}
      <div class="hint">Hours before the start. The team's default is ${t.settings.deadlineHours}.
        Nothing locks when it passes &mdash; it says when an answer is wanted.</div></div>`;
}

function eventDialogMarkup() {
  const dlg = state.evDialog;
  if (!dlg) return "";
  const d = dlg.draft;
  const bad = (f) => dlg.errorField === f ? " has-error" : "";
  const errFor = (f) => dlg.errorField === f
    ? `<div class="err" id="everr-${f}">${esc(dlg.error)}</div>` : "";
  const aria = (f) => dlg.errorField === f
    ? ` aria-invalid="true" aria-describedby="everr-${f}"` : "";
  const e = dlg.eventId ? eventById(dlg.eventId) : null;

  const shell = (title, sub, body, actions) => `
    <div class="modal-backdrop" id="ev-backdrop"><div class="modal modal-wide" role="dialog"
      aria-modal="true" aria-labelledby="ev-dlg-title">
      <h3 id="ev-dlg-title">${title}</h3>
      <div class="msub">${sub}</div>
      ${body}
      ${actions}</div></div>`;

  if (dlg.mode === "new") {
    return shell("New event",
      esc(team().name) + " &middot; it starts as a draft, so nobody is invited yet",
      eventFormFields(d, bad, errFor, aria) + `
      <div class="field${bad("weeks")}"><label for="ev-repeat">Repeat</label>
        <select id="ev-repeat">
          <option value="once" ${d.repeat === "once" ? "selected" : ""}>Once</option>
          <option value="weekly" ${d.repeat === "weekly" ? "selected" : ""}>Weekly</option>
        </select>
        ${d.repeat === "weekly"
          ? `<input id="ev-weeks" type="number" min="2" max="12" value="${esc(d.weeks)}"
               aria-label="How many weeks"${aria("weeks")}>
             ${errFor("weeks")}
             <div class="hint"><b>Each week becomes its own event, independent from the moment it
               is created.</b> Editing or cancelling one changes no other, and there is no series to
               edit afterwards. Up to 12 weeks.</div>`
          : `<div class="hint">A weekly repeat creates up to 12 separate events, each independent
               once created.</div>`}
      </div>`,
      `<div class="modal-actions">
        <button class="btn" id="ev-cancel">Cancel</button>
        <button class="btn primary" id="ev-save">Create draft</button></div>`);
  }

  if (dlg.mode === "edit") {
    return shell("Edit event",
      eventTitle(e) + " &middot; " + esc(e.longDate) + (e.draft ? " &middot; draft" : " &middot; published"),
      (e.published ? `<div class="alert notice" style="margin-bottom:14px">This event is published.
        Everyone invited already has it, and an edit does not re-send the invitation.</div>` : "")
      + eventFormFields(d, bad, errFor, aria),
      `<div class="modal-actions">
        <button class="btn" id="ev-cancel">Cancel</button>
        <button class="btn primary" id="ev-save">Save changes</button></div>`);
  }

  if (dlg.mode === "publish") {
    const t = team();
    const kids = t.people.filter((p) => p.type === "child").slice().sort(bySurname);
    const coaches = t.people.filter((p) => p.type === "adult" && p.coachIn[t.id]).slice().sort(bySurname);
    const off = state.evDeselected || new Set();
    const row = (p, kind) => `<label class="pickline${off.has(p.id) ? " is-off" : ""}">
        <input type="checkbox" data-invite="${p.id}" ${off.has(p.id) ? "" : "checked"}>
        <span class="pn">${esc(p.name)}</span>
        <span class="pk">${kind}</span></label>`;
    const total = kids.length + coaches.length;
    const going = total - off.size;
    const share = "Kilmacud Crokes " + typeWord(e) + " — " + e.dayName + " " + e.shortDate
      + ", " + e.time + " at " + e.venue + ". Please answer in the app.";
    return shell("Publish and invite",
      eventTitle(e) + " &middot; " + esc(e.longDate),
      `<div class="alert notice" style="margin-bottom:14px">Publishing sends the invitation email to
        <b>${going}</b> of ${total} &mdash; every child and every flagged coach, unless you take
        somebody off below. Once published, cancelling is the only way to withdraw it.</div>
      <div class="field"><label>Who gets invited</label>
        <div class="picklist">
          <div class="pickhead">Children (${kids.length})</div>
          ${kids.map((p) => row(p, "child")).join("")}
          <div class="pickhead">Coaches (${coaches.length})</div>
          ${coaches.map((p) => row(p, "coach")).join("")}
        </div></div>
      <div class="field"><label>Also share to WhatsApp</label>
        <div class="sharebox">
          <div class="sharetext">${esc(share)}</div>
          <button class="btn" type="button" id="ev-share">Copy for WhatsApp</button>
        </div>
        <div class="hint">A share, not a channel. Nothing comes back through it and nothing is
          tracked through it &mdash; email is the record that reaches everyone.</div></div>`,
      `<div class="modal-actions">
        <button class="btn" id="ev-cancel">Cancel</button>
        <button class="btn primary" id="ev-save">Publish and invite ${going}</button></div>`);
  }

  if (dlg.mode === "cancelevent") {
    return shell("Cancel this event",
      eventTitle(e) + " &middot; " + esc(e.longDate),
      `<div class="alert stop" style="margin-bottom:14px">Everyone invited is notified, and the event
        stays on the calendar with the reason you give.</div>
      <div class="field${bad("reason")}"><label for="ev-reason">Reason</label>
        <input id="ev-reason" value="${esc(dlg.reason || "")}" placeholder="Pitch waterlogged"${aria("reason")}>
        ${errFor("reason")}
        <div class="hint">Every parent sees this on the event.</div></div>`,
      `<div class="modal-actions">
        <button class="btn" id="ev-cancel">Keep the event</button>
        <button class="btn danger" id="ev-save">Cancel the event</button></div>`);
  }
  return "";
}

/* recompute everything a row and the calendar feed read off a date, a time and a
   duration, so an edit never leaves a stale end time or day name behind */
function stampEvent(e) {
  e.endTime = addMinutes(e.time, e.duration);
  e.longDate = longDate(e.date);
  e.shortDate = shortDate(e.date);
  e.dayName = DAYS[parseDate(e.date).getDay()];
  e.past = e.date < TODAY;
  e.social = e.type === "Social";
}

function applyDraftTo(e, d) {
  e.type = d.type;
  e.date = d.date;
  e.time = d.time;
  e.duration = Number(d.duration);
  e.venue = d.venue;
  e.meetTime = d.meetTime || "";
  e.opposition = d.type === "Game" ? ((d.opposition || "").trim() || null) : null;
  e.away = d.type === "Game" ? !!d.away : false;
  e.title = (d.type === "Blitz" || d.type === "Social") ? ((d.title || "").trim() || null) : null;
  e.deadlineHours = Math.max(1, Math.min(336, Number(d.deadlineHours) || 24));
  stampEvent(e);
}

function newEventFrom(t, d, offsetWeeks) {
  const start = parseDate(d.date);
  start.setDate(start.getDate() + offsetWeeks * 7);
  const e = {
    id: t.id + "-new-" + (++newEventSeq), teamId: t.id, key: null,
    type: d.type, title: null, date: isoOf(start), time: d.time,
    duration: Number(d.duration), meetTime: "", venue: d.venue,
    opposition: null, away: false,
    published: false, draft: true, cancelled: null,
    mode: t.mode, squadsPlanned: false,
    status: new Map(), answeredBy: new Map(), answeredAt: new Map()
  };
  applyDraftTo(e, Object.assign({}, d, { date: isoOf(start) }));
  return e;
}

const byDateThenTime = (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time);

function saveEventDialog() {
  const dlg = state.evDialog;
  if (!dlg) return;
  const t = team();

  const failWith = (field, message, focusId) => {
    dlg.errorField = field; dlg.error = message;
    renderCalendar();
    const n = el(focusId || ("ev-" + field));
    if (n) n.focus();
  };
  const finish = (message, reason) => {
    const e = dlg.eventId ? eventById(dlg.eventId) : null;
    const returnTo = dlg.returnTo;
    state.evDialog = null; state.evDeselected = null;
    toast(message);
    if (reason && e && e.id === state.eventId) rerun(true, reason);
    renderAll();
    /* the control that opened the dialog may not exist any more — publishing removes
       the Publish button — so fall back to the row it belonged to */
    const backTo = (returnTo && document.querySelector(returnTo))
      || (e && document.querySelector('[data-event="' + e.id + '"]'));
    if (backTo) backTo.focus();
  };

  if (dlg.mode === "cancelevent") {
    dlg.reason = el("ev-reason").value;
    if (!dlg.reason.trim()) return failWith("reason", "Give a reason. Every parent sees it.", "ev-reason");
    const e = eventById(dlg.eventId);
    e.cancelled = dlg.reason.trim().replace(/([^.!?])$/, "$1.");
    return finish("Cancelled. Everyone invited has been notified.", "the event was cancelled");
  }

  if (dlg.mode === "publish") {
    const e = eventById(dlg.eventId);
    publishEvent(e, state.evDeselected || new Set());
    const n = e.status.size;
    return finish("Published. " + plural(n, "invitation", "invitations") + " sent.",
      "the event was published");
  }

  /* new and edit share one validation pass */
  const d = readEventForm();
  dlg.draft = d;
  if (!d.date) return failWith("date", "Give the event a date.");
  if (!d.time) return failWith("time", "Give the event a start time.");
  if (!d.venue) return failWith("venue", "Pick a venue from the club's list.");
  const dur = Number(d.duration);
  if (!dur || dur < 15 || dur > 480) return failWith("duration", "A duration between 15 and 480 minutes.");
  const dh = Number(d.deadlineHours);
  if (!dh || dh < 1 || dh > 336) {
    return failWith("deadlineHours", "Between 1 and 336 hours before the start.", "ev-deadline");
  }

  if (dlg.mode === "new") {
    const weeks = d.repeat === "weekly" ? Number(d.weeks) : 1;
    if (d.repeat === "weekly" && (!weeks || weeks < 2 || weeks > 12)) {
      return failWith("weeks", "Between 2 and 12 weeks.", "ev-weeks");
    }
    const made = [];
    for (let i = 0; i < weeks; i++) made.push(newEventFrom(t, d, i));
    t.events = t.events.concat(made).sort(byDateThenTime);
    made.forEach((x) => state.calOpen.add(x.id));
    state.calTouched = true;
    return finish(weeks === 1
      ? "Draft created. Nobody is invited until you publish it."
      : plural(weeks, "draft", "drafts") + " created, one a week. Each is independent.");
  }

  applyDraftTo(eventById(dlg.eventId), d);
  t.events.sort(byDateThenTime);
  return finish("Saved.", "the event details changed");
}

function wireEventDialog() {
  const back = el("ev-backdrop");
  if (!back) return;
  const dlg = state.evDialog;
  back.onclick = (e2) => { if (e2.target === back) closeEventDialog(); };
  el("ev-cancel").onclick = closeEventDialog;
  el("ev-save").onclick = saveEventDialog;
  document.onkeydown = (e2) => {
    if (!state.evDialog) return;
    if (e2.key === "Escape") closeEventDialog();
    else trapTab(e2, "#ev-backdrop .modal");
  };

  /* the type decides which optional fields exist, and the repeat decides whether the
     week count does, so both re-render the form keeping everything already typed */
  ["ev-type", "ev-repeat"].forEach((id) => {
    const n = el(id);
    if (n) n.onchange = () => {
      dlg.draft = readEventForm();
      dlg.errorField = null; dlg.error = "";
      renderCalendar();
      const again = el(id);
      if (again) again.focus();
    };
  });

  document.querySelectorAll("[data-invite]").forEach((cb) =>
    cb.onchange = () => {
      const id = Number(cb.dataset.invite);
      if (cb.checked) state.evDeselected.delete(id); else state.evDeselected.add(id);
      renderCalendar();
      const again = document.querySelector('[data-invite="' + id + '"]');
      if (again) again.focus();
    });

  if (el("ev-share")) el("ev-share").onclick = () => {
    const text = document.querySelector("#ev-backdrop .sharetext").textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    toast("Copied. Paste it into the team's group chat.");
  };
}

function publishEvent(e, deselected) {
  e.published = true; e.draft = false;
  const t = TEAM_BY_ID.get(e.teamId);
  const off = deselected || new Set();
  /* everyone on the team — every child and every flagged coach — less anyone the admin
     took off before publishing */
  t.people.filter((p) => p.type === "child" && !off.has(p.id))
    .forEach((c) => e.status.set(c.id, "none"));
  t.people.filter((p) => p.type === "adult" && p.coachIn[t.id] && !off.has(p.id))
    .forEach((a) => e.status.set(a.id, "none"));
}

/* ---------------- the event picker, shared by Responses and Squads ----------------

   One picker component, used on both screens. It writes to `state.eventId`, which is
   the single event the admin side is looking at — the allocation, the calendar's open
   row and the response list all read it, so two independent selections would mean two
   allocations and two answers to "which event is this". Each screen still chooses its
   own opening event: Responses lands on the next one with answers outstanding, Squads
   on the next one still needing squads, and once an admin picks one by hand it stays
   picked whichever screen they move to.                                             */

const eventState = (e) => e.cancelled ? "cancelled" : e.draft ? "draft" : e.past ? "finished" : "";

function eventPicker(id, label) {
  const t = team(), e = ev();
  const opts = t.events.map((x) => {
    const st = eventState(x);
    return `<option value="${x.id}" ${x.id === state.eventId ? "selected" : ""}>${
      x.dayName.slice(0, 3)} ${x.shortDate} &middot; ${eventTitle(x)}${st ? " (" + st + ")" : ""}</option>`;
  }).join("");
  return `<div class="evpick">
      <label class="evpick-l" for="${id}">${label}</label>
      <select class="pick" id="${id}">${opts}</select>
      <div class="evpick-when">${e.longDate} &middot; ${e.time}&ndash;${e.endTime} &middot; ${esc(e.venue)}</div>
    </div>`;
}

function wireEventPicker(id) {
  const sel = el(id);
  if (!sel) return;
  sel.onchange = () => {
    state.eventPicked = true;    // chosen by hand, so no screen defaults over it again
    selectEvent(sel.value);
    renderAll();
  };
}

/* the next event still waiting on somebody */
function nextOutstandingEvent(t) {
  return t.events.find((e) => e.published && !e.cancelled && !e.past
      && [...e.status.values()].some((v) => v === "none"))
    || nextEventFor(t);
}

/* the next event that has squads to work out and hasn't had them published */
function nextUnsquaddedEvent(t) {
  return t.events.find((e) => e.published && !e.cancelled && !e.past
      && !isSocial(e) && !e.squadsPublished)
    || nextEventFor(t);
}

/* ---------------- members ---------------- */

let memberFilter = "all", memberSearch = "";

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
  rows.sort(bySurname);

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
      <div class="count">${t.name} &middot; ${teamChildren().length} children and ${teamAdults().length} adults,
        ${coachesNow().length} of them flagged as coaches</div>
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
      <thead><tr><th>Name</th><th>School</th>
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
    b.onclick = () => openEditDialog(Number(b.dataset.edit), '[data-edit="' + b.dataset.edit + '"]'));
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
  const d = state.editDraft || {};
  /* What was typed survives a validation failure. Re-rendering the form from the stored
     record throws away every other edit silently, and they may not notice until later. */
  const v = (k, fallback) => esc(d[k] !== undefined ? d[k] : fallback);
  const bad = (f) => state.editErrorField === f ? " has-error" : "";
  /* the message goes under the field it is about, and that field is marked */
  const errFor = (f) => state.editErrorField === f
    ? `<div class="err" id="err-${f}">${esc(state.editError)}</div>` : "";
  const aria = (f) => state.editErrorField === f
    ? ` aria-invalid="true" aria-describedby="err-${f}"` : "";
  const actions = `<div class="modal-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn primary" id="f-save">Save changes</button></div>`;

  if (p.type === "child") {
    const known = !!p.school && t.schools.includes(p.school);
    const current = d.school !== undefined ? d.school : (known ? p.school : "__other");
    const otherText = d.schoolOther !== undefined ? d.schoolOther
      : (known ? "" : (p.schoolPending || p.school || ""));
    const isOther = current === "__other";
    return `<div class="modal-backdrop" id="edit-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <h3 id="dlg-title">Edit ${esc(p.name)}</h3>
      <div class="msub">Child in ${t.name}</div>
      <div class="row2">
        <div class="field${bad("name")}"><label for="f-first">First name</label>
          <input id="f-first" value="${v("firstName", p.firstName)}"${aria("name")}></div>
        <div class="field${bad("name")}"><label for="f-last">Surname</label>
          <input id="f-last" value="${v("lastName", p.lastName)}"></div>
      </div>
      ${errFor("name")}
      <div class="field${bad("school")}"><label for="f-school">School</label>
        <select id="f-school"${aria("school")}>
          ${t.schools.map((sc) => `<option value="${esc(sc)}" ${sc === current ? "selected" : ""}>${esc(sc)}</option>`).join("")}
          <option value="__other" ${isOther ? "selected" : ""}>Other&hellip;</option>
        </select>
        <input id="f-school-other" placeholder="School name" value="${esc(otherText)}" ${isOther ? "" : "hidden"}>
        ${errFor("school")}
        <div class="hint">A school typed in here is not added to the club list. It is held against this child and
          queued for a Club Admin to map or add. Until they do, the child counts as a singleton for allocation.</div>
      </div>
      <div class="field"><label for="f-rating">Ability rating</label>
        <select id="f-rating">${[1, 2, 3, 4, 5].map((n) =>
          `<option value="${n}" ${n === (d.rating !== undefined ? Number(d.rating) : p.rating) ? "selected" : ""}>${
            n}${n === 1 ? " — strongest" : n === 5 ? " — needs most support" : ""}</option>`).join("")}</select>
        <div class="hint">1 is strongest and 5 is weakest. Admin only: never shown to any parent,
          and never given as the reason for a placement.</div>
      </div>
      ${actions}</div></div>`;
  }

  return `<div class="modal-backdrop" id="edit-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
    <h3 id="dlg-title">Edit ${esc(p.name)}</h3>
    <div class="msub">Adult${p.roleIn[t.id] ? " &middot; " + esc(ROLE_LABEL[p.roleIn[t.id]]) : ""} in ${t.name}</div>
    ${p.registered ? `<div class="alert notice" style="margin-bottom:14px">This member has signed up, so under the
      current spec they manage their own details and an admin cannot edit them. Editing is left open here so the
      prototype stays testable.</div>` : ""}
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
      <div class="hint">It is how they are notified and how a signup is matched to this record.</div></div>
    <div class="field"><label for="f-phone">Phone number</label>
      <input id="f-phone" value="${v("phone", p.phone || "")}">
      <div class="hint">Optional, and used for tap-to-call only. There is no SMS anywhere in the app.</div></div>
    ${actions}</div></div>`;
}

/* A dialog takes focus when it opens and hands it back to the control that opened it
   when it closes — the same rules the parent's dialogs already follow. */
function openEditDialog(id, triggerSelector) {
  state.editingId = id;
  state.editScope = "admin";
  state.editError = "";
  state.editErrorField = null;
  state.editDraft = null;
  state.editReturnTo = triggerSelector;
  renderMembers();
  const first = document.querySelector("#edit-backdrop input, #edit-backdrop select");
  if (first) first.focus();
}

function closeEditDialog() {
  const back = state.editReturnTo;
  state.editingId = null;
  state.editError = "";
  state.editErrorField = null;
  state.editDraft = null;
  state.editReturnTo = null;
  renderMembers();
  const trigger = back && document.querySelector(back);
  if (trigger) trigger.focus();
}

function wireEditModal() {
  const back = el("edit-backdrop");
  if (!back || state.editScope !== "admin") return;
  back.onclick = (e) => { if (e.target === back) closeEditDialog(); };
  el("f-cancel").onclick = closeEditDialog;
  document.onkeydown = (e) => {
    if (!state.editingId) return;
    if (e.key === "Escape") closeEditDialog();
    else trapTab(e);                       // Tab stays inside while it is open
  };

  const schoolSel = el("f-school");
  if (schoolSel) schoolSel.onchange = () => {
    const other = el("f-school-other");
    other.hidden = schoolSel.value !== "__other";
    if (!other.hidden) other.focus();
  };

  el("f-save").onclick = () => {
    const p = BY_ID.get(state.editingId);
    const first = el("f-first").value, last = el("f-last").value;

    /* everything typed is kept before anything is validated, so a failure never costs
       the person the other fields — and nothing is written until it all passes */
    const draft = { firstName: first, lastName: last };
    if (p.type === "child") {
      draft.school = el("f-school").value;
      draft.schoolOther = el("f-school-other").value;
      draft.rating = el("f-rating").value;
    } else {
      draft.email = el("f-email").value;
      draft.phone = el("f-phone").value;
    }
    state.editDraft = draft;

    const failWith = (field, message) => {
      state.editErrorField = field;
      state.editError = message;
      renderMembers();
      const node = el(field === "name" ? "f-first" : "f-" + field);
      if (node) node.focus();
    };

    if (!first.trim() || !last.trim()) return failWith("name", "A first name and a surname are both needed.");

    const school = p.type === "child"
      ? (draft.school === "__other" ? draft.schoolOther.trim() : draft.school) : null;
    if (p.type === "child" && !school) {
      return failWith("school", "Type the school's name, or pick one from the list.");
    }
    if (p.type !== "child" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())) {
      return failWith("email", "That email address doesn't look right. Every adult needs one.");
    }

    let reason = null;
    p.firstName = first.trim(); p.lastName = last.trim(); p.name = p.firstName + " " + p.lastName;

    if (p.type === "child") {
      const rating = Number(draft.rating);
      const schoolChanged = school !== (p.school || p.schoolPending), ratingChanged = rating !== p.rating;
      setSchool(p, school, draft.school === "__other");
      p.rating = rating;
      if (ratingChanged || schoolChanged) {
        reason = p.name + "'s " + (ratingChanged && schoolChanged ? "rating and school were"
          : ratingChanged ? "rating was" : "school was") + " changed by an admin";
      }
    } else {
      p.email = draft.email.trim();
      p.phone = draft.phone.trim();
    }

    /* a save that closes a dialog and says nothing leaves the person wondering */
    const returnTo = state.editReturnTo;
    state.editingId = null; state.editError = ""; state.editErrorField = null;
    state.editDraft = null; state.editReturnTo = null;
    toast(p.name + "'s details saved.");
    if (reason) rerun(true, reason);
    renderAll();
    const trigger = returnTo && document.querySelector(returnTo);
    if (trigger) trigger.focus();
  };
}

/* ---------------- responses ----------------

   The admin's answer to "who has said what, and who still needs chasing". It used to
   live inside an expanded calendar row, which meant 105 rows of it under one event on
   an Under 9 night; the calendar is the schedule now and this is its own screen.     */

let respAudience = "all", respStatus = "all", respSearch = "";

const RESP_AUDIENCE = [["all", "All"], ["children", "Children"], ["coaches", "Coaches"]];
const RESP_STATUS = [["all", "All"], ["accepted", "Accepted"], ["declined", "Declined"], ["none", "No response"]];

/* Three statuses, the current one shown as selected, and nothing written until one is
   picked — the same rule as the parent's chooser at item 79. Picking the one already
   selected closes it and writes nothing, which is how an admin backs out. A native
   select changed the value on the way past it with an arrow key. */
function statusChooser(p, st) {
  return `<div class="st-choose" role="group" aria-label="Set the status for ${esc(p.name)}">
      ${["accepted", "declined", "none"].map((k) =>
        `<button class="btn choice ${st === k ? "is-selected" : ""}" aria-pressed="${st === k}"
           data-set="${k}" data-person="${p.id}">${STATUS_LABEL[k]}</button>`).join("")}
    </div>`;
}

function setStatusByAdmin(personId, value) {
  const e = ev(), who = BY_ID.get(personId);
  state.respEditing = null;

  /* the status it already has: close the chooser, write nothing, and leave the
     answered-on date saying when the answer was actually given */
  if ((e.status.get(personId) || "none") === value) return renderAll();

  e.status.set(personId, value);
  if (value === "none") { e.answeredBy.delete(personId); e.answeredAt.delete(personId); }
  else { e.answeredBy.set(personId, "admin"); e.answeredAt.set(personId, NOW); }

  toast(value === "none"
    ? who.name + "'s answer was cleared."
    : who.name + " is down as " + STATUS_LABEL[value].toLowerCase()
      + ". They will see it was set by an admin.");
  rerun(true, who.name + " was set to " + STATUS_LABEL[value].toLowerCase() + " by an admin");
  renderAll();
}

function renderResponses() {
  const e = ev(), t = team();
  const head = `<div class="page-head">
      <div class="count">${t.name} &middot; who has answered, and who still needs asking</div>
    </div>
    ${eventPicker("resp-event", "Event")}`;

  if (!e.published) {
    el("view-responses").innerHTML = head + `<div class="alert notice"><b>Nobody has been invited yet.</b>
      This event is still a draft, so there are no answers to show. Publishing it on the calendar is what
      sends the invitations.</div>`;
    wireEventPicker("resp-event");
    return;
  }
  if (e.cancelled) {
    el("view-responses").innerHTML = head + `<div class="alert stop"><b>This event was cancelled.</b>
      ${esc(e.cancelled)} Everyone invited was notified, and no more answers are being collected.</div>`;
    wireEventPicker("resp-event");
    return;
  }

  const kids = teamChildren(), coaches = coachesNow();
  const rank = { accepted: 0, declined: 1, none: 2 };

  let people = respAudience === "children" ? kids.slice()
    : respAudience === "coaches" ? coaches.slice()
    : kids.concat(coaches);

  /* the counts belong to the audience being looked at, so they are taken before the
     status filter and after the audience one */
  const counts = { accepted: 0, declined: 0, none: 0 };
  people.forEach((p) => { counts[e.status.get(p.id) || "none"]++; });

  /* Children and coaches answer separately and the two numbers mean different things:
     one says how many are coming, the other whether there is anybody to run the night.
     One combined total hid the second, and the coaches had no breakdown at all. */
  const tally = (list) => {
    const c = { accepted: 0, declined: 0, none: 0 };
    list.forEach((p) => { c[e.status.get(p.id) || "none"]++; });
    return c;
  };
  const kidTally = tally(kids), coachTally = tally(coaches);

  /* Item 43: with coach-with-own-child on, an accepted coach whose own child is not
     attending cannot be placed, so the number who accepted and the number who can
     actually coach are two different numbers. Both are shown, as Squads already does.
     Not on a social: nothing is allocated there, so nobody stands down from anything. */
  const anchored = state.settings.coachWithOwnChild !== false;
  const accKids = new Set(kids.filter((k) => e.status.get(k.id) === "accepted").map((k) => k.id));
  const canCoach = !anchored ? coachTally.accepted
    : coaches.filter((c) => e.status.get(c.id) === "accepted"
        && c.childIds.some((id) => accKids.has(id))).length;

  const tallyRow = (label, c, extra) => `
    <div class="tally">
      <div class="tk">${label}</div>
      <div class="tv"><b class="t-ok">${c.accepted}</b> accepted <span class="tsep">&middot;</span>
        <b class="t-no">${c.declined}</b> declined <span class="tsep">&middot;</span>
        <b>${c.none}</b> no response</div>
      ${extra ? `<div class="tx">${extra}</div>` : ""}
    </div>`;

  const tallies = `<div class="tallies">
      ${tallyRow("Children", kidTally)}
      ${tallyRow("Coaches", coachTally, (isSocial(e) || !coachTally.accepted) ? ""
        : canCoach === coachTally.accepted
          ? "All " + canCoach + " can coach on the night."
          : "<b>" + canCoach + "</b> of them can coach on the night. "
            + plural(coachTally.accepted - canCoach, "coach stands", "coaches stand")
            + " down, because their own children aren't attending.")}
    </div>`;

  if (respStatus !== "all") people = people.filter((p) => (e.status.get(p.id) || "none") === respStatus);
  if (respSearch) {
    const q = respSearch.toLowerCase();
    people = people.filter((p) => p.name.toLowerCase().includes(q)
      || (p.type === "child" ? parentsOf(p) : p.childIds.map((id) => BY_ID.get(id)).filter(Boolean))
           .some((r) => r.name.toLowerCase().includes(q)));
  }

  const rows = people
    .sort((a, b) => rank[e.status.get(a.id) || "none"] - rank[e.status.get(b.id) || "none"]
      || bySurname(a, b))
    .map((p) => {
      const st = e.status.get(p.id) || "none";
      const sub = p.type === "child"
        ? "Child &middot; " + esc(parentsOf(p).map((a) => a.name).join(", "))
        : "Coach &middot; parent of " + esc(p.childIds.map((id) => BY_ID.get(id)).filter(Boolean).map((c) => c.name).join(", "));
      /* An override is marked on the status itself rather than in a column of its own:
         it is a fact about this answer, and the person sees the same thing. */
      const byAdmin = st !== "none" && e.answeredBy.get(p.id) === "admin";
      const choosing = state.respEditing === String(p.id);
      return `<tr>
        <td class="respname"><div class="name">${esc(p.name)}</div><div class="sub">${sub}</div></td>
        <td class="respstatus">${statusTag(st, false)}${byAdmin ? '<div class="by-admin">Set by an admin</div>' : ""}</td>
        <td class="pickcell">${choosing
          ? statusChooser(p, st)
          : `<button class="btn tiny" data-pick="${p.id}" aria-expanded="false"
               aria-label="Change the status for ${esc(p.name)}">Change&hellip;</button>`}</td></tr>`;
    }).join("");

  el("view-responses").innerHTML = head + tallies + `
    <div class="toolbar chiprow" role="group" aria-label="Who to show">
      ${RESP_AUDIENCE.map(([k, l]) => `<button class="chip" data-audience="${k}"
        aria-pressed="${respAudience === k}">${l}</button>`).join("")}
    </div>
    <div class="toolbar chiprow" role="group" aria-label="Filter by status">
      ${RESP_STATUS.map(([k, l]) => `<button class="chip" data-status="${k}"
        aria-pressed="${respStatus === k}">${l}${k === "all" ? "" : " (" + counts[k] + ")"}</button>`).join("")}
      <div class="spacer"></div>
      <input class="search" id="resp-search" placeholder="Search a name" value="${esc(respSearch)}">
    </div>
    <div class="card"><table class="resp-table">
      <thead><tr><th>Name</th><th>Status</th><th class="pickcell">Change</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="3" class="sub" style="padding:20px">Nobody matches that.</td></tr>`}</tbody>
    </table></div>
    <div class="notice">An admin can set anyone's status. It is visible to that person, shown as set by an
      admin, and feeds the allocation exactly like a real answer. A chaser can be sent to anyone who
      hasn't answered, as often as needed.</div>`;

  wireEventPicker("resp-event");

  el("view-responses").querySelectorAll("[data-audience]").forEach((b) =>
    b.onclick = () => { respAudience = b.dataset.audience; state.respEditing = null; renderResponses(); });
  el("view-responses").querySelectorAll("[data-status]").forEach((b) =>
    b.onclick = () => { respStatus = b.dataset.status; state.respEditing = null; renderResponses(); });

  /* opens the choice and writes nothing */
  el("view-responses").querySelectorAll("[data-pick]").forEach((b) =>
    b.onclick = () => {
      state.respEditing = b.dataset.pick;
      renderResponses();
      const first = el("view-responses").querySelector(".st-choose .is-selected, .st-choose button");
      if (first) first.focus();
    });
  el("view-responses").querySelectorAll("[data-set]").forEach((b) =>
    b.onclick = () => setStatusByAdmin(Number(b.dataset.person), b.dataset.set));

  const rs = el("resp-search");
  if (rs) rs.oninput = () => {
    respSearch = rs.value;
    const at = rs.selectionStart;
    renderResponses();
    const ns = el("resp-search"); if (ns) { ns.focus(); ns.setSelectionRange(at, at); }
  };
}

/* ---------------- squads ---------------- */

function renderGroups() {
  const e = ev(), t = team();
  // nothing to publish where nothing is allocated, so the button does not offer it
  /* The same picker the Responses screen carries, so squads for an event can be reached
     without going through the calendar to select it first. */
  const head = `<div class="page-head">
      <div class="count">${t.name} &middot; who is with whom on the night</div>
      <div class="spacer"></div>
      ${isSocial(e) ? "" : `<button class="btn primary" id="publish-squads">${
        e.squadsPublished ? "Re-publish squads" : "Publish squads"}</button>`}</div>
    ${eventPicker("squad-event", "Event")}`;

  if (!e.published) {
    el("view-groups").innerHTML = head + `<div class="alert notice"><b>This event is a draft.</b>
      Nobody has been invited, so there are no responses to allocate. Publish it on the calendar first.</div>`;
    wireEventPicker("squad-event");
    return;
  }
  if (e.cancelled) {
    el("view-groups").innerHTML = head + `<div class="alert stop"><b>This event was cancelled.</b>
      ${esc(e.cancelled)}</div>`;
    wireEventPicker("squad-event");
    return;
  }
  if (isSocial(e)) {
    el("view-groups").innerHTML = head + `<div class="alert"><b>Social events aren't allocated.</b>
      Everyone who said yes is coming to the same thing, so there are no squads to divide
      them into. Answers are still collected, and you can see them on the Responses tab.</div>`;
    wireEventPicker("squad-event");
    return;
  }

  const r = state.result, s = state.settings;
  const sizes = r.groups.map((g) => g.children.length);
  const noSchool = acceptedChildren().filter((c) => !c.school).length;
  const nChildren = acceptedChildren().length, nCoaches = acceptedCoaches().length;

  /* All seven settings from allocation-rules.md, at its defaults. Two were missing: the
     maximum squad size, which is the only thing stopping everybody landing in one squad,
     and coach with their own child, which hard rule 4 is written conditionally on —
     leaving it out presented a team setting as a fixed rule. */
  /* Set once a season, then passed nine times a week. A one-line summary by default,
     the whole set behind it — the same reasoning as the rules panel below. */
  const setSummary = [
    state.mode === "ability" ? "Balanced ability" : "School affinity",
    state.groupCount ? state.groupCount + " squads by hand" : "Squad count auto",
    "sizes " + s.minGroupSize + "\u2013" + s.maxGroupSize + ", target " + s.targetGroupSize,
    "1:" + s.ratio + " ratio",
    plural(s.minCoachesPerGroup, "coach", "coaches") + " minimum",
    "max " + s.maxGroups + " squads",
    "coach with own child " + (s.coachWithOwnChild ? "on" : "off")
  ].join(" \u00b7 ");

  const controls = `
    <details class="card settings-fold" ${state.squadSettingsOpen ? "open" : ""} id="set-fold">
      <summary><span class="sf-k">Settings</span><span class="sf-v">${esc(setSummary)}</span></summary>
      <div class="set-grid">
        <label>Mode<select id="set-mode">
          <option value="ability" ${state.mode === "ability" ? "selected" : ""}>Balanced ability</option>
          <option value="school" ${state.mode === "school" ? "selected" : ""}>School affinity</option></select></label>
        <label>Squads<select id="set-count">
          <option value="0" ${state.groupCount === 0 ? "selected" : ""}>Auto</option>
          ${Array.from({ length: Math.max(s.maxGroups, 1) }, (_, i) => i + 1).map((n) =>
            `<option value="${n}" ${state.groupCount === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Maximum size <input type="number" id="set-maxsize" min="1" max="60" value="${s.maxGroupSize}"></label>
        <label>Target size <input type="number" id="set-target" min="1" max="60" value="${s.targetGroupSize}"></label>
        <label>Minimum size <input type="number" id="set-min" min="1" max="60" value="${s.minGroupSize}"></label>
        <label>Coach ratio 1: <input type="number" id="set-ratio" min="1" max="40" value="${s.ratio}"></label>
        <label>Min coaches <input type="number" id="set-mincoach" min="0" max="6" value="${s.minCoachesPerGroup}"></label>
        <label>Max squads <input type="number" id="set-max" min="1" max="20" value="${s.maxGroups}"></label>
        <label><span>Coach with their own child</span>
          <span class="segset" role="group" aria-label="Coach with their own child">
            <button type="button" class="segbtn ${s.coachWithOwnChild ? "is-on" : ""}"
              aria-pressed="${!!s.coachWithOwnChild}" data-cwoc="on">On</button>
            <button type="button" class="segbtn ${s.coachWithOwnChild ? "" : "is-on"}"
              aria-pressed="${!s.coachWithOwnChild}" data-cwoc="off">Off</button>
          </span>
          <span class="set-hint">${s.coachWithOwnChild
            ? "A coach only ever goes in their own child's squad, and stands down on a night that child misses."
            : "Coaches are spread wherever they are needed, and nobody stands down."}</span></label>
      </div>
    </details>`;

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

  /* Both numbers, per item 43: what was accepted, and what is actually available. */
  const stand = r.standDown && r.standDown.length ? `<div class="alert notice">
      <b>${r.coachesAccepted} coaches accepted, ${r.coachesUsed} can coach.</b>
      ${plural(r.standDown.length, "coach", "coaches")} stood down because their own children aren't
      attending: ${esc(r.standDown.map((c) => c.name).join(", "))}. Every rule below is worked out from
      the ${r.coachesUsed} who can coach.</div>` : "";

  const notes = (r.notes || []).map((n) => `<div class="alert notice">${esc(n)}</div>`).join("");

  const noSchoolNote = state.mode === "school" && noSchool ? `<div class="alert notice">
      ${plural(noSchool, "child", "children")} attending ${noSchool === 1 ? "has" : "have"} no school
      recorded, so school affinity treats them as singletons.
      <button class="link" id="show-noschool">show them in the member list</button></div>` : "";

  const cands = r.candidates.map((c) => `
    <tr class="${c.groups === r.chosen.groups ? "chosen" : ""}">
      <td>${plural(c.groups, "squad", "squads")}</td>
      <td class="${c.feasible ? "yes" : "no"}">${c.feasible
        ? "averages " + c.avg.toFixed(1) + " children"
          + (c.groups === r.chosen.groups && !r.forced ? " &larr; closest to the target of " + s.targetGroupSize : "")
        : c.reason}${c.groups === r.chosen.groups && r.forced ? " &larr; set by hand" : ""}</td></tr>`).join("");

  /* Quiet when everything passes, loud when something fails. Six rows of ticks took a
     third of the screen to say "fine", and the failures are what an admin is here for.
     The minimum squad size is an aim that gives way, not a hard rule, so it is shown
     apart from them rather than with a tick in the same list. */
  const hard = r.checks.filter((c) => c.kind === "hard");
  const aims = r.checks.filter((c) => c.kind !== "hard");
  const broken = hard.filter((c) => !c.ok);
  const missed = aims.filter((c) => !c.ok);

  const checkRow = (c, cls) => `
    <div class="check ${cls}">
      <span class="mark" aria-hidden="true">${c.ok ? "&check;" : (cls === "fail" ? "&times;" : "!")}</span>
      <span class="ct"><b>${c.rule}</b> &mdash; <span class="d">${c.detail}</span>
        ${!c.ok && c.fix ? `<span class="cfix">${c.fix}</span>` : ""}</span></div>`;

  const allRows = `<div class="check-list">
      <div class="check-head">Hard rules &mdash; never broken by the allocation</div>
      ${hard.map((c) => checkRow(c, c.ok ? "" : "fail")).join("")}
      <div class="check-head">Aims &mdash; these give way to the hard rules</div>
      ${aims.map((c) => checkRow(c, c.ok ? "" : "warn")).join("")}
    </div>`;

  /* One band between the page header and Squad 1. The summary, the advisories, the
     rules and the drag notice were six separate blocks an admin scrolled past every
     time; folded together they are one line when the night is fine and open when it
     is not. The failures stay at the top, not the bottom: a broken rule is the reason
     the squads are wrong, and one below the fold is one an admin publishes over. */
  const summaryLine = `<b>${plural(nChildren, "child", "children")}</b> and
      <b>${plural(nCoaches, "coach", "coaches")}</b> accepted${
        r.coachesUsed !== nCoaches ? ", <b>" + r.coachesUsed + "</b> able to coach" : ""},
      split into <b>${plural(r.groups.length, "squad", "squads")}</b>${sizes.length
        ? " of " + Math.min(...sizes) + "&ndash;" + Math.max(...sizes) : ""}.`;

  const advisories = stand + notes + noSchoolNote;
  const advisoryCount = (stand ? 1 : 0) + (r.notes || []).length + (noSchoolNote ? 1 : 0);

  const dragNote = `<div class="bandnote">Drag a child or a coach onto another squad, or use the
      <b>Move&hellip;</b> box that appears beside a name on hover or focus. A manual move is pinned and
      survives a re-run, and moving one of a coach and child pair moves the other with it.</div>`;

  const bandDetail = `
    ${advisories}
    <details class="why"><summary>Why ${r.groups.length} squads?</summary>
      <table class="cand">${cands}</table></details>
    ${allRows}
    ${dragNote}
    ${ratingLegend("margin:12px 0 2px")}`;

  const band = (broken.length || missed.length)
    ? `<div class="sqband loud">
        <div class="bandlead">${summaryLine}</div>
        ${fail}
        ${broken.map((c) => checkRow(c, "fail")).join("")}
        ${missed.map((c) => checkRow(c, "warn")).join("")}
        <details class="bandmore"><summary>All ${r.checks.length} rules, the advisories and the count</summary>
          ${bandDetail}</details>
      </div>`
    : `<details class="sqband quiet">
        <summary><span class="mark" aria-hidden="true">&check;</span>
          <span class="bandlead">${summaryLine}</span>
          <span class="d">Every rule met.${advisoryCount
            ? " " + plural(advisoryCount, "note", "notes") + "." : ""}</span></summary>
        ${bandDetail}
      </details>`;

  /* The Move control is reachable by keyboard alone, per item 54 — it is in the document
     for every row, and CSS reveals it on hover or when it takes focus. Dragging stays the
     quick way; it is never the only way. */
  const moveBox = (id, kind, fromId, who) => `<select class="moveto" data-move="${id}" data-movekind="${kind}"
      aria-label="Move ${esc(who)} to another squad">
      <option value="">Move&hellip;</option>
      ${r.groups.filter((x) => x.id !== fromId).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}
    </select>`;

  const cards = r.groups.map((g) => {
    /* the per-school count chips came off: the rules panel already answers whether
       affinity held, and answers it by name */
    const counts = [1, 2, 3, 4, 5].map((x) => g.children.filter((c) => c.rating === x).length);
    const spread = counts.map((n, i) => n
      ? `<span class="sp sp${i + 1}" style="flex:${n}" title="${n} rated ${i + 1}"></span>` : "").join("");
    const spreadLabel = `<div class="spread-label">Ability spread &middot; ${counts
      .map((n, i) => n ? n + "&times;" + (i + 1) : null).filter(Boolean).join(", ")}</div>`;
    const coaches = g.coaches.slice().sort(byFirstName).map((c) => {
      const kids = c.childIds.map((id) => BY_ID.get(id)).filter((k) => k && g.children.some((x) => x.id === k.id));
      return `<div class="person coach" draggable="true" data-person="${c.id}" data-kind="coach">
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="Pinned by a manual move">&#9679;</span>' : ""}</span>
        <span class="sub">${kids.length ? "with " + kids.map((k) => esc(k.firstName)).join(" &amp; ") : ""}</span>
        ${moveBox(c.id, "coach", g.id, c.name)}</div>`;
    }).join("") || '<div class="sub" style="padding:3px 0">No coach</div>';
    const kids = g.children.slice().sort(byFirstName).map((c) => `
      <div class="person" draggable="true" data-person="${c.id}" data-kind="child">
        <span class="nm">${esc(c.name)}${state.pins.has(c.id) ? ' <span class="pin" title="Pinned by a manual move">&#9679;</span>' : ""}</span>
        ${state.mode === "school" ? `<span class="mini ${c.school ? "" : "none"}">${esc(schoolOf(c))}</span>` : ""}
        ${ratingChip(c.rating)}
        ${moveBox(c.id, "child", g.id, c.name)}</div>`).join("");
    const bad = g.coaches.length < s.minCoachesPerGroup
      || g.children.length > (g.coaches.length || 0) * s.ratio
      || g.children.length > s.maxGroupSize;

    return `<div class="group ${bad ? "bad" : ""}" data-group="${g.id}">
      <header><h3>${g.name}</h3>
        <span class="n">${plural(g.children.length, "child", "children")} &middot; ${plural(g.coaches.length, "coach", "coaches")}</span></header>
      <div class="spread">${spread}</div>
      ${spreadLabel}
      <div class="section">
        <div class="sqpart"><h4>Coaches (${g.coaches.length})</h4>${coaches}</div>
        <div class="sqpart"><h4>Players (${g.children.length})</h4>${kids}</div>
      </div></div>`;
  }).join("");

  el("view-groups").innerHTML = head + controls + updated + move + band + `
    <div class="groups-head">
      <h3>${plural(r.groups.length, "squad", "squads")}</h3>
      <div class="spacer"></div>
      <button class="btn" id="btn-rerun">Re-run the allocation</button>
      <button class="btn" id="btn-undo" ${state.pins.size ? "" : "disabled"}>Clear manual moves${
        state.pins.size ? " (" + state.pins.size + ")" : ""}</button>
    </div>
    <div class="groups" id="groups-grid">${cards}</div>`;

  wireEventPicker("squad-event");
  const fold = el("set-fold");
  if (fold) fold.ontoggle = () => { state.squadSettingsOpen = fold.open; };
  wireSettings(); wireDragDrop();
  if (el("publish-squads")) el("publish-squads").onclick = () => {
    publishSquads(e, state.result);
    state.rerunNotice = { reason: "Squads published", detail: "parents can now see their child's squad and coaches" };
    renderAll();
  };
}

function wireSettings() {
  const SETTING_LABEL = {
    maxGroupSize: "Maximum squad size", targetGroupSize: "Target squad size",
    minGroupSize: "Minimum squad size", ratio: "Coach ratio",
    minCoachesPerGroup: "Minimum coaches per squad", maxGroups: "Maximum squads"
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
  num("set-maxsize", "maxGroupSize", 1, 60);
  num("set-target", "targetGroupSize", 1, 60); num("set-min", "minGroupSize", 1, 60);
  num("set-ratio", "ratio", 1, 40); num("set-mincoach", "minCoachesPerGroup", 0, 6);
  num("set-max", "maxGroups", 1, 20);

  /* A team setting, not a fixed rule: hard rule 4 and the whole stand-down arithmetic
     only exist while it is on. See item 46. Writes nothing when the state it is given
     is the state it already has. */
  document.querySelectorAll("[data-cwoc]").forEach((b) =>
    b.onclick = () => {
      const on = b.dataset.cwoc === "on";
      if (!!state.settings.coachWithOwnChild === on) return;
      state.settings.coachWithOwnChild = on;
      rerun(true, "Coach with their own child turned " + (on ? "on" : "off"));
      renderAll();
    });
  if (el("set-mode")) el("set-mode").onchange = (e) => {
    state.mode = e.target.value;
    rerun(true, "Mode changed to " + (state.mode === "ability" ? "balanced ability" : "school affinity"));
    renderAll();
  };
  if (el("set-count")) el("set-count").onchange = (e) => {
    state.groupCount = Number(e.target.value);
    rerun(true, state.groupCount ? "Squad count set to " + state.groupCount + " by hand"
      : "Squad count put back to automatic");
    renderAll();
  };
  /* Two different actions. Re-run keeps the pins and reallocates everyone else around
     them; clearing the pins throws the manual moves away and starts clean. Re-run is
     always enabled: where it moves nobody it says so, and "nothing moved" is the useful
     answer — a disabled button or an error for a predictable outcome is worse. */
  if (el("btn-rerun")) el("btn-rerun").onclick = () => {
    rerun(true, "Re-run by an admin"); renderAll();
  };
  if (el("btn-undo")) el("btn-undo").onclick = () => {
    state.lastMove = null; rerun(false, "Manual moves cleared"); renderAll();
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

  /* Tapping the answer that is already there is a way of closing the chooser, not a new
     answer. Writing it again would move "answered by / when" to now, and that line has
     to keep saying when the answer was actually given. */
  if ((e.status.get(personId) || "none") === value) {
    state.familyEditing = null;
    renderAll();
    return;
  }

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

/* "base" sensitivity puts Áine with the As rather than after Z. With Irish given names
   all through the club a plain code-point sort puts every fada-carrying name after Z,
   so every list in the app sorts through this collator — the admin lists included. */
const NAME_ORDER = new Intl.Collator("en", { sensitivity: "base" });
const byFirstName = (a, b) =>
  NAME_ORDER.compare(a.firstName, b.firstName) || NAME_ORDER.compare(a.lastName, b.lastName);
const bySurname = (a, b) =>
  NAME_ORDER.compare(a.lastName, b.lastName) || NAME_ORDER.compare(a.firstName, b.firstName);

const STATUS_MARK = { accepted: "&check;", declined: "&minus;", none: "&#9675;" };
/* `owed` is what makes the unanswered status amber, and amber means owed *by the
   reader*. A parent looking at their own row owes that answer; an admin reading a list
   does not, so the admin's copy is neutral with weight. Item 85 says exactly this, and
   a rule that admits exceptions is not a rule. */
const statusTag = (st, owed = true) =>
  `<span class="st st-${st}${owed ? "" : " st-plain"}"><span class="st-mark" aria-hidden="true">${
    STATUS_MARK[st]}</span>${STATUS_LABEL[st]}</span>`;

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
  // nothing is ever allocated for a social, so it must never be shown waiting on squads
  if (isSocial(e)) return "";
  const sq = squadForChild(e, person.id);
  if (!sq) {
    /* Three different situations, and telling them apart matters: a parent told to
       wait for a squad that already went out without their child in it can turn up
       at a pitch expecting a team. */
    if (e.squadsPublished) {
      /* The fact, then the thing to do about it, then why it happened. Leaving the
         instruction until last buried the only part a parent can act on. */
      return `<div class="pending is-missing"><b>${esc(person.firstName)} isn't in a squad for this session.</b>
        Tell a coach ${esc(person.firstName)} is coming and they'll be put into one on the night.
        Squads went out${e.squadsPublishedAt ? " on " + fmtDay(e.squadsPublishedAt) : ""}, before this
        answer came in.</div>`;
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

/* What a parent needs to get there: where it is, the eircode to type into a phone, a
   link that opens it in maps, and whatever is awkward about parking. All of it belongs
   to the venue, so every event at that venue shows the same lines. */
function venueBlock(e, forAdmin) {
  const v = venueFor(e.venue);
  if (!v) return "";
  const map = mapLinkFor(e.venue, v);
  /* For a parent an eircode is either recorded or it is not, and where it is not there
     is no line for it — item 86. An admin gets the gap named instead, because whether a
     venue's details are complete is an admin's problem and the admin's view is where it
     belongs. It is a fact, not a pending state: nothing about it is parent-facing. */
  return `<div class="venue-detail">
      <div class="vd-line">
        ${v.eircode
          ? `<span class="vd-k">Eircode</span><span class="vd-v">${esc(v.eircode)}</span>`
          : forAdmin ? `<span class="vd-k">Eircode</span><span class="vd-v vd-missing">not recorded</span>` : ""}
        ${map ? `<a class="vd-map" href="${esc(map)}" target="_blank" rel="noopener noreferrer"
          >Open in maps<span class="vh"> (opens in a new tab)</span></a>` : ""}
      </div>
      ${v.note ? `<div class="vd-note">${esc(v.note)}</div>` : ""}
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
          data-no="${person.id}" data-ev="${e.id}">Can't make it</button></span>`;
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
  /* the two personal tabs are only shown to a parent of a child in this age group, so
     there is nothing to draw into them otherwise */
  if (!isParentHere(me)) {
    el("view-mycalendar").innerHTML = "";
    el("view-myfamily").innerHTML = "";
    return;
  }
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
  /* One card starts open — the next event, because that is the one being asked about.
     After that the parent decides; opening a second does not shut the first. */
  const visible = new Set(filtered.map((x) => x.event.id));
  [...state.familyOpen].forEach((id) => { if (!visible.has(id)) state.familyOpen.delete(id); });
  if (!state.familyOpen.size && !state.familyTouchedRows) {
    const next = answerable[0] || rest[0] || earlier[earlier.length - 1];
    if (next) state.familyOpen.add(next.event.id);
  }

  const renderRow = (entry) => {
    const e = entry.event, t = entry.team;
    const open = state.familyOpen.has(e.id);
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
          : `<div class="fev-facts"><span>${esc(e.venue)}${e.away ? " &middot; away" : ""} &middot; ${range}</span></div>
             ${venueBlock(e)}${blocks}`}
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

  const banner = outstanding
    ? `<button class="alert owed alert-action" id="goto-owed">
        <span class="alert-words">${outstanding === 1
          ? `<b>1 answer still to give, for ${esc(owedWho)}, ${owedWhen}.</b>`
          : `<b>${outstanding} answers still to give.</b> The first is ${esc(owedWho)}, ${owedWhen}.`}</span>
        <span class="alert-go">Take me there &#8594;</span></button>`
    : "";

  /* Two top-level tabs now, so there is no strip inside the page and no page title:
     the tab in the app bar is the heading, and repeating it here would say it twice. */
  el("view-mycalendar").innerHTML = `${banner}${chipRow}${body}`;

  el("view-myfamily").innerHTML = `
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
          ${current === "__none" ? '<option value="__none" selected disabled>Choose a school</option>' : ""}
          ${t.schools.map((sc) => `<option value="${esc(sc)}" ${sc === current ? "selected" : ""}>${esc(sc)}</option>`).join("")}
          <option value="__other" ${isOther ? "selected" : ""}>Other&hellip;</option>
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
      <div class="hint">Where invitations and reminders are sent.</div></div>
    <div class="field"><label for="f-phone">Phone number</label>
      <input id="f-phone" value="${v("phone", p.phone || "")}">
      <div class="hint">Optional. A team admin can see it, and if you coach, so can the
        other coaches on your squad.</div></div>
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

function trapTab(e, selector) {
  if (e.key !== "Tab") return;
  const modal = document.querySelector(selector || "#edit-backdrop .modal");
  if (!modal) return;
  const items = [...modal.querySelectorAll('a[href], button, select, input, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((n) => !n.disabled && !n.hidden && n.getBoundingClientRect().width);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function wireFamily(firstOwed) {
  /* the two panels are separate tabs now, so anything wired here has to be looked for
     across both of them */
  const panels = [el("view-mycalendar"), el("view-myfamily")];
  const root = {
    querySelectorAll: (sel) => panels.flatMap((n) => [...n.querySelectorAll(sel)])
  };

  const toggle = el("earlier-toggle");
  if (toggle) toggle.onclick = () => { state.familyShowEarlier = !state.familyShowEarlier; renderFamily(); };

  root.querySelectorAll("[data-childchip]").forEach((b) =>
    b.onclick = () => {
      state.familyChild = b.dataset.childchip;
      renderFamily();
    });

  const goto = el("goto-owed");
  if (goto && firstOwed) goto.onclick = () => {
    // the thing it counted may be hidden by the current filter, so clear it on the way
    showView("mycalendar");
    state.familyChild = "all";
    state.familyOpen.add(firstOwed.entry.event.id);
    state.familyTouchedRows = true;
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

  /* A row used to close whichever other row was open. If that one was above, the page
     above the tapped row shrank and the row walked out from under the thumb — and at the
     top of the list there is no scroll left to give back, so no amount of scroll
     correction could put it right. So a row now opens and closes on its own: tapping one
     only ever changes that row's own height, downward, and nothing above it moves.

     The scroll correction stays for everything else that can shift a row — the document
     getting shorter underneath it, and the browser clamping scroll at the end. */
  root.querySelectorAll("[data-fev]").forEach((b) =>
    b.onclick = () => {
      const id = b.dataset.fev;
      const before = el("fev-" + id).getBoundingClientRect().top;
      if (state.familyOpen.has(id)) state.familyOpen.delete(id);
      else state.familyOpen.add(id);
      state.familyTouchedRows = true;
      renderFamily();
      const after = el("fev-" + id);
      if (after) window.scrollBy(0, after.getBoundingClientRect().top - before);
    });
  root.querySelectorAll("[data-yes]").forEach((b) =>
    b.onclick = () => familyAnswer(evById(b.dataset.ev), Number(b.dataset.yes), "accepted"));
  root.querySelectorAll("[data-no]").forEach((b) =>
    b.onclick = () => familyAnswer(evById(b.dataset.ev), Number(b.dataset.no), "declined"));
  // opens the choice and writes nothing
  root.querySelectorAll("[data-change]").forEach((b) =>
    b.onclick = () => { state.familyEditing = b.dataset.change; renderFamily(); });

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

/* Six flat tabs, in one strip. The admin side had no tab structure written down
   anywhere, and the parent's two views were nested a level deeper inside one of them.
   Six is wide on a phone: the strip scrolls sideways, and whether that survives testing
   is the open half of item 89 — a mode switch in the header is the fallback if it
   doesn't. What it is not is a menu behind the signed-in name, per item 78. */
const TABS = [
  { id: "calendar", label: "Calendar", who: "admin" },
  { id: "members", label: "Members", who: "admin" },
  { id: "responses", label: "Responses", who: "admin" },
  { id: "groups", label: "Squads", who: "admin" },
  { id: "mycalendar", label: "My calendar", who: "parent" },
  { id: "myfamily", label: "My family", who: "parent" }
];

/* The two personal tabs belong to a parent of a child in the team being looked at. An
   admin who has no child in this age group has no family view of it to show. */
function isParentHere(me) {
  return (me.childIds || []).some((id) => {
    const c = BY_ID.get(id);
    return c && c.teamId === state.teamId;
  });
}

function visibleTabs() {
  const me = signedIn();
  const admin = isAdmin(me), parent = isParentHere(me);
  return TABS.filter((t) => t.who === "admin" ? admin : parent);
}

function showView(name) {
  state.view = name;
  document.querySelectorAll("#tabs button").forEach((b) => {
    const on = b.dataset.view === name;
    b.setAttribute("aria-selected", on);
    b.tabIndex = on ? 0 : -1;      // one stop for the strip, not one per tab
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));

  /* Each screen opens on its own event the first time it is reached, and after that the
     one the admin picked follows them from screen to screen. */
  const t = team();
  if (name === "responses" && !state.respDefaulted && !state.eventPicked) {
    state.respDefaulted = true;
    selectEvent(nextOutstandingEvent(t).id);
    renderAll();
  } else if (name === "groups" && !state.squadDefaulted && !state.eventPicked) {
    state.squadDefaulted = true;
    selectEvent(nextUnsquaddedEvent(t).id);
    renderAll();
  }
  window.scrollTo(0, 0);
}

/* A real tablist, as the parent's own strip was before these tabs were merged into it:
   arrow keys move between the tabs and take the selection with them, Home and End jump
   to the ends, and Tab leaves the strip for the panel rather than stepping through
   every tab on the way. */
function wireTabKeys() {
  const tabs = [...el("tabs").querySelectorAll("button")];
  tabs.forEach((b, i) => {
    b.onkeydown = (e) => {
      const last = tabs.length - 1;
      let to = null;
      if (e.key === "ArrowRight") to = i === last ? 0 : i + 1;
      else if (e.key === "ArrowLeft") to = i === 0 ? last : i - 1;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = last;
      if (to === null) return;
      e.preventDefault();
      showView(tabs[to].dataset.view);
      const again = el("tabs").querySelector(`[data-view="${tabs[to].dataset.view}"]`);
      if (again) again.focus();
    };
  });
}

/* The masthead's height, measured, so the phone breakpoint can offset the sticky bar
   by exactly it and leave the tab strip pinned on its own. It changes with the age-group
   picker appearing or disappearing, so it is re-measured whenever the chrome renders. */
function syncChromeOffset() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  /* the fractional height, not offsetHeight: rounding down leaves a sliver of the
     masthead showing under the pinned strip */
  document.documentElement.style.setProperty(
    "--topbar-h", bar.getBoundingClientRect().height.toFixed(2) + "px");
}
addEventListener("resize", syncChromeOffset);

function renderChrome() {
  const me = signedIn();
  const tabs = visibleTabs();

  el("tabs").innerHTML = tabs.map((t) =>
    `<button role="tab" id="tab-${t.id}" data-view="${t.id}" aria-controls="view-${t.id}"
       aria-selected="${t.id === state.view}" tabindex="${t.id === state.view ? "0" : "-1"}">${t.label}</button>`).join("");
  el("tabs").hidden = tabs.length < 2;
  el("tabs").querySelectorAll("button").forEach((b) => { b.onclick = () => showView(b.dataset.view); });
  wireTabKeys();

  const picker = el("team-pick");
  const mine = adminTeamsFor(me);
  picker.hidden = mine.length < 2;
  picker.innerHTML = mine.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
  if (mine.length) picker.value = state.teamId;

  /* switching age group can take a tab away with it — a parent of a child in one group
     and an admin of another has the personal tabs only on the one */
  if (!tabs.some((t) => t.id === state.view)) showView(tabs[0].id);
  else showView(state.view);
  syncChromeOffset();
}

function signInAs(id) {
  state.signedInId = id;
  const me = signedIn();
  const home = (adminTeamsFor(me)[0] || teamsFor(me)[0] || TEAMS[0]).id;
  state.view = null;
  selectTeam(home);
  el("signin").hidden = true;
  el("app").hidden = false;
  renderChrome();
  renderAll();
}

function signOut() {
  state.menuOpen = false;
  if (el("usermenu")) { el("usermenu").hidden = true; el("whoami").setAttribute("aria-expanded", "false"); }
  state.signedInId = null;
  state.editingId = null;
  state.editDraft = null;
  state.editErrorField = null;
  // view state belongs to the session that made it
  state.view = null;
  state.familyChild = "all";
  state.familyOpen = new Set();
  state.familyTouchedRows = false;
  state.familyShowEarlier = false;
  state.familyEditing = null;
  state.eventPicked = false;
  state.calOpen = new Set();
  state.calTouched = false;
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

el("team-pick").onchange = () => {
  selectTeam(el("team-pick").value);
  renderChrome();     // the personal tabs are per age group, so the strip is rebuilt
  renderAll();
};

el("whoami").onclick = () => { state.menuOpen ? closeUserMenu() : openUserMenu(); };

/* TEMPORARY: see renderThemeToggle */
el("theme-toggle").onclick = () => {
  document.documentElement.setAttribute("data-theme", themeIsDark() ? "light" : "dark");
  renderThemeToggle();
  el("theme-toggle").focus();
};

document.addEventListener("keydown", (e) => {
  if (!state.menuOpen) return;
  if (e.key === "Escape") { e.stopPropagation(); closeUserMenu(); }
  else if (e.key === "Tab") trapMenuTab(e);
});

document.addEventListener("mousedown", (e) => {
  if (state.menuOpen && !el("usermenu").contains(e.target) && e.target !== el("whoami")
      && !el("whoami").contains(e.target)) closeUserMenu(false);
});

/* Squads go out for the events the season marked `squads: true`, and nowhere else —
   which leaves sessions in both states for a parent to meet. They went out three days
   before the session, or this morning for one that close, never in the future. */
TEAMS.forEach((t) => {
  t.events.forEach((e) => {
    if (!e.squadsPlanned || !e.published || e.cancelled) return;
    const at = new Date(Math.min(eventStart(e).getTime() - 3 * 86400000,
      NOW.getTime() - 2 * 3600000));
    publishSquads(e, allocationFor(t, e), at);
  });
});

/* The answers that came in after the squads had gone out. Applied here rather than with
   the rest of the scenario because they only mean anything once there is a squad list to
   be missing from: the child is down as coming and is in nobody's squad, which is the
   state the app has to explain rather than hide. */
LATE_ANSWERS.forEach((a) => {
  const e = TEAM_BY_ID.get(a.teamId).events.find((x) => x.key === a.key);
  if (!e || !e.squadsPublished) return;
  /* after the squads went out, and still before the session itself */
  const when = new Date(Math.max(
    SCENARIO.answeredAtFor(e, a.daysBefore).getTime(),
    e.squadsPublishedAt.getTime() + 86400000));
  e.status.set(a.personId, "accepted");
  e.answeredBy.set(a.personId, a.byId);
  e.answeredAt.set(a.personId, when);
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
