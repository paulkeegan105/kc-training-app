# Club training app — spec

An app for one GAA club to organise training sessions, matches and social events across its juvenile age groups. It replaces Teamer, which closes on 5 October 2026.

The players are young children. The people using the app are their parents and the volunteer coaches, who are themselves parents of players.

Squad allocation is specified separately in `allocation-rules.md`. Read both.

## People and accounts

**Person** — a child or an adult. A child has a full name, a school and an ability rating. An adult has a full name, an email address and, optionally, a phone number.

Every adult must have an email address. It is how they are notified and how a signup is matched to an existing member. A phone number is optional, and is used for tap-to-call only.

**Account** — a login. Every adult gets their own login. An account can be signed in on several phones at once.

Person and account are deliberately separate. A child has no login of their own.

A child is linked to one or more adults. Every linked adult sees that child and can answer for them. Availability attaches to the child, so there is one answer per child per event whoever gives it, and any linked adult can change it afterwards.

A coach's own availability is separate from their child's.

Children have no photo, no bio and no contact details of their own. All contact goes to the adults linked to them.

An adult can be linked to more than one child, including children in different age groups.

## School and ability rating

A child's school is entered by their own parent, and is visible only to the adults linked to that child and to admins. The field carries a short note explaining why it is collected. An admin can also correct it — see *Editing members*.

It is required, but it is prompted after signup rather than blocking it. Admins get a list of the children still missing one. A child with no school recorded is treated as a singleton for that session.

Schools are a controlled list, maintained by a Club Admin. Parents pick from a dropdown, which includes an "other" option.

A school typed into "other" is **not** added to the club's list. It is recorded against that child as unconfirmed and queued for a Club Admin, who either maps it to a school already on the list or adds it. Until they do, the child has no confirmed school, so the allocation counts them as a singleton. The field says the club will confirm it, so a parent is not left thinking the job is done.

This keeps the list clean. If typing a school added it, "St Laurence's", "St Laurences" and "St. Laurence's NS" would become three schools within a season, and the affinity rules would quietly stop working.

The ability rating is entered and seen by admins only, and is never shown to a parent.

## Teams

A team is an age group: Under 6, Under 7 and so on. The app holds many of them.

All teams belong to the same club and share one crest, maintained by a Club Admin at club level rather than per team.

Teams are private. A person only sees a team they have been added to. An adult with children in two age groups sees both, and can switch between those teams from anywhere in the app.

## Squads and stations

A **squad** is what the allocation produces: a set of children and coaches who stay together for the session. How squads are worked out is in `allocation-rules.md`.

A **station** is a fixed spot on the pitch with a drill set up at it. Stations do not move and are not allocated.

Squads rotate around the stations on a whistle until every station has been visited, and coaches travel with their squad rather than staying at a station.

The app allocates squads and shows the pitch layout. What happens at each station is the coaches' business, not the app's.

### Squad, and the one place it is called a team

**Squad** is the word, everywhere, for a set of children and coaches the allocation puts together.

**Team** means the age group — Under 9, Under 11 — everywhere in admin surfaces and throughout these specs. The one exception is a parent's event card for a match, where their child's squad is shown as a team, "Team 4", because that is what the club calls it on the day. Nothing else uses the word.

## Roles

Children are players. Adults are never players: an adult's role is Team Admin, Event Manager, or nothing at all, and nothing at all is the normal case for a parent. There is no default player role for an adult.

**Club Admin** — sits above the teams. A Club Admin creates teams, appoints the first Team Admin of each, and maintains the crest, the school list and the venue list.

**Team Admin** — full control of the team, including events, members, roles and allocation. A team must always have at least one, and can have several. An admin can hand the role to another member.

A Team Admin cannot remove themselves or close their account while they are the only admin of a team. A Club Admin can always appoint a replacement.

**Event Manager** — can create and manage events, but cannot change members or roles.

Only a Team Admin can change anyone's role.

## Coaches

Coach is not a role. Roles are about what someone can do in the app; coaching is about what they do at a session. Most coaches have no admin rights, and some admins don't coach.

