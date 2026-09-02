/* License Lens — knowledge base
 *
 * Every capability maps to one or more "paths". A path is a set of licences that
 * together grant the capability, plus the reasoning and the official Microsoft
 * source(s) that back it. Nothing in this file is invented: if it can't be tied
 * to a microsoft.com / learn.microsoft.com page, it doesn't belong here.
 *
 * Point-in-time. Microsoft licensing changes often — see META.updated and always
 * confirm against the Microsoft Product Terms before you rely on it commercially.
 *
 * Schema (see scripts/validate/validate.mjs for the enforced version):
 *   CATEGORIES[]  { id, name, colorVar }
 *   LICENSES[]    { id, name, family, type, rank, note, includes[], prerequisites[], source }
 *      includes    other LICENCE ids this one already grants (transitive). Used so the
 *                  engine knows e.g. Microsoft 365 E3 already covers Entra ID P1.
 *   CLARIFIERS[]  { id, question, options[ {id,label} ] }
 *   CAPABILITIES[]{ id, title, category, keywords[], description, paths[] }  // paths = PATH ids
 *   PATHS[]       { id, capabilityId, licenses[], rationale, conditions[], preferred?, note?, sources[] }
 *      condition   { clarifier, in[] }   // path applies only if the user's answer is in `in`
 */

const META = {
  updated: "2026-09-01",
  seed: true, // replaced by the researched dataset in Phase 3
  productTerms: "https://www.microsoft.com/licensing/terms/",
  licensingHome: "https://www.microsoft.com/en-us/licensing"
};

const CATEGORIES = [
  { id: "m365",     name: "Microsoft 365 & Copilot",           colorVar: "--cat-m365" },
  { id: "security", name: "Security, Identity & Devices",       colorVar: "--cat-security" },
  { id: "azure",    name: "Azure",                              colorVar: "--cat-azure" },
  { id: "bizapps",  name: "Dynamics 365 & Power Platform",      colorVar: "--cat-bizapps" }
];

/* rank: rough breadth/cost ordering used only to prefer a single broad suite
 * over a stack of narrow add-ons when both fully cover the basket. Not a price. */
