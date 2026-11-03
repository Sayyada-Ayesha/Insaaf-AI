import admin from 'firebase-admin';

export const legalAidOrganizations = [
  {
    id: "org-1",
    name: "AGHS Legal Aid Cell",
    description: "Pioneering free legal aid organization founded by Asma Jahangir, protecting women, children, and minority rights in Pakistan.",
    city: "Lahore",
    coverage: "Punjab & Federal",
    province: "Punjab",
    services: ["Free Legal Representation", "Human Rights Advocacy", "Women & Children Legal Defense"],
    eligibility: "Underserved citizens, women, children, and victims of rights violations.",
    phone: "+92-42-35763234",
    email: "aghs@lhr.comsats.net.pk",
    address: "104-E/2, Gulberg III, Lahore, Punjab",
    website: "https://aghslaw.net/",
    officialSourceUrl: "https://aghslaw.net/",
    active: true
  },
  {
    id: "org-2",
    name: "Legal Aid Society (LAS)",
    description: "Non-profit organization dedicated to simplifying access to justice and providing legal empowerment across Sindh and Pakistan.",
    city: "Karachi",
    coverage: "Sindh & Nationwide",
    province: "Sindh",
    services: ["Free Legal Helpline (0800-70806)", "Prisoner Legal Aid", "Alternative Dispute Resolution"],
    eligibility: "Indigent prisoners, marginalized citizens, and low-income litigants.",
    phone: "+92-21-99217800",
    email: "info@las.org.pk",
    address: "Suite 501, Clifton Centre, Block 5, Clifton, Karachi, Sindh",
    website: "https://las.org.pk/",
    officialSourceUrl: "https://las.org.pk/",
    active: true
  },
  {
    id: "org-3",
    name: "Ministry of Human Rights Helpline",
    description: "Official Government of Pakistan legal assistance and human rights grievance redressal mechanism.",
    city: "Islamabad",
    coverage: "Nationwide",
    province: "Islamabad Capital Territory",
    services: ["24/7 Toll-Free Legal Advice (1099)", "Human Rights Complaints", "State Legal Assistance Referral"],
    eligibility: "All Pakistani citizens seeking human rights protection or government legal support.",
    phone: "1099",
    email: "info@mohr.gov.pk",
    address: "Kohsar Block, Pak Secretariat, Islamabad",
    website: "https://mohr.gov.pk/",
    officialSourceUrl: "https://mohr.gov.pk/",
    active: true
  },
  {
    id: "org-4",
    name: "Digital Rights Foundation (DRF)",
    description: "Independent NGO providing specialized legal advice, digital safety guidance, and harassment defense.",
    city: "Lahore",
    coverage: "Nationwide",
    province: "Punjab",
    services: ["Cyber Harassment Helpline (0800-39393)", "Digital Rights Legal Support", "PECA Legal Guidance"],
    eligibility: "Victims of online harassment, cybercrime, or digital privacy violations.",
    phone: "0800-39393",
    email: "helpdesk@digitalrightsfoundation.pk",
    address: "Lahore, Punjab",
    website: "https://digitalrightsfoundation.pk/",
    officialSourceUrl: "https://digitalrightsfoundation.pk/",
    active: true
  }
];

export const emergencyContacts = [
  {
    id: "emergency-1",
    name: "Police Emergency Assistance",
    category: "Police & Public Safety",
    phone: "15",
    description: "Immediate emergency police response across Pakistan",
    coverage: "Nationwide",
    color: "bg-rose-500",
    officialSourceUrl: "https://punjabpolice.gov.pk/",
    active: true,
    lastVerified: "2026-08-19"
  },
  {
    id: "emergency-2",
    name: "FIA Cybercrime Wing Helpline",
    category: "Cybercrime & Digital Fraud",
    phone: "1991",
    description: "Federal Investigation Agency helpline for online harassment, financial fraud, and cyber offenses",
    coverage: "Nationwide",
    color: "bg-blue-500",
    officialSourceUrl: "https://fia.gov.pk/",
    active: true,
    lastVerified: "2026-08-19"
  },
  {
    id: "emergency-3",
    name: "Women & Human Rights Helpline",
    category: "Human Rights & Domestic Abuse",
    phone: "1099",
    description: "Ministry of Human Rights helpline for domestic violence, abuse, and fundamental rights legal aid",
    coverage: "Nationwide",
    color: "bg-emerald-500",
    officialSourceUrl: "https://mohr.gov.pk/",
    active: true,
    lastVerified: "2026-08-19"
  },
  {
    id: "emergency-4",
    name: "Edhi Emergency Service",
    category: "Medical & Disaster Emergency",
    phone: "115",
    description: "Nationwide emergency medical, ambulance, and humanitarian response",
    coverage: "Nationwide",
    color: "bg-gray-800",
    officialSourceUrl: "https://edhi.org/",
    active: true,
    lastVerified: "2026-08-19"
  }
];

export async function seedOrgsAndEmergency() {
  console.log('--- Seeding Legal Aid Organizations & Emergency Contacts ---');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && admin.apps.length === 0) {
    console.warn('\n⚠️  WARNING: Firebase Admin credentials not configured.');
    return;
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }

  let targetDb;
  try {
    targetDb = admin.firestore(admin.app(), 'ai-studio-70142737-d617-4fdc-bfc9-a5697ec9f415');
  } catch (e) {
    targetDb = admin.firestore();
  }

  // Seed Organizations
  const orgsRef = targetDb.collection('legalAidOrganizations');
  for (const org of legalAidOrganizations) {
    await orgsRef.doc(org.id).set(org, { merge: true });
  }
  console.log(`Seeded ${legalAidOrganizations.length} Legal Aid Organizations to Firestore.`);

  // Seed Emergency Contacts
  const emergencyRef = targetDb.collection('emergencyContacts');
  for (const contact of emergencyContacts) {
    await emergencyRef.doc(contact.id).set(contact, { merge: true });
  }
  console.log(`Seeded ${emergencyContacts.length} Emergency Contacts to Firestore.`);
}
