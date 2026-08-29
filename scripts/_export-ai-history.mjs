// One-off: renders this project's Claude Code session .jsonl transcripts into
// readable markdown for the course submission's "AI Prompt and Response
// History" requirement. Run from the repo root: node scripts/_export-ai-history.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const PROJECT_DIR = join(
  os.homedir(),
  ".claude",
  "projects",
  "C--Users-mhnas-Downloads-Memo-d"
);
const OUT_DIR = join(process.cwd(), "docs", "ai-history");
mkdirSync(OUT_DIR, { recursive: true });

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && block.text) {
      parts.push(block.text);
    } else if (block.type === "tool_use") {
      const input = block.input ? JSON.stringify(block.input) : "";
      const short = input.length > 400 ? input.slice(0, 400) + "…" : input;
      parts.push(`\n> **Tool call:** \`${block.name}\`(${short})\n`);
    } else if (block.type === "tool_result") {
      let t = textFromContent(block.content);
      if (t.length > 1200) t = t.slice(0, 1200) + "\n…(truncated)…";
      if (t.trim()) parts.push(`\n> **Tool result:**\n> \`\`\`\n> ${t.replace(/\n/g, "\n> ")}\n> \`\`\`\n`);
    }
  }
  return parts.join("\n");
}

// Line-level nuking, not precise value extraction: a partial/truncated leak
// (e.g. from someone's earlier `grep | head -5`) has no closing quote or END
// marker for a bounded regex to match against, so the whole line is dropped
// instead of trying to surgically extract just the secret substring.
const LINE_TRIGGERS = [
  /BEGIN PRIVATE KEY/,
  /private_key/i,
  /FIREBASE_SERVICE_ACCOUNT_JSON\s*[:=]/,
  /AIzaSy[0-9A-Za-z_-]{10,}/,
  /gho_[0-9A-Za-z]{10,}/,
  /ghp_[0-9A-Za-z]{10,}/,
  /client_x509_cert_url/,
  // Bare base64 fragments of the leaked RSA key can end up quoted inside a
  // later grep command's own search pattern (no JSON marker around them),
  // so also catch runs of PEM-body-looking base64 on their own.
  /\bMII[A-Za-z0-9+/=]{20,}\b/,
  // Known-leaked literal, as a last-resort safety net.
  /MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcw/,
];

function redact(text) {
  return text
    .split("\n")
    .map((line) =>
      LINE_TRIGGERS.some((re) => re.test(line))
        ? "[REDACTED LINE — contained a credential fragment]"
        : line
    )
    .join("\n");
}

function renderFile(path, label) {
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const out = [`# AI session transcript — ${label}`, ""];
  let n = 0;
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = entry.message;
    if (!msg || !msg.role) continue;
    const text = redact(textFromContent(msg.content)).trim();
    if (!text) continue;
    n++;
    const who = msg.role === "user" ? "### User" : "### Assistant";
    out.push(who, "", text, "");
  }
  out.unshift(`<!-- ${n} messages rendered -->`);
  writeFileSync(join(OUT_DIR, `${label}.md`), out.join("\n"));
  console.log(`${label}: ${n} messages -> docs/ai-history/${label}.md`);
}

const files = readdirSync(PROJECT_DIR).filter((f) => f.endsWith(".jsonl"));
files.sort();
const index = ["# AI Prompt and Response History", "", "Session transcripts, in chronological order:", ""];
files.forEach((f, i) => {
  const label = `session-${String(i + 1).padStart(2, "0")}-${f.replace(".jsonl", "")}`;
  renderFile(join(PROJECT_DIR, f), label);
  index.push(`- [${label}](./${label}.md)`);
});
writeFileSync(join(OUT_DIR, "README.md"), index.join("\n") + "\n");
console.log("Wrote docs/ai-history/README.md index.");