Coach is a flag on a parent within a team, set by an admin and turned on or off at any point in the season as parents come and go. Roughly one in five parents is flagged, so a team of 75 children might have 15 coaches.

Every coach is a parent of a child in that team. A parent who isn't flagged is never treated as a coach.

Being flagged is what gets someone invited to an event as a coach. Whether they're coaching on a given night is their own availability answer, which they give separately from their child's, because a parent can be unavailable on a night their child still attends.

Whether a coach is tied to their own child's squad is a team setting. With it on, a coach who accepts on a night their own child declines cannot be placed and stands down for that session. With it off, they coach wherever they are needed. Both are in `allocation-rules.md`.

## Team settings

Each team carries the numbers the allocation runs on: maximum squads, maximum, target and minimum squad size, minimum coaches per squad, the coach-to-child ratio, and whether a coach is always placed with their own child. Defaults and meanings are in `allocation-rules.md`.

The three squad sizes default to a maximum of 12, a target of 8 and a minimum of 5. All three
are working defaults rather than club decisions, and they are settings precisely so that the
club can move them once they have used the app for a few weeks — which is better evidence than
an opinion formed in a meeting about a season nobody has played yet.

An admin sets them per team, because turnout and age change what works. An admin can also override them on a single event, which applies to that event only and leaves the team's settings alone.

A team also carries a default event duration of 1 hour 15, a response deadline of 24 hours before the start, and the advance reminder: a switch, and how many hours before the deadline it goes out. The duration and the deadline are overridable on a single event in the same way.

## Registered and unregistered members

An admin adds a member by typing a name and an email address. That member exists and receives notifications straight away without doing anything. They are **unregistered**, and the admin can edit their details.

When that person signs up using the same email address, they become **registered**. From then on they manage their own details.

Show the difference clearly in the member list so an admin can see who has signed up and who hasn't.

### Editing members

An admin can edit a member's details: a child's name, school and rating, and an adult's name, email and phone. This holds whether or not the adult has registered, because a name or an address typed wrong has to be fixable by someone.

Members can also be uploaded in bulk from a CSV template, matching the one for events, with a downloadable template provided.

Removing a member is a soft removal. Past events keep their record intact, and the member stops appearing in anything future.

## Events

Event types are game, training, blitz and social. Social covers the club's own social events —
a Halloween party, a Santa visit — and behaves like any other event for invitations,
availability, the response deadline and the reminder. Coaches are invited as coaches and answer
separately from their child, exactly as for training.

What a social does not have is an allocation. No squads are worked out for it, so there is no
squad list, no coach list and no count of who is coming, and the card never says squads are
still to come — there is nothing coming. See `allocation-rules.md`.

Required fields: type, date and time, venue.

Optional fields: meet time, opposition.

Venue is a controlled list of the places the club uses, maintained by a Club Admin. There is no
separate location field. It is not a list of pitches: the clubhouse function room is a venue on
the same list as Glenalbyn Pitch 1, and so is anywhere else on the grounds an event happens. A
social event needs a venue exactly as a match does, and needs to say how to get into it for the
same reasons.

A venue carries an **eircode** and a short free-text **note for parking and access**, both entered by the Club Admin alongside the venue itself, and a map link. A parent sees all four on the expanded event: the venue name, the eircode, the map link and the note.

A venue either has an eircode recorded or it does not. Where it does not, the line is simply
absent and the name, the map link and the note stand on their own. There is no parent-facing
"to be confirmed" state on venue data, for the reason already recorded for schools: a status a
parent cannot act on, hurry or fix does not belong in front of them.

This earns its place on away fixtures. A parent driving to a ground they have never been to needs the eircode for the satnav and the note for everything the satnav cannot tell them — which gate to use, where parking actually is, whether the pitch is the one behind the clubhouse. Entering it once against the venue means it is right for every fixture played there, rather than retyped into each event.

An event has a duration. It defaults to the team's setting of 1 hour 15 and can be overridden on the event.

An event can be created singly, or as a recurring event repeating weekly for up to 12 weeks. Recurrence is a convenience at creation only: each occurrence is independent once created, so editing or cancelling one affects no other. A member added mid-term is invited to the occurrences still to come.

