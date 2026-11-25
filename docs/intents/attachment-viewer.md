# Intent: Attachment cards and viewer modal
Author: Thanh Truong

## Problem
Files can be stored and sent (file storage, TOKI-058) and a message can carry them, but a message shows only its text: a person sees no file, no image and no link under a message, and cannot open, download or share one.
Three rules must hold on the screen as they do on the server: a file is always downloaded and never run in the browser, a link to a file opens only for people who can see its conversation, and an image whose thumbnail is not ready does not make the list jump.
The Files tab and the Files page, which come later, need the same cards and the same details window, so there must be one version of them.

## Proposed outcome
Under the text of a message the person sees one card for each file (icon, name, size), a thumbnail for each image, and a card for each link preview, drawn as in the prototype.
Pressing a file or an image opens a details window with the file name, who shared it, where, when and its size, and the buttons Open in conversation, Copy link and Download.
Download saves the file and never shows it in a browser tab; Copy link copies a link that opens only for people who can read the conversation.
The cards and the window are built once, so the Files tab and the Files page reuse them.

## Affected users and systems
- Members and Admins, who read messages that carry files, images and links, and open their details. Guests are not in phase 1 (D-152).
- The web app (`apps/web`): the place under the text of a message that the message component provides, and one details window for the whole signed-in app.
- The component package (`packages/ui-web`): the card, icon and image components and their styles (`.card`, `.fic`).
- The i18n package (`packages/i18n`): the file size formatter, owned by TOKI-059; this work imports it.
- File storage (TOKI-058), thumbnails (TOKI-060) and link previews (TOKI-061), which supply the data the cards show (TOKI-061 draws its link cards through the seam this work provides); the composer (TOKI-059) and the Files tab and page (TOKI-063), which use the same card parts or the same window.

## Constraints
- A file is always downloaded and never run in the browser; every type is accepted. Source: D-095, F18.
- A link to a file opens only for people who can see the conversation that holds it. Source: F18, AC-029, D-116.
- The details window shows the sender, the conversation, the date and the size, with the buttons Open in conversation, Copy link and Download. Source: F18, FR-39, AC-107.
- An image shows as a thumbnail that opens large; a thumbnail that is not ready shows a placeholder with the right proportions, so the layout does not jump. Source: F18.
- A message carries up to 10 files. Source: D-042.
- What needs the server is blocked with an explanation while the connection is down; what does not, keeps working. Source: D-079.
- Every text goes through the i18n package; English is the default language. Source: Toki Blueprint, TOKI-017.
- Milestone M4; size M. Needs TOKI-049 and TOKI-058. Source: Toki Blueprint, ticket TOKI-062.

## Open questions
- How does the details window show an image: from the original file or from a thumbnail?
- What does Copy link copy, and what does the link do for a person who cannot see the conversation, or is signed out?
- Which ticket owns the Open in conversation jump, and the rule that a message with files is not grouped with the one before it?
- What does a link item show in the details window, and does Download apply to it?
- Where does a file size such as "212 KB" get its unit and rounding?
