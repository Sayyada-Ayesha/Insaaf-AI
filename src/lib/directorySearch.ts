/**
 * src/lib/directorySearch.ts — the shared verified-directory search layer.
 *
 * Extracted from AgentSection so the Legal Agent and the Voice Agent search the
 * SAME Firestore records with the SAME rules. It contains no UI and no duplicate
 * data logic: every card here is a real record already verified elsewhere in the
 * app. Nothing is ever synthesized — an empty search returns an empty list.
 */
import { FirestoreService, type LawyerRecord, type LegalAidOrgRecord, type EmergencyContactRecord } from '../services/firestoreService';

export type DirectoryCard =
  | { kind: 'lawyer'; record: LawyerRecord }
  | { kind: 'org'; record: LegalAidOrgRecord }
  | { kind: 'emergency'; record: EmergencyContactRecord };

/** Specialization keyword → directory stems (matched against record specialization text). */
export const SPEC_KEYWORDS: { re: RegExp; en: string; roman: string; stems: string[] }[] = [
  { re: /criminal|faujdari|bail|jail|fir case|police case/i, en: "Criminal Law", roman: "Faujdari Qanoon", stems: ['criminal'] },
  { re: /family|khula|divorce|talaq|custody|inheritance|virsa|maintenance/i, en: "Family Law", roman: "Khandani Qanoon", stems: ['family', 'inherit'] },
  { re: /property|jaidad|land|zameen|transfer|mutation/i, en: "Property Law", roman: "Jaidad Qanoon", stems: ['property', 'land', 'estate', 'revenue'] },
  { re: /cyber|online|hack|blackmail|fia/i, en: "Cyber Crime", roman: "Cyber Crime", stems: ['cyber', 'it'] },
  { re: /labou?r|mazdoor|salary|workplace|union/i, en: "Labour Law", roman: "Labour Qanoon", stems: ['labor', 'labour'] },
  { re: /civil|muqadma|damages|recovery/i, en: "Civil Litigation", roman: "Civil Litigation", stems: ['civil'] },
  { re: /corporate|company|tax|business|karobar/i, en: "Corporate & Tax", roman: "Corporate aur Tax", stems: ['corporate', 'tax', 'banking', 'commercial'] },
  { re: /consumer|khareedar|defective|service/i, en: "Consumer Protection", roman: "Consumer Protection", stems: ['consumer'] },
  { re: /constitutional|fundamental rights|writ/i, en: "Constitutional Law", roman: "Aaini Qanoon", stems: ['constitutional', 'human rights'] },
];

/** Match a city that actually exists in the records — never an invented place. */
export function findCityInText(text: string, records: { city?: string }[]): string | undefined {
  const t = String(text || '').toLowerCase();
  const candidates = records
    .map(r => r.city)
    .filter((c): c is string => !!c)
    .sort((a, b) => b.length - a.length); // longest first ("tando adam" before "adam" fragment)
  return candidates.find(c => t.includes(c.toLowerCase()));
}

export async function searchLawyerCards(
  text: string,
  rom = false
): Promise<{ cards: DirectoryCard[]; usedCity?: string; usedSpec?: string; budgetAsked?: boolean }> {
  const all = await FirestoreService.getLawyers();
  const city = findCityInText(text, all);
  let results = all;
  if (city) results = results.filter(l => l.city.toLowerCase() === city.toLowerCase());

  let usedSpec: string | undefined;
  const spec = SPEC_KEYWORDS.find(s => s.re.test(text));
  if (spec) {
    const filtered = results.filter(l => {
      const specText = l.specialization.toLowerCase();
      return spec.stems.some(stem => specText.includes(stem));
    });
    if (filtered.length > 0) { results = filtered; usedSpec = rom ? spec.roman : spec.en; }
  }

  // Budget (F17): verified public fee schedules are not published by the Bar
  // Councils, so no fabricated fee filtering is applied. The reply notes this honestly.
  const budgetAsked = /budget|sasta|cheap|kam fee|low fee|munasib|affordable/i.test(text);
  return { cards: results.slice(0, 4).map(l => ({ kind: 'lawyer' as const, record: l })), usedCity: city, usedSpec, budgetAsked };
}

export async function searchOrgCards(text: string): Promise<{ cards: DirectoryCard[]; usedCity?: string }> {
  const all = await FirestoreService.getLegalAidOrganizations();
  const city = findCityInText(text, all);
  let results = all;
  if (city) results = results.filter(o => o.city.toLowerCase() === city.toLowerCase());
  // Narrow by service keyword when clearly present (women / children / labour ...)
  const serviceStems = [
    { re: /women|khawateen|aurat/i, stems: ['women'] },
    { re: /child|bacha|bache/i, stems: ['child'] },
    { re: /labou?r|mazdoor/i, stems: ['labour', 'labor'] },
    { re: /senior|old|buzurg/i, stems: ['senior'] },
    { re: /disabled|mazoor/i, stems: ['disab'] }
  ].find(s => s.re.test(text));
  if (serviceStems) {
    const filtered = results.filter(o =>
      o.services.some(s => serviceStems.stems.some(stem => s.toLowerCase().includes(stem))));
    if (filtered.length > 0) results = filtered;
  }
  return { cards: results.slice(0, 4).map(o => ({ kind: 'org' as const, record: o })), usedCity: city };
}

export async function searchEmergencyCards(text: string): Promise<DirectoryCard[]> {
  const all = await FirestoreService.getEmergencyContacts();
  const catStems = [
    { re: /cyber|fia|online/i, stems: ['cyber'] },
    { re: /women|aurat|khawateen/i, stems: ['women'] },
    { re: /child|bacha/i, stems: ['child'] },
    { re: /human rights|nchr/i, stems: ['rights'] },
    { re: /police|15/i, stems: ['police'] }
  ].find(c => c.re.test(text));
  let results = all;
  if (catStems) {
    const filtered = results.filter(c =>
      catStems.stems.some(stem => c.category.toLowerCase().includes(stem)));
    if (filtered.length > 0) results = filtered;
  }
  return results.slice(0, 4).map(c => ({ kind: 'emergency' as const, record: c }));
}
