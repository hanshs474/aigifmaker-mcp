# AI GIF Maker MCP server

Turn text into animated GIFs with AI GIF Maker. Native GIF generation — no video conversion. Type what you want and download your GIF in about a minute.

This is the official MCP server for [AI GIF Maker](https://aigifmaker.ai/?utm_source=mcp&utm_medium=package). It lets Claude, Cursor, Cline, Gemini CLI or any MCP client make a GIF on your own account: describe it in chat, get the GIF URL back.

## Tools

| Tool | What it does |
|---|---|
| `generate_gif` | Text prompt in, animated GIF URL out. Waits for the GIF (usually about a minute) |
| `check_credits` | Credits left on your account (free to call) |

## API key

Create one at https://aigifmaker.ai/settings/apikeys and set it as `AIGIFMAKER_API_KEY`.

Each GIF costs 1 credit on your AI GIF Maker account, the same as on the website. New accounts get one free GIF (it carries a small aigifmaker.ai badge). A GIF that fails to generate gives its credit back. Credit packs are on the [pricing](https://aigifmaker.ai/pricing?utm_source=mcp&utm_medium=package) page.

## Install

```bash
npx -y aigifmaker-mcp
```

### Claude Desktop / Claude Code / Cursor / Cline

```json
{
  "mcpServers": {
    "aigifmaker": {
      "command": "npx",
      "args": ["-y", "aigifmaker-mcp"],
      "env": { "AIGIFMAKER_API_KEY": "sk-..." }
    }
  }
}
```

Claude Code in one line: `claude mcp add aigifmaker -e AIGIFMAKER_API_KEY=sk-... -- npx -y aigifmaker-mcp`

### Gemini CLI

```bash
gemini extensions install https://github.com/hanshs474/aigifmaker-mcp
```

### Claude Code plugin

```bash
claude plugin marketplace add hanshs474/aigifmaker-mcp
claude plugin install aigifmaker@aigifmaker
```

### Docker

```bash
docker build -t aigifmaker-mcp . && docker run -i --rm -e AIGIFMAKER_API_KEY=sk-... aigifmaker-mcp
```

## Notes

- A run from an account that has not bought credits yet may wait in a short queue before it starts; `generate_gif` keeps waiting (up to 5 minutes).
- Text to GIF only. There is no frame count, size, photo-to-GIF or editing option.
- `AIGIFMAKER_BASE_URL` overrides the endpoint; only useful against a local build of the site.

## Development

```bash
npm install
npm test                          # build + mocked unit tests, offline
node --test test/smoke.live.mjs   # two free live checks, no generation
```

MIT licensed. Questions: support@aigifmaker.ai
