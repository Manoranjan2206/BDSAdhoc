import os
import random
import datetime
import subprocess

# Ensure seed randomness is reproducible
random.seed(42)

TENANTS = [
    {
        "db_name": "crm_alphacorp",
        "tenant_id": 1,
        "company_name": "AlphaCorp",
        "domain": "alphacorp.com",
        "users": [
            {"name": "Anna Smith", "email": "alpha1@alphacorp.com", "role": "Admin", "region": "North America", "avatar": "https://randomuser.me/api/portraits/women/11.jpg"},
            {"name": "John Doe", "email": "alpha2@alphacorp.com", "role": "Sales", "region": "Europe", "avatar": "https://randomuser.me/api/portraits/men/12.jpg"},
            {"name": "Linda Lee", "email": "alpha3@alphacorp.com", "role": "Finance", "region": "Asia", "avatar": "https://randomuser.me/api/portraits/women/13.jpg"},
            {"name": "Mike Brown", "email": "alpha4@alphacorp.com", "role": "Support", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/men/14.jpg"},
            {"name": "Chris Green", "email": "alpha5@alphacorp.com", "role": "Operations", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/men/15.jpg"}
        ]
    },
    {
        "db_name": "crm_betasolutions",
        "tenant_id": 2,
        "company_name": "BetaSolutions",
        "domain": "betasolutions.com",
        "users": [
            {"name": "Betty Jones", "email": "beta1@betasolutions.com", "role": "Admin", "region": "North America", "avatar": "https://randomuser.me/api/portraits/men/21.jpg"},
            {"name": "Julia King", "email": "beta2@betasolutions.com", "role": "Sales", "region": "Europe", "avatar": "https://randomuser.me/api/portraits/women/22.jpg"},
            {"name": "Brian Adams", "email": "beta3@betasolutions.com", "role": "Finance", "region": "Asia", "avatar": "https://randomuser.me/api/portraits/men/23.jpg"},
            {"name": "Diana Miller", "email": "beta4@betasolutions.com", "role": "Support", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/women/24.jpg"},
            {"name": "Eliza Scott", "email": "beta5@betasolutions.com", "role": "Operations", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/women/25.jpg"}
        ]
    },
    {
        "db_name": "crm_gammaindustries",
        "tenant_id": 3,
        "company_name": "GammaIndustries",
        "domain": "gammaindustries.com",
        "users": [
            {"name": "George William", "email": "gamma1@gammaindustries.com", "role": "Admin", "region": "North America", "avatar": "https://randomuser.me/api/portraits/men/31.jpg"},
            {"name": "Jack Black", "email": "gamma2@gammaindustries.com", "role": "Sales", "region": "Europe", "avatar": "https://randomuser.me/api/portraits/men/32.jpg"},
            {"name": "Olivia Martin", "email": "gamma3@gammaindustries.com", "role": "Finance", "region": "Asia", "avatar": "https://randomuser.me/api/portraits/women/33.jpg"},
            {"name": "Sophia White", "email": "gamma4@gammaindustries.com", "role": "Support", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/women/34.jpg"},
            {"name": "Noah Clark", "email": "gamma5@gammaindustries.com", "role": "Operations", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/men/35.jpg"}
        ]
    },
    {
        "db_name": "crm_deltaenterprises",
        "tenant_id": 4,
        "company_name": "DeltaEnterprises",
        "domain": "deltaenterprises.com",
        "users": [
            {"name": "Megan Young", "email": "delta1@deltaenterprises.com", "role": "Admin", "region": "North America", "avatar": "https://randomuser.me/api/portraits/women/41.jpg"},
            {"name": "Zoe Turner", "email": "delta2@deltaenterprises.com", "role": "Sales", "region": "Europe", "avatar": "https://randomuser.me/api/portraits/women/42.jpg"},
            {"name": "Ryan Evans", "email": "delta3@deltaenterprises.com", "role": "Finance", "region": "Asia", "avatar": "https://randomuser.me/api/portraits/men/43.jpg"},
            {"name": "Liam Cooper", "email": "delta4@deltaenterprises.com", "role": "Support", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/men/44.jpg"},
            {"name": "Emma Hall", "email": "delta5@deltaenterprises.com", "role": "Operations", "region": "Oceania", "avatar": "https://randomuser.me/api/portraits/women/45.jpg"}
        ]
    }
]

REGIONS = ["North America", "Europe", "Asia", "Oceania"]
REGION_WEIGHTS = [0.35, 0.30, 0.20, 0.15]

COMPANY_PREFIXES = ["Acme", "Nexus", "Quantum", "Horizon", "Apex", "Crestview", "Sterling", "Orion", "Summit", "Vanguard", "Zenith", "Pinnacle", "Aero", "Bio", "Cyber", "Data", "Echo", "Flux", "Global", "Hyper", "Infra", "Kinetix", "Logic", "Matrix", "Nova", "Omni", "Pulse", "Radius", "Synapse", "Terra", "Ultra", "Vertex", "Wave", "Xenon", "Yotta", "Zero"]
COMPANY_SUFFIXES = ["Corp", "Dynamics", "Systems", "Tech", "Global", "Labs", "Financial", "Logistics", "Health", "Media", "Retail", "Energy", "Solutions", "Industries", "Ventures", "Networks", "Cloud", "Group", "Holdings", "Partners", "Software", "Services"]

FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy", "Matthew", "Betty", "Anthony", "Sandra", "Mark", "Margaret", "Donald", "Ashley", "Steven", "Kimberly", "Andrew", "Emily", "Paul", "Donna", "Joshua", "Michelle", "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa", "Timothy", "Deborah"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"]

JOB_TITLES = ["VP of Engineering", "Chief Technology Officer", "Director of IT", "Head of Procurement", "Senior Product Manager", "Financial Controller", "Operations Manager", "Security Director", "Lead Developer", "VP of Sales", "Supply Chain Lead", "Infrastructure Architect"]
LEAD_SOURCES = ["Website Inbound", "LinkedIn Outreach", "Tech Conference", "Partner Referral", "Cold Email", "Executive Network", "Webinar Signup"]

PRODUCTS_CATALOG = [
    ("Enterprise CRM License (Annual)", "Software", 12000.00),
    ("BI & Analytics Engine Pro", "Software", 18000.00),
    ("Cloud Infrastructure Suite", "Hardware/Hosting", 24000.00),
    ("Custom API Integration Package", "Services", 8500.00),
    ("24/7 Dedicated Support SLA", "Support", 6000.00),
    ("Data Warehouse Connector", "Software", 4500.00),
    ("Security & Audit Module", "Software", 7200.00),
    ("Mobile SDK Add-on", "Software", 3500.00),
    ("Executive Advisory Consulting (10 hrs)", "Services", 5000.00),
    ("Automated Workflow Builder", "Software", 9800.00),
    ("AI Predictive Insights Engine", "Software", 15000.00),
    ("Multi-Tenant Storage Expansion", "Hardware/Hosting", 3200.00),
    ("Compliance & Governance Shield", "Software", 11000.00),
    ("Staff Training & Certification (3 Days)", "Services", 4200.00),
    ("Disaster Recovery Replication", "Hardware/Hosting", 7800.00)
]

STAGES = [
    ("Prospecting", 10),
    ("Qualification", 30),
    ("Proposal", 60),
    ("Negotiation", 80),
    ("Closed Won", 100),
    ("Closed Lost", 0)
]

STAGE_WEIGHTS = [0.15, 0.20, 0.25, 0.15, 0.20, 0.05]

ACTIVITY_TYPES = ["Call", "Email", "Meeting", "Demo", "Follow-up"]
ACTIVITY_SUBJECTS = [
    "Initial Discovery Call",
    "Product Architecture Demo",
    "Contract Terms Review",
    "Security Compliance Discussion",
    "Quarterly Roadmap Alignment",
    "Pricing & License Negotiation",
    "Post-Demo Q&A Session",
    "Onboarding Kickoff Meeting",
    "Technical Feasibility Review",
    "Executive Sponsor Check-in"
]

TICKET_CATEGORIES = ["Billing", "Technical", "Feature Request", "Bug", "General"]
TICKET_PRIORITIES = ["Low", "Medium", "High", "Critical"]
TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed", "Escalated"]
TICKET_SUBJECTS = [
    "SSO Integration Failure with Azure AD",
    "API Rate Limit Exceeded during bulk sync",
    "Invoice line item total mismatch",
    "Dashboard export PDF timeout",
    "Role permission upgrade request",
    "Data synchronization delay on region Asia",
    "Report filter reset issue on reload",
    "Webhook notification retry failure",
    "Custom domain SSL certificate renewal",
    "Audit log export missing timestamp"
]

CAMPAIGN_TYPES = ["Email", "Webinar", "Trade Show", "Social Media", "Content"]
CAMPAIGN_NAMES = [
    "Q3 Enterprise Tech Summit",
    "Winter Cloud Migration Webinar",
    "Spring AI Capabilities Launch",
    "Q4 Executive Roundtable",
    "Summer Security Whitepaper Lead Gen",
    "Annual Partner Ecosystem Expo",
    "Mid-Year Product Roadmap Preview",
    "Automated Workflows Masterclass"
]

TASK_TITLES = [
    "Send revised proposal with volume discount",
    "Schedule technical deep-dive with VP Eng",
    "Review legal redlines on Master Services Agreement",
    "Prepare QBR presentation deck",
    "Verify wire payment for invoice",
    "Follow up on pending security questionnaire",
    "Send sandbox trial credentials",
    "Confirm attendance for upcoming executive dinner"
]

EMAIL_SUBJECTS = [
    "Follow up regarding enterprise solution",
    "Proposal for custom analytics deployment",
    "Thank you for joining our product webinar",
    "Your invoice statement is ready",
    "Update on support ticket status",
    "Schedule confirmation: Architecture review",
    "Security & compliance documentation attached",
    "Quarterly product release notes"
]

def escape_sql_str(val):
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"

def random_date(start_date, end_date):
    if start_date >= end_date:
        return start_date
    delta = end_date - start_date
    if delta.days <= 0:
        return start_date
    random_days = random.randint(0, delta.days)
    random_seconds = random.randint(0, 86399)
    return start_date + datetime.timedelta(days=random_days, seconds=random_seconds)

def generate_tenant_sql(tenant):
    db_name = tenant["db_name"]
    users = tenant["users"]
    
    # Map user roles & emails
    users_by_region = {}
    users_by_email = {}
    sales_and_admin_users = []
    support_users = []
    
    for u in users:
        users_by_email[u["email"]] = u
        users_by_region.setdefault(u["region"], []).append(u)
        if u["role"] in ["Admin", "Sales"]:
            sales_and_admin_users.append(u)
        if u["role"] in ["Admin", "Support"]:
            support_users.append(u)

    sql_lines = []
    sql_lines.append(f"-- ============================================================================")
    sql_lines.append(f"-- SEED DATA FOR {tenant['company_name'].upper()} ({db_name})")
    sql_lines.append(f"-- ============================================================================")
    sql_lines.append("BEGIN;")
    
    # 1. Users
    sql_lines.append("\n-- 1. Seed Users")
    for u in users:
        sql_lines.append(
            f"INSERT INTO users (email, name, role, region, avatar_url) "
            f"VALUES ({escape_sql_str(u['email'])}, {escape_sql_str(u['name'])}, {escape_sql_str(u['role'])}, {escape_sql_str(u['region'])}, {escape_sql_str(u['avatar'])}) "
            f"ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, region = EXCLUDED.region, avatar_url = EXCLUDED.avatar_url;"
        )

    # 2. Products
    sql_lines.append("\n-- 2. Seed Products")
    for idx, (p_name, category, price) in enumerate(PRODUCTS_CATALOG, 1):
        sql_lines.append(
            f"INSERT INTO products (product_id, product_name, category, unit_price) "
            f"VALUES ({idx}, {escape_sql_str(p_name)}, {escape_sql_str(category)}, {price}) "
            f"ON CONFLICT (product_id) DO NOTHING;"
        )
    sql_lines.append("SELECT setval('products_product_id_seq', (SELECT MAX(product_id) FROM products));")

    # Time frame: Aug 1, 2025 to Jul 31, 2026
    start_dt = datetime.datetime(2025, 8, 1, 9, 0, 0)
    end_dt = datetime.datetime(2026, 7, 31, 17, 0, 0)

    # 3. Contacts (~260 contacts)
    sql_lines.append("\n-- 3. Seed Contacts")
    contacts = []
    contact_id = 1
    
    used_companies = set()
    while len(used_companies) < 180:
        c_name = f"{random.choice(COMPANY_PREFIXES)} {random.choice(COMPANY_SUFFIXES)}"
        used_companies.add(c_name)
    company_list = list(used_companies)

    for i in range(1, 261):
        fname = random.choice(FIRST_NAMES)
        lname = random.choice(LAST_NAMES)
        comp = company_list[i % len(company_list)]
        clean_comp = comp.lower().replace(" ", "").replace(",", "")
        email = f"{fname.lower()}.{lname.lower()}@{clean_comp}.com"
        phone = f"+1 ({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}"
        job = random.choice(JOB_TITLES)
        region = random.choices(REGIONS, weights=REGION_WEIGHTS)[0]
        source = random.choice(LEAD_SOURCES)
        status = random.choices(["Active", "Inactive", "Churned"], weights=[0.85, 0.10, 0.05])[0]
        
        # Pick owner in region if available, else admin
        owner = users_by_region.get(region, [users[0]])[0]["email"]
        created_at = random_date(start_dt, end_dt)

        contacts.append({
            "id": i,
            "fname": fname,
            "lname": lname,
            "email": email,
            "phone": phone,
            "company": comp,
            "job": job,
            "region": region,
            "source": source,
            "status": status,
            "owner": owner,
            "created_at": created_at
        })

        sql_lines.append(
            f"INSERT INTO contacts (contact_id, first_name, last_name, email, phone, company, job_title, region, lead_source, status, owner_email, created_at) "
            f"VALUES ({i}, {escape_sql_str(fname)}, {escape_sql_str(lname)}, {escape_sql_str(email)}, {escape_sql_str(phone)}, {escape_sql_str(comp)}, {escape_sql_str(job)}, {escape_sql_str(region)}, {escape_sql_str(source)}, {escape_sql_str(status)}, {escape_sql_str(owner)}, {escape_sql_str(created_at.isoformat())});"
        )
    sql_lines.append("SELECT setval('contacts_contact_id_seq', (SELECT MAX(contact_id) FROM contacts));")

    # 4. Deals (~190 deals)
    sql_lines.append("\n-- 4. Seed Deals")
    deals = []
    for d_id in range(1, 191):
        c = random.choice(contacts)
        d_name = f"{c['company']} - Enterprise Expansion Deal"
        stage, prob = random.choices(STAGES, weights=STAGE_WEIGHTS)[0]
        amount = round(random.uniform(8000, 220000), 2)
        region = c["region"]
        owner = c["owner"]
        created_at = random_date(c["created_at"], end_dt)
        
        exp_close = (created_at + datetime.timedelta(days=random.randint(15, 90))).date()
        act_close = None
        if stage in ["Closed Won", "Closed Lost"]:
            act_close = exp_close

        deals.append({
            "id": d_id,
            "name": d_name,
            "contact_id": c["id"],
            "owner": owner,
            "stage": stage,
            "amount": amount,
            "prob": prob,
            "region": region,
            "exp_close": exp_close,
            "act_close": act_close,
            "created_at": created_at
        })

        act_close_sql = escape_sql_str(act_close.isoformat()) if act_close else "NULL"
        sql_lines.append(
            f"INSERT INTO deals (deal_id, deal_name, contact_id, owner_email, stage, amount, currency, probability, region, expected_close_date, actual_close_date, created_at) "
            f"VALUES ({d_id}, {escape_sql_str(d_name)}, {c['id']}, {escape_sql_str(owner)}, {escape_sql_str(stage)}, {amount}, 'USD', {prob}, {escape_sql_str(region)}, {escape_sql_str(exp_close.isoformat())}, {act_close_sql}, {escape_sql_str(created_at.isoformat())});"
        )
    sql_lines.append("SELECT setval('deals_deal_id_seq', (SELECT MAX(deal_id) FROM deals));")

    # 5. Deal Products (~280 line items)
    sql_lines.append("\n-- 5. Seed Deal Products")
    dp_id = 1
    for d in deals:
        num_items = random.randint(1, 3)
        chosen_prods = random.sample(PRODUCTS_CATALOG, num_items)
        for p_name, cat, price in chosen_prods:
            qty = random.randint(1, 5)
            disc = random.choice([0.0, 0.0, 0.05, 0.10, 0.15])
            tot = round(qty * price * (1.0 - disc), 2)
            p_idx = [p[0] for p in PRODUCTS_CATALOG].index(p_name) + 1
            sql_lines.append(
                f"INSERT INTO deal_products (deal_product_id, deal_id, product_id, quantity, unit_price, discount_pct, total_price) "
                f"VALUES ({dp_id}, {d['id']}, {p_idx}, {qty}, {price}, {disc*100}, {tot});"
            )
            dp_id += 1
    sql_lines.append("SELECT setval('deal_products_deal_product_id_seq', (SELECT MAX(deal_product_id) FROM deal_products));")

    # 6. Activities (~750 activities)
    sql_lines.append("\n-- 6. Seed Activities")
    for a_id in range(1, 751):
        c = random.choice(contacts)
        d = random.choice([d for d in deals if d["contact_id"] == c["id"]] or [None])
        d_id_sql = d["id"] if d else "NULL"
        a_type = random.choice(ACTIVITY_TYPES)
        subj = random.choice(ACTIVITY_SUBJECTS)
        desc = f"{a_type} with {c['fname']} {c['lname']} ({c['company']}) discussing requirements and timeline."
        region = c["region"]
        owner = c["owner"]
        act_date = random_date(c["created_at"], end_dt)
        dur = random.choice([15, 30, 45, 60, 90])
        outcome = random.choice(["Completed", "Follow-up Needed", "Rescheduled", "Positive Interest", "Action Items Assigned"])

        sql_lines.append(
            f"INSERT INTO activities (activity_id, activity_type, subject, description, contact_id, deal_id, owner_email, region, activity_date, duration_minutes, outcome, created_at) "
            f"VALUES ({a_id}, {escape_sql_str(a_type)}, {escape_sql_str(subj)}, {escape_sql_str(desc)}, {c['id']}, {d_id_sql}, {escape_sql_str(owner)}, {escape_sql_str(region)}, {escape_sql_str(act_date.isoformat())}, {dur}, {escape_sql_str(outcome)}, {escape_sql_str(act_date.isoformat())});"
        )
    sql_lines.append("SELECT setval('activities_activity_id_seq', (SELECT MAX(activity_id) FROM activities));")

    # 7. Invoices (~140 invoices)
    sql_lines.append("\n-- 7. Seed Invoices")
    won_deals = [d for d in deals if d["stage"] == "Closed Won"]
    inv_id = 1
    for d in won_deals:
        c = [c for c in contacts if c["id"] == d["contact_id"]][0]
        inv_num = f"INV-2025-{inv_id:04d}" if d["created_at"].year == 2025 else f"INV-2026-{inv_id:04d}"
        amt = d["amount"]
        tax = round(amt * 0.08, 2)
        tot = amt + tax
        issued = d["act_close"] or d["created_at"].date()
        due = issued + datetime.timedelta(days=30)
        status = random.choices(["Paid", "Sent", "Overdue"], weights=[0.80, 0.15, 0.05])[0]
        paid_sql = escape_sql_str((issued + datetime.timedelta(days=random.randint(5, 25))).isoformat()) if status == "Paid" else "NULL"
        created_by = c["owner"]

        sql_lines.append(
            f"INSERT INTO invoices (invoice_id, invoice_number, contact_id, deal_id, amount, tax_amount, total_amount, currency, status, region, issued_date, due_date, paid_date, created_by, created_at) "
            f"VALUES ({inv_id}, {escape_sql_str(inv_num)}, {c['id']}, {d['id']}, {amt}, {tax}, {tot}, 'USD', {escape_sql_str(status)}, {escape_sql_str(c['region'])}, {escape_sql_str(issued.isoformat())}, {escape_sql_str(due.isoformat())}, {paid_sql}, {escape_sql_str(created_by)}, {escape_sql_str(d['created_at'].isoformat())});"
        )
        inv_id += 1
    sql_lines.append("SELECT setval('invoices_invoice_id_seq', (SELECT MAX(invoice_id) FROM invoices));")

    # 8. Revenue Summary (48 rows: 12 months x 4 regions)
    sql_lines.append("\n-- 8. Seed Revenue Summary (12 months x 4 regions)")
    rev_id = 1
    for year in [2025, 2026]:
        months = range(8, 13) if year == 2025 else range(1, 8)
        for m in months:
            m_date = datetime.date(year, m, 1)
            for r in REGIONS:
                # aggregate from deals
                m_deals = [d for d in deals if d["region"] == r and d["created_at"].year == year and d["created_at"].month == m]
                won_count = len([d for d in m_deals if d["stage"] == "Closed Won"])
                lost_count = len([d for d in m_deals if d["stage"] == "Closed Lost"])
                tot_rev = sum(d["amount"] for d in m_deals if d["stage"] == "Closed Won")
                avg_size = round(tot_rev / won_count, 2) if won_count > 0 else 0.0
                new_c = len([c for c in contacts if c["region"] == r and c["created_at"].year == year and c["created_at"].month == m])
                
                # Add base volume to ensure non-zero, realistic reporting figures
                if tot_rev == 0:
                    tot_rev = round(random.uniform(45000, 180000), 2)
                    won_count = random.randint(3, 8)
                    lost_count = random.randint(1, 3)
                    avg_size = round(tot_rev / won_count, 2)
                    new_c = random.randint(4, 12)

                sql_lines.append(
                    f"INSERT INTO revenue_summary (revenue_id, month, region, total_revenue, total_deals_won, total_deals_lost, avg_deal_size, new_contacts) "
                    f"VALUES ({rev_id}, {escape_sql_str(m_date.isoformat())}, {escape_sql_str(r)}, {tot_rev}, {won_count}, {lost_count}, {avg_size}, {new_c}) "
                    f"ON CONFLICT (month, region) DO UPDATE SET total_revenue = EXCLUDED.total_revenue, total_deals_won = EXCLUDED.total_deals_won;"
                )
                rev_id += 1
    sql_lines.append("SELECT setval('revenue_summary_revenue_id_seq', (SELECT MAX(revenue_id) FROM revenue_summary));")

    # 9. Support Tickets (~220 tickets)
    sql_lines.append("\n-- 9. Seed Support Tickets")
    for t_id in range(1, 221):
        c = random.choice(contacts)
        t_num = f"TKT-2025-{t_id:04d}" if t_id <= 110 else f"TKT-2026-{t_id:04d}"
        subj = random.choice(TICKET_SUBJECTS)
        desc = f"Customer reported: {subj}. Investigation initiated by tier-2 support."
        prio = random.choice(TICKET_PRIORITIES)
        status = random.choices(TICKET_STATUSES, weights=[0.10, 0.15, 0.50, 0.20, 0.05])[0]
        cat = random.choice(TICKET_CATEGORIES)
        assigned = random.choice(support_users)["email"]
        region = c["region"]
        created_at = random_date(c["created_at"], end_dt)
        resolved_at = created_at + datetime.timedelta(hours=random.randint(2, 72)) if status in ["Resolved", "Closed"] else None
        res_sql = escape_sql_str(resolved_at.isoformat()) if resolved_at else "NULL"
        csat = random.choice([3, 4, 5, 5, 5]) if status in ["Resolved", "Closed"] else "NULL"

        sql_lines.append(
            f"INSERT INTO support_tickets (ticket_id, ticket_number, subject, description, contact_id, priority, status, category, assigned_to, region, created_at, resolved_at, satisfaction_score) "
            f"VALUES ({t_id}, {escape_sql_str(t_num)}, {escape_sql_str(subj)}, {escape_sql_str(desc)}, {c['id']}, {escape_sql_str(prio)}, {escape_sql_str(status)}, {escape_sql_str(cat)}, {escape_sql_str(assigned)}, {escape_sql_str(region)}, {escape_sql_str(created_at.isoformat())}, {res_sql}, {csat});"
        )
    sql_lines.append("SELECT setval('support_tickets_ticket_id_seq', (SELECT MAX(ticket_id) FROM support_tickets));")

    # 10. Campaigns (~28 campaigns)
    sql_lines.append("\n-- 10. Seed Campaigns")
    campaigns = []
    for cmp_id in range(1, 29):
        c_name = f"{random.choice(CAMPAIGN_NAMES)} - {random.choice(REGIONS)}"
        c_type = random.choice(CAMPAIGN_TYPES)
        status = random.choice(["Active", "Completed", "Planned"])
        budget = round(random.uniform(5000, 45000), 2)
        cost = round(budget * random.uniform(0.85, 1.05), 2)
        region = random.choice(REGIONS)
        owner = users_by_region.get(region, [users[0]])[0]["email"]
        s_date = random_date(start_dt, end_dt).date()
        e_date = s_date + datetime.timedelta(days=random.randint(14, 60))
        leads = random.randint(15, 120)

        campaigns.append({"id": cmp_id, "region": region, "start": s_date})

        sql_lines.append(
            f"INSERT INTO campaigns (campaign_id, campaign_name, campaign_type, status, budget, actual_cost, start_date, end_date, region, owner_email, leads_generated, created_at) "
            f"VALUES ({cmp_id}, {escape_sql_str(c_name)}, {escape_sql_str(c_type)}, {escape_sql_str(status)}, {budget}, {cost}, {escape_sql_str(s_date.isoformat())}, {escape_sql_str(e_date.isoformat())}, {escape_sql_str(region)}, {escape_sql_str(owner)}, {leads}, {escape_sql_str(s_date.isoformat())});"
        )
    sql_lines.append("SELECT setval('campaigns_campaign_id_seq', (SELECT MAX(campaign_id) FROM campaigns));")

    # 11. Campaign Contacts (~350 junction records)
    sql_lines.append("\n-- 11. Seed Campaign Contacts")
    cc_id = 1
    used_pairs = set()
    for cmp in campaigns:
        reg_contacts = [c for c in contacts if c["region"] == cmp["region"]]
        sample_contacts = random.sample(reg_contacts, min(len(reg_contacts), 15))
        for c in sample_contacts:
            if (cmp["id"], c["id"]) in used_pairs:
                continue
            used_pairs.add((cmp["id"], c["id"]))
            resp = random.choice([True, False, True])
            resp_date = (cmp["start"] + datetime.timedelta(days=random.randint(1, 10))).isoformat() if resp else None
            resp_date_sql = escape_sql_str(resp_date) if resp_date else "NULL"
            
            sql_lines.append(
                f"INSERT INTO campaign_contacts (campaign_contact_id, campaign_id, contact_id, responded, response_date) "
                f"VALUES ({cc_id}, {cmp['id']}, {c['id']}, {'TRUE' if resp else 'FALSE'}, {resp_date_sql});"
            )
            cc_id += 1
    sql_lines.append("SELECT setval('campaign_contacts_campaign_contact_id_seq', (SELECT MAX(campaign_contact_id) FROM campaign_contacts));")

    # 12. Tasks (~400 tasks)
    sql_lines.append("\n-- 12. Seed Tasks")
    for tsk_id in range(1, 401):
        c = random.choice(contacts)
        d = random.choice([d for d in deals if d["contact_id"] == c["id"]] or [None])
        d_id_sql = d["id"] if d else "NULL"
        title = f"{random.choice(TASK_TITLES)} ({c['company']})"
        desc = f"Action item created for {c['fname']} {c['lname']}."
        assigned = c["owner"]
        prio = random.choice(["Low", "Medium", "High", "Urgent"])
        status = random.choice(["Completed", "Completed", "In Progress", "Pending"])
        created_at = random_date(c["created_at"], end_dt)
        due_date = (created_at + datetime.timedelta(days=random.randint(2, 14))).date()
        comp_at = created_at + datetime.timedelta(days=random.randint(1, 5)) if status == "Completed" else None
        comp_sql = escape_sql_str(comp_at.isoformat()) if comp_at else "NULL"

        sql_lines.append(
            f"INSERT INTO tasks (task_id, title, description, assigned_to, related_contact_id, related_deal_id, priority, status, due_date, region, completed_at, created_at) "
            f"VALUES ({tsk_id}, {escape_sql_str(title)}, {escape_sql_str(desc)}, {escape_sql_str(assigned)}, {c['id']}, {d_id_sql}, {escape_sql_str(prio)}, {escape_sql_str(status)}, {escape_sql_str(due_date.isoformat())}, {escape_sql_str(c['region'])}, {comp_sql}, {escape_sql_str(created_at.isoformat())});"
        )
    sql_lines.append("SELECT setval('tasks_task_id_seq', (SELECT MAX(task_id) FROM tasks));")

    # 13. Audit Log (~600 entries)
    sql_lines.append("\n-- 13. Seed Audit Log")
    tables_list = ["contacts", "deals", "invoices", "support_tickets", "tasks"]
    actions_list = ["INSERT", "UPDATE", "UPDATE", "DELETE"]
    for log_id in range(1, 601):
        tbl = random.choice(tables_list)
        act = random.choice(actions_list)
        rec_id = random.randint(1, 150)
        usr = random.choice(users)["email"]
        reg = random.choice(REGIONS)
        dt_val = random_date(start_dt, end_dt)
        details_json = f'{{"event": "Record {act}", "target": "{tbl}", "id": {rec_id}}}'

        sql_lines.append(
            f"INSERT INTO audit_log (log_id, table_name, record_id, action, performed_by, region, details, performed_at) "
            f"VALUES ({log_id}, {escape_sql_str(tbl)}, {rec_id}, {escape_sql_str(act)}, {escape_sql_str(usr)}, {escape_sql_str(reg)}, {escape_sql_str(details_json)}::jsonb, {escape_sql_str(dt_val.isoformat())});"
        )
    sql_lines.append("SELECT setval('audit_log_log_id_seq', (SELECT MAX(log_id) FROM audit_log));")

    # 14. Email Logs (~500 emails)
    sql_lines.append("\n-- 14. Seed Email Logs")
    for eml_id in range(1, 501):
        c = random.choice(contacts)
        d = random.choice([d for d in deals if d["contact_id"] == c["id"]] or [None])
        d_id_sql = d["id"] if d else "NULL"
        from_email = c["owner"]
        to_email = c["email"]
        subj = random.choice(EMAIL_SUBJECTS)
        body = f"Hi {c['fname']},\n\nFollowing up on our recent conversation regarding {c['company']}. Let us know if you need further details.\n\nBest regards,\n{users_by_email[from_email]['name']}"
        sent_at = random_date(c["created_at"], end_dt)
        status = random.choices(["Sent", "Delivered", "Opened", "Bounced"], weights=[0.10, 0.30, 0.55, 0.05])[0]

        sql_lines.append(
            f"INSERT INTO email_logs (email_log_id, from_email, to_email, subject, body_preview, contact_id, deal_id, region, sent_at, status) "
            f"VALUES ({eml_id}, {escape_sql_str(from_email)}, {escape_sql_str(to_email)}, {escape_sql_str(subj)}, {escape_sql_str(body)}, {c['id']}, {d_id_sql}, {escape_sql_str(c['region'])}, {escape_sql_str(sent_at.isoformat())}, {escape_sql_str(status)});"
        )
    sql_lines.append("SELECT setval('email_logs_email_log_id_seq', (SELECT MAX(email_log_id) FROM email_logs));")

    sql_lines.append("\nCOMMIT;")
    return "\n".join(sql_lines)

def run_psql_cmd(db_name, sql_content):
    p = subprocess.Popen(
        ["docker", "exec", "-i", "bdsadhoc-postgres", "psql", "-U", "postgres", "-d", db_name],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = p.communicate(input=sql_content)
    if p.returncode != 0:
        print(f"Error executing SQL on {db_name}:\n{stderr}")
    else:
        print(f"Successfully executed SQL on {db_name}")

def main():
    print("=== Enterprise CRM Database Provisioning & Data Seeding ===")
    
    # Read Schema SQL
    schema_path = os.path.join(os.path.dirname(__file__), "crm_schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    for tenant in TENANTS:
        db_name = tenant["db_name"]
        print(f"\n---> Provisioning tenant database: {db_name} ({tenant['company_name']})")

        # Check if Database exists, if not create it
        check_db = subprocess.run(
            ["docker", "exec", "-i", "bdsadhoc-postgres", "psql", "-U", "postgres", "-tAc", f"SELECT 1 FROM pg_database WHERE datname='{db_name}'"],
            capture_output=True, text=True
        )
        if "1" not in check_db.stdout:
            print(f"  - Creating database {db_name}...")
            subprocess.run(["docker", "exec", "-i", "bdsadhoc-postgres", "psql", "-U", "postgres", "-c", f"CREATE DATABASE {db_name};"], check=True)
        else:
            print(f"  - Database {db_name} already exists.")

        # Apply Schema
        print(f"  - Applying DDL schema (14 tables, indexes, RLS)...")
        run_psql_cmd(db_name, schema_sql)

        # Generate & Apply Seed Data
        print(f"  - Generating 12 months of CRM seed data (Aug 2025 - Jul 2026)...")
        seed_sql = generate_tenant_sql(tenant)
        
        # Save generated seed SQL file for reference/reproducibility
        seed_file_path = os.path.join(os.path.dirname(__file__), f"{db_name}_seed.sql")
        with open(seed_file_path, "w", encoding="utf-8") as sf:
            sf.write(seed_sql)
        print(f"  - Saved seed SQL file to: {seed_file_path}")

        print(f"  - Executing seed SQL on {db_name}...")
        run_psql_cmd(db_name, seed_sql)

    print("\n=== All 4 Tenant Databases Successfully Provisioned & Seeded! ===")

if __name__ == "__main__":
    main()
