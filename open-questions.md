# Open questions — spec review

Review of `app-spec.md` and `allocation-rules.md`. Split into: contradictions (the two documents or a single document disagrees with itself), gaps that block a build, and things I'd have to invent outright.

## Contradictions

**1. There is no Coach role.** `app-spec.md` defines exactly three roles — Player (default), Event Manager, Team Admin. `allocation-rules.md` is built entirely on a coach/player distinction: coaches are a separate input list, there's a minimum coaches per group, and hard rule 1 pins a coach to their child's group. Is "coach" the same thing as Team Admin/Event Manager, a fourth role, or a per-event flag (someone is coaching *this* session)? Nothing else in the allocation can be built until this is settled.

**Answered (app-spec.md, "Coaches").** Coach is not a role — it is a flag on a parent within a team, set by an admin and turned on or off at any point in the season. The three roles stay as they were; coaching is about what someone does at a session, so most coaches have no admin rights and some admins do not coach. Every coach is a parent of a child in that team, and a parent who is not flagged is never treated as a coach. The flag is what gets them invited to an event as a coach, and they answer availability separately from their child. Because a coach can only be placed in a group with their own child, a coach who accepts on a night their child declines is not coaching either. This does not settle item 16 — a coach with two children in the same team still has two possible groups.

**2. Hard rules are "never broken by the allocation", but the spec instructs breaking them.** When the coach ceiling falls below the floor, the app should "say so plainly and let the admin proceed anyway". Proceeding necessarily violates either rule 2 (group sizes) or rule 3 (min coaches). Which one gives way — do you make the floor number of groups with too few coaches in some, or fewer groups that exceed max size?

**Answered (allocation-rules.md, "Hard rules" and "When the rules can't all be met").** Group sizes give way. The hard rules are now: every group has at least one coach, a coach is with their own child, and every group meets the coach-to-child ratio — and a group will go over its target size if that is what it takes to keep every group staffed. Maximum group size is gone entirely, replaced by the ratio, so the old rule-2-versus-rule-3 conflict can no longer arise. When the rules still cannot all be met, the app names the rule that fails and why, suggests the change that would fix it (two more coaches would allow eight groups; dropping to five would meet the ratio), and lets the admin proceed — treated as a normal bad night rather than an error. One residual ambiguity: minimum group size appears both as a constraint on deriving the group count and as an aim that gives way, so it acts as a floor when choosing how many groups to make but not when placing people into them.

**Updated.** A maximum squad size is back, as a hard cap defaulting to 12. The decision recorded above removed it entirely and left the coach ratio to do that work, but the ratio alone never stopped the allocation putting everybody together: seventy-five children and twelve coaches satisfies 1:8 in a single squad of seventy-five. The target and minimum sizes still give way to the staffing rules; the maximum is not an aim and never gives way.

**3. Unregistered members "receive notifications straight away", but notifications are push and email only.** An admin adds a member with "a name and a contact detail". If that detail is a phone number, they have no push (no app) and no email, so they receive nothing — and no SMS is allowed. Should the contact detail be mandatorily an email?

**Decided.** Every adult must have an email address; a phone number is optional and used for tap-to-call only. An unregistered member therefore always has an address that email notifications can reach, and the member-add flow now asks for a name and an email address.

**4. Registration can only happen by email match, so phone-only members are permanently unregistered.** "When that person signs up using the same email address, they become registered." Is there any other path — an invite link, an admin manually linking a signup to an existing member?

**Decided.** Every adult must have an email address, so there is always an address to match a signup against and nobody can be stranded as permanently unregistered.

**5. Parents never see a child's school or rating, but registered members "manage their own details".** Who enters a child's school and ability rating, and can a registered parent see or edit their *own* child's record? As written, "never sees any child's... school, anywhere in the app" includes their own child — which means the admin must source school data some other way.

**Decided.** A child's school is entered and edited by their own parent and visible only to the adults linked to that child, with a short note on the field explaining why it is collected. It is required but prompted after signup rather than blocking it, and admins get a list of the children still missing one. The ability rating is entered and seen by admins only and is never shown to a parent, including their own child's.

