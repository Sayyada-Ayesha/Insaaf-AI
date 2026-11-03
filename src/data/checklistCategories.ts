export interface ChecklistCategory {
  id: string;
  labelEn: string;
  labelRoman: string;
  descriptionEn: string;
  descriptionRoman: string;
}

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  {
    id: 'bail',
    labelEn: 'Bail Application',
    labelRoman: 'Zamanat Darkhwast',
    descriptionEn: 'I need to apply for bail in a criminal case',
    descriptionRoman: 'Mujhe criminal case mein zamanat chahiye'
  },
  {
    id: 'fir',
    labelEn: 'FIR Registration',
    labelRoman: 'FIR Darj Karwani Hai',
    descriptionEn: 'I need to register a First Information Report at the police station',
    descriptionRoman: 'Mujhe police station mein FIR darj karwani hai'
  },
  {
    id: 'family',
    labelEn: 'Family Case',
    labelRoman: 'Khandani Case',
    descriptionEn: 'I need help with a family matter — maintenance, custody, or divorce',
    descriptionRoman: 'Mujhe khandaani masle mein madad chahiye — nafqa, tahweel, ya talaq'
  },
  {
    id: 'consumer',
    labelEn: 'Consumer Complaint',
    labelRoman: 'Sarfeh Shikayat',
    descriptionEn: 'I want to file a consumer complaint against a product or service',
    descriptionRoman: 'Main kisi product ya service ke khilaf sarfeh shikayat darj karwana chahta hoon'
  },
  {
    id: 'rent',
    labelEn: 'Rent / Tenancy Dispute',
    labelRoman: 'Kirayadaari Ka Masla',
    descriptionEn: 'I need to file a rent or tenancy matter — eviction, unpaid rent, or security deposit',
    descriptionRoman: 'Mujhe kirayadaari ka masla hal karna hai — makan khali karwana, kiraya ya security deposit'
  },
  {
    id: 'property',
    labelEn: 'Property Transfer',
    labelRoman: 'Jaidad Ki Muntaqili',
    descriptionEn: 'I need to transfer or register a property — sale, gift, or inheritance',
    descriptionRoman: 'Mujhe jaidad transfer ya register karwani hai — baich, tohfa, ya virasat'
  },
  {
    id: 'student-appeal',
    labelEn: 'Student Appeal',
    labelRoman: 'Talib Appeal',
    descriptionEn: 'I need to appeal a university decision — result, discipline, or admission',
    descriptionRoman: 'Mujhe university ke faislay ke khilaf appeal karni hai — result, discipline, ya admission'
  },
  {
    id: 'domicile',
    labelEn: 'Domicile Certificate',
    labelRoman: 'Domicile Certificate',
    descriptionEn: 'I need to apply for a domicile certificate',
    descriptionRoman: 'Mujhe domicile certificate chahiye'
  },
  {
    id: 'passport',
    labelEn: 'Passport',
    labelRoman: 'Passport',
    descriptionEn: 'I need to apply for or renew a passport',
    descriptionRoman: 'Mujhe passport chahiye ya renew karwana hai'
  }
];
