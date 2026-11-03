import { fillCourtLineTokens } from '../lib/courtLineTokens';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface TemplateStructure {
  heading?: string;
  courtLine?: string;
  authorityNote?: string;
  sections?: { label: string; hint?: string }[];
}

export function getDraftTemplate(type: string, details: string, categoryId?: string, fieldsObj: Record<string, string> = {}, structure?: TemplateStructure): string {
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const heading = structure?.heading || type.toUpperCase();
  // P11 hygiene — the structure court line is a caption TEMPLATE (tokens such as
  // [CITY] / [RECIPIENT]): fill each token from the user's field values and strip
  // anything still unresolved so raw bracket tokens are never printed; when the
  // caption has no structure seed, use the generic verified frame instead.
  const structureCourtLine = structure?.courtLine
    ? fillCourtLineTokens(structure.courtLine, (name) => fieldsObj[name])
    : '';
  const courtLine = structure
    ? structureCourtLine
    : (categoryId === 'legal' ? 'BEFORE THE COMPETENT COURT / AUTHORITY OF JURISDICTION IN PAKISTAN' : 'TO: THE COMPETENT AUTHORITY');
  const sections = structure?.sections;
  const fieldValues = Object.values(fieldsObj);

  // F4: render the type-specific professional structure (heading, court/authority
  // line, ordered sections, declaration, date/place, signature area)
  let bodyHtml = '';
  if (sections && sections.length > 0) {
    bodyHtml = sections.map((s, i) => {
      const val = fieldValues[i] !== undefined ? fieldValues[i] : '';
      return `
        <div style="margin-bottom: 14px;">
          <p style="font-weight: bold; margin-bottom: 2px;">${i + 1}. ${s.label}</p>
          <p style="text-align: justify; border-bottom: 1px dotted #9ca3af; min-height: 22px;">${val || '___________________'}</p>
        </div>
      `;
    }).join('');
  } else {
    bodyHtml = `
      <p style="text-align: justify; margin-bottom: 20px; font-size: 12pt;">
        This formal document pertains to <b>${type}</b>. The specific facts, operational details, and statements declared for record are set forth below:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11pt;">
        <tbody>
          ${Object.keys(fieldsObj).length > 0 ? 
            Object.entries(fieldsObj).map(([k, v]) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 12px; font-weight: bold; width: 35%; background-color: #f9fafb;">${k}</td>
                <td style="padding: 10px 12px; width: 65%;">${v || '___________________'}</td>
              </tr>
            `).join('') : `
              <tr>
                <td style="padding: 12px; font-weight: bold;">Details & Statements:</td>
                <td style="padding: 12px;">${details || '___________________'}</td>
              </tr>
            `
          }
        </tbody>
      </table>
    `;
  }

  return `
    <div style="font-family: 'Times New Roman', Times, serif; color: #111827; line-height: 1.8; max-width: 800px; margin: 0 auto;">
      <div style="text-align: right; margin-bottom: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11pt;">
        Date: ${todayStr}
      </div>

      ${structure?.authorityNote ? `
        <p style="font-style: italic; font-size: 10pt; color: #4b5563; margin-bottom: 16px;">
          ${structure.authorityNote}
        </p>
      ` : ''}

      <h2 style="text-align: center; text-transform: uppercase; text-decoration: underline; font-size: 16pt; margin-bottom: 12px; font-weight: bold; letter-spacing: 0.05em;">
        ${heading}
      </h2>

      ${courtLine ? `
        <p style="text-align: center; font-weight: bold; margin-bottom: 24px; font-size: 12pt;">
          ${escapeHtml(courtLine)}
        </p>
      ` : ''}

      ${bodyHtml}

      <div style="margin-top: 30px; text-align: justify; font-size: 11pt; line-height: 1.8;">
        <p>
          It is solemnly affirmed and declared that the information provided herein is true and correct to the best of knowledge and belief, and nothing relevant has been concealed.
        </p>
      </div>

      <div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <p style="font-weight: bold; margin-bottom: 4px;">Verification / Witness:</p>
          <p>1. ___________________________</p>
          <p>2. ___________________________</p>
        </div>
        <div style="text-align: right;">
          <p style="margin-bottom: 40px;">____________________________________</p>
          <p style="font-weight: bold; text-transform: uppercase;">Applicant / Deponent Signature & Stamp</p>
          <p style="font-size: 10pt; color: #6b7280;">Date: ${todayStr}</p>
        </div>
      </div>

      <p style="font-style: italic; font-size: 9.5pt; color: #6b7280; margin-top: 30px;">
        Note: Formats may vary by court or authority. Verify the exact format with the relevant office before submission.
      </p>
    </div>
  `;
}

export function getMergedDocumentTemplate(formData: Record<string, string>): string {
  const rows = Object.entries(formData)
    .map(([k, v]) => `<tr><td style="padding:8px;font-weight:bold;">${k}</td><td style="padding:8px;">${v || '___________________'}</td></tr>`)
    .join('');

  return `
    <div style="font-family:'Times New Roman',serif;padding:24px;max-width:800px;margin:0 auto;">
      <h2 style="text-align:center;text-transform:uppercase;text-decoration:underline;">Merged Legal Document</h2>
      <p style="text-align:justify;margin:20px 0;">This document incorporates verified citizen declarations as set forth below:</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:40px;text-align:right;">
        <p>____________________________________</p>
        <p><b>Authorized Signature & Stamp</b></p>
      </div>
    </div>
  `;
}
