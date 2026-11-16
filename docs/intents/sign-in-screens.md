# Intent: Sign-in screens
Author: Thanh Truong

## Problem
Nothing in Toki can be read without a session, and sign-in is the only public page. The prototype has no sign-in screen for members, only the guest one (D-011), so a Member or an Admin has no way to ask for a code, type it, or learn why a code was refused.
The server side of sign-in (TOKI-022) answers requests but shows nothing to a person. Without the screens nobody can enter Toki, and milestone M2 cannot be shown.
A person whose session ends while Toki is open also needs to be told, and needs a way back in.

## Proposed outcome
A Member or an Admin opens Toki, enters their email address, receives a 6-digit code by mail, types it and is inside Toki. There is no password and no welcome step.
When something goes wrong, the person reads the reason under the field and knows what to do next: how many tries are left, that the code is locked or has expired, how long to wait before asking again, that the account is deactivated, or that the network is down.
When a session ends while Toki is open, the person sees 'Your session has ended', the content behind is covered, and they can sign in again.
The screens work at every supported width, with the keyboard alone, in English and in Vietnamese.

## Affected users and systems
- Users: Member and Admin. Source: Toki Blueprint, intent I03 sign-in-by-email-code. (There is no Owner role; the Guest signs in through the guest portal of phase 5, which is not this work.)
- Systems: the Toki web app; the texts of the interface (English and Vietnamese).
- Uses the Sign-in API (TOKI-022) and the base components and overlays of the design system (TOKI-014).
- Used by: every later screen, which is reached only after sign-in; Accept an invitation (TOKI-097) leads a person with a used invitation to the sign-in page; Sign out (TOKI-099) ends on the sign-in page.

## Constraints
- Belongs to Blueprint intent I03 sign-in-by-email-code, with TOKI-019, 020, 021, 022, 026 and 099. Source: Toki Blueprint, intent list.
- Milestone: M2, Sign-in, members and conversations. Size: M. Source: Toki Blueprint, ticket TOKI-023.
- Needs: TOKI-014 (Overlays) and TOKI-022 (Sign-in API). Source: Toki Blueprint, ticket dependencies.
- Builds FR-01, FR-02 and FR-03 on the screen side, and follows FR-28 for form errors. Source: Toki Blueprint, requirements.
- Agreed scope: the email step; the 'Check your email' step with the 6-digit field, the line 'The code works for 10 minutes', 'Use a different email' and 'Resend code'; the 7 error cases of journey F05; the 'Your session has ended' screen of journey F07. Source: Toki Blueprint, ticket TOKI-023.
- Sign-in is by a 6-digit code sent by email. There is no password. Source: D-011, BR-02.
- The sign-in mail carries the code only, with no button. Nothing in the mail signs anyone in without the code. Source: D-157.
- A code is valid for 10 minutes. Source: D-136.
- The 5th wrong try locks the code; a new one must be requested. The screen says how many tries are left. Source: D-137, journey F05.
- At most 5 code requests per email address in 15 minutes. 'Resend code' is available 60 seconds after the last request. A new code cancels the earlier one. Source: D-038, D-082.
- The screen behaves the same whether or not the address belongs to a member. It never reveals which addresses are members. Source: BR-04, journey F05.
- A code signs in only the device that asked for it. Source: journey F04, ticket TOKI-022.
- Form errors show under the field, and the button is disabled until the form is valid. Source: D-104, FR-28.
- A button is disabled while its request runs. Source: D-111.
- There is no welcome screen. After the code the person is in the app. Source: D-083.
- With a valid session, opening Toki goes straight to the app with no sign-in page. Without one, every address shows the sign-in page and no workspace content. Source: journey F04, FR-03 (AC-007).
- A session lasts 30 days and renews on every use. Source: D-011, D-138.
- When a session ends while Toki is in use, the app shows 'Your session has ended' with a 'Sign in again' button and covers the content behind. After signing in again the person returns to the conversation that was open. For a person deactivated while in use, the screen says 'This account has been deactivated' and has no sign-in button. Source: journey F07.
- Journeys F04, F05 and F07 are the accepted baseline for what these screens do. Source: D-091. Assumption, not a decision: the wordings quoted in those journeys are the working texts; a wording that the prototype does not contain stays a proposal until it is signed off (D-139; open question 5).
- English is the default language and Vietnamese is fully translated. Every text goes through the translation package; a missing translation fails CI. Source: D-018, D-064.
- Smallest supported size is 360 × 560. Under 720 px one pane at a time; the layout changes again at 1100 px. Source: D-068, NFR-01.
- No action is hover-only or desktop-only. Source: D-067.
- Every icon-only button has a name for screen readers. A modal traps focus. Source: D-075.
- Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox. Source: D-108.
- The sign-in page lives at the path `/login`. Source: Toki Blueprint, technical design, frontend.
- Roles are Member, Admin and Guest. There is no Owner. Source: D-012, D-090.

## Open questions
1. Journeys F04, F05 and F07 give the main texts. Several smaller texts are not in any decision: the label of the email field, the message for a malformed address, the message for a server failure, any text beside 'Resend code' while it waits, any confirmation after a resend, the form of '4 tries left' when one try is left, and the browser tab title. What are they?
2. What are the Vietnamese texts? D-188 (the form of address in Vietnamese) is still open.
3. Which language and which look (Calm or Focus) does the sign-in page use before anyone is signed in? Both are saved to the account (D-175), which is not known yet.
4. Journey F04 shows the logo and the workspace name on the sign-in card. Where does a signed-out page get the workspace name from?
5. D-139 calls every text that the prototype does not contain a proposal; D-091 accepts the journeys as the baseline. Which holds for the sign-in texts?
6. Journey F04 says the code is sent when the 6th digit is typed, and does not say whether the step also has a button. The prototype's guest sign-in card has a 'Sign in' button. Does the code step have a button as well?
7. What does the screen show when the same address asks for a code again inside 60 seconds?
8. Journey F07 says the draft being typed is still in the composer after signing in again. Is that part of this work or of the composer work?
9. D-093 says the other tabs of the same browser are signed out at once. Which work makes the other tabs notice?