**Updated.** An admin can now also edit a child's school and rating, and an adult's name, email and phone, whether or not that adult has registered. That reaches past two things settled above — school editing belonging to the child's own parent, and a registered member's details being beyond an admin's reach — on the grounds that a name or an address typed wrong has to be fixable by someone. See item 44 in this file for the rest of the editing decision.

**6. "One household has one account" vs "every parent gets a login" vs "their own account".** If both parents and a grandparent share one login, whose account is it, and what does "a parent does from their own account" mean? Compounding this: "members can set their own notification preferences", but all phones on an account get the same notifications. If Mum wants email only and Dad wants push, one shared account can't express that.

**Decided.** The household account is gone: every adult gets their own login. A child is linked to one or more adults, all of whom see that child and can answer for them. Availability attaches to the child, so there is one answer per child per event whoever gives it and any linked adult can change it, while a coach's own availability stays separate. Notification preferences are per adult.

**Updated.** The per-adult notification preferences in the decision above are withdrawn. Push is out of the first release, email is the only channel, and with one channel there is nothing to choose between. Everything else recorded here stands.

**7. Blackout dates auto-decline, but declining requires a reason.** "A member who declines is asked for a reason" — nobody is present to be asked when the decline is automatic. Does an auto-decline carry a system-generated reason, skip the reason, and can the member override it later for a specific event?

**Decided.** Blackout dates and date-range unavailability are removed from the spec entirely. Members respond per event, so every decline comes from someone who can be asked for a reason.

**8. Delete may be a dead feature.** Deleting is allowed only before notifications have gone out. If the invitation notification fires automatically when an event is created, there is never a window to delete. Is there an explicit publish/invite step separate from creation?

**Decided.** Events start as a draft: invisible to members, freely editable and deletable. Publishing is a separate step that sends the invitations, and once published, cancelling is the only way to withdraw an event.

**9. Venue is required and location is optional, with no stated difference.** What is each for?

**Decided.** Venue and location become one field. Venue is a controlled list of the club's usual pitches, maintained by a Club Admin, with an optional map link that covers away games. There is no separate location field.

**10. A max coaches per group is referenced but never defined.** Two coaching parents of one child both go to that child's group "if it stays within the coach limits" — the Inputs list only a *minimum*. Is there a maximum, and is it a hard rule?

**No longer applicable.** The conditional it hangs on is gone — allocation-rules.md now says simply that where a child has two parents coaching, both go to that child's group, so nothing references an undefined coach maximum any more.

**11. The singleton pool can't always be a legal group.** Singletons are pooled into one group, which is "bound by the same min and max sizes". With three singletons and a minimum of five, you must top it up with non-singletons — is that intended? And a *single* singleton on the night can't satisfy the school floor anywhere; the spec doesn't say what to do or what to show.

**Partly overtaken.** The min/max wording it quotes no longer exists and sizes now give way before the staffing rules, so an undersized singleton group is no longer an outright rule break — but the lone singleton who can't satisfy the school floor at all is still unaddressed.

**Decided.** The surviving half is settled: if only one child is a singleton on a given night there is no pool to place them in, so they are placed normally and the admin is told the rule couldn't be met for that child.

**41. "A coach can only be placed in a group with their own child" reads as an absolute, but a manual move is allowed to break a hard rule.** The Coaches section in `app-spec.md` states the pairing as something that simply cannot be otherwise, while Manual changes in `allocation-rules.md` says a manual move can break a hard rule, and that this should be allowed and shown. Can an admin move a coach away from their child by hand?

**Answered.** The absolute reading applies to the allocation engine, which never places a coach away from their child. An admin can still move one by hand, and it is treated like any other hard-rule break — allowed, and shown to the admin with the same warning.

**Superseded by the decision recorded at item 23.** Moving one of a coach and child pair now moves the other with it, so a manual move never splits them.


**42. Squad and station were the same word.** The specs defined the thing the allocation produces as "one station at a training session", while the prototype labelled them Station 1, Station 2 and so on. Two different things were sharing one name: the set of children who stay together, and the spot on the pitch they walk to.

