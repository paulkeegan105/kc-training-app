# Club training app — spec

An app for one GAA club to organise training sessions, matches and social events across its juvenile age groups. It replaces Teamer, which closes on 5 October 2026.

The players are young children. The people using the app are their parents and the volunteer coaches, who are themselves parents of players.

Group allocation is specified separately in `allocation-rules.md`. Read both.

## People and accounts

**Person** — a child or an adult. A child has a full name, a school and an ability rating. An adult has a full name, an email address and a phone number.

**Account** — a login. One household has one account, with one or more people attached to it. The same account can be signed in on several phones at once, and all of them get the same notifications, so both parents and a grandparent can be on the same login.

Person and account are deliberately separate. Availability is answered per person, not per account, so one household can accept for the child and decline for the coaching parent on the same night.

Children have no photo, no bio and no contact details of their own. All contact goes to the adults on their account.

An adult can be linked to more than one child, including children in different age groups.

Every parent gets a login. Accepting an event and blocking out unavailable dates are both things a parent does from their own account.

## Teams

A team is an age group: Under 6, Under 7 and so on. The app holds many of them.

All teams belong to the same club and share one crest, set once at club level rather than per team.

Teams are private. A person only sees a team they have been added to. An adult with children in two age groups sees both.

## Roles

Everyone is added as a player by default.

**Team Admin** — full control of the team, including events, members, roles and allocation. A team must always have at least one, and can have several. An admin can hand the role to another member.

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

## Registered and unregistered members

An admin adds a member by typing a name and a contact detail. That member exists and receives notifications straight away without doing anything. They are **unregistered**, and the admin can edit their details.

When that person signs up using the same email address, they become **registered**. From then on they manage their own details and the admin cannot edit them.

Show the difference clearly in the member list so an admin can see who has signed up and who hasn't.

## Events

Event types are game, training and other. Other covers social outings.

Required fields: type, date and time, venue.

Optional fields: meet time, opposition, location.

An event can be created singly, or as a recurring event repeating weekly for up to 12 weeks. Events can also be uploaded in bulk from a CSV template, with a downloadable template provided.

Events can be edited.

Cancelling asks the admin for a reason and notifies everyone. Deleting is only allowed before notifications have gone out; once an event has been notified it can only be cancelled.

Events appear in a list view and a calendar view. The calendar can be subscribed to from Google Calendar, iCal or Outlook, so new events appear there automatically.

Player of the Game is a poll that can be turned on or off per event.

## Availability

There is no standby or substitutes list. Every available child is placed in a group.

Each person invited to an event has one of three statuses: accepted, declined, or no response. The event shows a count of each.

A member who declines is asked for a reason. Only admins see it.

An admin can override anyone's status, and can send a chaser to an individual who hasn't responded. Assumption: an automatic reminder also goes out 24 hours before the event unless the admin turns it off. Correct this if it's wrong.

A member can block out a range of dates in their own calendar. They are then marked unavailable automatically for any event falling in that range.

## Notifications

Push notification and email only. There is no SMS anywhere in the app.

Notifications go out for a new event invitation, a chaser, a reminder, a cancellation, and when the groups for an event are published.

Members can set their own notification preferences.

## Contacting people

From a member's entry an admin can call them, email them, or save them to the phone's contacts in one tap.

## What parents see

A parent sees their child's group and who is coaching it.

A parent never sees any child's ability rating or school, anywhere in the app, and is never given either as the reason for a placement.

## Explicitly out of scope

These were in Teamer and are deliberately not being built: payments of any kind, SMS, standby and substitutes lists, attendance tracking, player photos and bios, the documents area, and the team message board. Pitch booking and any Foireann integration are also out.

## Notes

Teamer has no export tools, so the member lists have to be re-entered by hand before 5 October 2026. A CSV import for members, matching the one for events, would save a lot of typing.

## Assumptions to confirm

- Admins can add, edit and remove members. This wasn't discussed but the app doesn't work without it.
- The automatic 24-hour reminder, as above.
