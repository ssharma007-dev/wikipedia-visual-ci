#!/usr/bin/env bash
# Switch how passing PRs are merged ( for tickets without a label; the Jira label auto-ai-merge always merges automatically ):
#   code-approval  → the AI review must pass AND one person approves the PR; GitHub then merges by itself ( default )
#   auto           → the pipeline merges as soon as the AI review passes
# Usage: eyes-demo-agent/scripts/set-merge-policy.sh auto|code-approval      (needs gh, logged in as a repo admin)
set -euo pipefail
POLICY="${1:?auto or code-approval}"
REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
case "$POLICY" in auto) N=0 ;; code-approval) N=1 ;; *) echo "auto or code-approval"; exit 1 ;; esac
gh variable set MERGE_POLICY -R "$REPO" --body "$POLICY"
gh api -X PATCH "repos/$REPO" -F allow_auto_merge=true >/dev/null
ID=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="Protect main") | .id')
[ -n "$ID" ] || { echo "Ruleset 'Protect main' not found"; exit 1; }
gh api "repos/$REPO/rulesets/$ID" > /tmp/ruleset.json
node -e '
  const fs=require("fs"), r=JSON.parse(fs.readFileSync("/tmp/ruleset.json"));
  r.rules.find(x=>x.type==="pull_request").parameters.required_approving_review_count=+process.argv[1];
  fs.writeFileSync("/tmp/ruleset.json", JSON.stringify({name:r.name,target:r.target,enforcement:r.enforcement,conditions:r.conditions,rules:r.rules,bypass_actors:r.bypass_actors}));' "$N"
gh api -X PUT "repos/$REPO/rulesets/$ID" --input /tmp/ruleset.json >/dev/null
echo "Merge policy: $POLICY (required code approvals: $N)"
