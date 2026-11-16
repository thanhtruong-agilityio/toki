# Working agreements

- One ticket per branch, named `<type>/<ticket>-<slug>` (ticket id in lowercase). Never commit or push to `main`, `master`, `develop` or `release/*`.
- Commits follow Conventional Commits with a lowercase subject. PRs follow `.github/pull_request_template.md`.
- Tickets are done per `docs/definition-of-done.md`.
- Never paste client secrets or customer data into any AI tool. AI output is a proposal until it has been run.
- Push to your own ticket branch and open its pull request without asking.
- Never merge a pull request and never force-push; merging is done by a person on GitHub.
- Ask before every branch deletion and deploy.
- Start work with `/cl-core:ticket <ticket>`. The exception is an unattended run the user started (many intents, specs or review fixes in parallel): do not stop at confirmation gates there; record each choice you made and each question you could not answer in the pull request, and report them at the end.

## Advisor

An advisor model (Opus) is configured for this repository. Consult it:

- before you commit to a plan or an approach:
  - during brainstorming, consult it once, on the written design, before you ask the user to approve it (not on every question);
  - for small tickets that skip design, do not consult it at this point;
- when the same error has happened twice;
- before you report the work as done.

Say in one line what you are asking it. If its guidance conflicts with the code or the test output, say so instead of following it blindly.