Events can also be uploaded in bulk from a CSV template, with a downloadable template provided.

### Draft and publish

An event starts as a draft. A draft is invisible to members, freely editable, and can be deleted outright.

Publishing is a separate step, and it is what sends the invitations. Publishing invites everyone on the team, meaning every child and every flagged coach. The admin can deselect people before publishing.

Publishing sends the invitation email, and also offers a WhatsApp share link carrying the same content for the team's group chat. Email is the record that reaches everyone; WhatsApp is the nudge. The link is a share and not a second channel: no response comes back through it and nothing is tracked through it.

Once an event is published, cancelling is the only way to withdraw it. Cancelling asks the admin for a reason and notifies everyone. A published event can still be edited.

### The season calendar

Events appear as a season calendar: every event of the season in date order, grouped by month. The next upcoming event is open by default, because it is the one being asked about. Drafts appear on it as drafts, clearly marked and visible to admins only. A cancelled event stays on the calendar with its reason.

The calendar can be subscribed to from Google Calendar, iCal or Outlook, so new events appear there automatically.

## The parent's invitation

This is the screen the app is judged on. It is the one nearly every parent uses, and the only one some of them ever see, so it is built for a phone first.

**The email.** Publishing sends each parent an email naming their child, carrying the event type, the date, the start and end time, the meet time and the venue, and two buttons: one to accept and one to decline.

**The screen.** Both buttons open the same page. It shows the event, then asks whether that child can make it. Accepting is one tap, and so is declining. No reason is asked for and none is stored: a parent who cannot make a session owes the club an answer, not an explanation, and asking for one makes the quick no harder to give than the quick yes.

Answering re-runs the allocation straight away.

A parent can change their answer afterwards, as often as they need to, up to the event itself. The screen shows the answer already given and offers to change it.

A coaching parent answers for themselves separately from their child, because a parent can be unavailable on a night their child still attends.

## CSV imports

Both the event import and the member import are validated as a whole. Nothing is imported until the file is clean, and errors are reported by row number.

## Availability

There is no standby or substitutes list. Every available child is placed in a squad.

Each person invited to an event has one of three statuses: accepted, declined, or no response. The event shows a count of each.

An admin can override anyone's status. An override is visible to that person, shown as set by an admin, and feeds the allocation exactly like a real response.

Each answer carries who set it and when — "Declined by Dad, Wed 16 Sep" — shown under the status to the household and to an admin. It is the answer that is live now, not a history: previous answers and who changed what are not kept or shown. An override reads as set by an admin, with the same date.

An admin can send a chaser to an individual who hasn't responded. Chasers are per person, with no limit.

Members respond per event. There are no blackout dates and no date-range unavailability.

### The response deadline

An event has a response deadline, set as a number of hours before the event starts. It is a team setting, defaulting to 24 hours, and an admin can override it on a single event.

**Nothing locks when it passes.** A parent can still change their answer afterwards, and doing so re-runs the allocation and tells the admin exactly as it does at any other time. The deadline is there to say when an answer is wanted, not to shut the door on one. A late change is more useful than no change.

A parent sees the deadline on each event, and a count at the top of their page of how many answers are still outstanding across their children.

An admin sees the deadline state on each calendar row: counting down before it, and saying responses have closed after it.

### The advance reminder

The advance reminder is a team setting, on or off. It goes only to people who haven't responded.

It is timed off the deadline rather than off the event, and goes out a configurable number of hours before it, defaulting to 24. Both numbers are settings, so a team can ask for answers early and still nudge late, or the other way round.

For a Wednesday 18:30 session with a 24-hour deadline and a 24-hour reminder, answers are due Tuesday 18:30 and the reminder goes out Monday 18:30. Widen the deadline to 72 hours and answers are due Sunday 18:30, with the reminder on Saturday 18:30 — which is why it is no longer called the 24-hour reminder: the 24 in it was never the thing that mattered.

## Notifications

Email only. There is no SMS anywhere in the app, and push notifications are not in the first release.

Notifications go out for a new event invitation, a chaser, the advance reminder, a cancellation, and when the squads for an event are published. When squads are re-published, only those whose squad has changed are notified.

