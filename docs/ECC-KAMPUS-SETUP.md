# ECC-inspired KAMPUS agent toolkit

## What was installed in this repository
- \`AGENTS.md\`: shared project instructions for Codex and compatible coding assistants.
- Five focused, human-readable skills under \`.agents/skills/\`: plan, UI, security, Kritic and verify.
- No app code, database rows, environment variables, deployment credentials, hooks, external executables or automated agents are installed by these Markdown files.

This is an **adaptation**, not an installation of the full ECC plugin. Codex can discover repository skills when working in a checked-out project; ChatGPT can read these files through the connected GitHub source when working on KAMPUS. That does not automatically install them as global ChatGPT skills or add runtime capabilities to this conversation.

## Recommended use in Codex
1. Open the actual \`panashemus/kampusfinalversion\` project directory in Codex.
2. Pull the latest \`main\` changes before starting new work.
3. Codex should read \`AGENTS.md\` and discover \`.agents/skills/*/SKILL.md\`.
4. For a task, say e.g. **"Improve KAMPUS profiles, following AGENTS.md and the kampus-ui and kampus-verify skills; test before deploying."**
5. For sensitive changes, require the \`kampus-security\` skill and an explicit migration/release plan.

## Optional: official full ECC installation
The current official upstream is https://github.com/affaan-m/ECC (not the outdated \`WorldFlowAI/everything-claude-code\` mirror in older search results).

ECC v2.2.3 documents a native Codex installation path. Run this locally **only if you want the full official plugin**, after reviewing its permissions, installer and source:

\`\`\`powershell
npx ecc-universal@2.2.3 install --guided --harness codex --dry-run
\`\`\`

Review the dry-run destinations and changes before choosing to perform the actual installation through the guided installer. A dry run is not an installation, and this project integration does not execute any npm installer.

Avoid stacking overlapping hook or global agent configurations blindly. The full ECC plugin and the KAMPUS-specific repository rules serve different purposes.

## Upstream source and license
Workflow concepts were studied and adapted from the MIT-licensed Everything Claude Code project at https://github.com/affaan-m/ECC, particularly:
- \`rules/common/development-workflow.md\` and \`rules/common/security.md\`
- \`rules/typescript/coding-style.md\`
- \`skills/frontend-patterns/SKILL.md\`
- \`skills/security-review/SKILL.md\`
- \`skills/verification-loop/SKILL.md\`
- \`skills/tdd-workflow/SKILL.md\`

These KAMPUS files are independently rewritten and specialized; they do **not** copy ECC's runtime hooks or pretend that ECC's specialized subagents are executable in ChatGPT.

## Security item to address separately
\`docs/FOUNDATION-AUDIT.md\` reports a non-placeholder VAPID private key was tracked in \`.env.local\` and therefore in Git history. The current repository tree still includes \`.env.local\`. Do **not** expose or distribute its contents. The repository owner should rotate affected keys using official provider controls, ensure the replacement is configured in production, and remove the tracked secret file from Git, while preserving deployments. Removing the current file does not erase Git history.

## Maintenance
Keep \`AGENTS.md\` short and update the relevant skill when KAMPUS architecture or policies change. Review upstream ECC releases selectively; do not blindly overwrite app-specific security and privacy rules.
