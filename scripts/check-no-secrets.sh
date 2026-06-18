#!/usr/bin/env bash
# Local-only secret scanner.
#
# Runs before committing/pushing so that obvious API-key strings never
# leave the developer's machine. This is intentionally a low-effort
# pattern match — it is a safety net, not a replacement for GitHub's
# Secret Scanning + Push Protection. Keep the patterns here in sync
# with whatever providers the app talks to.

set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 2

# Patterns we always want to refuse at commit time:
#   - OpenAI / DeepSeek style keys (sk-…)
#   - NVIDIA NGC / NIM API keys (nvapi-…)
#   - Any "Authorization: Bearer …" header literal
#   - raw JSON fields that look like api_key / x-api-key with a value
patterns=(
  "sk-[A-Za-z0-9]{16,}"
  "nvapi-[A-Za-z0-9]{16,}"
  "Bearer [A-Za-z0-9._-]{20,}"
  "api[_-]?key[=:][\"' ]?[A-Za-z0-9._-]{12,}[\"']"
  "x-api-key[=:][\"' ]?[A-Za-z0-9._-]{12,}[\"']"
)

# Honor .gitignore so we don't waste time scanning build outputs.
# Use `git ls-files` if available; fall back to a plain find otherwise.
mapfile -t files < <(git ls-files -c -o --exclude-standard 2>/dev/null \
  | grep -vE '^(node_modules|dist|src-tauri/target)(/|$)' \
  | grep -vE '\.(tsbuildinfo|env)$' \
  || true)

exit_code=0
for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue
  for pattern in "${patterns[@]}"; do
    if grep -nE "$pattern" "$file" >/dev/null 2>&1; then
      echo "::error file=$file :: matched secret pattern: $pattern"
      grep -nE "$pattern" "$file" | head -n 3
      exit_code=1
    fi
  done
done

if [[ "$exit_code" -ne 0 ]]; then
  echo
  echo "Refusing to commit: at least one file looks like it might contain a real API key."
  echo "Double-check the matches above — if a value is intentional (e.g., an env-var example),"
  echo "move it to a placeholder or add a precise inline-ignore rule that does not weaken coverage."
fi

exit "$exit_code"