There are no per-adult notification preferences. With a single channel there is nothing to choose between.

The WhatsApp share link offered at publishing is a share rather than a channel. It carries the same content into a group chat, and nobody is notified or tracked through it.

Push is expected in a later release. Notifications should be built with the channel behind one sending path, so that adding push is a new channel rather than a rewrite.

## Keeping the squads current

The allocation re-runs by itself whenever something changes it, and there is no re-run button. Whenever it does, say so: what caused it, and what changed as a result. The rules are in `allocation-rules.md`.

## Contacting people

From a member's entry an admin can call them, email them, or save them to the phone's contacts in one tap.

## Exports

There is one export: an admin export of a session's squads, for printing or sharing. It carries names, squads and coaches only, and never ability ratings or schools.

## What parents see

A parent sees the season calendar: every event of the season in date order, grouped by month, with the next upcoming one open by default. Drafts remain invisible to them.

Event cards open and close independently. Opening one never closes another, and tapping a row
never moves that row: the detail opens downward beneath it and everything above stays where it
was. This replaced an accordion, which closed whichever card was open — and when that card was
above the one being tapped, the page above shrank and the tapped row walked out from under the
thumb. Scroll correction fixes that everywhere except at the top of the list, where there is no
scroll above left to give back, so the accordion had to go rather than the symptom. One card
still opens by default: the next upcoming event, whatever its type, because it is the one being
asked about.

The list opens at the next upcoming event. Everything earlier collapses behind a single row that reads as the control it is — "Show 6 earlier events", with a chevron that turns as it opens — and expands in place. That is a collapse, not a filter: nothing is removed from the list, and a cancelled event stays inline wherever it falls, with its reason. There are no status filters — upcoming, past and cancelled are the only states a parent can see, and the calendar already separates them.

Where the signed-in adult has more than one child, a row of chips above the list filters it by child: All, then one chip per child. It filters the list and nothing else. With one child there are no chips, and the subtitle under "Your family" carries the child's name instead.

### What an event row says

The row leads with the event: the title, then the day and the times. The age group is not repeated on a parent's row, and neither is the child's name — a name appears **once per row, or not at all**.

The two times are split across the two lines rather than run together. The collapsed row carries the day and the meet time — "Today · Meet 11:00" — because that is the one a parent acts on. The start and end move into the expanded detail beside the venue: "Glenalbyn, Pitch 1 · 11:30–12:40". Both are kept; they are only separated.

The range carries no label. The separation does that work, which also keeps the wording from having to branch between a training session and a match. Where an event has no meet time, the start time goes on the collapsed row and the range stays in the detail. End times are kept throughout, because the calendar feed needs them.

The type leads the title: training reads "Training", a match reads "Match · Home to Templeogue Synge Street", and a blitz reads "Blitz ·" and its name. That last one closes a gap — a blitz and a match were previously indistinguishable on a row.

The date tile is coloured by type as well: the club purple for training, the club gold for matches and blitzes. The word in the title carries the meaning, so the colour is reinforcement and never the only signal. A past event mutes its tile along with the rest of the row, so a finished match never sits brighter than an upcoming session.

The name, where it is needed, goes on the status rather than in the subline, because that is where it does work — it says whose answer this is. It appears when the row carries more than one answer, which is a coaching parent's own alongside their child's, and when the signed-in adult has more than one child, where the row would otherwise not say which of them it concerns. Where there is one child and one answer, there is no name in the subline and no label on the status: it could only be that child, and saying so twice says nothing.

Labelled statuses read "Orla" and "You". They sit stacked in a fixed column at the right of the row, so they form a straight edge down the list. Those labels are what tells a coaching parent the two answers are separate; no standing explainer is needed alongside them.

A parent sees their child's squad, the coaches for it, and the names of the children in it, their own child included. The squad is shown as two labelled lists, coaches then players, each label carrying its own count.

A coach sees the phone numbers of the other coaches on that squad, as tap-to-call. A parent who does not coach sees names only. A coach's number is not a parent-facing detail, and coaches sorting a session between them on the night is exactly the case this serves.

