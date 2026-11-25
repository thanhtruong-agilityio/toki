# Definition of done

A ticket is done when:
- [ ] The change works and the reproduction (bugs) no longer fails
- [ ] A test covers the change
- [ ] The diff contains only what the ticket needs
- [ ] The PR description stands alone (Ticket, What, Why, How tested, Risk) and links the ticket
- [ ] CI is green
- [ ] The QA record of the ticket passes `bash .github/scripts/qa-ready.sh <KEY>`
- [ ] The acceptance record of the outcome lists the ticket
- [ ] Another person reviewed it, including AI-assisted PRs
- [ ] No secrets or customer data in code, commits or PR text