**Decided.** Renamed throughout both specs. A **squad** is what the allocation produces: a set of children and coaches who stay together for the session. A **station** is a fixed spot on the pitch with a drill set up at it. Squads rotate around the stations on a whistle until every station has been visited, and coaches travel with their squad rather than staying at a station. The app allocates squads and shows the pitch layout; what happens at each station is the coaches' business.

## Gaps that block a build

**12. Min/max players per group and min coaches per group are all TBC** — the entire group-count derivation depends on them. Are they set per team, per event, or per event type, and who sets them?

**Answered (allocation-rules.md, "Settings"; app-spec.md, "Team settings"), apart from two numbers.** They are team settings, set per team by an admin because turnout and age change what works, and overridable on a single event — an override applies to that event only and never changes the team's settings. Defaults are now: maximum groups 10, minimum coaches per group 1, coach-to-child ratio 1:8, with the older age groups running 1:10. Max players per group no longer exists; the ratio and the target size replace it. Target group size and minimum group size are still TBC and are now the only two numbers outstanding — the specs record that they need the club.

**Updated.** Target squad size now defaults to 8, and the new maximum squad size defaults to 12. Both are working defaults rather than club decisions. Minimum squad size is still outstanding, so all three want settling together rather than one at a time.

**13. Does allocation apply to matches at all?** A group is "one station at a training session, or one team at a match". Those aren't the same constraint: a match squad size is fixed by the code (e.g. Go Games sides), not by an admin's min/max. Does an admin set the group count directly for games?

**Decided.** The allocation applies to matches and blitzes as well as training. A go-games squad is a group with a fixed size, set through the per-event settings override, and all the same rules apply.

**14. The derivation always produces the maximum permitted number of groups.** Taking the lowest ceiling and clamping up to the floor means 30 players with min 5 / max 12 and 12 coaches gives six groups of five, not three of ten. Is "as many small groups as the coaches allow" the intent, and can the admin override the number?

**No longer applicable.** The floor-and-ceiling arithmetic it describes has been replaced — the group count is now the one landing closest to the target group size within the maximum, and an admin can override it on an event.

**15. Tiny or lopsided turnouts are undefined.** Four players with a minimum of five gives a ceiling of zero groups and a floor of one. Zero coaches, or one player, likewise. What should happen?

**No longer applicable.** The new "When the rules can't all be met" section covers this — an unsatisfiable turnout is reported to the admin with the rule that fails and a suggested fix, and treated as a normal bad night rather than an undefined state.

**16. A coach with two children in the same age group can't be in both their groups.** Twins and same-age siblings are common. Which child wins, or does the admin resolve it?

**Decided.** All of a coach's children in that team go into their group, twins and same-age siblings included.

**Updated.** This now depends on the coach-with-own-child setting recorded at item 46. With the setting on, all of a coach's children in that team go into their squad, as decided above. With it off, a coach isn't tied to any of their children and the question doesn't arise.

**17. Precedence between step 1 and the school-affinity floor is undefined.** Coaches' children are placed first, before the mode is applied, so a coach's child can land as the only one from their school in that group. Does the affinity floor get to move them afterwards, or does the coach spread win?

**Decided.** Coach placement beats school affinity. A coach's child may end up the only one from their school in that group, and that is accepted rather than corrected.

**18. Precedence between "sizes as even as possible" and "schools spread as evenly as possible" is undefined.** Both are stated as applying to every allocation and they routinely conflict. Which yields, or is there a weighting?

**Decided.** Even group sizes and even coach spread come first. School cohorts are fitted inside them.

**19. Missing ability ratings and missing schools.** New child, or a rating nobody has set yet — does balanced ability refuse to run, treat it as a 3, or exclude them from balancing?

**Decided.** A missing ability rating is treated as 3 and flagged to the admin. A child with no school recorded is treated as a singleton for that session, and admins get a list of the children still missing one.

**20. School needs to be a controlled list.** If it's free text, "St Mary's" and "St. Marys" are two schools and the singleton logic silently misfires. Is there a club-level list of schools?