const LICENSES = [
  {
    id: "o365-e3", name: "Office 365 E3", family: "m365", type: "suite", rank: 30,
    note: "Office apps plus Exchange Online, SharePoint, Teams and OneDrive. No Entra ID P1, Intune or Windows Enterprise — those come with Microsoft 365 E3.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/office365/servicedescriptions/office-365-platform-service-description/office-365-plan-options"
  },
  {
    id: "m365-e3", name: "Microsoft 365 E3", family: "m365", type: "suite", rank: 45,
    note: "Office 365 E3 plus Enterprise Mobility + Security E3 (Entra ID P1, Intune Plan 1) and Windows 11 Enterprise E3.",
    includes: ["o365-e3", "ems-e3", "entra-p1", "intune-p1", "win-e3-user"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plan-options"
  },
  {
    id: "m365-e5", name: "Microsoft 365 E5", family: "m365", type: "suite", rank: 70,
    note: "Microsoft 365 E3 plus Entra ID P2, the full Microsoft Defender suite, Microsoft Purview advanced compliance, Power BI Pro, Audio Conferencing and Teams Phone.",
    includes: ["m365-e3", "o365-e3", "ems-e3", "ems-e5", "entra-p1", "entra-p2", "intune-p1", "win-e3-user", "mde-p2", "mdo-p2", "e5-security", "purview-eda", "powerbi-pro"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plan-options"
  },
  {
    id: "m365-bp", name: "Microsoft 365 Business Premium", family: "m365", type: "suite", rank: 40,
    note: "For organisations under 300 seats. Office apps, Exchange/SharePoint/Teams, Entra ID P1, Intune, Windows 11 Business, Defender for Business and Defender for Office 365 Plan 1.",
    includes: ["entra-p1", "intune-p1"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/microsoft-365/business-premium/"
  },
  {
    id: "m365-f3", name: "Microsoft 365 F3", family: "m365", type: "suite", rank: 25,
    note: "Frontline-worker suite. Web/mobile Office, 2 GB mailbox, Entra ID P1, Intune, Windows Enterprise E3 rights. No desktop Office apps.",
    includes: ["entra-p1", "intune-p1", "win-e3-user"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/microsoft-365/frontline/flw-licensing-options"
  },
  {
    id: "copilot-m365", name: "Microsoft 365 Copilot", family: "m365", type: "addon", rank: 60,
    note: "Per-user add-on. Copilot in the Office apps, Teams, Outlook and Microsoft 365 Chat, with Graph grounding and Copilot Studio agent capacity.",
    prerequisites: ["A qualifying base: Microsoft 365 or Office 365 E3/E5/F3, or Business Standard/Premium"],
    source: "https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-requirements"
  },
  {
    id: "entra-p1", name: "Microsoft Entra ID P1", family: "security", type: "standalone", rank: 20,
    note: "Conditional Access, self-service password reset with writeback, dynamic groups, group-based licensing, cloud MDM auto-enrolment. Included in EMS E3 and Microsoft 365 E3.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/entra/fundamentals/licensing"
  },
  {
    id: "entra-p2", name: "Microsoft Entra ID P2", family: "security", type: "standalone", rank: 30,
    note: "Everything in P1 plus Identity Protection risk policies, Privileged Identity Management, access reviews and entitlement management. Included in EMS E5 and Microsoft 365 E5.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/entra/fundamentals/licensing"
  },
  {
    id: "ems-e3", name: "Enterprise Mobility + Security E3", family: "security", type: "suite", rank: 30,
    note: "Entra ID P1, Intune Plan 1, and Microsoft Purview / Azure Information Protection P1. The identity + management layer added on top of Office 365.",
    includes: ["entra-p1", "intune-p1"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/mem/intune/fundamentals/licenses"
  },
  {
    id: "ems-e5", name: "Enterprise Mobility + Security E5", family: "security", type: "suite", rank: 45,
    note: "EMS E3 plus Entra ID P2, Microsoft Defender for Cloud Apps, Microsoft Defender for Identity and Azure Information Protection P2.",
    includes: ["ems-e3", "entra-p1", "entra-p2", "intune-p1"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/mem/intune/fundamentals/licenses"
  },
  {
    id: "intune-p1", name: "Microsoft Intune Plan 1", family: "security", type: "standalone", rank: 18,
    note: "Core cloud device and app management (MDM/MAM). Included in EMS E3, Microsoft 365 E3/E5/F3 and Business Premium.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/mem/intune/fundamentals/licenses"
  },
  {
    id: "intune-suite", name: "Microsoft Intune Suite", family: "security", type: "addon", rank: 35,
    note: "Add-on on top of Intune Plan 1. Adds Remote Help, Endpoint Privilege Management, Advanced Analytics, Microsoft Tunnel for MAM, Cloud PKI and Enterprise App Management.",
    prerequisites: ["Microsoft Intune Plan 1 (standalone or via a suite)"],
    source: "https://learn.microsoft.com/en-us/mem/intune/fundamentals/intune-add-ons"
  },
  {
    id: "mdo-p2", name: "Microsoft Defender for Office 365 Plan 2", family: "security", type: "addon", rank: 30,
    note: "Safe Attachments/Links plus Threat Explorer, automated investigation and response, attack simulation training. Included in Microsoft 365 E5 and E5 Security.",
    prerequisites: ["Exchange Online (standalone) or a qualifying Office 365 / Microsoft 365 plan"],
    source: "https://learn.microsoft.com/en-us/defender-office-365/mdo-about"
  },
  {
    id: "mde-p2", name: "Microsoft Defender for Endpoint Plan 2", family: "security", type: "addon", rank: 30,
    note: "Full endpoint detection and response, threat and vulnerability management, automated investigation. Plan 1 is included in Microsoft 365 E3; Plan 2 is in Microsoft 365 E5 / E5 Security.",
    prerequisites: ["A supported OS and a qualifying licence (per-user or per-device)"],
    source: "https://learn.microsoft.com/en-us/defender-endpoint/minimum-requirements"
  },
  {
    id: "e5-security", name: "Microsoft 365 E5 Security", family: "security", type: "addon", rank: 45,
    note: "Add-on for Microsoft 365 E3 / Office 365 E3 + EMS E3 customers. Bundles Entra ID P2, Defender for Endpoint P2, Defender for Office 365 P2, Defender for Identity and Defender for Cloud Apps.",
    includes: ["entra-p1", "entra-p2", "mde-p2", "mdo-p2"],
    prerequisites: ["Microsoft 365 E3, or Office 365 E3 + EMS E3, or the equivalent components"],
    source: "https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plan-options"
  },
  {
    id: "purview-eda", name: "Microsoft 365 E5 Compliance", family: "security", type: "addon", rank: 45,
    note: "Add-on for Microsoft 365 E3. Purview Information Protection P2, Insider Risk Management, Communication Compliance, eDiscovery (Premium), Audit (Premium) and Records Management.",
    includes: [],
    prerequisites: ["Microsoft 365 E3 or the equivalent components"],
    source: "https://learn.microsoft.com/en-us/purview/purview-compliance"
  },
  {
    id: "win-e3-user", name: "Windows 11 Enterprise E3 (per user)", family: "security", type: "standalone", rank: 18,
    note: "Per-user upgrade rights to Windows Enterprise for up to 5 devices, provided the device already has a qualifying Windows Pro OEM/retail licence. Included in Microsoft 365 E3.",
    prerequisites: ["Each device already licensed for Windows 10/11 Pro"],
    source: "https://learn.microsoft.com/en-us/windows/deployment/windows-enterprise-e3-overview"
  },
  {
    id: "azure-plan", name: "Azure (consumption)", family: "azure", type: "consumption", rank: 10,
    note: "Azure is billed on consumption (pay-as-you-go, or discounted via reservations / savings plans), not per-user licences. An Azure subscription plus the relevant service meters is what's needed.",
    prerequisites: [],
    source: "https://azure.microsoft.com/en-us/pricing/"
  },
  {
    id: "azure-hub", name: "Azure Hybrid Benefit", family: "azure", type: "benefit", rank: 5,
    note: "Not a licence to buy — a right to apply existing Windows Server / SQL Server licences with active Software Assurance (or subscription) to Azure VMs and reduce the compute rate.",
    prerequisites: ["Windows Server or SQL Server licences with Software Assurance or a qualifying subscription"],
    source: "https://azure.microsoft.com/en-us/pricing/hybrid-benefit/"
  },
  {
    id: "powerbi-pro", name: "Power BI Pro", family: "bizapps", type: "standalone", rank: 15,
    note: "Per-user. Publish reports to workspaces, share, and consume shared content. Included in Microsoft 365 E5.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/power-bi/fundamentals/service-features-license-type"
  },
  {
    id: "powerbi-ppu", name: "Power BI Premium Per User", family: "bizapps", type: "standalone", rank: 30,
    note: "Per-user. Adds paginated reports, larger models, higher refresh rates and other capacity features without buying a Fabric capacity.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/power-bi/enterprise/service-premium-per-user-faq"
  },
  {
    id: "fabric-capacity", name: "Microsoft Fabric capacity (F SKU)", family: "bizapps", type: "consumption", rank: 20,
    note: "A provisioned Fabric capacity (F2–F2048, or a Trial) billed on Capacity Units. All Fabric workloads — including the Fabric IQ workload (ontology, graph, planning, data and operations agents) — run on it and draw from the same CU pool. No separate SKU per workload.",
    prerequisites: [],
    source: "https://learn.microsoft.com/fabric/enterprise/licenses"
  },
  {
    id: "github-copilot-business", name: "GitHub Copilot Business", family: "m365", type: "standalone", rank: 20,
    note: "Per-seat GitHub Copilot for organisations (Enterprise is the larger tier). The seat must be assigned and the GitHub Copilot app policy enabled for the user — an assigned seat alone is not enough.",
    prerequisites: [],
    source: "https://learn.microsoft.com/microsoft-scout/admin-access-overview"
  },
  {
    id: "powerapps-premium", name: "Power Apps Premium", family: "bizapps", type: "standalone", rank: 25,
    note: "Per-user. Run custom canvas and model-driven apps, including premium connectors and Dataverse, outside the seeded rights that come with Microsoft 365 or Dynamics 365.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus"
  },
  {
    id: "powerautomate-premium", name: "Power Automate Premium", family: "bizapps", type: "standalone", rank: 25,
    note: "Per-user. Cloud flows with premium connectors, plus attended and unattended desktop flows (RPA) usage rights and Process Mining.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus"
  },
  {
    id: "copilot-studio", name: "Microsoft Copilot Studio", family: "bizapps", type: "standalone", rank: 30,
    note: "Build and publish custom agents. Licensed by a tenant subscription with a message pack, or by pay-as-you-go metering through an Azure subscription.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing-subscriptions"
  },
  {
    id: "d365-sales-ent", name: "Dynamics 365 Sales Enterprise", family: "bizapps", type: "standalone", rank: 40,
    note: "Full sales force automation: opportunity management, forecasting, sales sequences and the seeded Power Apps rights for the Sales app context.",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/dynamics365/get-started/licensing"
  },
  {
    id: "d365-team-members", name: "Dynamics 365 Team Members", family: "bizapps", type: "standalone", rank: 12,
    note: "Light-use licence for read access and a limited set of write scenarios across Dynamics 365 apps. Not for full operational use of an app.",
    prerequisites: ["At least one full Dynamics 365 user licence in the tenant"],
    source: "https://learn.microsoft.com/en-us/dynamics365/get-started/licensing"
  },
  {
    id: "d365-sales-prem", name: "Dynamics 365 Sales Premium", family: "bizapps", type: "standalone", rank: 55,
    note: "Sales Enterprise plus the AI-driven seller experience (conversation intelligence, predictive scoring, and the basic features of the built-in Sales agents).",
    includes: ["d365-sales-ent"],
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/dynamics365/sales/buy-dynamics-365-sales"
  },
  {
    id: "teams-ent", name: "Microsoft Teams (Enterprise / standalone)", family: "m365", type: "standalone", rank: 12,
    note: "A Teams licence, either inside a Microsoft 365 suite or bought standalone (for example Microsoft Teams Enterprise, or Teams EEA in the EEA/Switzerland).",
    prerequisites: [],
    source: "https://learn.microsoft.com/en-us/microsoftteams/teams-add-on-licensing/licensing-enhance-teams"
  },
  {
    id: "agent-365", name: "Microsoft Agent 365", family: "m365", type: "addon", rank: 30,
    note: "The platform that gives an agent its own identity, mailbox and Teams account and governs it. In public preview via a no-cost 'Microsoft 365 Frontier for Autopilots' SKU that includes 25 agent instances; Copilot Frontier must be enabled.",
    prerequisites: ["Microsoft 365 Copilot", "Copilot Frontier enabled in the Microsoft 365 admin center"],
    source: "https://learn.microsoft.com/dynamics365/sales/sales-dev-agent/activate-agent"
  }
];

const CLARIFIERS = [
  {
    id: "base-license",
    question: "What base licence does the organisation already have?",
    options: [
      { id: "none",    label: "None / not sure" },
      { id: "o365-e3", label: "Office 365 E3" },
      { id: "m365-e3", label: "Microsoft 365 E3" },
      { id: "m365-e5", label: "Microsoft 365 E5" },
      { id: "m365-bp", label: "Microsoft 365 Business Premium" },
      { id: "m365-f3", label: "Microsoft 365 F3 (frontline)" }
    ]
  },
  {
    id: "org-size",
    question: "Roughly how many users need this?",
    options: [
      { id: "smb",   label: "Under 300" },
      { id: "ent",   label: "300 or more" }
    ]
  },
  {
    id: "win-device",
    question: "Are the Windows devices already licensed for Windows Pro?",
    options: [
      { id: "yes", label: "Yes, all on Windows Pro" },
      { id: "no",  label: "No / mixed / not sure" }
    ]
  },
  {
    id: "sa-server-licenses",
    question: "Do you own Windows Server / SQL Server licences with active Software Assurance?",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no",  label: "No" }
    ]
  },
  {
    id: "powerapps-context",
    question: "Is the app used inside a Microsoft 365 / Dynamics 365 context, or standalone?",
    options: [
      { id: "seeded",     label: "Within Microsoft 365 / Dynamics 365" },
      { id: "standalone", label: "Standalone custom app" }
    ]
  }
];

const CAPABILITIES = [
  {
    id: "dlp-email-external",
    title: "Stop users emailing sensitive files outside the organisation",
    category: "security",
    keywords: ["dlp","data loss prevention","email","external","exfiltration","sensitive","attachment","block sharing","leak"],
    description: "Detect sensitive content (financial data, PII, credentials) in Exchange Online, SharePoint and OneDrive and block or warn on sharing.",
    paths: ["p-dlp-min", "p-dlp-e5"]
  },
  {
    id: "conditional-access",
    title: "Require MFA / device compliance for sign-in (Conditional Access)",
    category: "security",
    keywords: ["conditional access","mfa","multi-factor","device compliance","sign-in policy","block legacy auth","location policy","zero trust"],
    description: "Policy-based access control that evaluates user, device, location and risk before granting access to apps.",
    paths: ["p-ca-p1"]
  },
  {
    id: "identity-protection-pim",
    title: "Risk-based identity protection and just-in-time admin access",
    category: "security",
    keywords: ["identity protection","risky sign-in","privileged identity management","pim","just in time","access reviews","entitlement management"],
    description: "Automated response to risky users/sign-ins, time-bound elevation of admin roles, and periodic access recertification.",
    paths: ["p-ipp-p2", "p-ipp-e5sec"]
  },
  {
    id: "mdm-enroll",
    title: "Manage and secure company and BYOD mobile devices",
    category: "security",
    keywords: ["intune","mdm","mam","mobile device management","byod","enrol devices","app protection","wipe device","endpoint manager"],
    description: "Enrol Windows, iOS, Android and macOS devices, push configuration and apps, and apply app protection policies.",
    paths: ["p-mdm-intune"]
  },
  {
    id: "remote-help",
    title: "Built-in remote assistance for the helpdesk (Remote Help)",
    category: "security",
    keywords: ["remote help","remote assistance","helpdesk","screen sharing","endpoint privilege management","epm","remote control"],
    description: "Authenticated, compliance-aware remote view/control of managed devices, plus privilege elevation without permanent admin rights.",
    paths: ["p-remotehelp-suite"]
  },
  {
    id: "edr-endpoint",
    title: "Endpoint detection and response (EDR) with threat & vulnerability management",
    category: "security",
    keywords: ["defender for endpoint","edr","antivirus","threat and vulnerability management","tvm","endpoint security","automated investigation","xdr"],
    description: "Behavioural endpoint detection, automated investigation and remediation, and continuous vulnerability assessment.",
    paths: ["p-edr-mde2", "p-edr-e5sec"]
  },
  {
    id: "copilot-m365",
    title: "Copilot in Word, Excel, Outlook and Teams with company-data grounding",
    category: "m365",
    keywords: ["copilot","microsoft 365 copilot","generative ai","word","excel","outlook","teams","m365 chat","graph grounding","ai assistant"],
    description: "Microsoft 365 Copilot embedded in the Office apps and Teams, grounded on the user's Microsoft Graph content.",
    paths: ["p-copilot-need-base", "p-copilot-have-base"]
  },
  {
    id: "microsoft-scout",
    title: "Use Microsoft Scout",
    category: "m365",
    keywords: ["microsoft scout","scout","desktop agent","developer agent","github copilot agent","scout app","frontier"],
    description: "The Microsoft Scout desktop app (Windows 11 / macOS 12+) — an agent that runs on GitHub Copilot for developer and research tasks.",
    paths: ["p-scout"]
  },
  {
    id: "fabric-iq",
    title: "Use Fabric IQ (ontology, semantic layer, graph, operations agents)",
    category: "bizapps",
    keywords: ["fabric iq","microsoft iq","ontology","semantic layer","semantic intelligence","operations agent","data agent","graph","business entities","enterprise intelligence layer"],
    description: "The semantic-intelligence workload in Microsoft Fabric that turns data into shared business concepts and grounds agents in them. Currently in preview.",
    paths: ["p-fabric-iq"]
  },
  {
    id: "eDiscovery-premium",
    title: "Advanced eDiscovery and legal hold across Microsoft 365",
    category: "security",
    keywords: ["ediscovery","legal hold","litigation","review set","purview","insider risk","communication compliance","records management"],
    description: "End-to-end legal discovery workflow (custodians, hold, collect, review, export) beyond the standard content search.",
    paths: ["p-ediscovery-compliance"]
  },
  {
    id: "win-enterprise",
    title: "Windows 11 Enterprise edition features and management rights",
    category: "security",
    keywords: ["windows enterprise","windows 11 enterprise","e3","per user","per device","applocker","credential guard","long term servicing"],
    description: "Upgrade from Windows Pro to Enterprise for features like AppLocker, Credential Guard and advanced deployment/servicing controls.",
    paths: ["p-wine-e3"]
  },
  {
    id: "vm-linux-basic",
    title: "Run a Linux virtual machine in the cloud",
    category: "azure",
    keywords: ["azure vm","linux","virtual machine","iaas","compute","host server","pay as you go"],
    description: "A single Linux VM with managed disks and networking.",
    paths: ["p-vm-linux"]
  },
  {
    id: "vm-windows-sql",
    title: "Run Windows Server / SQL Server VMs in Azure at the best rate",
    category: "azure",
    keywords: ["azure vm","windows server","sql server","hybrid benefit","bring your own licence","byol","software assurance","reserved instance"],
    description: "Windows Server and SQL Server workloads on Azure IaaS, using existing licences where possible to lower the compute rate.",
    paths: ["p-vm-win-ahb", "p-vm-win-payg"]
  },
  {
    id: "powerbi-share",
    title: "Publish and share Power BI reports across the organisation",
    category: "bizapps",
    keywords: ["power bi","publish report","share dashboard","workspace","paginated report","premium per user","fabric capacity"],
    description: "Author reports and distribute them to colleagues who can view and interact with them.",
    paths: ["p-pbi-pro", "p-pbi-ppu"]
  },
  {
    id: "custom-canvas-app",
    title: "Build a custom business app with Power Apps",
    category: "bizapps",
    keywords: ["power apps","canvas app","model-driven","dataverse","premium connector","low code","custom app"],
    description: "A custom app for staff, potentially using Dataverse and premium connectors.",
    paths: ["p-papps-seeded", "p-papps-premium"]
  },
  {
    id: "rpa-desktop-flow",
    title: "Automate a legacy desktop application (RPA)",
    category: "bizapps",
    keywords: ["power automate","rpa","desktop flow","robotic process automation","unattended","attended","process automation"],
    description: "Record and run UI automation against desktop or web apps, attended or unattended.",
    paths: ["p-rpa-premium"]
  },
  {
    id: "custom-agent",
    title: "Build a custom AI agent / chatbot for staff or customers",
    category: "bizapps",
    keywords: ["copilot studio","agent","chatbot","virtual agent","conversational ai","bot","custom copilot","build agent"],
    description: "A custom conversational agent with its own knowledge sources and actions, published to Teams, a website or other channels.",
    paths: ["p-agent-studio"]
  },
  {
    id: "d365-sales-agent",
    title: "Use Sales agent (formerly Copilot for Sales) in Outlook and Teams",
    category: "bizapps",
    keywords: ["sales agent","copilot for sales","sales copilot","viva sales","crm in outlook","crm in teams","seller copilot","sales chat","record summary"],
    description: "The seller assistant that brings Dynamics 365 Sales or Salesforce CRM context into Outlook and Teams and appears as an agent inside Microsoft 365 Copilot. This is the successor to Copilot for Sales.",
    paths: ["p-sales-agent-full", "p-sales-agent-crmonly"]
  },
  {
    id: "d365-sales-dev-agent",
    title: "Use the Sales Development agent (SDR agent) with Dynamics 365 Sales",
    category: "bizapps",
    keywords: ["sales development agent","sdr agent","sales development representative","prospecting agent","agent 365","copilot frontier","outreach agent","autonomous agent"],
    description: "The Frontier / Agent 365 agent that runs in Microsoft Teams, does autonomous prospect outreach, and syncs leads and interactions back to Dynamics 365 Sales. Currently in preview.",
    paths: ["p-salesdev-agent"]
  },
  {
    id: "d365-builtin-sales-agents",
    title: "Use the built-in Dynamics 365 Sales agents (Sales Qualification / Close / Opportunity)",
    category: "bizapps",
    keywords: ["sales qualification agent","sales close agent","opportunity agent","research agent","dynamics 365 sales ai hub","lead qualification agent","built-in sales agent"],
    description: "The agents configured inside the Sales Hub AI hub that research and qualify leads, draft outreach and progress opportunities. Metered on Copilot Studio messages.",
    paths: ["p-builtin-sales-agents"]
  },
  {
    id: "d365-sales",
    title: "Full sales pipeline and forecasting for a sales team",
    category: "bizapps",
    keywords: ["dynamics 365 sales","crm","opportunity management","forecasting","pipeline","sales enterprise","team members"],
    description: "Operational CRM for sellers plus lighter access for people who only need to read or lightly update records.",
    paths: ["p-sales-ent", "p-sales-team"]
  }
];

/* Modelling note (seed): most paths are unconditional and point at the smallest
 * licence that grants the capability. When the user states an existing base
 * licence, the engine seeds it (and everything it `includes`) so an already-owned
 * entitlement is never re-recommended. `conditions` are used only where the
 * answer genuinely changes what must be bought. */
const PATHS = [
  // --- DLP ---
  { id: "p-dlp-min", capabilityId: "dlp-email-external", licenses: ["m365-e3"], preferred: true,
    rationale: "Microsoft Purview Data Loss Prevention for Exchange Online, SharePoint and OneDrive is included in Microsoft 365 E3, Office 365 E3 and Microsoft 365 Business Premium. No add-on if any of those is already in place.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/purview/dlp-microsoft-365-licensing"] },
  { id: "p-dlp-e5", capabilityId: "dlp-email-external", licenses: ["m365-e5"],
    rationale: "Microsoft 365 E5 also covers this and adds endpoint DLP and trainable classifiers — relevant only if E5 is justified for other reasons.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/purview/dlp-microsoft-365-licensing"] },

  // --- Conditional Access ---
  { id: "p-ca-p1", capabilityId: "conditional-access", licenses: ["entra-p1"], preferred: true,
    rationale: "Conditional Access is a Microsoft Entra ID P1 feature. P1 standalone is the minimum; it is also included in EMS E3/E5 and Microsoft 365 E3/E5/F3/Business Premium.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview","https://learn.microsoft.com/en-us/entra/fundamentals/licensing"] },

  // --- Identity Protection / PIM ---
  { id: "p-ipp-p2", capabilityId: "identity-protection-pim", licenses: ["entra-p2"], preferred: true,
    rationale: "Identity Protection, Privileged Identity Management, access reviews and entitlement management are all Microsoft Entra ID P2 features. P2 is included in EMS E5 and Microsoft 365 E5.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/entra/id-protection/overview-identity-protection","https://learn.microsoft.com/en-us/entra/fundamentals/licensing"] },
  { id: "p-ipp-e5sec", capabilityId: "identity-protection-pim", licenses: ["e5-security"],
    rationale: "The Microsoft 365 E5 Security add-on includes Entra ID P2, and can be a better fit for a Microsoft 365 E3 tenant that also wants the Defender suite.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plan-options"] },

  // --- Intune / MDM ---
  { id: "p-mdm-intune", capabilityId: "mdm-enroll", licenses: ["intune-p1"], preferred: true,
    rationale: "Microsoft Intune Plan 1 provides cloud MDM and MAM for all major platforms. It is included in EMS E3/E5 and Microsoft 365 E3/E5/F3/Business Premium.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/mem/intune/fundamentals/licenses"] },

  // --- Remote Help ---
  { id: "p-remotehelp-suite", capabilityId: "remote-help", licenses: ["intune-suite"], preferred: true,
    rationale: "Remote Help and Endpoint Privilege Management are part of the Microsoft Intune Suite add-on (also sold as individual add-ons). They are not in Intune Plan 1 or in Microsoft 365 E3/E5.",
    conditions: [],
    note: "Requires Intune Plan 1 underneath, which most Microsoft 365 suites already provide.",
    sources: ["https://learn.microsoft.com/en-us/mem/intune/fundamentals/intune-add-ons"] },

  // --- EDR ---
  { id: "p-edr-mde2", capabilityId: "edr-endpoint", licenses: ["mde-p2"], preferred: true,
    rationale: "Microsoft Defender for Endpoint Plan 2 is the licence that grants full EDR. It is sold standalone (per user or per device) and is included in Microsoft 365 E5 and the E5 Security add-on. Plan 1, in Microsoft 365 E3, does not include EDR.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/defender-endpoint/minimum-requirements","https://learn.microsoft.com/en-us/defender-endpoint/defender-endpoint-plan-1-2"] },
  { id: "p-edr-e5sec", capabilityId: "edr-endpoint", licenses: ["e5-security"],
    rationale: "The Microsoft 365 E5 Security add-on bundles Defender for Endpoint Plan 2 with the rest of the Defender suite — a good fit if endpoint, identity and email protection are all needed.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/microsoft-365/enterprise/microsoft-365-plan-options"] },

  // --- Copilot (base-license genuinely changes the answer) ---
  { id: "p-copilot-have-base", capabilityId: "copilot-m365", licenses: ["copilot-m365"], preferred: true,
    rationale: "Microsoft 365 Copilot is a per-user add-on. A qualifying base licence (Microsoft 365 or Office 365 E3/E5/F3, or Business Standard/Premium) is already present, so only the add-on is needed.",
    conditions: [{ clarifier: "base-license", in: ["o365-e3","m365-e3","m365-e5","m365-bp","m365-f3"] }],
    sources: ["https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-requirements"] },
  { id: "p-copilot-need-base", capabilityId: "copilot-m365", licenses: ["m365-e3","copilot-m365"], preferred: true,
    rationale: "Microsoft 365 Copilot requires a qualifying base licence. With no base in place, a suite such as Microsoft 365 E3 must be licensed alongside the Copilot add-on.",
    conditions: [{ clarifier: "base-license", in: ["none"] }],
    sources: ["https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-requirements"] },

  // --- eDiscovery ---
  { id: "p-ediscovery-compliance", capabilityId: "eDiscovery-premium", licenses: ["purview-eda"], preferred: true,
    rationale: "eDiscovery (Premium), Insider Risk Management and Communication Compliance come with the Microsoft 365 E5 Compliance add-on (or with Microsoft 365 E5 itself). They are not in Microsoft 365 E3.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/purview/ediscovery","https://learn.microsoft.com/en-us/purview/purview-compliance"] },

  // --- Windows Enterprise ---
  { id: "p-wine-e3", capabilityId: "win-enterprise", licenses: ["win-e3-user"], preferred: true,
    rationale: "Windows 11 Enterprise E3 per-user upgrade rights are included in Microsoft 365 E3/E5/F3 and sold standalone. Each device still needs an underlying Windows 10/11 Pro licence.",
    conditions: [],
    note: "If devices are not already on Windows Pro, licensing needs a per-device Windows Enterprise E3/E5 or new hardware with Pro — confirm the device estate.",
    sources: ["https://learn.microsoft.com/en-us/windows/deployment/windows-enterprise-e3-overview"] },

  // --- Azure VMs ---
  { id: "p-vm-linux", capabilityId: "vm-linux-basic", licenses: ["azure-plan"], preferred: true,
    rationale: "A Linux VM is pure Azure consumption — an Azure subscription plus the compute, disk and networking meters. No per-user licence and no OS licence charge for open-source Linux images.",
    conditions: [],
    sources: ["https://azure.microsoft.com/en-us/pricing/details/virtual-machines/linux/"] },
  { id: "p-vm-win-ahb", capabilityId: "vm-windows-sql", licenses: ["azure-plan","azure-hub"], preferred: true,
    rationale: "With Windows Server / SQL Server licences under Software Assurance, Azure Hybrid Benefit removes the OS/SQL licence portion of the VM rate; you still pay Azure compute consumption.",
    conditions: [{ clarifier: "sa-server-licenses", in: ["yes"] }],
    sources: ["https://azure.microsoft.com/en-us/pricing/hybrid-benefit/"] },
  { id: "p-vm-win-payg", capabilityId: "vm-windows-sql", licenses: ["azure-plan"], preferred: true,
    rationale: "Without eligible licences, run pay-as-you-go Windows / SQL images where the licence cost is built into the hourly rate. Reservations or a savings plan reduce the compute portion.",
    conditions: [{ clarifier: "sa-server-licenses", in: ["no"] }],
    sources: ["https://azure.microsoft.com/en-us/pricing/details/virtual-machines/windows/"] },

  // --- Power BI ---
  { id: "p-pbi-pro", capabilityId: "powerbi-share", licenses: ["powerbi-pro"], preferred: true,
    rationale: "Power BI Pro is the per-user licence required both to publish and to consume shared content in a non-capacity workspace. It is included in Microsoft 365 E5.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/power-bi/fundamentals/service-features-license-type"] },
  { id: "p-pbi-ppu", capabilityId: "powerbi-share", licenses: ["powerbi-ppu"],
    rationale: "Premium Per User is only needed if reports require capacity features (paginated reports, large models, high refresh) and you are not licensing a Fabric capacity.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/power-bi/enterprise/service-premium-per-user-faq"] },

  // --- Power Apps ---
  { id: "p-papps-seeded", capabilityId: "custom-canvas-app", licenses: ["m365-e3"], preferred: true,
    rationale: "Microsoft 365 licences include seeded Power Apps rights for apps that use standard connectors within the Microsoft 365 context. No premium licence if the app stays inside those limits.",
    conditions: [{ clarifier: "powerapps-context", in: ["seeded"] }],
    sources: ["https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus"] },
  { id: "p-papps-premium", capabilityId: "custom-canvas-app", licenses: ["powerapps-premium"], preferred: true,
    rationale: "A standalone app, or one using premium connectors / Dataverse / custom APIs, needs Power Apps Premium per user.",
    conditions: [{ clarifier: "powerapps-context", in: ["standalone"] }],
    sources: ["https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus"] },

  // --- RPA ---
  { id: "p-rpa-premium", capabilityId: "rpa-desktop-flow", licenses: ["powerautomate-premium"], preferred: true,
    rationale: "Attended desktop flows (RPA) need Power Automate Premium per user. Unattended runs need an additional Power Automate unattended add-on / Process add-on.",
    conditions: [],
    note: "Unattended automation requires the Power Automate Hosted/Unattended add-on on top of Premium.",
    sources: ["https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus"] },

  // --- Custom agent ---
  { id: "p-agent-studio", capabilityId: "custom-agent", licenses: ["copilot-studio"], preferred: true,
    rationale: "Custom agents are built in Microsoft Copilot Studio, licensed by a tenant subscription with a message pack or by pay-as-you-go metering through an Azure subscription.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing-subscriptions"] },

  // --- Microsoft Scout ---
  { id: "p-scout", capabilityId: "microsoft-scout", licenses: ["copilot-m365", "github-copilot-business"], preferred: true,
    rationale: "Microsoft Scout needs a Microsoft 365 Copilot licence assigned to a work or school account, plus a GitHub Copilot Business or Enterprise seat with the GitHub Copilot app policy enabled. The app installs per machine and the IT admin must complete Scout access setup first (Frontier access, Intune policy and attestation).",
    conditions: [],
    note: "Windows 11 or macOS 12+; local admin / Intune-enrolled device to install. Personal Microsoft accounts are not supported.",
    sources: [
      "https://learn.microsoft.com/microsoft-scout/get-started",
      "https://learn.microsoft.com/microsoft-scout/admin-access-overview"
    ] },

  // --- Fabric IQ ---
  { id: "p-fabric-iq", capabilityId: "fabric-iq", licenses: ["fabric-capacity"], preferred: true,
    rationale: "Fabric IQ is a workload inside Microsoft Fabric, not a separate product. It runs on a provisioned Fabric capacity (F SKU) and draws Capacity Units for ontology modelling, logic and operations, AI reasoning, graph refresh and operations-agent compute. Power BI licensing (Pro or Premium Per User) still applies to the semantic models and reports per the normal Fabric rules.",
    conditions: [],
    note: "When Fabric IQ answers are surfaced inside Microsoft 365 Copilot (Copilot Chat or Cowork), those users also need a Microsoft 365 Copilot licence and read access to the underlying Power BI content; Cowork adds its own usage-based billing. Preview.",
    sources: [
      "https://learn.microsoft.com/fabric/iq/overview",
      "https://learn.microsoft.com/fabric/enterprise/licenses",
      "https://learn.microsoft.com/fabric/iq/ontology/resources-capacity-usage",
      "https://learn.microsoft.com/fabric/iq/connectors/microsoft-365-copilot-overview"
    ] },

  // --- Sales agent (Copilot for Sales successor) ---
  { id: "p-sales-agent-full", capabilityId: "d365-sales-agent",
    licenses: ["copilot-m365", "d365-sales-ent"], preferred: true,
    rationale: "Sales agent is delivered through Microsoft 365 Copilot — a Microsoft 365 Copilot licence is required for the full experience (Graph grounding of Outlook mail, Teams meetings and messages, and use inside Microsoft 365 Copilot). It also needs a connected CRM: Dynamics 365 Sales Enterprise or Premium, or Salesforce. Users need the Salesperson or Sales Manager security role.",
    conditions: [],
    note: "If the Dynamics 365 Sales licence already includes Microsoft 365 Copilot access, no separate Copilot licence is needed. Salesforce can replace Dynamics 365 Sales as the CRM.",
    sources: [
      "https://learn.microsoft.com/microsoft-sales-copilot/introduction",
      "https://learn.microsoft.com/microsoft-sales-copilot/set-up-sales-chat",
      "https://learn.microsoft.com/dynamics365/sales/sales-agent-banner-summary"
    ] },
  { id: "p-sales-agent-crmonly", capabilityId: "d365-sales-agent",
    licenses: ["d365-sales-ent"],
    rationale: "Dynamics 365 Sales Enterprise or Premium on its own gives a limited Sales agent — CRM data only. Without Microsoft 365 Copilot there is no Microsoft Graph grounding (Outlook email, Teams meetings and messages) and no use inside Microsoft 365 Copilot.",
    conditions: [],
    sources: ["https://learn.microsoft.com/microsoft-sales-copilot/use-sales-chat"] },

  // --- Sales Development agent (Frontier / Agent 365) ---
  { id: "p-salesdev-agent", capabilityId: "d365-sales-dev-agent",
    licenses: ["copilot-m365", "teams-ent", "agent-365", "d365-sales-ent"], preferred: true,
    rationale: "The Sales Development agent needs Microsoft 365 Copilot (with Copilot Frontier enabled) and Microsoft Teams for every user who creates or manages an instance, plus Microsoft Agent 365 for the agent's own identity. For the Dynamics 365 integration, a Dynamics 365 Sales licence (Professional, Enterprise or Premium) is assigned to the agent user itself, with the Salesperson security role.",
    conditions: [],
    note: "Preview feature — subject to supplemental preview terms, not for production. Agent 365 is currently a no-cost preview SKU (25 agent instances). Teams can be standalone or bundled in the AI Teammate licence.",
    sources: [
      "https://learn.microsoft.com/dynamics365/sales/sales-dev-agent/activate-agent",
      "https://learn.microsoft.com/dynamics365/sales/sales-dev-agent/integrate-with-dynamics"
    ] },

  // --- Built-in Dynamics 365 Sales agents (SQA / Close / Opportunity) ---
  { id: "p-builtin-sales-agents", capabilityId: "d365-builtin-sales-agents",
    licenses: ["d365-sales-ent", "copilot-studio"], preferred: true,
    rationale: "The built-in Sales agents are configured in the Sales Hub AI hub and require a Dynamics 365 Sales licence plus Copilot Studio message capacity (a message pack or pay-as-you-go), set up in the Power Platform admin center. Sales Enterprise and Sales Premium include the basic Sales agent features; premium agent features additionally require a Microsoft 365 Copilot licence.",
    conditions: [],
    note: "Also needs server-side synchronisation with Exchange and a Dataverse app user (AISalesPerson role). A Power Platform administrator role is required to complete setup.",
    sources: [
      "https://learn.microsoft.com/dynamics365/sales/configure-sales-qualification-agent",
      "https://learn.microsoft.com/dynamics365/sales/prerequisites-for-all-agents",
      "https://learn.microsoft.com/dynamics365/sales/buy-dynamics-365-sales"
    ] },

  // --- D365 Sales ---
  { id: "p-sales-ent", capabilityId: "d365-sales", licenses: ["d365-sales-ent"], preferred: true,
    rationale: "Sellers who run the pipeline need a full Dynamics 365 Sales Enterprise licence. Sales Professional is a lower-cost option if the advanced features aren't required.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/dynamics365/get-started/licensing"] },
  { id: "p-sales-team", capabilityId: "d365-sales", licenses: ["d365-team-members"],
    rationale: "People who only read records or do light updates can use a Dynamics 365 Team Members licence instead of a full Sales licence, as long as one full licence exists in the tenant.",
    conditions: [],
    sources: ["https://learn.microsoft.com/en-us/dynamics365/get-started/licensing"] }
];

// exposed for app.js / validation
window.LL = { META, CATEGORIES, LICENSES, CLARIFIERS, CAPABILITIES, PATHS };
