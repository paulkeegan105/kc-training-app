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

Event types are game, training and other. Other covers social outings.

Required fields: type, date and time, venue.

Optional fields: meet time, opposition.

Venue is a controlled list of the club's usual pitches, maintained by a Club Admin. A venue can carry an optional map link, which is how away games are covered. There is no separate location field.

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

A parent sees the season calendar: every event of the season in date order, grouped by month, with the next upcoming one open by default. Past events stay on it, and a cancelled event stays in place with its reason. Drafts remain invisible to them. There are no status filters — upcoming, past and cancelled are the only states they can see, and the calendar already separates them.

A parent sees their child's squad, the coaches for it, and the names of the children in it, their own child included. The squad is shown as two labelled lists, coaches then players, each label carrying its own count. Their own child is sorted to the top of the players and set in bold rather than annotated, with a hidden label so a screen reader still says which name is theirs.

A cancelled event drops the answers-due line, the venue, the meet time and the whole response block. It keeps the date, the time, the age group, the opposition where there is one, and the cancellation reason.

A parent sees their own child's school, because they enter it themselves. They never see another child's school, and no parent ever sees any ability rating, including their own child's. Neither is ever given as the reason for a placement.

## Branding and accessibility

The club's crest and colours live in one place and are used from there, so changing them is one change rather than a hunt. The crest is maintained by a Club Admin.

All text meets WCAG AA contrast, 4.5:1 for body text and 3:1 for large text and interface controls, in both light and dark mode. That is a floor rather than an aspiration: a colour that cannot carry text at that contrast is used as a fill and not as text.

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