**Decided.** Schools are a controlled list maintained by an admin at club level. Parents pick from a dropdown, which includes an "other" option.

**21. Who is invited to an event?** Always the whole team, or can an admin invite a subset? Are adults invited to every event, or only those flagged as coaching?

**Partly overtaken.** The second half is answered — app-spec.md's "Coaches" section makes the coach flag the thing that gets someone invited to an event as a coach — but whether an admin can invite a subset of the team is still open.

**Decided.** Publishing invites everyone on the team, meaning every child and every flagged coach. The admin can deselect people before publishing.

**22. Availability changes after groups are published.** Someone accepts late or drops out on the morning. Does the app re-run, warn the admin, or do nothing? Does re-publishing re-notify everyone?

**Decided.** The app never re-runs the allocation by itself: it reports who has changed and which rules are now broken, and the admin decides. A re-run keeps everyone where they are and makes the fewest moves that satisfy the rules, and re-publishing notifies only those whose group has changed.

**Superseded.** The allocation now re-runs by itself whenever something changes it, and there is no re-run button. What was decided above — that the app never re-runs on its own and the admin decides — no longer holds. What survives: a re-run makes the fewest moves that satisfy the rules, pinned people stay put, and re-publishing notifies only those whose squad changed. Added: every re-run is announced with what caused it and what changed, so the squads never change silently.

**23. Does moving a child move their coaching parent?** Manual moves are pinned; moving one half of a coach/child pair breaks hard rule 1. Does the app move both, or break the rule and report it?

**Decided.** Moving one of a coach and child pair moves the other with it, and warns the admin. This supersedes the answer recorded at item 41: a manual move can no longer split the pair, though it can still break the other hard rules.

**Updated.** The pair move now depends on the coach-with-own-child setting recorded at item 46. With the setting on, moving one of the pair moves the other, as decided above. With it off there is no pair to hold together and a coach moves on their own.

**24. Recurring event edits.** Does editing or cancelling one occurrence affect the series? What happens to a series when a member is added mid-way?

**Decided.** Recurrence is a convenience at creation only. Each occurrence is independent afterwards, so editing or cancelling one affects no other, and a member added mid-term is invited to the occurrences still to come.

**25. Event end time or duration is never specified** — the calendar subscription needs one.

**Decided.** Events have a duration, defaulting to 1 hour 15 as a team setting and overridable per event.

**26. Exports are referenced in the visibility rules but no export feature is defined anywhere.** What exports exist, and for whom?

**Decided.** There is one export: an admin export of a session's groups, for printing or sharing. It carries names, groups and coaches only, never ratings or schools.

**27. Club-level administration doesn't exist in the role model.** The crest is "set once at club level", but there's no club admin. Who creates teams, and who appoints the first Team Admin of a new team?

**Decided.** A Club Admin sits above the teams. They create teams, appoint the first Team Admin of each, and maintain the crest, the school list and the venue list.

**28. Last-admin protection.** A team must always have at least one admin — what stops the only admin from removing themselves or deleting their account?

**Decided.** A Team Admin cannot remove themselves or close their account while they are the only admin of a team, and a Club Admin can always appoint a replacement.

**29. Removing a member.** What happens to their past availability responses and historical group placements?

**Decided.** Removing a member is a soft removal. Past events keep their record intact and the member stops appearing in anything future.

**30. Member CSV import is in Notes, not scope.** Given Teamer has no export and closes 5 October 2026, is it in?

**Decided.** In scope. The member CSV import moves out of Notes and into the spec, matching the one for events.


**43. The coach count the squad count is derived from.** The rules derived everything from the coaches who accepted. But a coach who accepts on a night their own child isn't attending cannot be placed anywhere, because a coach only ever goes in their own child's squad — so the number who accepted and the number who can actually coach are two different numbers.

**Decided.** A coach in that position stands down for the session. The squad count, the ratio and the minimum coaches per squad are all worked out from the coaches who can actually coach. Twelve acceptances with one of their children declining is eleven coaches for every rule in the file. The admin is told who stood down and why, and shown both numbers so the gap is never a surprise.


