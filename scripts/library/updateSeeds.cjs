const fs = require('fs');
const path = require('path');

const newSeedContent = `
export const SEED_LEGAL_AID_ORGS: LegalAidOrgRecord[] = [
  {
    id: "org-1",
    name: "AGHS Legal Aid Cell",
    description: "Pioneering free legal aid organization founded by Asma Jahangir, protecting women, children, and minority rights.",
    city: "Lahore",
    coverage: "Punjab & Federal",
    province: "Punjab",
    category: "Women & Child Protection",
    services: ["Free Legal Representation", "Human Rights Advocacy", "Women & Children Legal Defense"],
    eligibility: "Underserved citizens, women, children, and victims of rights violations.",
    phone: "+92-42-35763234",
    email: "aghs@lhr.comsats.net.pk",
    address: "104-E/2, Gulberg III, Lahore, Punjab",
    website: "https://aghslaw.net/",
    officialSourceUrl: "https://aghslaw.net/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-2",
    name: "Legal Aid Society (LAS)",
    description: "Simplifying access to justice and providing legal empowerment across Sindh and Pakistan.",
    city: "Karachi",
    coverage: "Sindh & Nationwide",
    province: "Sindh",
    category: "Legal Aid",
    services: ["Free Legal Helpline (0800-70806)", "Prisoner Legal Aid", "Alternative Dispute Resolution"],
    eligibility: "Indigent prisoners, marginalized citizens, and low-income litigants.",
    phone: "0800-70806",
    email: "info@las.org.pk",
    address: "Suite 501, Clifton Centre, Block 5, Clifton, Karachi, Sindh",
    website: "https://las.org.pk/",
    officialSourceUrl: "https://las.org.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-3",
    name: "Ministry of Human Rights Helpline",
    description: "Official Government of Pakistan legal assistance and human rights grievance redressal mechanism.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Government Institution",
    services: ["24/7 Toll-Free Legal Advice (1099)", "Human Rights Complaints", "State Legal Assistance Referral"],
    eligibility: "All Pakistani citizens seeking human rights protection or government legal support.",
    phone: "1099",
    email: "info@mohr.gov.pk",
    address: "Kohsar Block, Pak Secretariat, Islamabad",
    website: "https://mohr.gov.pk/",
    officialSourceUrl: "https://mohr.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-4",
    name: "Digital Rights Foundation (DRF)",
    description: "Independent NGO providing specialized legal advice, digital safety guidance, and harassment defense.",
    city: "Lahore",
    coverage: "Nationwide",
    province: "Punjab",
    category: "Cybercrime",
    services: ["Cyber Harassment Helpline (0800-39393)", "Digital Rights Legal Support", "PECA Legal Guidance"],
    eligibility: "Victims of online harassment, cybercrime, or digital privacy violations.",
    phone: "0800-39393",
    email: "helpdesk@digitalrightsfoundation.pk",
    address: "Lahore, Punjab",
    website: "https://digitalrightsfoundation.pk/",
    officialSourceUrl: "https://digitalrightsfoundation.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-5",
    name: "Madadgaar National Helpline",
    description: "Pakistan's first helpline for children and women suffering from abuse, violence, and exploitation.",
    city: "Karachi",
    coverage: "Nationwide",
    province: "Sindh",
    category: "Domestic Violence Support",
    services: ["Telephonic Counseling", "Legal Referrals", "Crisis Intervention"],
    eligibility: "Women, children, and youth in distress.",
    phone: "1098",
    email: "info@madadgaar.org",
    address: "Karachi, Sindh",
    website: "https://madadgaar.org/",
    officialSourceUrl: "https://madadgaar.org/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-6",
    name: "Punjab Women Protection Authority (PWPA)",
    description: "Official authority managing Violence Against Women Centers (VAWC) and women protection helplines.",
    city: "Lahore",
    coverage: "Punjab",
    province: "Punjab",
    category: "Women & Child Protection",
    services: ["1043 Toll-Free Helpline", "Violence Against Women Centers", "Legal & Medical Aid"],
    eligibility: "Women victims of violence residing in Punjab.",
    phone: "1043",
    email: "info@pwpa.punjab.gov.pk",
    address: "Lahore, Punjab",
    website: "https://pwpa.punjab.gov.pk/",
    officialSourceUrl: "https://pwpa.punjab.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-7",
    name: "Rozan",
    description: "NGO working on emotional health, gender, and violence against women and children.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Human Rights",
    services: ["Psychological Counseling", "Police Training", "Youth Empowerment"],
    eligibility: "General public, survivors of domestic violence.",
    phone: "0800-22444",
    email: "rozan@rozan.org",
    address: "Islamabad",
    website: "https://rozan.org/",
    officialSourceUrl: "https://rozan.org/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "org-8",
    name: "Supreme Court Human Rights Cell",
    description: "The official human rights cell under the Supreme Court of Pakistan for suo moto notices and fundamental rights violations.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    category: "Courts & Institutions",
    services: ["Fundamental Rights Petitions", "Public Interest Litigation Processing"],
    eligibility: "Aggrieved citizens denied fundamental rights.",
    phone: "+92-51-9220581",
    email: "hrc@supremecourt.gov.pk",
    address: "Supreme Court Building, Constitution Avenue, Islamabad",
    website: "https://www.supremecourt.gov.pk/",
    officialSourceUrl: "https://www.supremecourt.gov.pk/human-rights-cell/",
    active: true,
    lastVerified: "2026-08-12"
  }
];

export const SEED_EMERGENCY_CONTACTS: EmergencyContactRecord[] = [
  {
    id: "emergency-1",
    name: "Police Emergency Assistance",
    category: "Police",
    phone: "15",
    description: "Immediate emergency police response across Pakistan.",
    coverage: "Nationwide",
    color: "bg-rose-500",
    officialSourceUrl: "https://punjabpolice.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-2",
    name: "FIA Cybercrime Wing",
    category: "Cybercrime",
    phone: "1991",
    description: "Federal Investigation Agency helpline for online harassment and financial fraud.",
    coverage: "Nationwide",
    color: "bg-blue-500",
    officialSourceUrl: "https://fia.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-3",
    name: "Women & Human Rights Helpline",
    category: "Women's Support",
    phone: "1099",
    description: "Ministry of Human Rights helpline for domestic violence and rights violations.",
    coverage: "Nationwide",
    color: "bg-emerald-500",
    officialSourceUrl: "https://mohr.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-4",
    name: "Edhi Emergency Service",
    category: "Medical & Disaster Emergency",
    phone: "115",
    description: "Nationwide emergency medical, ambulance, and humanitarian response.",
    coverage: "Nationwide",
    color: "bg-gray-800",
    officialSourceUrl: "https://edhi.org/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-5",
    name: "Child Protection Bureau Helpline",
    category: "Child Protection",
    phone: "1121",
    description: "Punjab Child Protection & Welfare Bureau for rescued children.",
    coverage: "Punjab",
    color: "bg-orange-500",
    officialSourceUrl: "https://cpwb.punjab.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-6",
    name: "Citizen Portal (PMDU)",
    category: "Public Complaints",
    phone: "051-9000000",
    description: "Pakistan Citizen Portal for lodging complaints against government departments.",
    coverage: "Nationwide",
    color: "bg-purple-600",
    officialSourceUrl: "https://citizenportal.gov.pk/",
    active: true,
    lastVerified: "2026-08-12"
  },
  {
    id: "emergency-7",
    name: "Rangers Helpline (Sindh)",
    category: "Police & Security",
    phone: "1101",
    description: "Pakistan Rangers helpline for extortion, terrorism, and immediate threats in Sindh.",
    coverage: "Sindh",
    color: "bg-green-700",
    officialSourceUrl: "https://pakistanrangerssindh.org/",
    active: true,
    lastVerified: "2026-08-12"
  }
];
`;

const filePath = path.join(__dirname, '..', '..', 'src/services/firestoreService.ts');
let fileContent = fs.readFileSync(filePath, 'utf8');

const regexOrgs = /export const SEED_LEGAL_AID_ORGS.*?\];/s;
const regexEmergency = /export const SEED_EMERGENCY_CONTACTS.*?\];/s;

// We will just replace the content from export const SEED_LEGAL_AID_ORGS up to the end of SEED_EMERGENCY_CONTACTS array
const combinedRegex = /export const SEED_LEGAL_AID_ORGS: LegalAidOrgRecord\[\].*?\];\s*\n\/\/ Verifiable Public Emergency Contacts Seed Records\nexport const SEED_EMERGENCY_CONTACTS: EmergencyContactRecord\[\].*?\];/s;

if (combinedRegex.test(fileContent)) {
  fileContent = fileContent.replace(combinedRegex, newSeedContent.trim());
} else {
  // Try replacing them individually if the combined regex fails
  fileContent = fileContent.replace(regexOrgs, '').replace(regexEmergency, newSeedContent.trim());
}

fs.writeFileSync(filePath, fileContent);
console.log("Seeds updated successfully");
