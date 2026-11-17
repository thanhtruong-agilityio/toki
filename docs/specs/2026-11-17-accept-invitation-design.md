# Accept an invitation design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/accept-invitation.md (Thanh Truong)
Ticket: TOKI-097

## Goal
An invited person needs to get into Toki from the mail: press Join, land on the code step with the address filled in, type the 6-digit code, and arrive in #general with no welcome step. A person whose invitation cannot be used needs a page that says why, and a person who is signed in as someone else needs to be asked before anything changes. A deactivated person who is invited again must get the same account back.
This ticket builds the Join page and the three public server routes behind it. It reuses the code rules and the session functions of the Sign-in API and the code step of the sign-in screens, and builds only what is new. It targets the web app at every supported width, with the keyboard alone, in English and Vietnamese.

## Scope
- In:
  - The Join page at `/join`: the code step for a usable invitation, the three refusal pages (expired, revoked, not recognised), the hand-over of a used invitation to `/login`, and the question for a person who is signed in as someone else.
  - Three public server routes under `/api/v1/invitations`: look up an invitation, send a new code ("Resend code"), accept with the code.
  - What accepting does to the data: a new account with its display name from the address, or the same account back for a deactivated person; the membership of #general; the session.
  - Three calls in `client-core` and the changes to the guard and the session state that `/join` needs.
  - The English and Vietnamese texts of the page (`join.*`).
- Out (not now):
  - Creating, resending and revoking an invitation, the invitation record and its table, the 7 days, the token and its hash, the Join address, the first code and the invitation mail: TOKI-024. This ticket reads and changes the record only through the three functions of "What this ticket needs from TOKI-024".
  - The code rules (6 digits, 10 minutes, once, 5 tries, hashing), the session functions and the cookie: TOKI-022 (its R49, R29). This ticket calls them and writes none of them again.
  - The mail layer and the mail that carries a new code: TOKI-021 (`sendInvitationCode`). This ticket decides when it is sent.
  - The tables `users`, `login_codes`, `sessions`, `conversation_members`: TOKI-019 and TOKI-028. No table, column or migration is added here. Inserting the account and bringing a deactivated one back: TOKI-024's `acceptInvitation`, called here.
  - The code step component, the sign-in page, the session state and the guard: TOKI-023. This ticket reuses the component and changes the three places listed under "What this ticket needs from TOKI-023".
  - Creating #general and the first Admin: TOKI-020.
  - The grey line "Minh joined" in #general (D-100): not owned by any ticket yet (concern 7). The component that draws such a line is TOKI-042.
  - The card that offers notifications on first entry (F03, F36): TOKI-074.
  - Changing the display name afterwards: TOKI-078. The Admin page that shows the person as Active: TOKI-025.
  - Sign out and the devices list: TOKI-099. Closing realtime connections of an ended session: TOKI-038.
  - Accepting by the token transport for apps (phase 1 is the web app).

## Requirements
A text in quotes is the English text of a key in "Texts", which says for each text whether its wording is decided or proposed (D-139). Words in `code font` are names of the Sign-in API (TOKI-022) unless said otherwise.

Server: look up an invitation
- R1. `POST /api/v1/invitations/lookup` with `{ "token": string }` needs no session and returns status 200 with `state`, one of `open`, `expired`, `revoked`, `used`, `unknown`, and only these other fields: for `open`, `email`, `workspaceName`, `codeExpiresInSeconds` and `resendAfterSeconds`; for `expired` and `revoked`, `workspaceName`; for `used`, `email`; for `unknown`, none. No role, inviter name or id is ever returned (D-081, D-149).
- R2. A `token` that is not exactly 43 characters of the base64url alphabet gives `unknown`, as does a token no invitation has. A missing or non-string `token` returns status 400 with `validation_error`. In both cases nothing is written.
- R3. The state is the one of TOKI-024 R18, worked out in the order `used`, `revoked`, `expired`, otherwise `open`, and is taken from `findInvitationByToken` (TOKI-024 R19). A token that function does not find, a token replaced by a Resend of the invitation included, is `unknown`. A used invitation leads to sign-in whatever else is true (D-081); a revoked one says "ask an admin" even after its 7 days.
- R4. `codeExpiresInSeconds` is 600 minus the age of the latest code of the invitation, rounded up, and not below 0; `resendAfterSeconds` is 60 minus that age, rounded up, and not below 0. The age is read from `codeIssuedAt`, which `findInvitationByToken` returns (a change TOKI-024 is asked to make) and the clock interface of TOKI-008.
- R5. A lookup creates no session, sets no cookie, creates no code, sends no mail and changes no row, for every state. After a lookup of a `open` invitation, a request to any route that needs a session still answers 401 (D-149; TS-017).

Server: "Resend code"
- R6. `POST /api/v1/invitations/codes` with `{ "token" }` for a `open` invitation gets a new secret from TOKI-024's `nextInvitationCodeSecret` and creates a new invitation code with `createInvitationCode` (TOKI-022 R49), which cancels the earlier unused codes of the address (D-082), and after the answer hands exactly one mail to `sendInvitationCode` with the invitation's address and the 6 digits (TOKI-021 R24). It returns status 200 with exactly `expiresInSeconds` (600) and `resendAfterSeconds` (60). The code from the earlier mail then answers `code_expired` (D-082, D-136).
- R7. A request made less than 60 seconds after the latest code of that invitation, the code of the invitation mail included, returns status 429 with `code_resend_too_soon`, `details.retryAfterSeconds` (whole seconds, rounded up, at least 1) and the header `Retry-After` with the same number. It creates no code and sends no mail. At exactly 60 seconds it is accepted (D-038, D-082).
- R8. For an invitation that is `expired`, `revoked` or `used` the answer is status 409 with the code `invitation_expired`, `invitation_revoked` or `invitation_used`; for an unknown token, status 404 with `invitation_not_found`. No code is created and no mail is sent (D-081, D-131).
- R9. When the mail layer fails or never answers, the response of R6 is unchanged and the mail layer's own log line records the failure (TOKI-021 R14). This module adds no log line with the address or the code (concern 4).