**44. An admin could not fix a member's details.** Nothing in the spec let an admin correct a name, a school, a rating, an email or a phone number, and the registered-member rule explicitly put a signed-up adult's details beyond their reach.

**Decided.** An admin can edit a child's name, school and rating, and an adult's name, email and phone. This holds whether or not the adult has registered. See the update recorded at item 5, which this reaches past.


**45. The parent's side of an invitation was never specified.** The specs covered publishing, the three availability statuses and decline reasons, but never described the email a parent actually receives or the screen they answer on — which is the most-used screen in the app and the only one some parents ever see.

**Decided.** Publishing sends each parent an email naming their child and carrying the event type, date, start and end time, meet time and venue, with an accept button and a decline button. Both open the same phone-first page: it shows the event, asks whether that child can make it, takes an acceptance in one tap, and asks a declining parent for a reason in a single field with a line saying only the team admin sees it. Answering re-runs the allocation straight away. A parent can change their answer afterwards, as often as they need, up to the event itself.


**46. Coach-with-own-child was an unconditional hard rule.** It forced every coach into their own child's squad with no way to turn it off, which also forced the stand-down: a coach whose child was absent could not be used at all, however short the session was of adults.

**Decided.** It becomes a team setting, defaulting to on. **On**, it behaves exactly as specified, stand-down included. **Off**, coaches are spread evenly wherever they're needed, nobody stands down, and a coach can take a session their own child misses. It is a team setting rather than a fixed rule because the answer differs by age group. This makes items 16, 23 and 41 conditional on the setting.


**47. Events had a list view and a calendar view, and no season view.** Nothing said what an admin or a parent sees when they want the shape of the term rather than one night.

**Decided.** A season calendar: every event of the season in date order, grouped by month, with the next upcoming event open by default because it is the one being asked about. Drafts appear on it marked as drafts and visible to admins only. A cancelled event stays on the calendar with its reason.


**48. An adult with children in two age groups could see both teams, with no way to move between them.** The spec said they "see both" and stopped there.

**Decided.** They can switch between those teams from anywhere in the app.


**49. Publishing sent an email and nothing else,** in clubs that in practice run on WhatsApp group chats.

**Decided.** Publishing sends the invitation email and also offers a WhatsApp share link carrying the same content for the team's group chat. Email is the record that reaches everyone; WhatsApp is the nudge. The link is a share and not a second channel: no response comes back through it and nothing is tracked through it, so it doesn't disturb the single-channel decision recorded at item 6.


**50. Adults were players by default.** The Roles section opened with "Everyone is added as a player by default", which made every parent a player of an under-9 team.

**Decided.** Adults are never players. An adult's role is Team Admin, Event Manager, or nothing at all, and nothing at all is the normal case for a parent. The default player role for adults is removed. Children are players.


**51. Parents receive a session plan and a pitch layout diagram, and neither is specified.** Alongside their child's squad, a parent gets a plan of the activities for the session and a simple diagram of the pitch. Nothing in either spec describes what is in them.

**Recorded as a known gap, not decided.** The session plan is the club's to define rather than the app's: what goes into it is a coaching decision, and the app's part is carrying it to parents. The pitch layout diagram shows where the stations are and the route squads take between them, but what it has to show, and whether it is drawn per event or per venue, is undecided. Both need the club before either can be built.

## Things I'd have to invent to build it

These aren't underspecified so much as absent — if you don't answer them I will pick something and it will be a guess:

**31. Platform and stack.** Push notifications imply native apps or web push; nothing states iOS/Android/web, or whether this is one deployment for one club or multi-tenant.

**Proposed, not yet decided.** A mobile-first responsive web app, installed to the home screen as a PWA, with Web Push for notifications and email as the second channel. It fits the constraints directly: no app store, parents on phones, and one club means one small deployment with no per-platform release cycle. The caveat worth knowing before this is signed off is that web push on iOS only works once the parent has added the site to their home screen, so a share of the club will be on email alone until they do — which matters because notifications are the point of the app.

