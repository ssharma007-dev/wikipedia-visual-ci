#!/usr/bin/env bash
# Does a pull request change the app, or only docs / the pipeline?
#   bash visual-agent/scripts/pr-scope.sh <PR>   → prints "app" or "no-app"
# "no-app": every changed file is under one of NO_TICKET_PATHS (repository variable). Those PRs need no Jira
# ticket and no visual review. Any other file, or an error reading the PR, → "app" ( the full checks run ).
PR="$1"
EXEMPT="${NO_TICKET_PATHS:-docs/ .github/ visual-agent/ README.md}"
FILES=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR/files" --paginate \
          --jq '.[] | .filename, (.previous_filename // empty)' 2>/dev/null || true)
[ -n "$FILES" ] || { echo app; exit 0; }
while IFS= read -r f; do
  ok=no
  for p in $EXEMPT; do case "$f" in "$p"*) ok=yes; break ;; esac; done
  [ "$ok" = yes ] || { echo app; exit 0; }
done <<< "$FILES"
echo no-app
