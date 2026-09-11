# Club training app — spec

An app for one GAA club to organise training sessions, matches and social events across its juvenile age groups. It replaces Teamer, which closes on 5 October 2026.

The players are young children. The people using the app are their parents and the volunteer coaches, who are themselves parents of players.

Group allocation is specified separately in `allocation-rules.md`. Read both.

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

A child's school is entered and edited by their own parent, and is visible only to the adults linked to that child. The field carries a short note explaining why it is collected.

It is required, but it is prompted after signup rather than blocking it. Admins get a list of the children still missing one. A child with no school recorded is treated as a singleton for that session.

Schools are a controlled list, maintained by an admin at club level. Parents pick from a dropdown, which includes an "other" option.

The ability rating is entered and seen by admins only, and is never shown to a parent.

## Teams

A team is an age group: Under 6, Under 7 and so on. The app holds many of them.

All teams belong to the same club and share one crest, maintained by a Club Admin at club level rather than per team.

Teams are private. A person only sees a team they have been added to. An adult with children in two age groups sees both.

## Roles

Everyone is added as a player by default.

**Club Admin** — sits above the teams. A Club Admin creates teams, appoints the first Team Admin of each, and maintains the crest, the school list and the venue list.

**Team Admin** — full control of the team, including events, members, roles and allocation. A team must always have at least one, and can have several. An admin can hand the role to another member.

A Team Admin cannot remove themselves or close their account while they are the only admin of a team. A Club Admin can always appoint a replacement.

**Event Manager** — can create and manage events, but cannot change members or roles.

Only a Team Admin can change anyone's role.

## Coaches

Coach is not a role. Roles are about what someone can do in the app; coaching is about what they do at a session. Most coaches have no admin rights, and some admins don't coach.

Coach is a flag on a parent within a team, set by an admin and turned on or off at any point in the season as parents come and go. Roughly one in five parents is flagged, so a team of 75 children might have 15 coaches.

Every coach is a parent of a child in that team. A parent who isn't flagged is never treated as a coach.

Being flagged is what gets someone invited to an event as a coach. Whether they're coaching on a given night is their own availability answer, which they give separately from their child's, because a parent can be unavailable on a night their child still attends. A coach can only be placed in a group with their own child, so a night where the coach accepts and the child declines means that parent isn't coaching either.

## Team settings

Each team carries the numbers the allocation runs on: maximum groups, minimum coaches per group, coach-to-child ratio, and target and minimum group size. Defaults and meanings are in `allocation-rules.md`.

An admin sets them per team, because turnout and age change what works. An admin can also override them on a single event, which applies to that event only and leaves the team's settings alone.

A team also carries a default event duration of 1 hour 15, overridable on a single event in the same way, and a switch for the automatic 24-hour reminder.

## Registered and unregistered members

An admin adds a member by typing a name and an email address. That member exists and receives notifications straight away without doing anything. They are **unregistered**, and the admin can edit their details.

When that person signs up using the same email address, they become **registered**. From then on they manage their own details and the admin cannot edit them.

Show the difference clearly in the member list so an admin can see who has signed up and who hasn't.

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

Once an event is published, cancelling is the only way to withdraw it. Cancelling asks the admin for a reason and notifies everyone. A published event can still be edited.

Events appear in a list view and a calendar view. The calendar can be subscribed to from Google Calendar, iCal or Outlook, so new events appear there automatically.

## CSV imports

Both the event import and the member import are validated as a whole. Nothing is imported until the file is clean, and errors are reported by row number.

## Availability

There is no standby or substitutes list. Every available child is placed in a group.

Each person invited to an event has one of three statuses: accepted, declined, or no response. The event shows a count of each.

A member who declines is asked for a reason. Only admins see it.

An admin can override anyone's status. An override is visible to that person, shown as set by an admin, and feeds the allocation exactly like a real response.

An admin can send a chaser to an individual who hasn't responded. Chasers are per person, with no limit.

The automatic 24-hour reminder is a team setting, on or off. It goes only to people who haven't responded.

Members respond per event. There are no blackout dates and no date-range unavailability.

## Notifications

Email only. There is no SMS anywhere in the app, and push notifications are not in the first release.

Notifications go out for a new event invitation, a chaser, a reminder, a cancellation, and when the groups for an event are published. When groups are re-published, only those whose group has changed are notified.

There are no per-adult notification preferences. With a single channel there is nothing to choose between.

Push is expected in a later release. Notifications should be built with the channel behind one sending path, so that adding push is a new channel rather than a rewrite.

## Contacting people

From a member's entry an admin can call them, email them, or save them to the phone's contacts in one tap.

## Exports

There is one export: an admin export of a session's groups, for printing or sharing. It carries names, groups and coaches only, and never ability ratings or schools.

## What parents see

A parent sees their child's group, the coaches for it, and the names of the other children in it.

A parent sees their own child's school, because they enter it themselves. They never see another child's school, and no parent ever sees any ability rating, including their own child's. Neither is ever given as the reason for a placement.

## First release

The first release covers teams and members, creating and publishing events, availability, and group allocation. Email is the only notification channel in it. Everything else waits.

## Explicitly out of scope

These were in Teamer and are deliberately not being built: payments of any kind, SMS, standby and substitutes lists, attendance tracking, player photos and bios, the documents area, and the team message board. Pitch booking and any Foireann integration are also out.

## Notes

Teamer has no export tools, so the member lists have to be re-entered by hand before 5 October 2026. The member CSV import is in scope for that reason.
