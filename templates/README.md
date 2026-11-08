# n8n workflow templates with Alion

Two templates for the n8n template library. Both call Alion through the built-in **MCP Client** node and Alion's free open address `https://alion.io/mcp/open`, so they need no Alion account and no community node, and they work on n8n Cloud and self-hosted alike.

Tested on n8n 2.46.6 (self-hosted) on 2026-11-08: each JSON was imported into a fresh instance and run end to end, with every branch exercised. Results are below each template.

---

## 1. Build a weekly list of newly funded startups in your market with Alion

File: [`weekly-funded-startups.json`](weekly-funded-startups.json)

### Who it's for
Sales teams prospecting freshly funded companies, recruiters looking for startups about to hire, and investors or analysts tracking a sector.

### How it works
1. Every Monday at 08:00 the **Schedule Trigger** starts the workflow.
2. **Configure your market** holds the country, industry, funding stages, time window and table name.
3. **Create the table if missing** creates the n8n Data Table on the first run and reuses it afterwards.
4. The **MCP Client** asks Alion's `search_companies` tool for startups with a matching round in the window, newest round first.
5. **Split Out** turns the result into one item per startup.
6. **Keep startups not saved yet** drops domains already in the table, and **Save new startups** adds the rest: name, domain, industry, size, country, founding year, last round and its date, open roles.

### How to set up
1. Open **Configure your market** and set the country (ISO code), industry, funding stages and window (for example `90d`).
2. Run the workflow once and open the Data Table to check the rows.
3. Activate it.

### Requirements
- n8n 2.x with Data Tables (n8n Cloud or self-hosted).
- Nothing else: Alion's open address is free within 300 calls a day per network and 20 companies per search.

### How to customize
Add Slack, Gmail or Google Sheets after **Save new startups** for a weekly digest. Widen the search with comma-separated stages or industries.

**Test (2026-11-08):** first run saved 3 German fintech startups with a seed or Series A round in the last 90 days; the second run saved none (no duplicates).

---

## 2. Qualify inbound leads by their company domain with Alion

File: [`qualify-inbound-leads.json`](qualify-inbound-leads.json)

### Who it's for
Sales and growth teams that receive leads through a website form and want each one tagged with the company behind it before anyone replies.

### How it works
1. A visitor submits the **Lead form** (name, work email, optional website, message).
2. **Lead rules** holds the company sizes you reject, the list of personal email domains and the table name.
3. **Extract the company domain** takes the website if given, otherwise the email domain.
4. Personal addresses (Gmail, Outlook...) skip the lookup and are saved for review.
5. Work domains go to Alion's `resolve_company`; a known company is then checked with `check_counterparty` (signs of life, open roles).
6. **Score the lead** marks it **qualified** when the company is known and active and not in a rejected size band, otherwise **review**. Unknown companies and lookups that time out are saved for review too, so no lead is lost.
7. Every lead goes to an n8n Data Table, and the visitor sees a thank-you page.

### How to set up
1. Adjust **Lead rules**.
2. Activate the workflow, open the production URL of **Lead form** or embed it on your site.
3. Submit three test leads: a personal address, an address at a well-known company, and one at a made-up domain. Check the rows in the Data Table.

### Requirements
- n8n 2.x with Data Tables.
- Nothing else: Alion's open address is free within 300 calls a day per network. A lookup of an unknown domain can take up to two minutes.

### How to customize
Send qualified leads to Slack, email or your CRM after **Save the lead**. Extend **Lead rules** with industries or countries to prioritise.

**Test (2026-11-08):** `@stripe.com` → qualified (Stripe, 1001-5000, US, 731 open roles); `@gmail.com` → review (personal email); `@gmail.com` with website `notion.so` → qualified (Notion); made-up domain → review (unknown company); forced lookup timeout → review (lookup failed). The thank-you page was shown after each submission.
