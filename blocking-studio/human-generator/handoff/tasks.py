"""Put the hand tasks on GitHub: the issues, then a project board that holds them.

    python3 tasks.py issues [--dry]   the milestone, the tracking issue, the task issues, the checklist, the sub-issues
    python3 tasks.py board  [--dry]   the repository's Projects tab, the project, its fields, the issues on it

The tasks are the files in issues/ next to this script: a header (title, labels, order, area, files, after) and,
after a line "---", the issue's body. "TRACKING" in a body becomes the tracking issue's number; "after" lists the
orders of the tasks a task depends on. Both steps look up what already exists and only add what is missing, so a
second run changes nothing. --dry prints the commands that would change something instead of running them (the
lookups still run). Needs the GitHub CLI (gh). "issues" needs an account with at least the triage role on the repository; "board"
needs the repository's owner (the project is created under that account), with the project scope
(gh auth refresh -s project). Both check this first and stop with the reason. Python standard library only.
"""
import glob, json, os, subprocess, sys

OWNER, REPO_NAME = 'rniedson', 'hfd'
REPO = f'{OWNER}/{REPO_NAME}'
MILESTONE = 'Procedural hands'
PROJECT = 'Procedural hands'
AREAS = ['Tests', 'Geometry', 'CI', 'Docs', 'Review', 'Decision', 'Release']
HERE = os.path.dirname(os.path.abspath(__file__))
DRY = '--dry' in sys.argv


def run(args, input=None, change=True):
    """gh with these arguments; a change is only printed under --dry."""
    if DRY and change:
        print('  would run: gh', ' '.join(a if len(a) < 60 else a[:57] + '...' for a in args))
        return None
    r = subprocess.run(['gh', *args], capture_output=True, text=True, input=input)
    if r.returncode:
        sys.exit(f'gh {" ".join(args[:5])} failed:\n{r.stderr.strip()}')
    return r.stdout


def api(path, method='GET', body=None, change=None):
    args = ['api', path] if method == 'GET' else ['api', '-X', method, path]
    if body is not None:
        args += ['--input', '-']
    out = run(args, input=json.dumps(body) if body is not None else None, change=method != 'GET' if change is None else change)
    return json.loads(out) if out else None


def tasks():
    out = []
    for path in sorted(glob.glob(os.path.join(HERE, 'issues', '[0-9][0-9]-*.md'))):
        head, body = open(path, encoding='utf-8').read().split('\n---\n', 1)
        meta = {k.strip(): v.strip() for k, v in (line.split(':', 1) for line in head.splitlines())}
        out.append({
            'title': meta['title'], 'labels': [x.strip() for x in meta['labels'].split(',') if x.strip()],
            'order': int(meta['order']), 'area': meta['area'], 'files': meta['files'],
            'after': [int(x) for x in meta['after'].split(',') if x.strip()], 'body': body,
        })
    return sorted(out, key=lambda t: t['order'])


def existing_issues():
    """title -> {number, id, url} for every issue (open or closed) with these titles, pull requests left out."""
    found, page = {}, 1
    while True:
        batch = api(f'repos/{REPO}/issues?state=all&per_page=100&page={page}')
        for it in batch:
            if 'pull_request' not in it:
                found.setdefault(it['title'], {'number': it['number'], 'id': it['id'], 'url': it['html_url']})
        if len(batch) < 100:
            return found
        page += 1


def who():
    """The logged-in account, its permissions on the repository, and its token's scopes."""
    login = api('user')['login']
    perms = api(f'repos/{REPO}').get('permissions', {})
    status = subprocess.run(['gh', 'auth', 'status'], capture_output=True, text=True)
    scopes = (status.stdout + status.stderr).split('Token scopes:')[-1].splitlines()[0] if 'Token scopes:' in status.stdout + status.stderr else ''
    return login, perms, scopes


def need(ok, why):
    if not ok:
        sys.exit('cannot go on: ' + why)


def step_issues():
    login, perms, _ = who()
    need(perms.get('triage') or perms.get('push') or perms.get('admin'),
         f'{login} cannot set milestones, labels or sub-issues on {REPO}: it needs at least the triage role '
         f'(the repository owner adds it under Settings, Collaborators)')
    T = tasks()
    ms = [m for m in api(f'repos/{REPO}/milestones?state=all&per_page=100') if m['title'] == MILESTONE]
    if ms:
        milestone = ms[0]['number']
        print(f'milestone "{MILESTONE}" exists (#{milestone})')
    else:
        print(f'milestone "{MILESTONE}": creating')
        m = api(f'repos/{REPO}/milestones', 'POST', {'title': MILESTONE, 'description':
                'The procedural hand pose system: the branch procedural-hands, its tasks and its pull request into main.'})
        milestone = m['number'] if m else 0
    have = existing_issues()

    def ensure(t, body):
        if t['title'] in have:
            print(f"  #{have[t['title']]['number']} exists: {t['title']}")
            return have[t['title']]
        print(f"  creating: {t['title']}")
        made = api(f'repos/{REPO}/issues', 'POST', {'title': t['title'], 'body': body, 'labels': t['labels'], 'milestone': milestone})
        info = {'number': made['number'], 'id': made['id'], 'url': made['html_url']} if made else {'number': 0, 'id': 0, 'url': ''}
        have[t['title']] = info
        return info

    tracking_task, rest = T[0], T[1:]
    tracking = ensure(tracking_task, tracking_task['body'].replace('SUBISSUES', '(the list is filled in once the tasks exist)'))
    num = {tracking_task['order']: tracking['number']}
    for t in rest:   # in order, so a task's dependencies have numbers before it
        extra = f"\n\n---\n**Files:** {t['files'] or 'none in the repository'}"
        extra += f"\n**Depends on:** {', '.join(f'#{num[a]}' for a in t['after'])}" if t['after'] else '\n**Depends on:** nothing'
        info = ensure(t, t['body'].replace('TRACKING', f"#{tracking['number']}") + extra)
        num[t['order']] = info['number']
        t['issue'] = info
    checklist = '\n'.join(f"- [ ] #{t['issue']['number']}" for t in rest)
    current = api(f"repos/{REPO}/issues/{tracking['number']}") if tracking['number'] else {'body': ''}
    if 'SUBISSUES' in tracking_task['body'] and checklist not in (current or {}).get('body', ''):
        print('  tracking issue: writing the task list')
        api(f"repos/{REPO}/issues/{tracking['number']}", 'PATCH', {'body': tracking_task['body'].replace('SUBISSUES', checklist)})
    subs = {s['id'] for s in api(f"repos/{REPO}/issues/{tracking['number']}/sub_issues?per_page=100")} if tracking['number'] else set()
    for t in rest:
        if t['issue']['id'] not in subs:
            print(f"  sub-issue: #{t['issue']['number']} under #{tracking['number']}")
            api(f"repos/{REPO}/issues/{tracking['number']}/sub_issues", 'POST', {'sub_issue_id': t['issue']['id']})
    print(f"tracking issue: https://github.com/{REPO}/issues/{tracking['number']}")


