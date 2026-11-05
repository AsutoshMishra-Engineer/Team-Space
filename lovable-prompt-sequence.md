# Prompt Sequence for Lovable — Paste One at a Time

Rule for using this: **paste one prompt, wait for it to finish, click through the result yourself, THEN paste the next one.** Never paste two prompts back to back without testing in between — that's how bugs stack up and become hard to fix.

Before Prompt 1, attach or paste your full `team-workspace-spec.md` file into the chat.

---

## Prompt 0 — Orientation (do this first, before building anything)

```
I'm attaching my full project specification. Read the entire document first.
Do not build anything yet. Just reply back with a short summary in your own
words of the User ID format, the Team Code format, and the difference between
a "Pending" invite and an active "Member." I want to confirm you understood
it correctly before we start.
```

Check its summary against your spec. If it got something wrong, correct it in plain words before moving on.

---

## Prompt 1 — Landing Page

```
Build the landing page only. It should have the site name at the top and two
buttons: "Login" and "Register." Clicking either button should go to a
placeholder page for now — we'll build those next. Keep the design clean and
simple.
```

---

## Prompt 2 — Registration

```
Now build the Register page, following Section 3.1 of my spec exactly:
- Fields: email and password (password minimum 8 characters)
- If the email is already registered, show the error exactly as written in
  the spec and do not create a second account
- Send a verification email; the account should not be usable until the
  link is clicked
- After verification, automatically generate a User ID in the exact format
  NNNLLNN (3 numbers, 2 uppercase letters, 2 numbers), checking it isn't
  already used and generating a new one if it is
- Show the final User ID on screen once, and also send it by email
```

---

## Prompt 3 — Login

```
Now build the Login page, following Section 3.2 of my spec:
- Both a User ID field and a password field are required
- If the User ID doesn't exist, show the exact error from the spec
- If the User ID exists but the password is wrong, show the exact error
  from the spec
- Add a "Forgot Password" link (email in, reset link out) and a separate
  "Forgot User ID" link (email in, User ID emailed back) — these are two
  different flows, don't combine them
- On success, take the user to the Workspace (My Teams screen) — build that
  as an empty placeholder for now
```

---

## Prompt 4 — My Teams Screen

```
Now build the "My Teams" screen from Section 4 of my spec:
- Shows a list of every team the logged-in user belongs to, with the team
  name and their role (Leader or Member)
- Two buttons always visible: "Create a Team" and "Join a Team"
- If they have no teams yet, just show the two buttons and an empty list
```

---

## Prompt 5 — Create a Team

```
Now build the "Create a Team" flow from Section 5.1 of my spec:
- Form fields: Team Name, Project Idea, and optional boxes to type in User
  IDs of people to invite right away
- On submit: create the team, make this user the Leader, add each valid
  invited User ID to an "Invited List" with status Pending (not yet active
  members) — show an error next to any invalid ID without stopping the rest
- Generate a Team Code in the exact format NNNLL, checking for duplicates
  the same way as the User ID
- Show the Team Code on screen so the Leader can share it
```

---

## Prompt 6 — Invite / Manage Members

```
Now build the "Manage Members" panel from Sections 5.2 and 6.1 of my spec,
visible only to the Leader:
- A box to type a User ID to invite — apply the exact checks from Section
  5.2 (ID must exist, must not already be invited or a member) and add
  valid ones to the Invited List as Pending
- A way to remove any person (Pending or active Member) from the team —
  removing does not delete their account, only removes them from this team
- The member list should show each person's status: Pending or Member
```

---

## Prompt 7 — Join a Team by Code

```
Now build the "Join a Team" flow from Section 5.3 of my spec:
- A single box asking for the Team Code
- Check in this exact order: (1) does the code belong to a real team, (2)
  is this logged-in user's own User ID on that team's Invited List — if not,
  show the exact rejection error even if the code was correct, (3) are they
  already an active member — show that error if so
- If all checks pass, change their status from Pending to active Member and
  take them straight into that team's workspace
```

---

## Prompt 8 — Team Workspace Shell

```
Now build the main Team Workspace screen from Section 6 of my spec:
- A "Back to My Teams" link/button always visible
- Team Info Bar showing: Team Name, Project Idea, and (Leader only) the
  Team Code with a copy button, plus the member list with statuses
- Leave this page ready for the Announcements and Files sections we'll add
  next
```

---

## Prompt 9 — Announcements

```
Add the Announcements section from Section 6.2 of my spec to the Team
Workspace:
- A feed, newest at the top, showing message text, optional deadline date,
  and who posted it and when
- Only the Leader sees a box to post a new announcement
- Members can view the feed but cannot post
```

---

## Prompt 10 — Team Chat

```
Add the Team Chat section from Section 6.3 of my spec to the Team Workspace:
- One shared chat for the whole team (not private one-to-one messages)
- Any team member (Leader or Member) can post a message
- Each message shows the text, sender, and time sent, oldest at top
- Messages update on page open/refresh — it does not need to update live
  while the page sits open
- No editing or deleting messages once sent
```

---

## Prompt 11 — Shared Files

```
Add the Shared Files section from Section 6.4 of my spec to the Team
Workspace:
- A list of uploaded files showing file name, uploader, upload date, and a
  download button
- Any team member can upload a file
- Show a delete button only next to files the current user uploaded, or any
  file if the current user is the Leader
```

---

## Prompt 12 — Leave Team

```
Add the "Leave Team" flow from Section 6.5 of my spec:
- Members can leave at any time — this only removes them from this one team
- If the Leader tries to leave, show the exact warning from the spec asking
  them to delete the team or assign a new leader first — do not allow a
  team to have zero leaders
```

---

## Prompt 13 — Final End-to-End Test (do this yourself, not a prompt)

Register 3 real test accounts (you + 2 teammates, or 3 of your own test emails). Walk through the entire flow manually:
1. Register all 3, note their User IDs
2. One creates a team and invites the other two by User ID (they should show Pending)
3. Each invited person logs in, goes to Join a Team, enters the code — confirm they become active Members
4. Post an announcement as Leader, confirm members can see it but not post
5. Send a few chat messages as different members, confirm everyone sees them after a refresh
6. Upload files as different members, confirm delete permissions match the rules
7. Try leaving as a Member, then try leaving as the Leader — confirm the warning appears

**If anything breaks at any point, describe exactly what happened in plain words** ("I entered the wrong Team Code and it let me in anyway" is a perfect bug report) and paste that back to Lovable as your next prompt — don't try to fix it yourself.

---

## Final Prompt — Publish/Deploy

```
Everything is tested and working. Please deploy/publish this so it's live
on the internet, and give me the URL.
```

That's the whole core build, start to finish. Once it's live, share the URL with your two teammates and have them register for real.

---

## Optional Prompt — Admin Dashboard (only do this later, when opening the site to more people)

```
Now build the Admin Dashboard from Section 7 of my spec. This is a
completely separate area only reachable by accounts marked Admin — not
linked from the normal Workspace navigation. Include:
- A search bar to look up any user by User ID or email, or any team by
  name or Team Code
- A user detail view (email, User ID, verification status, all teams and
  roles) with actions: resend verification, unlock/reactivate account,
  remove account
- A team detail view (name, project idea, Leader, Team Code, full
  member/invite list) with actions: reassign Leader, remove a member,
  delete the team
- A simple activity log recording which Admin did what action and when
Also tell me how to manually mark my own account as Admin directly in the
Supabase database, since this should never happen through the normal
Register page.
```
