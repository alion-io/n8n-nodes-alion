# @alion-io/n8n-nodes-alion

An [n8n](https://n8n.io) community node for [Alion](https://alion.io/developers): a live graph of companies worldwide (what each one does, where it operates, its tech stack, funding rounds and investors, how fast it hires), startup investors, verified job postings, and hiring and pay statistics.

Use it in workflows (build prospect lists, enrich leads, watch a market) or give it to an n8n AI Agent as a tool. **Most operations are free without an account.**

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Example workflows](#example-workflows) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

In n8n: **Settings → Community Nodes → Install**, enter `@alion-io/n8n-nodes-alion`. See the [n8n community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/) for self-hosted setups.

## Operations

| Resource | Operation | What it does | Needs a key |
|---|---|---|---|
| Company | Search | Companies by industry, country, size, founding year, startup or not, funding stage, recent rounds, investor, technology, ATS, hiring and growth level | No |
| Company | Get | One company in depth: funding, hiring, stack, offices, visa sponsorship | Yes |
| Company | Get Similar | Lookalikes of a company | No |
| Company | Resolve | Which company a name or a domain means | No |
| Company | Check | Whether a domain, site, email or agent is a real, verified counterparty | No |
| Job | Search | Verified job postings by role, country, city, work mode, seniority, pay, technology and visa sponsorship | No |
| Job | Get | One posting in full | No |
| Investor | Search | Funds, accelerators and angels by stage, sector, geography and activity | Yes |
| Investor | Get | One investor: portfolio, rounds, co-investors | Yes |
| Market | Get Statistics | Demand, pay percentiles, top employers and technologies of a role in a country | Yes |

Searches return one item per row. Use **Return All** or **Limit** (Alion stops a search at 100 rows; narrow the filters to reach further). **Simplify** (on by default) returns the compact form of each row.

The filters come from the tool schemas of the Alion server, so they always match what the API accepts.

## Credentials

Without credentials, leave **Authentication** on **None (Free Open Address)**: compact searches, lookalikes, job postings and checks are free within a daily allowance per network (300 calls a day, up to 20 rows a page).

For full company and investor profiles and pay statistics:

1. Create a key at [alion.io/developers/keys](https://alion.io/developers/keys).
2. In the node set **Authentication** to **API Key** and create an **Alion API** credential with that key.

Calls with a key are paid from the account's credits. Prices are at [alion.io/developers](https://alion.io/developers).

## Example workflows

- **Weekly startup list to a sheet.** Schedule Trigger → Alion (Company: Search, Filters: Country `DE`, Startup, Funding Stage `seed`, Raised Since `90d`) → Google Sheets (Append).
- **Check a lead before a call.** Webhook → Alion (Company: Resolve, Company `{{ $json.email.split('@')[1] }}`) → Alion (Company: Check) → Slack.
- **Research agent.** AI Agent with the Alion node attached as a tool: "Find fintech startups in Poland that are hiring backend engineers and list their stacks."

## Compatibility

Built with `@n8n/node-cli` 0.55 against n8n 2.x. No run-time dependencies.

## Resources

- [Alion developer docs](https://alion.io/developers)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- Other Alion clients: [`@alion-io/sdk`](https://www.npmjs.com/package/@alion-io/sdk) (JavaScript), [`alion`](https://pypi.org/project/alion/) (Python), [`@alion-io/mcp`](https://www.npmjs.com/package/@alion-io/mcp) (MCP over stdio)

## Development

```bash
npm ci
npm run build && npm run lint
npm test                      # runs the node against alion.io without a key
node scripts/generate.mjs     # refresh the filters from https://alion.io/mcp/tools
```

Releases: `npm run release` bumps the version, tags and pushes; the GitHub Actions workflow publishes to npm with provenance.

## License

[MIT](LICENSE.md)