def step_board():
    login, perms, scopes = who()
    need(login == OWNER, f'the project is created under {OWNER}, and only {OWNER} can create a project of its own '
         f'(logged in as {login}). Run this step logged in as {OWNER}.')
    need("'project'" in scopes, "the token has no 'project' scope: run gh auth refresh -s project (it opens the browser)")
    need(perms.get('admin'), f"turning on the repository's Projects tab needs the admin role on {REPO}")
    T, have = tasks(), existing_issues()
    missing = [t['title'] for t in T if t['title'] not in have]
    if missing:
        sys.exit('run "tasks.py issues" first; missing: ' + '; '.join(missing))
    repo = api(f'repos/{REPO}')
    if not repo.get('has_projects'):
        print("the repository's Projects tab: enabling")
        run(['repo', 'edit', REPO, '--enable-projects'])
    projects = json.loads(run(['project', 'list', '--owner', OWNER, '--format', 'json', '--limit', '100'], change=False))['projects']
    proj = next((p for p in projects if p['title'] == PROJECT), None)
    if not proj:
        print(f'project "{PROJECT}": creating')
        out = run(['project', 'create', '--owner', OWNER, '--title', PROJECT, '--format', 'json'])
        if out is None:
            print('  (dry run: the rest needs the project to exist)'); return
        proj = json.loads(out)
    n, pid = str(proj['number']), proj['id']
    print(f"project #{n}: {proj.get('url', '')}")
    run(['project', 'link', n, '--owner', OWNER, '--repo', REPO])   # linking twice is harmless

    def fields():
        return {f['name']: f for f in json.loads(run(['project', 'field-list', n, '--owner', OWNER, '--format', 'json', '--limit', '50'], change=False))['fields']}
    F = fields()
    for name, kind in [('Order', 'NUMBER'), ('Area', 'SINGLE_SELECT'), ('Files', 'TEXT'), ('Depends on', 'TEXT')]:
        if name not in F:
            print(f'  field "{name}": creating')
            args = ['project', 'field-create', n, '--owner', OWNER, '--name', name, '--data-type', kind]
            if kind == 'SINGLE_SELECT':
                args += ['--single-select-options', ','.join(AREAS)]
            run(args)
    F = fields() if not DRY else F
    items = {it['content'].get('number'): it for it in json.loads(run(['project', 'item-list', n, '--owner', OWNER, '--format', 'json', '--limit', '200'], change=False))['items'] if it.get('content')}
    num = {t['order']: have[t['title']]['number'] for t in T}
    for t in T:
        issue = have[t['title']]
        item = items.get(issue['number'])
        if not item:
            print(f"  adding #{issue['number']} to the board")
            out = run(['project', 'item-add', n, '--owner', OWNER, '--url', issue['url'], '--format', 'json'])
            item = json.loads(out) if out else {'id': 'ITEM'}
        if DRY and ('Order' not in F or 'Area' not in F):
            continue

        def edit(field, **value):
            flag, v = next(iter(value.items()))
            run(['project', 'item-edit', '--project-id', pid, '--id', item['id'], '--field-id', F[field]['id'], f'--{flag.replace("_", "-")}', str(v)])
        if not item.get('status'):
            todo = next(o for o in F['Status']['options'] if o['name'].lower() in ('todo', 'to do'))
            edit('Status', single_select_option_id=todo['id'])
        edit('Order', number=t['order'])
        edit('Area', single_select_option_id=next(o['id'] for o in F['Area']['options'] if o['name'] == t['area']))
        if t['files']:
            edit('Files', text=t['files'])
        if t['after']:
            edit('Depends on', text=', '.join(f'#{num[a]}' for a in t['after']))
    print('done. Views (a board grouped by Status, a table sorted by Order) are added on the project page: the API cannot create them.')


if __name__ == '__main__':
    steps = {'issues': step_issues, 'board': step_board}
    if len(sys.argv) < 2 or sys.argv[1] not in steps:
        sys.exit(__doc__)
    steps[sys.argv[1]]()