Any copy about who can see a phone number has to hold for a coach as well as a parent. The
helper text under the field promised that only a team admin could see it, which was true of a
parent and untrue of every coach in the club — their number is shown to the other coaches on
their squad by the paragraph above. It now says both: a team admin can see it, and if you
coach, so can the other coaches on your squad. The general form of the mistake is worth
avoiding everywhere: this app has adults who are parents, adults who coach, and adults who are
both, and a sentence that is only true of the first is a promise broken for the rest.

Both lists are in plain alphabetical order by first name, with nobody pulled to the top. A squad list is read to find a name in it, and a list that is alphabetical everywhere except the first entry is slower to scan, not faster. The reader's own child, and a coach's own name, are set in bold where they fall, with a hidden label so a screen reader still says which name is theirs.

Sorting is collated so that fadas order with their base letter: Áine belongs with the As, not after Z.

A cancelled event drops the answers-due line, the venue, the meet time and the whole response block. It keeps the date, the time, the opposition where there is one, and the cancellation reason.

### Once an event has started

An event that has started takes no more answers. The Yes and Can't make it buttons go, and so does Change answer. Whatever was answered still shows, with who answered and when. This is about the event having happened, not about the deadline: the deadline never locks anything (see the response deadline above).

A finished event never says squads haven't been published yet. If squads were published it shows them; if they never were it says nothing, because there is nothing left to wait for. An unanswered finished event says so where its buttons would have been — "This session has finished" — rather than leaving a parent to work out why it cannot be answered.

Past events recede. They keep their place in the list and lose their emphasis: no raised surface, no accent, a quieter title. The list should read as things to act on and things that already happened.

### When a child is not in a squad

There are three reasons a parent might not see a squad, and the app says which:

- Squads have not been published yet — so wait, and it will appear here.
- Squads were published and this child was not in one, because their answer arrived afterwards. Say exactly that, say when squads went out, and tell the parent to let a coach know the child is coming. **Never tell this parent to wait**: a parent who is told a squad is still coming, when it went out without their child in it, can arrive at a pitch expecting a team.
- The session has finished and squads were never published — say nothing.

### Chasing answers

The answers-due line appears only while that person's answer is outstanding. Once they answer either way it goes, because it was a prompt and there is nothing left to prompt for.

Where the deadline has passed and the person never answered, the line says responses have closed and they can still **answer** — not that they can still change their answer, because there is no answer to change. Where an answer exists, nothing is shown at all.

The count of answers still to give covers the next seven days, not the season. It names the child and when: "1 answer still to give, for Liam, today", or where there is more than one, "2 answers still to give. The first is Liam, today." Exactly one name either way, however many children there are — the count says how much is owed and the name says where to start, and listing the rest belongs in the list, not the banner.

It counts only events that can still be answered, so a past event that was never answered drops out of it. It counts from **everything owed, not from the filtered list**: a child filter changes what is shown, never what is owed. The count is itself the way to reach what it counts — following it clears any filter in the way, opens the earliest event it counted, and puts the keyboard there.

Outside that window there is no count and no banner. The row statuses carry it, which is what they are for. **This changes what is shown, not what can be answered.** Nothing locks, and a parent can answer any event at any distance, from its own row.

There is no standing "everything answered" banner. A brief confirmation appears when an answer is given and fades on its own, rather than a reassurance sitting on the page for the whole visit. It is announced once to a screen reader rather than left in the page for one to find.

### The response block

An answer that already exists is a fact rather than an action, and takes one line: the person, who said it and when, and a text link to change it — "Orla · Accepted by you, Mon 7 Sep · Change". No status badge: the word in the provenance already carries it, and the collapsed row showed it on the way in.

An unanswered person keeps the full treatment, with Yes and Can't make it as proper buttons, because that is the action the card exists for.

The controls stay inside the expanded card. The collapsed row is itself the control that opens the card, and the chooser needs somewhere to render when it opens.

### Changing an answer

Change answer opens the choice. It shows both options with the current answer already selected,
and **writes nothing until the parent picks one**. A parent who taps it and walks away has
changed nothing, and their child is still down as they were. It is not a dropdown, and it never
clears the answer as a step on the way to replacing it.