Server: accept
- R10. `POST /api/v1/invitations/sessions` with `{ "token", "code" }` with the right code for a `open` invitation returns status 200 with `user` (the shape of TOKI-022 R32) and `generalConversationId`, the id of #general, and creates one session through `createSession` (TOKI-022 R29) with the cookie transport. The cookie has the name and attributes of TOKI-022 R21. The body holds no token (D-083, D-034).
- R11. The checks run in this order, and each stops the request: unknown token (404 `invitation_not_found`); `used`, `revoked`, `expired` (409, as R8); then the code. A refusal of the first group uses up no try (D-136, D-137).
- R12. The code is checked with `checkInvitationCode` (TOKI-022 R49), with the secret of R20. The answers are those of TOKI-022 R12 to R16, with the same status and `details`: `code_incorrect` with `triesLeft` (4 to 1), `code_locked` after the 5th wrong try, `code_expired` for a code that is 10 minutes old or more, was used, was cancelled by a newer code or does not exist (D-136, D-137).
- R13. A `code` that is not exactly 6 digits, or a missing `token`, returns status 400 with `validation_error` and does not count as a wrong try.
- R14. An address with no account gets a new account through TOKI-024's `acceptInvitation`: `status` `active`, `role` the invitation's role (D-153), `language` `en` (D-018, D-180), and `display_name` the part of the address before the `@`, as stored (lower case), which has at most 64 characters (TOKI-020 R16) and so fits the 80 of D-033 (D-150).
- R15. An address whose account is `deactivated` gets that same account back through `acceptInvitation`: the same `users.id`, `status` `active`, `role` the invitation's role (D-181, D-094). Its display name, language and memberships are not changed, and no second account is created (TOKI-024 R20; TS-104).
- R16. When `acceptInvitation` refuses with its typed error, because the invitation was used or revoked or ran out between the check of R11 and the call, or its token was replaced, the answer is 409 `invitation_used`, `invitation_revoked` or `invitation_expired`, or 404 `invitation_not_found`, no account is changed, no member row is added and no session is created.
- R17. In the same transaction as `acceptInvitation`, the person is made a member of #general by `addMemberToGeneral` of the `conversations` module, which returns the id of #general; a person who already is a member gets no second row and no other change (D-034, D-100; TS-022).
- R18. An invitation is used at most once. When two accepts with the right code arrive at the same time, exactly one account change, one membership row and one session result (TOKI-024 R20: exactly one call succeeds); the other gets the answer of R16 or, when it fails at the code, `code_expired`.
- R19. Every partial failure leaves the person able to go on. When the transaction of R17 fails, it is rolled back, the invitation is still open and unchanged, the code is used up, and the person asks for a new code. When the session cannot be created after the transaction committed, the answer is status 500, the invitation is used and the account is active, and a later look-up answers `used`, which leads to the normal sign-in (R34).
- R20. The secret passed to the code functions is the `codeSecret` of `findInvitationByToken` (TOKI-024 R11: the token, a dot and the invitation's `code_seq`). It is never stored by this ticket; a code is therefore bound to the token that was in the link, and a new code has a new secret so that `request_hash` stays unique (TOKI-019 R14). The token of another invitation, or the digits mailed for another address, give `code_incorrect`.
- R21. When the request carries a valid session cookie, that session is ended with the reason `replaced` and the cookie is replaced, as for TOKI-022 R34. When the cookie belongs to a deactivated account (TOKI-022 R27) nothing is ended and the new cookie replaces it.
- R22. The three routes apply the rules of TOKI-022 R45 and R46: a body that is not `application/json` returns 415 `unsupported_media_type`, and a `POST` from another origin returns 403 `origin_not_allowed`, both changing nothing; no response carries an `Access-Control-` header.
- R23. The three routes answer without a session and no other route becomes public. None of them is a `GET`, and none creates a session without a correct code (D-149, D-157).
- R24. No log line and no error body of this module holds the token, the code, a secret or the address. The request and response bodies of the three routes are Zod schemas in `packages/shared/src/invitations/schemas.ts`, which the routes validate with and the web app uses; the token shape of R2 is one constant there.

Web: the Join page
- R25. `/join/$token` is a route of the root route outside the app layout, as `/login` is (TOKI-015 R30). A person with no session and a person with a session both reach it: the guard of TOKI-023 does not send either to `/login` or to the app. While the session is being read, the page shows the page background only (TOKI-023, "Checking the session").
- R26. The token is the last segment of the address, `/join/<token>`, the form TOKI-024 builds (its R11). A token that fails the shape of R2, or an address `/join` with no token, shows the page of R35 for an unrecognised link without any request. The token is sent to the server only in a request body, never in a path or a query string of an API call (TOKI-024, contract; TOKI-004 R7 logs paths).
- R27. For a `open` invitation the page shows the card of TOKI-023 (logo, workspace name from the lookup) and its code step: the heading 'Check your email', the address from the lookup, the line 'The code works for 10 minutes', the code field with the focus, 'Sign in' if the step has it, 'Resend code' and 'Use a different email' (D-149, D-082). Nothing else is added, and no welcome or other step follows (D-083). The link 'Use a different email' goes to `/login` and sends no request.
- R28. Opening the Join page makes no request to a code or accept route. Only the session read of TOKI-023 and the lookup are sent. Closing the page and opening Toki again leaves nobody signed in (D-149; TS-017).
- R29. 'Resend code' is disabled for `resendAfterSeconds` of the lookup and enabled from then on; when `codeExpiresInSeconds` is 0 the step opens in the expired state of TOKI-023 R18 ('This code has expired' and 'Send a new code'). The wait after a request is `resendAfterSeconds` of its answer, counted by elapsed time with the clock interface (TOKI-023 R12).
- R30. Pressing 'Resend code' or 'Send a new code' sends R6. On 200 the field is emptied and enabled, any message is removed and the wait starts again (TOKI-023 R13). `code_resend_too_soon` does what TOKI-023 R37 says. 409 and 404 switch to the page of R33 to R35. A lost connection and a failure show the messages of TOKI-023 R21 and R22 and keep what was typed.
- R31. The 6th digit sends the code once, with nothing more to press, to R10; fewer than 6 digits send nothing (TOKI-023 R9, R10, R36). `code_incorrect` shows 'That code is not right. N tries left.', `code_locked` 'This code is locked. Ask for a new one.', `code_expired` 'This code has expired' with 'Send a new code', exactly as TOKI-023 R16 to R18 say. The three refusal states of R8 switch to the page of R33 to R35.
- R32. On 200 the app opens at `/c/<generalConversationId>` and replaces the history entry of the Join page, so that Back does not return to it. No other step is shown in between (D-083). Until the conversation route exists (TOKI-033), the address is reached and shows the page for an unknown address; the test of the address does not depend on that page.
- R33. On 200 the session state of TOKI-023 becomes `signedIn` with the returned `user`, whatever the state was before. When the state was `signedIn` with another person, the data the web app holds in memory for that person is cleared before the app opens, so that nothing of the earlier person is shown (D-080, D-132).

Web: the other states
- R34. A `used` invitation replaces the Join page with `/login`, with the address from the lookup filled in through the router's navigation state, never in the address (TOKI-023, "Filled-in email"). It shows no refusal page and no code step (D-081; TS-020). With a session, `/login` then shows the app (TOKI-023 R2).
- R35. An `expired` invitation shows the page with the heading 'This invitation has expired' and the line 'Ask the person who invited you for a new one.'. A `revoked` one shows 'This invitation is no longer valid' and 'Ask an admin.'. An `unknown` one, a token that fails the shape and 404 `invitation_not_found` show 'This link is not valid'. The first two show the logo and the workspace name; the third shows the logo only, and the page holds no name of the workspace anywhere (D-081; TS-016, TS-019). None shows a code field or a button that signs anyone in.
- R36. When the invitation is `open` and the session state is `signedIn` with an address other than the invitation's, the page shows, before the code step, the question 'You are signed in as {current}. Sign out to continue as {invited}?' with two buttons: 'Sign out and continue' and 'Stay signed in' (D-080; TS-021). Both addresses are shown as addresses. Nothing is sent and nothing changes while the question shows. 'Stay signed in' replaces the page with `/` and sends no request; the person stays signed in and the invitation stays valid. 'Sign out and continue' shows the code step of R27; the session of the person ends when the code is accepted (R21). With the same address as the invitation there is no question and the code step shows.
- R37. When the session read answers 401 `account_deactivated` on `/join`, the page treats the browser as having no session: the modal of TOKI-023 R26 is not shown on this page, and the code step shows. After the code is accepted the new cookie replaces the old one (R21). Reason: a deactivated person who is invited again usually still holds the cookie of the old account (decided in this spec; concern 1 of TOKI-023 is not touched).
- R38. A deactivated person who is invited again sees the same page as everyone else: nothing on it says the account was deactivated, and nothing tells a new person from a returning one (D-094).

Web: every state
- R39. Every text comes from the `i18n` package and exists in English and Vietnamese; no component holds a literal text, and the missing-translation check passes (D-018, D-064). The page shows the language and look that `i18n` and `tokens` report as active, as the sign-in page does (TOKI-023, concern 3).
- R40. At 360 x 560, 719, 720, 1099 and 1100 px wide, the code step, each refusal page and the question show with nothing clipped, no sideways scrolling and every control reachable; under 720 px every control is at least 40 px tall (D-068, D-054).
- R41. The page can be used with the keyboard alone and nothing needs hover (D-067). The focus starts in the code field on the code step and on the heading on a refusal page and on the question; the heading takes the focus without being a tab stop. A disabled button is skipped by Tab. The tab order of the question is 'Sign out and continue', 'Stay signed in'.
- R42. The page is drawn only with the tokens and base components, and shows correctly in Calm and in Focus. It adds no base component.
- R43. The address and the code never appear in the address bar or in browser storage, and the token is never written to browser storage. The token appears only in the address of the page and in request bodies; the page loads nothing from another origin and makes no request with a token in its path or query string. The code is never written to the console.

## Design
### Who does what
| Part | Client or server | Owner |
| :---- | :---- | :---- |
| The three routes of "API", the transaction that accepts, the #general membership, the landing id | Server | This ticket |
| Inserting the account or bringing a deactivated one back, marking the invitation used | Server | TOKI-024 (`acceptInvitation`), called here |
| The code rules, hashing, wrong tries, the 10 minutes, the single use | Server | TOKI-022 (R49), called here |
| Creating the session and the cookie, ending the replaced session | Server | TOKI-022 (R29, R34), called here |
| The invitation record, its token, its 7 days, revoke, the first code, `code_seq`, the Join address | Server | TOKI-024 |
| The mail of a new code | Server | TOKI-021 writes it; this ticket sends it |
| The page, the refusal pages, the question, the three calls | Client | This ticket |
| The code step, the card, the field, the waits, every message of the code | Client | TOKI-023, reused |
| The session state and the guard | Client | TOKI-023; this ticket changes three places |

### Data model
No table and no column is added by this ticket. It writes `conversation_members` (one insert, through `addMemberToGeneral`) and nothing else directly; `users` and the invitation are written by `acceptInvitation` (TOKI-024), `login_codes` and `sessions` by the `auth` module (TOKI-022).

### API
| Method | Path | Session | Purpose |
|---|---|---|---|
| POST | `/api/v1/invitations/lookup` | none | Tell the state of an invitation and what the page needs |
| POST | `/api/v1/invitations/codes` | none | Send a new code ("Resend code") |
| POST | `/api/v1/invitations/sessions` | none | Accept: check the code, open the account, start the session |

Shapes (JSON):
- Lookup request `{ "token": string }`. Response 200: `{ "state": "open", "email", "workspaceName", "codeExpiresInSeconds", "resendAfterSeconds" }`, `{ "state": "expired" | "revoked", "workspaceName" }`, `{ "state": "used", "email" }` or `{ "state": "unknown" }`.
- Codes request `{ "token": string }`. Response 200: `{ "expiresInSeconds": 600, "resendAfterSeconds": 60 }`.
- Sessions request `{ "token": string, "code": string of 6 digits }`. Response 200 with the cookie: `{ "user": User, "generalConversationId": string }`. `User` is that of TOKI-022.
- Every error: `{ "error": { "code", "message", "details"? } }` (TOKI-004).

The lookup answers 200 for all five states because it asks "what is this link", and each answer is a normal one. The two other routes answer an unusable invitation with an error, because the person asked to do something that cannot be done. The client decides by `error.code`.

### Outcomes and what the person sees
| Call | Status | `error.code` / state | What the person sees | Requirement |
| :---- | :---- | :---- | :---- | :---- |
| Lookup | 200 | `open` | The code step; the question first when R36 applies | R27, R36 |
| | 200 | `expired` | 'This invitation has expired' page | R35 |
| | 200 | `revoked` | 'This invitation is no longer valid' page | R35 |
| | 200 | `used` | `/login` with the address filled in | R34 |
| | 200 | `unknown` | 'This link is not valid' page | R35 |
| | 400 | `validation_error` | The same page as `unknown` (not reachable from a correct page) | R2, R35 |
| | none, 5xx | | Messages and retry as TOKI-023 R21, R22 for the page: the card without a step and the general failure message; the person reloads | concern 4 |
| Codes | 200 | none | The step, emptied, with a new wait | R30 |
| | 429 | `code_resend_too_soon` | No change; the control waits `retryAfterSeconds` | R30 |
| | 409 | `invitation_expired`, `invitation_revoked`, `invitation_used` | The page of that state (`used`: `/login`) | R30 |
| | 404 | `invitation_not_found` | 'This link is not valid' page | R30 |
| Sessions | 200 | none | The app at `/c/<id>` | R32 |
| | 400 | `code_incorrect`, `code_locked`, `code_expired` | The messages of TOKI-023 | R31 |
| | 409, 404 | as Codes | The page of that state | R31 |
| | 500, none | | The messages of TOKI-023 R21, R22; what was typed stays | R31 |

A 401 does not occur on these routes. The failure row of the lookup is a proposal for the behaviour: the log has no text for it (concern 4).

### How the parts run
How a lookup runs: validate the shape (R2); `findInvitationByToken(db, token)` (TOKI-024 R19) gives the state, the address and the code's time; read the workspace name through the `workspace` module's read function (TOKI-022, Module boundaries); compute the two times (R4); answer.

How "Resend code" runs: look up as above; refuse an unusable state (R8); call `nextInvitationCodeSecret(db, invitationId)` (TOKI-024 R19), which refuses inside 60 seconds of the latest code and otherwise returns the new secret and sets the time of the latest code, under a lock on the invitation row (R7); create the code with `createInvitationCode(email, secret)`; answer; after the answer, `sendInvitationCode`. Decided in this spec: the 60 seconds are held here and not in `auth`, because TOKI-022 R49 applies no request limit (its concern 4) and the invitation is TOKI-024's; they are held in the one function that takes the lock, so two requests cannot both pass.

How an accept runs:
1. Validate and find the invitation; refuse an unusable state (R11).
2. `checkInvitationCode(codeSecret, digits)`. The right digits mark the code used (TOKI-022).
3. One transaction: `acceptInvitation(tx, token)` (TOKI-024 R20: used, account inserted or brought back); `addMemberToGeneral(tx, ...)` (R17). A typed refusal from `acceptInvitation` rolls the transaction back (R16).
4. After the commit: end the replaced session if there is one (R21), create the session with `createSession`, set the cookie and answer with the user and the id of #general.

Decided in this spec: the code check comes before the transaction and the session after it, because the `auth` functions run their own transactions and take none from a caller. Each failure leaves a way on (R19): a failure in step 3 leaves the invitation open and the person asks for one more code; a failure in step 4 leaves an active account and a used invitation, and the person signs in by the normal code. The cost is at most one extra code. Passing one transaction through the `auth` functions would need two changes in the TOKI-022 spec.

How the page runs: the route reads the token from the path (R26), asks the session state of TOKI-023 for the session (`unknown` shows only the page background), then does the lookup once. The lookup is done again after a reload. It then picks one of: code step (with the question first when R36 applies), refusal page, `/login`.

### Screens
1. **Code step.** The card of TOKI-023 and its code step, as in "Standing of the texts" of that spec. The only differences from the sign-in code step: the workspace name and the address come from the lookup; the waits start from the lookup (R29); 'Resend code' and the send action call the routes of this ticket; there is no stored record of the step (the token in the address is what a reload uses); the expired state can show on opening.
2. **Refusal page** (expired, revoked, not recognised). The same card: logo, workspace name where R35 says, one heading, one line (none for 'This link is not valid'). No button, no field. Decided in this spec: no link back to sign-in, because no wording for it is decided (concern 2); the person has the address of Toki.
3. **The question.** The same card: logo, workspace name, the heading with the question, the two buttons stacked, the first primary. It is shown only for a `open` invitation.
4. **Checking.** The page background only, until the session read and the lookup have answered.

### States of the Join page
| State | Shown | Leaves when |
| :---- | :---- | :---- |
| Reading the session or the invitation | Page background only | Both answered |
| Open, signed in as another | The question | A button is pressed |
| Open | Code step | Right code; a refusal state; 'Use a different email' |
| Expired, revoked, not recognised | Refusal page | Not applicable |
| Used | `/login` | Not applicable |
| Signed in | The app at `/c/<id>` | Not applicable |

### Texts
Namespace `join`. The code step, its messages and its buttons reuse the keys `signIn.*` of TOKI-023 and add none. "Decided" means a Confirmed decision states the wording or the prototype's guest sign-in card contains it, the standard of TOKI-023 ("Standing of the texts"); everything else is proposed (D-139). The prototype has no page for a member invitation (a search of `index.html` for the words of D-080 and D-081 finds none).

| Key | English text | Wording | Source |
| :---- | :---- | :---- | :---- |
| `join.notFound.title` | This link is not valid | Decided | D-081 |
| `join.signedIn.question` | You are signed in as {current}. Sign out to continue as {invited}? | Decided | D-080. The journey F03 writes it with A and B; TS-021 with a name; the addresses as values are proposed |
| `join.expired.title` | This invitation has expired | Proposed | D-081 gives the cause and "ask the inviter for a new one" |
| `join.expired.body` | Ask the person who invited you for a new one. | Proposed | D-081, F03 |
| `join.revoked.title` | This invitation is no longer valid | Proposed | D-081 gives the cause and "ask an admin"; F03 "no longer valid" |
| `join.revoked.body` | Ask an admin. | Proposed | D-081, F03 |
| `join.signedIn.signOut` | Sign out and continue | Proposed | D-080 gives the choice, not the buttons |
| `join.signedIn.stay` | Stay signed in | Proposed | D-080; TS-021 "stay signed in" |

Vietnamese (all proposed; D-188 is Open): 'Liên kết này không hợp lệ'; 'Bạn đang đăng nhập với {current}. Đăng xuất để tiếp tục với {invited}?'; 'Lời mời này đã hết hạn'; 'Hãy nhờ người đã mời bạn gửi lời mời mới.'; 'Lời mời này không còn hiệu lực'; 'Hãy liên hệ quản trị viên.'; 'Đăng xuất và tiếp tục'; 'Giữ đăng nhập'. The workspace name and the addresses are data, not translated text.

### Routes and state
- **Path.** `/join/$token`, a child of the root route and outside the app layout, the address TOKI-024 builds (its R11). Decided in this spec: the token is read from the path and sent to the server only in request bodies; the lookup is a `POST` with a body for that reason. The token is therefore in the proxy's access log of page requests and in the address history of the browser (concern 12).
- **Guard.** The guard in the root route of TOKI-023 lets `/join` through for every session state, and the session read on `/join` treats 401 `account_deactivated` as no session (R37). These are two edits of TOKI-023's `__root.tsx` and `session-store.ts` made here, with the tests of TOKI-023 still passing.
- **Session state.** One new row in the state table of TOKI-023: from any state, 200 from the accept call gives `signedIn` with the returned `user`. The accept call goes through the same API client, so a 401 reaches `reportUnauthenticated` as for every call; none is expected.
- **Calls.** `client-core` gets `lookupInvitation(token)`, `resendInvitationCode(token)` and `acceptInvitation(token, code)`, using the shared schemas. They send no `transport` and read no token.
- **Landing.** `generalConversationId` from the answer, `/c/<id>`, the address of Home for a conversation (TOKI-015 R30).
- **Filled-in email for a used invitation.** The navigation state of TOKI-023 for `/login`.
- **Cleared data.** `acceptInvitation` clears the Query client's cache when the earlier state held another person, before it opens the app (R33).

### What this ticket needs from TOKI-022
These are its names; the changes to that spec are listed here and not made here.
- `createInvitationCode(email, secret)` and `checkInvitationCode(secret, digits)` (its R49 and Layout), with the answers of R12. `checkInvitationCode` must report `incorrect` with the tries left, `locked`, `expired` and `ok` as separate results.
- `createSession(account, "cookie")` (its R29).
- An exported way to end the session of a request with the reason `replaced`, used by R21; its R34 does this inside its own route only.
- The two rules of its R45 and R46 on the three routes of this ticket, and the three routes as public routes. Its R24 names four routes without a session, so it needs a way for a module to add a public route or a prefix. Until it has one, this ticket adds the three paths to that list in `auth`.

### What this ticket needs from TOKI-024
Plan change: TOKI-097 needs TOKI-024. TOKI-024 owns the invitation and its R19, R20 and "Contract with the accept-an-invitation work" already give three functions; the line is drawn from this side as follows.
- **Who verifies the token.** TOKI-024's `findInvitationByToken(db, token)` hashes the token and finds the invitation. It returns `{ invitationId, email, role, state, codeSecret }`, with `codeSecret` only for an `open` invitation, or `null` for an unknown or replaced token. This ticket takes the state from it (R3) and does not read the table.
- **Who builds the Join address.** TOKI-024 (its R11): `<origin>/join/<token>`, with a token of 43 base64url characters. This ticket serves that address (R25, R26) and defines no builder. The only test that joins the two is the end-to-end one of "Testing".
- **Who makes a new code's secret.** TOKI-024's `nextInvitationCodeSecret(db, invitationId)` adds 1 to `code_seq`. The mail of the first code and of a resend of the invitation is TOKI-024's (`sendInvitationMail`); the mail of a new code is this ticket's (`sendInvitationCode`, TOKI-021 concern 11).
- **Who accepts.** TOKI-024's `acceptInvitation(tx, token)` runs in this ticket's transaction (R14 to R16, R18).
- **Two changes this ticket asks of TOKI-024.** (a) `findInvitationByToken` also returns `codeIssuedAt`, the time of the latest code of the invitation (`sent_at` for the first code, and the time of each call of `nextInvitationCodeSecret` after it), needed by R4. (b) `nextInvitationCodeSecret` refuses inside 60 seconds of `codeIssuedAt`, with the seconds left, under its row lock, and otherwise sets `codeIssuedAt`; it returns `null` for an invitation that is not open (R7).
- **What a Resend of the invitation does to the old link.** TOKI-024 R14 replaces the token, so the old link is `unknown` and shows 'This link is not valid'. Whether that is the right page is concern 3.
- **Reactivation.** TOKI-024 R30 marks the open invitation of a reactivated person as used, so the old link leads to the normal sign-in page and an old invitation cannot change the role of an active member.

### What this ticket needs from TOKI-023
- `CodeStep` takes its send action, its resend action and its first waits as props, and keeps no record when told not to (its Layout names it as reusable). This ticket makes that change if TOKI-023 did not, without changing what the sign-in page does.
- The guard and the session read of "Routes and state" above.
- The new row of the state table above.

### What this ticket needs from TOKI-028 and TOKI-020
`addMemberToGeneral(tx, { userId, createdAt })` in the `conversations` module: finds #general, inserts the member row with `notification_level` empty (TOKI-028) and does nothing when the row exists, and returns the id of #general. TOKI-028's R18 lists the exports of that module and has none that writes, and TOKI-020 adds `createGeneralChannel` for the first Admin's row and leaves the new members' row to "a function it owns" (its Design, "Hand-offs"); this ticket adds this function and extends the export test of TOKI-028 R18. TOKI-024 (its concern 10) asks for exactly such a function.

### Layout
```
apps/server/src/modules/members/
├─ invitation-join.ts      lookup, resend, accept (R1 to R21)
├─ invitation-join.routes.ts  the three routes, the guards (R22, R23)
└─ invitation-join.test.ts integration tests
apps/server/src/modules/conversations/
└─ index.ts                + addMemberToGeneral
packages/shared/src/invitations/
└─ schemas.ts              request, response, token shape (R24)
packages/client-core/src/auth/
└─ invitation.ts           lookupInvitation, resendInvitationCode, acceptInvitation
packages/ui-web/src/join/
├─ InvitationRefusal.tsx   the three refusal pages
└─ SignedInQuestion.tsx    the question
packages/i18n/             keys join.* in en and vi
apps/web/src/routes/
└─ join.tsx                the /join/$token route: token, lookup, choice of view, landing
```
Edited, with their tests kept: `CodeStep.tsx` and the session state of TOKI-023, `__root.tsx` (the guard), `router.tsx` (one route). The shared files of TOKI-022 and TOKI-024 are named above and not edited here.

## Testing
- Server integration tests, written first, with Vitest against the real Postgres, the test clock and a fake mail layer of TOKI-008 (as TOKI-022 does). Addresses are of the form `sam@example.com`; no real address, token or code.
- Lookup: each of the five states with exactly the fields of R1 and no other (R1); a 42-character token, a 44-character one and a token with a `+` give `unknown`, a body without `token` gives 400 (R2); an invitation that is used and revoked answers `used`, revoked and expired answers `revoked` (R3); 9 minutes 59 seconds and 10 minutes after the latest code give 1 and 0, and 59 and 60 seconds give 1 and 0 (R4); after a lookup the session table, the code table and the mail layer are unchanged and a request to a session route answers 401 (R5).
- Resend: a new code, the earlier digits answer `code_expired`, one mail with the address and 6 digits (R6); 59 seconds refused with `retryAfterSeconds` 1 and the header, 60 accepted, the code of the first mail counted as the latest code (R7); expired, revoked, used and unknown answer 409 and 404 with no code and no mail (R8); a mail layer that fails and one that never answers leave the answer unchanged (R9).
- Accept: success with one session, the cookie name and attributes, no token in the body, `generalConversationId` equal to the id of #general (R10); the order of the checks, with a revoked invitation and the right code, and an unknown token and a right code, and no try used up by them (R11); `triesLeft` 4 to 1, then locked, then the right code refused as locked, 10 minutes, and a used code (R11); 5 digits and a missing token (R13); a new address gives an account with the display name of the part before the `@` (a 64-character one included), role `member` and `admin`, language `en` (R14); a deactivated account comes back with the same id, the new role, its old name, its old memberships and no second row (R15); `acceptInvitation` made to refuse (a revoked, used or replaced invitation after the code check) answers 409 or 404 with no account change, no member row and no session (R16); #general has one member row after an accept, also when the person was already a member (R17); two accepts at the same time give one session and one row, and the loser answers as R16 (R18); a failing transaction (made to fail after `acceptInvitation`) leaves the invitation open, the account unchanged and the code used up, a failing session creation leaves it used with an active account, and a look-up then answers `used` (R19); the digits mailed for another invitation and the token of another invitation give `code_incorrect` (R20); a valid session cookie is ended with the reason `replaced` and replaced, and a cookie of a deactivated account is replaced with nothing ended (R21).
- Hardening: a form-encoded and a `text/plain` body give 415; a foreign `Origin` gives 403; no response carries `Access-Control-` (R22); the routes answer with no session; a list of the routes of this ticket shows no `GET`; the other routes still answer 401 (R23); the captured log is searched for the token, the code, the secret and the address (R24); the routes reject a body that fails the shared schema (R24).
- Unit tests (Vitest): the token reader (R26: a valid token, `/join` with none, a short one, one with a `?`); the choice of view from a state and a session (R25, R34 to R37, R38).
- Component tests with a faked API and the controllable clock of TOKI-008, one per row of "Outcomes and what the person sees": the text, the place, the focus and the state of the controls (R27, R30, R31, R35). In addition: only the session read and the lookup are sent on opening (R28); 'Resend code' at 59 and 60 seconds from the lookup and the expired state on opening (R29); the question and each of its buttons, with nothing sent for 'Stay signed in' and the same address giving no question (R36); the session read answering `account_deactivated` shows the code step and no modal (R37); the same page and the same texts for a lookup of a returning person (R38); the cache is cleared when another person was signed in (R33); every text exists in both languages through the missing-translation check and a search of `packages/ui-web/src/join` for literals (R39).
- End-to-end tests (Playwright) against the real server and Mailpit: press Join in the mail of a new invitation, enter the code from the mail, land at the address of #general with the person as a member of it (R26, R27, R32, TS-015); the link opened and abandoned leaves nobody signed in (R28, TS-017); the mail's code after 10 minutes is refused and 'Resend code' sends a code that works, read from Mailpit with the moved server clock (R29, R30, TS-018); a used link opens `/login` with the address and an invitation to another address while signed in asks the question and 'Stay signed in' leaves the person signed in with the invitation still valid (R34, R36, TS-020, TS-021); an invitation for a deactivated person gives the same account back, in a browser that still holds the old cookie (R15, R37, TS-104); expired, revoked and a garbled link show their pages (R35, TS-016, TS-019); the address bar and storage hold no address or code after each step (R43). The link of the mail is the one TOKI-024 builds, which tests the form of R26.
- Layout: each page at 360 x 560, 719, 720, 1099 and 1100 px, in Calm and Focus, in English and Vietnamese (R40, R42); a keyboard-only run (R41) and an automated accessibility check of the three views (R41).
- The grey line, the conversation screen and the notification card are not tested here (Scope).

## Data safety
- The token is a secret for the life of the invitation: it is in the address of the page, hashed by TOKI-024 and never logged or stored by this ticket; it travels only in request bodies (R24, R26, R43). Concern 12 says what the address still shows.
- The lookup returns the address and the workspace name to whoever holds the token, who received the mail. For an unknown token it returns nothing. It returns no role, no inviter and no id (R1).
- Codes are stored hashed and never logged (TOKI-022). A code is bound to the token (R20), so a code typed for one invitation never signs in another.
- The three routes accept only JSON and refuse a foreign origin (R22); no `GET` changes anything (R23).
- A new session replaces the one of the browser (R21) and the data of the earlier person is cleared (R33).
- The cookie of a deactivated account does not stop the person from joining again (R37), and nothing on the page says that an account was deactivated (R38).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I04 member-management, alongside TOKI-024, 025 and 027 | Planning fact; Scope "Out" draws the line with TOKI-024 and TOKI-025. |
| Milestone M2; size M | Planning fact. Three routes, one page and its states; no table, no mail template. |
| Needs: the plan lists nothing; the design needs TOKI-019, 021, 022, 023, 024 and 028 | "What this ticket needs from ..." sections. Plan change: the needs list is updated. |
| Needed by: no ticket lists it | Planning fact; no design impact. |
| Join opens the code step with the email filled in; the link alone signs nobody in (D-149) | R27, R28, R5, R23. |
| 10 minutes; "Resend code" after 60 seconds; a new code cancels the earlier; 5th wrong try locks (D-136, D-082, D-137) | R6, R7, R11, R29, R30, R31; the rules themselves are TOKI-022's (R49). |
| An invitation lasts 7 days and works once; Resend gives 7 days and stops the earlier mail (D-037, D-182) | Owned by TOKI-024; R3, R8, R18 read and use it. The old link after a Resend: concern 3. |
| No welcome step; lands in #general; display name from the address (D-083, D-034, D-150) | R10, R14, R17, R32; R27 (nothing added). The line "Minh joined": concern 7. |
| A deactivated person gets the same account, with the new role (D-094, D-181) | R15, R37, R38. |
| Refusal pages for expired, revoked, not recognised; a used link goes to sign-in; no workspace name on the unrecognised page (D-081) | R3, R34, R35. The wording: concern 2. |
| A person signed in as someone else is asked first; choosing no keeps A and the invitation (D-080) | R36, R21, R33. |
| Invitations are mailed in English (D-180) | The mail of a new code is English (TOKI-021 R24); the account's language is `en` (R14). |
| English default; Vietnamese complete; every text through the translation package (D-018, D-064) | R39. Vietnamese wording: concern 2. |
| 360 x 560; layout at 720 and 1100; nothing hover-only; focus (D-054, D-068, D-067, D-075) | R40, R41. No modal is used; the question is a page. |
| The API lives under `/api/v1` | API table. |
| Two roles, Member and Admin; no Owner (D-152, D-153) | R14 and R15 take the role of the invitation; the page names no role. |

## Open questions from the intent
- Which ticket verifies the token, and which builds the Join address? Answered: TOKI-024 verifies it through `findInvitationByToken` and builds the address `<app origin>/join#<token>`; this ticket calls the first and fixes the form of the second ("What this ticket needs from TOKI-024"). Evidence: TOKI-019 concern 1 gives the invitation table to TOKI-024; TOKI-021 R9 receives a finished `joinUrl`.
- What does the Join page show to a deactivated person who is invited again? Answered: the same page as everyone (R38). Evidence: D-094 returns the same account after the code; F03 has no separate page.
- Which wording do the refusal pages and the question use? Not answered. The prototype has none; D-080 and D-081 decide only some words. Carried forward as concern 2.
- Do "Resend code" requests on an invitation count toward the 5 in 15 minutes? Not answered. The server holds the 60 seconds here (R7) and no count of 5. Carried forward as concern 5.
- What does the person read when the mail of a resent code cannot be sent? Not answered. Carried forward as concern 4.
- What does the old link show after an Admin has pressed "Resend" on the invitation? Not answered. Carried forward as concern 3.
- Which ticket writes the grey line "Minh joined"? Not answered. Carried forward as concern 7.

## Areas of concern
1. The Join page must work for a person who still holds the cookie of a deactivated account, and for a person who is already signed in. Decided in this spec: `/join` is outside the app layout and outside the redirect of the guard; a 401 `account_deactivated` on this page counts as no session (R37); the code that is accepted replaces the cookie (R21); the question of D-080 is asked only when another person is signed in (R36), and the session of that person ends only when the code is accepted. Reason: D-094 says a deactivated person can accept a new invitation, and TOKI-022 R27 and TOKI-023 R26 would otherwise show a modal with no button to the same person; ending the session before the code would leave a person with no session if the code step is abandoned. This changes two places of TOKI-023 (R25, R37) and is the change request for that spec. Owner: Thanh Truong.
2. Wordings. The prototype has no member invitation page, so by D-139 every wording it does not contain is a proposal. D-081 and D-080 state some words ('This link is not valid'; 'You are signed in as A. Sign out to continue as B?') and the spec follows the standard of TOKI-023 in treating those as decided; the rest is proposed: the titles and lines of the expired and revoked pages, the two buttons of the question, the use of addresses for A and B, and the Vietnamese of all of it (D-188 is Open). Proposal, not a decision: no link back to sign-in on the refusal pages (Screens, 2); a link 'Go to sign in' would need a wording. Browser tab titles are not decided either, as in TOKI-023. Not decided. Owner: Thanh Truong.
3. What an old Join link shows after an Admin presses "Resend" on the invitation (D-182: the earlier mail stops working). The log has three refusal messages (D-081) and none for a replaced link. TOKI-024 R14 replaces the token, so the old link is unknown and shows 'This link is not valid', which says nothing helpful to a person who holds a real mail and may be about to use the new one. Proposal, not a decision: keep that. Another proposal: keep the old token as revoked and show 'This invitation is no longer valid'. Not decided. Owner: Thanh Truong, with TOKI-024.
4. When the page cannot reach the lookup, or the mail of a resent code cannot be sent. D-099 decides mail failure for the Admin's batch only. This spec holds R9: the answer of "Resend code" is unchanged and the person is not told; after 60 seconds they can press it again; the Admin can resend the whole invitation. For the lookup, the proposal in the outcomes table is the card with the general failure message of TOKI-023 (its concern 1) and a reload. Proposals, not decisions: tell the person with a message such as 'We could not send the code. Try again.'; this is allowed here because the person holds the token, so it reveals nothing about membership. Not decided. Owner: Thanh Truong.
5. Limits on codes of an invitation. D-038 limits requests per email and D-082 gives 60 seconds. TOKI-022 concern 4 does not decide whether invitation codes count toward the 5 in 15 minutes. This spec holds only the 60 seconds (R7) and the 5 tries of every code (TOKI-022). Held this way, anyone who holds the token can send the invitee one mail a minute for the life of the invitation, and can try 5 codes a minute, 7,200 a day, 1 in a million each, about 5 in 100 over 7 days; the token is in the invitee's mailbox, which also holds the code, so the case needs a leaked token. Proposals, not decisions: count invitation codes with sign-in codes per address; or a cap of 5 codes per invitation in 15 minutes; or cancel the invitation after a number of wrong tries across its codes. Each needs a number from the product owner. Not decided. Owner: Thanh Truong.
6. Where the Join page lands before the conversation screen exists. The address `/c/<id>` is reached (R32) and, until TOKI-033, shows the page for an unknown address. Decided in this spec: the address is the requirement and the screen is TOKI-033's; the end-to-end test of "lands in #general" checks the address and the membership until then. Owner: Thanh Truong.
7. The grey line 'Minh joined' in #general (D-100: no unread count, no notification). TOKI-042 draws such a line, and the table of messages is TOKI-036, which comes after this ticket; no ticket writes the row when a person joins. This spec writes none. Proposal, not a decision: the messages module exports one function that records a system line, and this ticket calls it once that module exists. Not decided. Owner: Thanh Truong.
8. This spec changes or asks for changes in other specs, all listed above: TOKI-022 (public routes, an exported way to end a request's session, the guards on three more routes), TOKI-023 (CodeStep props, the guard, one state row), TOKI-024 (`codeIssuedAt` and the 60 seconds in `nextInvitationCodeSecret`) and TOKI-028 (one export). Settled here by naming them; none of those specs is edited by this ticket. If one of them differs, the difference is settled in its spec. Owner: Thanh Truong.
9. An invitation that was open when an Admin reactivated the person. Answered by TOKI-024 R30: the reactivation marks the open invitation as used, so the old link leads to the normal sign-in page (R16 and R19 cover the race). Evidence: TOKI-024 R30 and R18. D-181 gives the role of a new invitation to a deactivated person who accepts it; an old invitation cannot change the role of an active member. Owner: Thanh Truong.
10. The code check, the account transaction and the session are three steps, not one transaction. Decided in this spec: the code check comes first, the transaction of `acceptInvitation` and `addMemberToGeneral` second, the session third, each failure leaves a way on, and the cost is at most one extra code (R19, "How an accept runs"). Reason: the `auth` functions run their own transactions and TOKI-024 gives the accept one transaction in this ticket (its contract). Owner: Thanh Truong.
11. The accept answer holds `generalConversationId` and `addMemberToGeneral` is a new export of the `conversations` module. Decided in this spec: both are part of this ticket. Reason: the landing address needs the id, and TOKI-028 exports no function that writes a member row; TOKI-020 and TOKI-024 both leave this function to this ticket. Owner: Thanh Truong.
12. The token is in the address of the page, `/join/<token>`, the form TOKI-024 builds. Decided in this spec: this ticket follows it and sends the token only in request bodies. What stays exposed: the address is in the browser's history and in the access log of the web server that serves the page (the server skeleton logs paths, TOKI-004 R7), and same-origin requests of the page carry it in `Referer` unless a policy says otherwise. Proposals, not decisions: a fragment (`/join#<token>`), which a browser sends neither in a request line nor in `Referer`, needs a change in TOKI-024 R11 only (TOKI-026 already puts its emergency token in a fragment, `/emergency#<token>`); or a `Referrer-Policy: no-referrer` header, which belongs to the security review (TOKI-091). The token alone signs nobody in (D-149) and expires with the invitation, so the exposure lets a person with log access see an address and read the lookup, and try codes (concern 5). Owner: Thanh Truong.
