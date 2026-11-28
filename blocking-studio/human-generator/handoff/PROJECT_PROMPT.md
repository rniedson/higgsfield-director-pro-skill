# Prompts for the hand tasks

Two prompts for a coding agent with a checkout of `rniedson/higgsfield-director-pro-skill`: the first sets up the
issues and the project board once; the second is for every agent that takes a task afterwards.

**Who runs the first one.** The project is created under the account `rniedson`, and only that account can create a
project of its own; turning on the repository's Projects tab needs the admin role. So the first prompt runs logged in
to the GitHub CLI as `rniedson`, with the `project` scope (`gh auth refresh -s project`, approved in the browser).
`tasks.py` checks both before it changes anything. A collaborator's account cannot do this step, whatever its scopes.

**What a collaborator needs from the owner,** before the second prompt:

- the write role on the repository, to push branches and be assigned issues (the owner invites it under Settings,
  Collaborators, or with `gh api -X PUT repos/rniedson/higgsfield-director-pro-skill/collaborators/<login> -f permission=push`;
  the collaborator accepts the invitation);
- the writer role on the project, to move its cards (the project's page, Settings, Manage access).

## 1. Set up the issues and the project board (once)

```text
You are setting up the GitHub issues and project board for the procedural hand pose system in the repository
rniedson/higgsfield-director-pro-skill. The work is on the branch `procedural-hands`. Its tasks are written as issue
drafts in `blocking-studio/human-generator/handoff/issues/`, and `blocking-studio/human-generator/handoff/tasks.py`
puts them on GitHub.

First:
1. `git fetch origin`, then check out `procedural-hands` (in a worktree if the main checkout is busy). Read
   `blocking-studio/human-generator/handoff/README.md`, `CONTRIBUTING.md` and `AGENTS.md`.
2. Run `gh auth status`. This setup must run logged in as `rniedson` (the project is created under that account),
   with the `project` scope. If the account is another one, stop and tell me. If the scope is missing, ask me to run
   `gh auth refresh -s project` myself (it opens the browser), and wait for me.

Then one step at a time. Before each step that changes something on GitHub, run it with `--dry`, show me what it
would do, and wait for my "ok":
3. `python3 blocking-studio/human-generator/handoff/tasks.py issues`: the milestone "Procedural hands", the tracking
   issue, the twelve task issues (each with its files and dependencies), the tracking issue's task list, and the
   tasks linked as its sub-issues.
4. `python3 blocking-studio/human-generator/handoff/tasks.py board`: turns on the repository's Projects tab, creates
   the project "Procedural hands" under rniedson, links it to the repository, adds the fields Order, Area, Files and
   Depends on, and puts every issue on it with Status "Todo" and its fields. This step has not been run against
   GitHub before: if a gh command fails, fix the script, tell me what you changed, and run the dry run again.
5. Ask me whether the project should be public (anyone can see it; only people with access can change it). If I
   say yes: `gh project edit <number> --owner rniedson --visibility PUBLIC`.
6. Tell me to add two views on the project page, because the API cannot create them: a Board grouped by Status, and
   a Table sorted by Order that shows Area, Files and Depends on.
7. Report the project's URL, the tracking issue's URL, and a table of the issues with their Order, Area and
   dependencies.

If you fixed the script, commit the fix to `procedural-hands` (never to `main`) and push the branch. Do not merge
anything, do not change any repository setting other than the Projects tab, do not invite collaborators (I do
that), and keep everything in English.
```

## 2. Take a task (every agent afterwards)

```text
You are taking one task of the procedural hand pose system in rniedson/higgsfield-director-pro-skill. Read
`blocking-studio/human-generator/handoff/README.md` on the branch `procedural-hands`, section "Taking a task", and
follow it: pick a Todo issue in the milestone "Procedural hands" whose dependencies are closed and whose files no
task in progress is changing, assign yourself, set it In Progress on the project board, branch from
`origin/procedural-hands`, do the task as its issue describes, run the checks, and open the pull request into
`procedural-hands`. Stop when the pull request is ready for review: only the maintainer merges.
```