There are two controls and no third. Tapping the option that is already selected is how a
parent backs out: the chooser closes and nothing is written — the answer stands, and **the
answered-on date is not restamped**, because that line has to keep saying when the answer was
actually given. A separate "keep what you have" link said the same thing as the selected button
beside it, and a chooser with two ways to do nothing is harder to read than one.

A parent is shown the school they gave, plainly, as that child's school — whether or not it is yet on the club's list. What a Club Admin is confirming is whether the school joins the dropdown, which is a decision about a list. It is not something the parent can act on, and telling them their answer is provisional invites them to do something about it when there is nothing to do. The queue and the allocation behaviour are unchanged: an unconfirmed school still waits for a Club Admin, and the child is still counted a singleton until it is confirmed.

A school can also be set back to not recorded, because a parent who picked the wrong one needs a
way back.

The dropdown offers the club's schools and "Other…", and nothing else. It carried a "Not sure
yet" option, which did exactly what leaving the field alone did — both make the child a
singleton for the session and both leave them on the admin's chasing list — so it was not a
second option, it was the same option twice. Where no school is recorded the control shows an
unselectable placeholder rather than pre-selecting a real school on the parent's behalf.

Required fields are not marked with an asterisk. The one optional field says that it is
optional, which is the clearer way round: it marks the exception rather than the rule, and a
form of starred labels teaches a parent nothing they could not read off the one unstarred one.

A parent sees their own child's school, because they enter it themselves. They never see another child's school, and no parent ever sees any ability rating, including their own child's. Neither is ever given as the reason for a placement.

### Someone to ring on the day

A parent can see the team admin's name and phone number. When a pitch changes an hour before throw-in, or a parent is lost on the way to an away ground, there has to be one named person to contact, and it cannot be a general club number that rings out on a Saturday morning.

This is deliberately the team admin and not the coaches. Coaches' numbers are shown to other coaches on the squad card and are not exposed to parents.

**This needs the club's agreement before it is built.** It puts a volunteer's personal number in front of every parent in the age group, which is a thing to ask for rather than assume.

### Forms and dialogs

A dialog takes focus when it opens, keeps Tab inside itself while it is open, and hands focus back to the control that opened it when it closes.

A validation failure keeps what the person typed. Re-rendering a form from the stored record throws away every other edit they made, silently, and they may not notice until later. The message goes under the field it is about and that field is marked, so with four fields on screen nobody has to work out which one is wrong.

Saving confirms the same way answering does, with the same brief confirmation. A save that closes a dialog and says nothing leaves the person wondering whether it took.

## What the header carries

The header carries the club, the age group where an admin has one to switch, and the signed-in person's name. It does not carry their role. A role line cannot describe an adult who coaches two age groups without either lying or growing, and the event rows already say who is coaching what, per event. Anything needed to tell test accounts apart belongs on the sign-in screen.

The name is a control. Behind it sits a menu holding **Sign out, and nothing else**. On a phone
shared between two parents the name is worth keeping in sight, because it says whose answers
these are.

Under the header sits one tab strip, carrying six tabs: **Calendar, Members, Responses,
Squads, My calendar** and **My family**. The first four are the admin side — the season
schedule and where events are created and published; the team's people; who has answered a
given event; and the allocation. The last two are the parent's own view, and are shown only to
an adult who is a parent of a child in the team being looked at. The strip is sticky at every
scroll position, because it is how everything is reached. A page title and the action buttons
under it are not sticky: they belong to the screen rather than to the app.

**My calendar** is where a parent lands, and holds the outstanding-answers banner, the child
filter chips, the earlier-events collapse and the list. **My family** holds the two personal
cards, Your children and Your details, stacked. The tabs are the same at every width, and the
right sidebar those cards used to sit in is gone — on a wide screen they take the width the
calendar list takes.

This supersedes the earlier note that there is no hamburger because there is nothing to
navigate to. There now is: places, named, in the page rather than behind the name. What the
menu held was navigation wearing a menu's clothes, reachable only by opening something that
looked like an account control. On the parent's two tabs the strip is the heading as well, so
there is no page title repeating what the selected tab already says.