**Updated.** Push is out of the first release, so the iOS home-screen caveat above doesn't apply to it — email carries every notification. The PWA pick stands, and it is the reason the architecture should keep the channel behind one sending path so push can be added later without a rewrite.

**32. Authentication.** Email and password, magic link, social sign-in? Password reset, and how a signup gets matched to an existing unregistered member.

**Proposed, not yet decided.** Email magic links, no passwords. Signup already has to match an email address against an existing member record, so proving control of that address is the entire job, and an admin-added member becomes registered the first time they follow a link sent to the address on their record. It also avoids storing passwords and fielding reset requests for a volunteer-run club, and suits phones shared between parents. Sessions should be long-lived so parents aren't re-authenticating every time. The caveat is that it puts sign-in on the same email deliverability that the notifications already depend on.

**33. The balanced-ability objective function.** "Ratings spread evenly" has several reasonable implementations — equalise each group's mean, snake-draft by rating, or equalise the count of each rating value per group. They give different answers.

**Decided.** Balanced ability spreads the ratings in this order: the 1s first, then the 5s, then the 2s, then the 4s, then the 3s fill the remaining places. No group needs one of every rating. Banding was considered and parked, because banded groups make a child's rating readable by any parent who can see who else is in the group.

**34. Player of the Game entirely.** Who votes (parents, children, coaches), one vote per person or per account, whether you can vote for your own child, when voting opens and closes, whether results are public, and what happens on a tie.

**Decided.** Player of the Game is removed from the spec entirely.

**35. CSV schemas** for both the event template and any member import, plus validation and partial-failure behaviour on a bad row.

**Partly decided.** A CSV import is validated as a whole: nothing is imported until the file is clean, and errors are reported by row number. This applies to both the event and member imports. The column definitions for either template are still not specified.

**36. Chaser and reminder scope.** Is the 24-hour reminder toggle per event or per team? Does it go to everyone or only non-responders? Is there a limit on manual chasers?

**Decided.** The automatic 24-hour reminder is a team setting, on or off, and goes only to people who haven't responded. Manual chasers are per person with no limit.

**37. Whether an admin override of someone's status is visible to that person,** and whether an overridden "accepted" feeds the allocation identically to a real one.

**Decided.** An admin override of someone's status is visible to that person, shown as set by an admin, and feeds the allocation exactly like a real response.

**38. What parents see of a group beyond their own child** — the other children's names, or only the coaches.

**Decided.** A parent sees their child's group, the coaches for it, and the names of the other children in it.

**39. Data protection.** Nothing addresses consent, retention, or subject access for children's records — including an ability rating that is explicitly hidden from the child's own parents. For a club handling young children's data this needs a decision before launch, not after.

**40. Timeline.** Teamer closes 5 October 2026, which is under four weeks away. The scope above is considerably more than that allows, so I'd assume a cut-down first release — which of these is genuinely needed by 5 October versus later?

**Decided.** The first release covers teams and members, creating and publishing events, availability, and group allocation. Everything else waits.

**52. The club's visual identity and any accessibility floor.** Nothing specified colours, where branding lives, or any contrast standard — the crest was mentioned once, as something a Club Admin maintains.

**Decided.** The crest and the club colours live in one place and are used from there, so changing them is one change rather than a hunt. All text meets WCAG AA contrast — 4.5:1 for body text, 3:1 for large text and interface controls — in both light and dark mode. That is a floor rather than an aspiration: a colour that cannot carry text at that contrast is used as a fill and not as text.

---

Items **1** and **2** are answered, and **12** is down to one number: the minimum squad size, plus confirmation of the 8 and 12 that are currently working defaults rather than club decisions.

The three I'd want answered before anything else now are **12** (that minimum, which the allocation still can't run without), **39** (data protection — the only item here with nothing recorded against it at all) and **51** (the session plan and the pitch layout diagram, which need the club before either can be built).

Two others are less urgent but not settled: **31** and **32** hold proposals rather than decisions, and **35** still has no column definitions for either CSV template.