The tabs are a tablist: arrow keys move between them and take the selection with them, Home and
End jump to the ends, and Tab leaves the strip for the panel rather than stepping through every
tab on the way.

The menu follows the same focus rules as a dialog: focus moves into it when it opens and back to the name when it closes, Tab stays inside it, and Escape closes it.

### Light and dark

The app follows the phone. There is no in-app light and dark choice in the first release:
a parent has already made that decision once, at the level where it applies to everything, and
an app that asks again is asking them to maintain the same preference in two places. Both themes
are built and both meet the contrast floor below; which one appears is the operating system's
call.

The switch currently sitting in the prototype's header is a testing aid, so a session can be
run through both themes without leaving the app, and comes out afterwards. If it turns out that
parents do want the opposite of their phone setting, it is one row in the Your family tab, not
a control in the header of every screen.

## Branding and accessibility

The club's crest and colours live in one place and are used from there, so changing them is one change rather than a hunt. The crest is maintained by a Club Admin.

All text meets WCAG AA contrast, 4.5:1 for body text and 3:1 for large text and interface controls, in both light and dark mode. That is a floor rather than an aspiration: a colour that cannot carry text at that contrast is used as a fill and not as text.

The built targets are higher than that floor: **7:1 for body text** and **4.5:1 for large text
and interface controls**. The aim is the most readable rather than the highest measurable —
maximum contrast is white on black, which at paragraph length halates and is worst for readers
with astigmatism. The dark theme therefore has no pure black background and no pure white text.

There are **two colour rules**, and nothing outside them may borrow either.

**The club's purple means you can interact with this.** Links, buttons, the selected state of a
control, a focus ring. Nothing that is merely important, merely current, or merely worth reading
is given it.

**Amber means something is owed by you.** It appears in three places: the outstanding-answers
banner, the unanswered status on an event row, and the block that says a child is not in a
squad. Nowhere else. Emphasis that is neither interactive nor owed gets weight, or a neutral
colour, or a background.

Both rules earn their keep on the screens with a lot going on. A parent scanning an event card
should be able to tell what is tappable without tapping to find out, and what still wants an
answer without reading every row — and a colour that sometimes means "act on this" and
sometimes means "read this" tells them neither.

The emphasis colour was re-pitched off the club gold. Amber and gold began as the same hue, and
on an unanswered match row the gold date tile and the amber status sat at opposite ends of one
line meaning unrelated things — measurably the same colour in dark mode. Gold kept the hue and
amber moved, because gold is a brand colour on the most visible element of the row and amber
has no claim on any particular hue; only on being unmistakable. Amber now sits midway between
the club gold and the red that means declined, which is the furthest it can be from both, and
the unanswered status is a filled chip rather than coloured text so that the emphasis does not
rest on hue alone — a solid block reads as different from plain text whatever the colours do.

Type is sized in rem or em, never in px, so that a browser or operating system font-size setting scales the page. Zoom is not a substitute. A parent who has set a larger default font — often the reason they set it is that they need it — gets nothing from a layout whose type is nailed to pixels, because a text-size setting only moves text sized in relative units. Spacing that has to hold text may be relative too; borders and hairlines can stay in px.

## Known gaps

Parents also receive a session plan of activities and a simple pitch layout diagram alongside their child's squad. Neither is specified.

The session plan is the club's to define, not the app's. What goes into it is a coaching decision; the app's part is carrying it to parents.

The pitch layout diagram shows where the stations are and the route squads take between them. What it has to show, and whether it is drawn per event or per venue, is undecided.

## First release

The first release covers teams and members, creating and publishing events, the parent's invitation and availability, the season calendar, and squad allocation. Email is the only notification channel in it. Everything else waits.

## Explicitly out of scope

These were in Teamer and are deliberately not being built: payments of any kind, SMS, standby and substitutes lists, attendance tracking, player photos and bios, the documents area, and the team message board. Pitch booking and any Foireann integration are also out.

## Notes

Teamer has no export tools, so the member lists have to be re-entered by hand before 5 October 2026. The member CSV import is in scope for that reason.
