import {
  FileText, FileX, Scale, Lock, Clock, Unlock, ShieldCheck, ShieldAlert, Gavel,
  RefreshCw, RotateCcw, Ban, ClipboardCheck, Users, FileSignature, Wallet, Baby,
  UserCheck, Home, Building2, Briefcase, ShoppingBag, MonitorSmartphone, Megaphone,
  HeartHandshake, Landmark, ScrollText, MessagesSquare, Handshake, MessageCircle
} from "lucide-react";

// F11: "Legal Procedures & Help" — verified legal workflows.
// Every procedure explains: Situation → Where to go → Who can file → Documents/evidence
// → Main steps → Possible outcome → Next step → Relevant law/source.
export interface LocalizedText {
  en: string;
  roman_urdu: string;
}

export interface LegalProcedure {
  id: string;
  icon: any;
  category: string;
  title: LocalizedText;
  situation: LocalizedText;
  whereToGo: LocalizedText;
  whoCanFile: LocalizedText;
  documents: { en: string[]; roman_urdu: string[] };
  steps: { en: string[]; roman_urdu: string[] };
  possibleOutcome: LocalizedText;
  nextStep: LocalizedText;
  law: LocalizedText;
  sourceUrl: string;
}

export const LEGAL_PROCEDURES: LegalProcedure[] = [
  {
    id: "fir",
    icon: FileText,
    category: "Criminal Complaints",
    title: { en: "FIR (First Information Report)", roman_urdu: "FIR (First Information Report)" },
    situation: {
      en: "You want to report a cognizable offence (theft, assault, fraud) so that police investigation starts.",
      roman_urdu: "Aap koi cognizable jurm (chori, maar pitai, fraud) report karwana chahte hain taake police tehqeeq shuru kare."
    },
    whereToGo: {
      en: "The police station of the area where the offence took place. If refused, the SP/DSP office or a Justice of Peace (Sessions Judge).",
      roman_urdu: "Us area ka police station jahan jurm hua. Agar inkar ho to SP/DSP office ya Justice of Peace (Sessions Judge) ke paas."
    },
    whoCanFile: {
      en: "The victim, an eyewitness, or anyone with knowledge of the offence can report it; the complaint is recorded and signed as the FIR.",
      roman_urdu: "Victim, gawah ya koi bhi jaankaar shakhs report kar sakta hai; complaint darj ho kar FIR banti hai."
    },
    documents: {
      en: ["CNIC copy", "Written details of the incident", "Evidence: photos, medical report, witnesses' names"],
      roman_urdu: ["CNIC ki copy", "Waqia ki likhi hui details", "Suboot: photos, medical report, gawahon ke naam"]
    },
    steps: {
      en: [
        "Go to the police station of the area where the offence occurred.",
        "Give a written or oral complaint; the SHO must record it under Section 154 CrPC.",
        "Read the FIR carefully before signing it.",
        "Collect a free certified copy and note the FIR number."
      ],
      roman_urdu: [
        "Jurm wale area ke police station jayen.",
        "Likhi ya zabani complaint den; SHO ko Section 154 CrPC ke tehat darj karna zaroori hai.",
        "FIR ghaur se parh kar sign karen.",
        "Mufit certified copy aur FIR number hasil karen."
      ]
    },
    possibleOutcome: {
      en: "Police register the FIR and begin investigation; the accused may be arrested and the case sent to court for trial.",
      roman_urdu: "Police FIR darj kar ke tehqeeq shuru karti hai; mulzim giraftar ho sakta hai aur case trial ke liye court jata hai."
    },
    nextStep: {
      en: "Follow up on the investigation; if police delay or refuse, apply to the Justice of Peace under Section 22-A CrPC.",
      roman_urdu: "Tehqeeq ka follow-up karen; agar police dair kare ya inkar kare to Section 22-A CrPC ke tehat Justice of Peace ko apply karen."
    },
    law: {
      en: "Section 154, Criminal Procedure Code 1898 (CrPC); Article 10 of the Constitution.",
      roman_urdu: "Section 154, Code of Criminal Procedure 1898; Constitution ka Article 10."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "fir_refusal",
    icon: FileX,
    category: "Criminal Complaints",
    title: { en: "FIR Refusal by Police", roman_urdu: "Police Ka FIR Darj Karne Se Inkar" },
    situation: {
      en: "The police station refuses to register your FIR or keeps delaying it without reason.",
      roman_urdu: "Police station aap ki FIR darj karne se inkar kar raha hai ya bila wajah dair kar raha hai."
    },
    whereToGo: {
      en: "The SP (Superintendent of Police) or DSP of the district; then the Justice of Peace (Sessions Judge) under Section 22-A CrPC.",
      roman_urdu: "District ka SP (Superintendent of Police) ya DSP; phir Section 22-A CrPC ke tehat Justice of Peace (Sessions Judge)."
    },
    whoCanFile: {
      en: "The aggrieved person or the complainant whose report was refused.",
      roman_urdu: "Mutassira shakhs ya complainant jis ki report lene se inkar hua."
    },
    documents: {
      en: ["Copy of your written complaint to police", "Proof of submission (receipt/diary number if given)", "Witness names"],
      roman_urdu: ["Police ko di gayi complaint ki copy", "Jama karwane ka suboot (receipt/diary number)", "Gawahon ke naam"]
    },
    steps: {
      en: [
        "Send a written complaint to the SP/DSP of the district under Section 154(3) CrPC.",
        "If still no action, file an application before the Justice of Peace under Section 22-A(6) CrPC.",
        "Attend the hearing; the Justice of Peace can examine the matter and direct registration.",
        "Police must then register the FIR and investigate."
      ],
      roman_urdu: [
        "Section 154(3) CrPC ke tehat district ke SP/DSP ko likhi complaint bhejen.",
        "Agar phir bhi koi action na ho to Section 22-A(6) CrPC ke tehat Justice of Peace ke samne application den.",
        "Sama'at mein sharik hon; Justice of Peace mamla dekhta hai aur registration ka hukm deta hai.",
        "Phir police par FIR darj kar ke tehqeeq karna wajib hota hai."
      ]
    },
    possibleOutcome: {
      en: "The Justice of Peace orders the police to register the FIR and proceed with investigation.",
      roman_urdu: "Justice of Peace police ko FIR darj kar ke tehqeeq karne ka hukm deta hai."
    },
    nextStep: {
      en: "Obtain the FIR number and monitor the investigation; seek legal advice if police still do not comply.",
      roman_urdu: "FIR number hasil kar ke tehqeeq ki nigerani karen; agar police phir bhi na manay to qanooni mashwara len."
    },
    law: {
      en: "Sections 154(3) and 22-A, Criminal Procedure Code 1898.",
      roman_urdu: "Section 154(3) aur 22-A, Code of Criminal Procedure 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "section_22",
    icon: Scale,
    category: "Criminal Complaints",
    title: { en: "Section 22-A / 22-B CrPC (Justice of Peace)", roman_urdu: "Section 22-A / 22-B CrPC (Justice of Peace)" },
    situation: {
      en: "Police refuse to register an FIR or act on your complaint, or the matter needs judicial direction to police.",
      roman_urdu: "Police FIR darj karne ya complaint par amal karne se inkar karti hai, ya mamla police ko adalati hukm chahta hai."
    },
    whereToGo: {
      en: "The Court of the Sessions Judge, who acts as the Ex-Officio Justice of Peace for the district.",
      roman_urdu: "Sessions Judge ki adalat, jo district ka Ex-Officio Justice of Peace hota hai."
    },
    whoCanFile: {
      en: "Any aggrieved citizen against police inaction or refusal.",
      roman_urdu: "Koi bhi mutassira shehri police ki kotahi ya inkar ke khilaf."
    },
    documents: {
      en: ["Application describing the incident", "Copy of police complaint (if filed)", "CNIC copy"],
      roman_urdu: ["Waqia ki details wali application", "Police complaint ki copy (agar di thi)", "CNIC ki copy"]
    },
    steps: {
      en: [
        "File an application under Section 22-A(6) CrPC before the Justice of Peace.",
        "The court hears you and examines the police record.",
        "The court may direct the police to register the FIR and report compliance.",
        "Section 22-B gives the Justice of Peace power to issue other appropriate directions."
      ],
      roman_urdu: [
        "Section 22-A(6) CrPC ke tehat Justice of Peace ke samne application file karen.",
        "Adalat sunwai karti hai aur police record ka jayza leti hai.",
        "Adalat police ko FIR darj kar ke compliance report dene ka hukm de sakti hai.",
        "Section 22-B Justice of Peace ko munsib hidaayaat dene ka ikhtiyar deta hai."
      ]
    },
    possibleOutcome: {
      en: "FIR registered and investigation begins under the court's direction.",
      roman_urdu: "Adalat ke hukm par FIR darj hoti hai aur tehqeeq shuru hoti hai."
    },
    nextStep: {
      en: "Track investigation progress and inform the Justice of Peace of any continued non-compliance.",
      roman_urdu: "Tehqeeq ki peshraft dekhte rahen aur na-manane ki soorat mein Justice of Peace ko batayen."
    },
    law: {
      en: "Sections 22-A and 22-B, Criminal Procedure Code 1898.",
      roman_urdu: "Section 22-A aur 22-B, Code of Criminal Procedure 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "arrest",
    icon: Lock,
    category: "Arrest & Bail",
    title: { en: "Arrest (Your Rights)", roman_urdu: "Giraftari (Aap Ke Haqooq)" },
    situation: {
      en: "Police are arresting you or someone you know, with or without a warrant.",
      roman_urdu: "Police aap ko ya aap ke kisi aziz ko warrant ke sath ya baghair warrant ke giraftar kar rahi hai."
    },
    whereToGo: {
      en: "The arrest happens at the spot or police station; the arrested person must be produced before a magistrate within 24 hours.",
      roman_urdu: "Giraftari mauqa par ya police station par hoti hai; giraftar shakhs ko 24 ghante ke andar magistrate ke samne pesh karna zaroori hai."
    },
    whoCanFile: {
      en: "Police arrest under Section 54 CrPC (without warrant in listed offences) or under a court warrant.",
      roman_urdu: "Police Section 54 CrPC ke tehat (baghair warrant) ya adalat ke warrant par giraftar karti hai."
    },
    documents: {
      en: ["CNIC of the arrested person", "Lawyer and family contact numbers", "Any warrant/copy of case details if available"],
      roman_urdu: ["Giraftar shakhs ka CNIC", "Wakeel aur ghar walon ke numbers", "Warrant ya case ki details agar milen"]
    },
    steps: {
      en: [
        "Ask the police to state the grounds of arrest (a constitutional right).",
        "Inform family and a lawyer immediately.",
        "Police must produce the person before a magistrate within 24 hours (Section 61 CrPC, Article 10).",
        "If the offence is bailable, apply for bail at once; otherwise apply for remand limits to be respected."
      ],
      roman_urdu: [
        "Police se giraftari ki wajah poochhen (yeh aaini haq hai).",
        "Foran ghar walon aur wakeel ko khabar karen.",
        "Police ko 24 ghante ke andar shakhs magistrate ke samne pesh karna hota hai (Section 61 CrPC, Article 10).",
        "Agar jurm bailable hai to foran bail ki darkhwast den; warna remand ki hudood ka khayal rakhen."
      ]
    },
    possibleOutcome: {
      en: "Release on bail, discharge, or police/judicial custody as the court orders.",
      roman_urdu: "Zamanat par rehaai, discharge, ya adalat ke hukm ke mutabiq police/judicial hirasat."
    },
    nextStep: {
      en: "Obtain the FIR copy, consult a lawyer, and file a bail application where needed.",
      roman_urdu: "FIR ki copy hasil karen, wakeel se mashwara karen aur zaroorat par bail ki darkhwast den."
    },
    law: {
      en: "Sections 54 and 61 CrPC 1898; Article 10 of the Constitution of Pakistan.",
      roman_urdu: "Section 54 aur 61 CrPC 1898; Constitution of Pakistan ka Article 10."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "remand",
    icon: Clock,
    category: "Arrest & Bail",
    title: { en: "Police Remand & Judicial Remand", roman_urdu: "Police Remand Aur Judicial Remand" },
    situation: {
      en: "After arrest, the investigation officer needs custody of the accused for further investigation.",
      roman_urdu: "Giraftari ke baad tehqeeqi afsar ko mazeed tehqeeq ke liye mulzim ki hirasat chahiye hoti hai."
    },
    whereToGo: {
      en: "The Magistrate's Court before which the accused is produced within 24 hours.",
      roman_urdu: "Magistrate ki adalat jahan 24 ghante ke andar mulzim pesh hota hai."
    },
    whoCanFile: {
      en: "The investigation officer applies to the magistrate for remand.",
      roman_urdu: "Tehqeeqi afsar magistrate se remand ki darkhwast karta hai."
    },
    documents: {
      en: ["Case diary entries of the investigation", "FIR copy", "Reasons for requiring custody"],
      roman_urdu: ["Tehqeeq ke case diary entries", "FIR ki copy", "Hirasat ki zaroorat ki wajuhat"]
    },
    steps: {
      en: [
        "Police produce the accused before the magistrate and request physical remand.",
        "The magistrate may allow police custody up to 15 days in total under Section 167 CrPC.",
        "After that, custody converts to judicial remand (jail) unless bail is granted.",
        "The defence can oppose further remand at every hearing."
      ],
      roman_urdu: [
        "Police mulzim ko magistrate ke samne pesh kar ke physical remand maangti hai.",
        "Magistrate Section 167 CrPC ke tehat total 15 din tak police hirasat de sakta hai.",
        "Is ke baad hirasat judicial remand (jail) mein tabdeel hoti hai, siwaye bail ke.",
        "Defence har hearing par mazeed remand ki mukhalfat kar sakta hai."
      ]
    },
    possibleOutcome: {
      en: "Physical remand for investigation, then judicial remand or release on bail.",
      roman_urdu: "Tehqeeq ke liye physical remand, phir judicial remand ya zamanat par rehaai."
    },
    nextStep: {
      en: "If remand is misused, apply to higher courts for bail or cancellation of remand.",
      roman_urdu: "Agar remand ka ghalat istemal ho to bail ya remand mansookhi ke liye oonchi adalaton mein jayen."
    },
    law: {
      en: "Section 167, Criminal Procedure Code 1898.",
      roman_urdu: "Section 167, Code of Criminal Procedure 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "bail",
    icon: Unlock,
    category: "Arrest & Bail",
    title: { en: "Bail (Overview)", roman_urdu: "Zamanat (Jaiza)" },
    situation: {
      en: "An accused person is in custody or fears arrest and wants release pending trial.",
      roman_urdu: "Mulzim hirasat mein hai ya giraftari se dartay hue trial tak rehaai chahta hai."
    },
    whereToGo: {
      en: "The Magistrate's Court for ordinary cases; Sessions Court or High Court for non-bailable offences.",
      roman_urdu: "Aam mamlat ke liye Magistrate ki adalat; non-bailable jurm ke liye Sessions Court ya High Court."
    },
    whoCanFile: {
      en: "The accused personally or through a lawyer or close relative.",
      roman_urdu: "Mulzim khud, wakeel ke zariye ya qareebi rishtedar ke zariye."
    },
    documents: {
      en: ["Bail application", "Surety documents (CNIC of sureties, property details)", "FIR copy"],
      roman_urdu: ["Bail ki darkhwast", "Zamanat dene walon ki asnaad (CNIC, jaedad ki details)", "FIR ki copy"]
    },
    steps: {
      en: [
        "Check whether the offence is bailable (right to bail under Section 496 CrPC) or non-bailable (court's discretion under Section 497 CrPC).",
        "File the bail application in the competent court.",
        "The prosecution replies; the court hears both sides.",
        "On grant, furnish surety bonds; the accused is released."
      ],
      roman_urdu: [
        "Dekhen jurm bailable hai (Section 496 CrPC ke tehat bail ka haq) ya non-bailable (Section 497 CrPC ke tehat adalat ki marzi).",
        "Mohtbar adalat mein bail ki darkhwast den.",
        "Isteghasa jawaab deta hai; adalat dono fareeqain sunti hai.",
        "Bail milne par surety bonds jama karen; mulzim reha hota hai."
      ]
    },
    possibleOutcome: {
      en: "Release on bail with conditions, or rejection of bail with reasons.",
      roman_urdu: "Sharaait ke sath zamanat par rehaai, ya wajuhat ke sath bail ki manzoori se inkar."
    },
    nextStep: {
      en: "If rejected, move the higher court; comply strictly with bail conditions to avoid cancellation.",
      roman_urdu: "Inkar ki soorat mein oonchi adalat mein jayen; bail ki sharaait ki sakhti se pabandi karen taake mansookhi na ho."
    },
    law: {
      en: "Sections 496, 497 and 498, Criminal Procedure Code 1898.",
      roman_urdu: "Section 496, 497 aur 498, Code of Criminal Procedure 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "pre_arrest_bail",
    icon: ShieldCheck,
    category: "Arrest & Bail",
    title: { en: "Pre-Arrest Bail", roman_urdu: "Giraftari Se Pehle Zamanat" },
    situation: {
      en: "You fear arrest in an FIR registered against you and want protection before arrest.",
      roman_urdu: "Aap ke khilaf darj FIR mein giraftari ka andesha hai aur aap giraftari se pehle tahaffuz chahte hain."
    },
    whereToGo: {
      en: "The Court of Session (or High Court) under Section 498 CrPC.",
      roman_urdu: "Section 498 CrPC ke tehat Sessions Court ya High Court."
    },
    whoCanFile: {
      en: "The person who apprehends arrest, through a lawyer.",
      roman_urdu: "Giraftari ka andesha rakhne wala shakhs, wakeel ke zariye."
    },
    documents: {
      en: ["Bail application with reasons to believe arrest is imminent", "FIR copy", "Surety documents if granted"],
      roman_urdu: ["Giraftari ke andeshe ki wajuhat wali darkhwast", "FIR ki copy", "Zamanat ki asnaad agar manzoor ho"]
    },
    steps: {
      en: [
        "File the pre-arrest bail application under Section 498 CrPC.",
        "The court may grant interim protective bail for a few days.",
        "At the final hearing, the court considers the merits, threat, and past record.",
        "If confirmed, bail continues with conditions such as joining the investigation."
      ],
      roman_urdu: [
        "Section 498 CrPC ke tehat giraftari se pehle bail ki darkhwast den.",
        "Adalat chand din ke liye interim protective bail de sakti hai.",
        "Aakhri hearing mein adalat merits, khatre aur sabqa record dekhti hai.",
        "Confirm hone par bail sharaait (jaise tehqeeq mein shamil hona) ke sath jari rehti hai."
      ]
    },
    possibleOutcome: {
      en: "Protection from arrest on conditions, or dismissal of the application.",
      roman_urdu: "Sharaait ke sath giraftari se tahaffuz, ya darkhwast ki namanzoori."
    },
    nextStep: {
      en: "If dismissed, approach the High Court; always join the investigation as ordered.",
      roman_urdu: "Namanzoori par High Court se rujoo karen; hukm ke mutabiq tehqeeq mein zaroor shamil hon."
    },
    law: {
      en: "Section 498, Criminal Procedure Code 1898.",
      roman_urdu: "Section 498, Code of Criminal Procedure 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "post_arrest_bail",
    icon: ShieldAlert,
    category: "Arrest & Bail",
    title: { en: "Post-Arrest Bail", roman_urdu: "Giraftari Ke Baad Zamanat" },
    situation: {
      en: "The accused has already been arrested and is in custody seeking release pending trial.",
      roman_urdu: "Mulzim giraftar ho kar hirasat mein hai aur trial tak rehaai chahta hai."
    },
    whereToGo: {
      en: "First the Magistrate's Court; if refused, the Sessions Court, then the High Court.",
      roman_urdu: "Pehle Magistrate ki adalat; inkar par Sessions Court, phir High Court."
    },
    whoCanFile: {
      en: "The accused through a lawyer or any relative.",
      roman_urdu: "Mulzim wakeel ya kisi rishtedar ke zariye."
    },
    documents: {
      en: ["Bail application under Section 497 CrPC", "FIR copy", "Surety documents", "Medical report if relevant"],
      roman_urdu: ["Section 497 CrPC ke tehat bail ki darkhwast", "FIR ki copy", "Zamanat ki asnaad", "Zaroorat par medical report"]
    },
    steps: {
      en: [
        "File the bail application before the competent court.",
        "The court examines the FIR, evidence collected, delay, and the accused's role.",
        "The prosecution argues against bail; the defence replies.",
        "If granted, furnish sureties and obtain release."
      ],
      roman_urdu: [
        "Mohtbar adalat mein bail ki darkhwast den.",
        "Adalat FIR, shawahid, dair aur mulzim ke kirdar ka jaiza leti hai.",
        "Isteghasa bail ke khilaf daleel deta hai; defence jawab deta hai.",
        "Manzoori par surety jama kara ke rehaai hasil karen."
      ]
    },
    possibleOutcome: {
      en: "Release on bail with surety, or rejection; the matter can be taken higher.",
      roman_urdu: "Surety ke sath rehaai ya namanzoori; mamla oonchi adalat mein le jaya ja sakta hai."
    },
    nextStep: {
      en: "If refused, file a fresh application in the next higher court after reading the rejection order.",
      roman_urdu: "Inkar ki soorat mein rejection order parh kar agli oonchi adalat mein nayi darkhwast den."
    },
    law: {
      en: "Section 497, Criminal Procedure Code 1898.",
      roman_urdu: "Section 497, Code of Criminal Procedure 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "criminal_trial",
    icon: Gavel,
    category: "Trials & Appeals",
    title: { en: "Criminal Trial", roman_urdu: "Faujdari Muqadma" },
    situation: {
      en: "A criminal case against the accused proceeds to trial before a magistrate or sessions judge.",
      roman_urdu: "Mulzim ke khilaf faujdari case magistrate ya sessions judge ke samne trial ke liye chalta hai."
    },
    whereToGo: {
      en: "The trial court: Magistrate (minor offences) or Court of Session (serious offences).",
      roman_urdu: "Trial court: Magistrate (chhote jurm) ya Court of Session (sangeen jurm)."
    },
    whoCanFile: {
      en: "The state prosecutes; the accused defends personally or through counsel.",
      roman_urdu: "Riyasat istighasa karti hai; mulzim khud ya wakeel ke zariye defence karta hai."
    },
    documents: {
      en: ["Challan/charge sheet", "Evidence list and documents", "Witness list"],
      roman_urdu: ["Challan/charge sheet", "Shawahid aur asnaad ki fehrist", "Gawahon ki fehrist"]
    },
    steps: {
      en: [
        "Charge is framed and read to the accused (Sections 242/265-C CrPC).",
        "Prosecution witnesses are examined and cross-examined.",
        "The accused is examined under Section 342 CrPC and may give a defence statement.",
        "Defence evidence is recorded, final arguments heard, and judgment is delivered."
      ],
      roman_urdu: [
        "Mulzim par charge tayar kar ke parha jata hai (Section 242/265-C CrPC).",
        "Isteghasa ke gawahon ke bayanat aur jirah hoti hai.",
        "Mulzim ka Section 342 CrPC ke tehat bayan liya jata hai aur woh defence statement de sakta hai.",
        "Defence ke shawahid, final behes ke baad faisla sunaya jata hai."
      ]
    },
    possibleOutcome: {
      en: "Conviction with sentence, or acquittal.",
      roman_urdu: "Saza ke sath saza yaftagi, ya barri (acquittal)."
    },
    nextStep: {
      en: "The losing side can file an appeal in the appellate court within the limitation period.",
      roman_urdu: "Harne wala fareeq limitation period ke andar appellate court mein appeal kar sakta hai."
    },
    law: {
      en: "Sections 241-265-K CrPC 1898; Qanun-e-Shahadat Order 1984.",
      roman_urdu: "Section 241-265-K CrPC 1898; Qanun-e-Shahadat Order 1984."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "appeal",
    icon: RefreshCw,
    category: "Trials & Appeals",
    title: { en: "Appeal", roman_urdu: "Appeal (Marafa)" },
    situation: {
      en: "You are aggrieved by a judgment, conviction, or decree of a trial court.",
      roman_urdu: "Aap trial court ke faisle, saza ya decree se mutassir hain."
    },
    whereToGo: {
      en: "The next appellate court: Sessions Court (from magistrates), High Court, or Supreme Court.",
      roman_urdu: "Agli appellate adalat: Sessions Court (magistrate se), High Court ya Supreme Court."
    },
    whoCanFile: {
      en: "The convicted person or the aggrieved party (in civil cases the losing party).",
      roman_urdu: "Saza yafta shakhs ya mutassira fareeq (civil case mein harne wala fareeq)."
    },
    documents: {
      en: ["Certified copy of judgment/decree", "Memorandum of appeal with grounds", "Case file references"],
      roman_urdu: ["Faisle/decree ki certified copy", "Asbaab ke sath memorandum of appeal", "Case file ke hawale"]
    },
    steps: {
      en: [
        "Obtain certified copies of the judgment within the limitation period.",
        "File the memorandum of appeal with clear grounds.",
        "The appellate court hears both sides (and may re-appraise evidence).",
        "The appellate court may confirm, modify, or reverse the decision."
      ],
      roman_urdu: [
        "Limitation period ke andar faisle ki certified copies hasil karen.",
        "Wazeh asbaab ke sath memorandum of appeal file karen.",
        "Appellate adalat dono fareeqain sunti hai (aur shawahid ka naya jaiza le sakti hai).",
        "Appellate adalat faisla barqarar, tabdeel ya mansookh kar sakti hai."
      ]
    },
    possibleOutcome: {
      en: "The judgment is upheld, modified, or set aside; a retrial may be ordered.",
      roman_urdu: "Faisla barqarar, tabdeel ya mansookh ho sakta hai; dobara trial ka hukm bhi ho sakta hai."
    },
    nextStep: {
      en: "A further appeal or revision lies to the next higher court within its limits.",
      roman_urdu: "Agli oonchi adalat mein munsib hudood ke andar mazeed appeal ya revision ho sakti hai."
    },
    law: {
      en: "Sections 408-431 CrPC 1898 (criminal); Section 96 CPC 1908 (civil).",
      roman_urdu: "Section 408-431 CrPC 1898 (faujdari); Section 96 CPC 1908 (civil)."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "revision",
    icon: RotateCcw,
    category: "Trials & Appeals",
    title: { en: "Revision", roman_urdu: "Nazra Sani (Revision)" },
    situation: {
      en: "A subordinate court has passed an order that is illegal, irregular, or beyond its jurisdiction.",
      roman_urdu: "Matehat adalat ne aisa hukm diya hai jo ghair qanooni, be qaida ya ikhtiyar se bahar hai."
    },
    whereToGo: {
      en: "The Sessions Judge or the High Court, which can call for the record of the case.",
      roman_urdu: "Sessions Judge ya High Court, jo case ka record talab kar sakti hai."
    },
    whoCanFile: {
      en: "An aggrieved party; the revisional court can also act on its own motion.",
      roman_urdu: "Mutassira fareeq; revisional court khud bhi note le sakti hai."
    },
    documents: {
      en: ["Certified copy of the impugned order", "Revision application with grounds", "Trial court record reference"],
      roman_urdu: ["Mutnaza order ki certified copy", "Asbaab ke sath revision application", "Trial court record ke hawale"]
    },
    steps: {
      en: [
        "File the revision application within the limitation period.",
        "The revisional court examines the legality and regularity of the order (no new evidence generally).",
        "The court hears the parties and may stay the order.",
        "The court can set aside, modify, or confirm the order."
      ],
      roman_urdu: [
        "Limitation period ke andar revision application den.",
        "Revisional court order ki qanooniyat dekhti hai (aam tor par naya suboot nahi liya jata).",
        "Adalat fareeqain sunti hai aur order par stay de sakti hai.",
        "Adalat order mansookh, tabdeel ya barqarar kar sakti hai."
      ]
    },
    possibleOutcome: {
      en: "The illegal or irregular order is corrected or set aside.",
      roman_urdu: "Ghair qanooni ya be qaida order durust ya mansookh ho jata hai."
    },
    nextStep: {
      en: "If revision fails, consider an appeal or constitutional petition where available.",
      roman_urdu: "Revision na chale to jahan munsib ho appeal ya aaini petition par ghour karen."
    },
    law: {
      en: "Sections 435-439 CrPC 1898; Section 115 CPC 1908.",
      roman_urdu: "Section 435-439 CrPC 1898; Section 115 CPC 1908."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "civil_suit",
    icon: Scale,
    category: "Civil Cases",
    title: { en: "Civil Suit", roman_urdu: "Diwani Muqadma (Civil Suit)" },
    situation: {
      en: "A dispute over money, property, contracts, or rights needs a civil court decision.",
      roman_urdu: "Paise, jaedad, muahidon ya haqooq ka tanaza civil court ke faisle ka mohtaj hai."
    },
    whereToGo: {
      en: "The Civil Court (Senior Civil Judge / District Judge) of the area where the defendant lives or the cause arose.",
      roman_urdu: "Us area ki Civil Court (Senior Civil Judge / District Judge) jahan mudda alaih rehta hai ya moamla paida hua."
    },
    whoCanFile: {
      en: "The aggrieved person (plaintiff) files the suit against the defendant.",
      roman_urdu: "Mutassira shakhs (plaintiff) mudda alaih ke khilaf muqadma file karta hai."
    },
    documents: {
      en: ["Plaint with cause of action and relief sought", "Documents supporting the claim", "Court fee as per valuation"],
      roman_urdu: ["Wajah aur mutalba wali plaint", "Dawe ki taeed mein asnaad", "Takhmeena ke mutabiq court fee"]
    },
    steps: {
      en: [
        "Draft and file the plaint (Orders VI-VII CPC).",
        "The court issues summons to the defendant (Order V CPC).",
        "The defendant files a written statement (Order VIII CPC).",
        "Issues are framed (Order XIV), evidence is recorded, arguments are heard, and judgment with decree is delivered (Order XX CPC)."
      ],
      roman_urdu: [
        "Plaint tayar kar ke file karen (Orders VI-VII CPC).",
        "Adalat mudda alaih ko summons jari karti hai (Order V CPC).",
        "Mudda alaih written statement file karta hai (Order VIII CPC).",
        "Tanqeehat (issues) tayar hoti hain (Order XIV), shawahid record hote hain, behes hoti hai aur decree ke sath faisla sunaya jata hai (Order XX CPC)."
      ]
    },
    possibleOutcome: {
      en: "A decree in favour of the plaintiff or dismissal of the suit.",
      roman_urdu: "Plaintiff ke haq mein decree ya muqadma kharij."
    },
    nextStep: {
      en: "The decree-holder can start execution proceedings if the decree is not complied with.",
      roman_urdu: "Decree par amal na ho to decree-holder execution ki karwai shuru kar sakta hai."
    },
    law: {
      en: "Code of Civil Procedure 1908 (Orders IV-VIII, XIV, XVIII, XX).",
      roman_urdu: "Code of Civil Procedure 1908 (Orders IV-VIII, XIV, XVIII, XX)."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "injunction",
    icon: Ban,
    category: "Civil Cases",
    title: { en: "Temporary Injunction (Stay)", roman_urdu: "Aarzi Injunction (Stay)" },
    situation: {
      en: "Urgent protection is needed to stop the other side from doing an act that would cause irreparable loss during the suit.",
      roman_urdu: "Muqadme ke doran doosre fareeq ko kisi aise amal se rokne ke liye fori tahaffuz chahiye jo na qabil-e-talaafi nuqsan de."
    },
    whereToGo: {
      en: "The civil court where the main suit is pending.",
      roman_urdu: "Wohi civil court jahan asal muqadma zair-e-sam'at hai."
    },
    whoCanFile: {
      en: "The plaintiff (or defendant by counter-application) in the pending suit.",
      roman_urdu: "Zair-e-sam'at muqadme mein plaintiff (ya counter-application se defendant)."
    },
    documents: {
      en: ["Application under Order XXXIX Rules 1-2 CPC", "Affidavit of urgency and irreparable loss", "Evidence of the threatened act"],
      roman_urdu: ["Order XXXIX Rules 1-2 CPC ke tehat application", "Fori zaroorat aur na qabil-e-talaafi nuqsan ka affidavit", "Khatre wale amal ka suboot"]
    },
    steps: {
      en: [
        "File the injunction application with the suit (or during it).",
        "The court may grant an ex-parte ad-interim injunction in urgent cases.",
        "The other side is heard; the court tests the three conditions (prima facie case, balance of convenience, irreparable loss).",
        "The injunction is confirmed, modified, or vacated."
      ],
      roman_urdu: [
        "Muqadme ke sath (ya doran) injunction ki application den.",
        "Fori mamlat mein adalat ex-parte ad-interim injunction de sakti hai.",
        "Doosra fareeq suna jata hai; adalat teen sharaait (prima facie case, balance of convenience, irreparable loss) dekhti hai.",
        "Injunction barqarar, tabdeel ya mansookh hota hai."
      ]
    },
    possibleOutcome: {
      en: "A stay order against the threatened act, with conditions such as security.",
      roman_urdu: "Khatre wale amal ke khilaf stay order, zaroorat par security jaisi sharaait ke sath."
    },
    nextStep: {
      en: "Proceed with the main suit; violation of the injunction invites contempt proceedings.",
      roman_urdu: "Asal muqadma aage barhayen; injunction ki khilaaf warzi par contempt ki karwai ho sakti hai."
    },
    law: {
      en: "Section 94 and Order XXXIX Rules 1-2, Code of Civil Procedure 1908.",
      roman_urdu: "Section 94 aur Order XXXIX Rules 1-2, Code of Civil Procedure 1908."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "execution",
    icon: ClipboardCheck,
    category: "Civil Cases",
    title: { en: "Execution of Decree", roman_urdu: "Decree Ki Tameel (Execution)" },
    situation: {
      en: "The judgment debtor is not complying with the court's decree (paying money, vacating property, etc.).",
      roman_urdu: "Judgment debtor adalat ki decree (raqam ki adaeigi, jaedad khali karna waghera) par amal nahi kar raha."
    },
    whereToGo: {
      en: "The court which passed the decree (or the court where the property is located).",
      roman_urdu: "Wohi adalat jisne decree di (ya wahan ki adalat jahan jaedad mojood hai)."
    },
    whoCanFile: {
      en: "The decree-holder (the winning party) files the execution application.",
      roman_urdu: "Decree-holder (jeetne wala fareeq) execution ki darkhwast deta hai."
    },
    documents: {
      en: ["Certified copy of the decree", "Execution application (Order XXI CPC)", "Details of the debtor's assets"],
      roman_urdu: ["Decree ki certified copy", "Execution application (Order XXI CPC)", "Qarzdar ke asasay ki details"]
    },
    steps: {
      en: [
        "File the execution application in the executing court.",
        "The court issues notice to the judgment debtor.",
        "The court can attach property, order sale by auction, or arrest in limited cases.",
        "Recovered money/property is handed over to the decree-holder."
      ],
      roman_urdu: [
        "Executing court mein execution application den.",
        "Adalat judgment debtor ko notice jari karti hai.",
        "Adalat jaedad attach kar sakti hai, neelam ka hukm de sakti hai ya mehdood mamlat mein giraftari ka hukm de sakti hai.",
        "Wusool shuda raqam/jaedad decree-holder ke hawalay ki jati hai."
      ]
    },
    possibleOutcome: {
      en: "The decree is satisfied through recovery or sale of assets.",
      roman_urdu: "Asasay ki wusooli ya farokht ke zariye decree poori ho jati hai."
    },
    nextStep: {
      en: "If the debtor has no assets, fresh execution can be filed when assets are found.",
      roman_urdu: "Agar qarzdar ke paas koi asasa nahi to asasa milne par nayi execution ho sakti hai."
    },
    law: {
      en: "Order XXI, Code of Civil Procedure 1908.",
      roman_urdu: "Order XXI, Code of Civil Procedure 1908."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "family_proceedings",
    icon: Users,
    category: "Family",
    title: { en: "Family Proceedings", roman_urdu: "Khandani Muqadmat" },
    situation: {
      en: "A dispute about marriage, dower, maintenance, custody, or divorce needs a family court.",
      roman_urdu: "Nikah, mahr, kharch (nafqa), hizanat ya talaq ka tanaza family court ka mohtaj hai."
    },
    whereToGo: {
      en: "The Family Court of the district (established under the Family Courts Act 1964).",
      roman_urdu: "District ki Family Court (Family Courts Act 1964 ke tehat qaem)."
    },
    whoCanFile: {
      en: "Either spouse, children (through a next friend), or parents, as per the specific relief.",
      roman_urdu: "Koi bhi farqeen, bache (next friend ke zariye) ya walidain, mutalba ke mutabiq."
    },
    documents: {
      en: ["Nikahnama (marriage certificate)", "CNICs", "Birth certificates of children", "Evidence of the dispute"],
      roman_urdu: ["Nikahnama", "CNIC", "Bachon ke birth certificates", "Tanaze ka suboot"]
    },
    steps: {
      en: [
        "File the suit in the Family Court.",
        "The court first attempts reconciliation between the parties.",
        "If reconciliation fails, evidence is recorded in summary manner.",
        "The court passes a decree on the family matter."
      ],
      roman_urdu: [
        "Family Court mein muqadma file karen.",
        "Adalat pehle fareeqain ke darmiyan sulah ki koshish karti hai.",
        "Sulah na ho to mukhtasar tareeqe se shawahid record hote hain.",
        "Adalat khandani mamle par decree jari karti hai."
      ]
    },
    possibleOutcome: {
      en: "A decree resolving the family dispute (dissolution, maintenance, custody, etc.).",
      roman_urdu: "Khandani tanaza hal karne wala decree (dissolution, nafqa, hizanat waghera)."
    },
    nextStep: {
      en: "An appeal lies to the District Court (or High Court for some matters) within the time limit.",
      roman_urdu: "Muqarrara muddat ke andar District Court (ya kuch mamlat mein High Court) mein appeal ho sakti hai."
    },
    law: {
      en: "West Pakistan Family Courts Act 1964 (Sections 5-17).",
      roman_urdu: "West Pakistan Family Courts Act 1964 (Section 5-17)."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "khula_divorce",
    icon: FileSignature,
    category: "Family",
    title: { en: "Khula / Divorce", roman_urdu: "Khula / Talaq" },
    situation: {
      en: "The wife wants dissolution of marriage by khula, or the husband has pronounced talaq (divorce).",
      roman_urdu: "Biwi khula ke zariye nikah khatam karna chahti hai, ya shohar ne talaq di hai."
    },
    whereToGo: {
      en: "Family Court for khula; for talaq, the husband must send notice to the Chairman Union Council.",
      roman_urdu: "Khula ke liye Family Court; talaq ke liye shohar Chairman Union Council ko notice bhejta hai."
    },
    whoCanFile: {
      en: "The wife files a khula suit; the husband initiates talaq through written notice.",
      roman_urdu: "Biwi khula ka muqadma karti hai; shohar likhi notice se talaq ka aaghaz karta hai."
    },
    documents: {
      en: ["Nikahnama", "CNICs", "For talaq: written notice and proof of delivery to Union Council"],
      roman_urdu: ["Nikahnama", "CNIC", "Talaq ke liye: likhi notice aur Union Council ko raseed ka suboot"]
    },
    steps: {
      en: [
        "Khula: the wife files a suit under Section 10(4) of the Family Courts Act 1964.",
        "The court attempts reconciliation; the wife may return part of the dower if ordered.",
        "Talaq: the husband sends written notice under Section 7 MFLO 1961 to the Union Council chairman.",
        "After a 90-day reconciliation period, the divorce becomes effective and is registered."
      ],
      roman_urdu: [
        "Khula: biwi Family Courts Act 1964 ke Section 10(4) ke tehat muqadma karti hai.",
        "Adalat sulah ki koshish karti hai; hukm ho to biwi mahr ka hissa wapas kar sakti hai.",
        "Talaq: shohar MFLO 1961 ke Section 7 ke tehat Union Council chairman ko likhi notice bhejta hai.",
        "90 din ki sulah muddat ke baad talaq moasir hoti hai aur register hoti hai."
      ]
    },
    possibleOutcome: {
      en: "Decree of dissolution (khula), or effective divorce after the talaq procedure.",
      roman_urdu: "Nikah khatam karne ka decree (khula), ya talaq ke amal ke baad moasir talaq."
    },
    nextStep: {
      en: "Apply for maintenance or custody in the Family Court if needed after dissolution.",
      roman_urdu: "Zaroorat par dissolution ke baad Family Court mein nafqa ya hizanat ki darkhwast karen."
    },
    law: {
      en: "Section 10(4) Family Courts Act 1964; Sections 7-8 Muslim Family Laws Ordinance 1961.",
      roman_urdu: "Section 10(4) Family Courts Act 1964; Section 7-8 Muslim Family Laws Ordinance 1961."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "maintenance",
    icon: Wallet,
    category: "Family",
    title: { en: "Maintenance (Nafqa)", roman_urdu: "Nafqa (Kharch)" },
    situation: {
      en: "A wife, children, or parents are not being provided financial support by the person legally bound to maintain them.",
      roman_urdu: "Biwi, bache ya walidain ko un ki kifalat ka qanooni zimmedar shakhs maali madad nahi de raha."
    },
    whereToGo: {
      en: "The Family Court (suit for maintenance); a Magistrate under Section 488 CrPC is also available in some situations.",
      roman_urdu: "Family Court (nafqa ka muqadma); kuch sooraton mein Section 488 CrPC ke tehat Magistrate bhi mojood hai."
    },
    whoCanFile: {
      en: "The wife, minor children (through guardian), or parents who cannot maintain themselves.",
      roman_urdu: "Biwi, na baligh bache (wali ke zariye) ya woh walidain jo apni kifalat nahi kar sakte."
    },
    documents: {
      en: ["Nikahnama / birth certificates proving relationship", "Proof of the respondent's means", "CNIC copies"],
      roman_urdu: ["Rishte ka suboot (nikahnama/birth certificates)", "Jawab deh ki maali haisiyat ka suboot", "CNIC ki copy"]
    },
    steps: {
      en: [
        "File the maintenance suit before the Family Court.",
        "Prove the relationship and the respondent's failure to maintain.",
        "The court can award interim maintenance during the case.",
        "A final decree fixes the monthly allowance, enforceable through execution."
      ],
      roman_urdu: [
        "Family Court mein nafqa ka muqadma karen.",
        "Rishta aur kifalat mein kotahi sabit karen.",
        "Adalat case ke doran interim nafqa bhi de sakti hai.",
        "Aakhri decree mahana raqam muqarrar karti hai jo execution ke qabil hoti hai."
      ]
    },
    possibleOutcome: {
      en: "A monthly maintenance order with arrears, enforceable against the respondent.",
      roman_urdu: "Baqaya samet mahana nafqa ka hukm, jo jawab deh ke khilaf nafiz hota hai."
    },
    nextStep: {
      en: "If the respondent stops paying, file for execution; modification is possible if circumstances change.",
      roman_urdu: "Adaigi ruk jaye to execution karen; haalaat badalne par tabdeeli bhi mumkin hai."
    },
    law: {
      en: "Family Courts Act 1964 (Section 5); Muslim Family Laws Ordinance 1961 (Section 9); Section 488 CrPC 1898.",
      roman_urdu: "Family Courts Act 1964 (Section 5); Muslim Family Laws Ordinance 1961 (Section 9); Section 488 CrPC 1898."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "child_custody",
    icon: Baby,
    category: "Family",
    title: { en: "Child Custody", roman_urdu: "Bache Ki Hizanat (Custody)" },
    situation: {
      en: "After separation or divorce, parents dispute who will keep and raise the child.",
      roman_urdu: "Judai ya talaq ke baad walidain mein is baat ka tanaza hai ke bacha kis ke paas rahega."
    },
    whereToGo: {
      en: "The Family Court or the Guardian Judge (District Court) under the Guardians and Wards Act 1890.",
      roman_urdu: "Family Court ya Guardians and Wards Act 1890 ke tehat Guardian Judge (District Court)."
    },
    whoCanFile: {
      en: "Either parent or a close relative seeking custody or visitation.",
      roman_urdu: "Koi bhi waldain ya qareebi rishtedar jo hizanat ya mulaqat chahta hai."
    },
    documents: {
      en: ["Child's birth certificate", "Parental status documents", "Evidence of the child's living conditions"],
      roman_urdu: ["Bache ka birth certificate", "Waldain ki haisiyat ki asnaad", "Bache ke rehne ke halaat ka suboot"]
    },
    steps: {
      en: [
        "File a custody petition stating the child's welfare as the ground.",
        "The court examines the child's welfare (the paramount consideration).",
        "The court may interview the child and consider both parents' circumstances.",
        "The court issues a custody and visitation order."
      ],
      roman_urdu: [
        "Bache ki khair khawahi ko bunyaad bana kar hizanat ki petition den.",
        "Adalat bache ki khair khawahi (sab se ahem) ka jaiza leti hai.",
        "Adalat bache se baat kar sakti hai aur dono waldain ke halaat dekhti hai.",
        "Adalat hizanat aur mulaqat ka hukm jari karti hai."
      ]
    },
    possibleOutcome: {
      en: "Custody awarded in the child's welfare, with visitation rights for the other parent.",
      roman_urdu: "Bache ki khair khawahi mein hizanat ka faisla, doosre waldain ke liye mulaqat ke haqooq ke sath."
    },
    nextStep: {
      en: "Custody can be modified if circumstances change; contempt applies for disobeying visitation orders.",
      roman_urdu: "Haalaat badalne par hizanat mein tabdeeli ho sakti hai; mulaqat ke hukm ki khilaaf warzi par contempt lagta hai."
    },
    law: {
      en: "Guardians and Wards Act 1890 (Sections 7, 17, 25).",
      roman_urdu: "Guardians and Wards Act 1890 (Section 7, 17, 25)."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "guardianship",
    icon: UserCheck,
    category: "Family",
    title: { en: "Guardianship", roman_urdu: "Sarparasti (Guardianship)" },
    situation: {
      en: "A minor needs a legal guardian for his or her person or property (e.g., after a parent's death).",
      roman_urdu: "Na baligh bache ko apni zaat ya jaedad ke liye qanooni sarparast chahiye (misal ke taur par waldain ke inteqal ke baad)."
    },
    whereToGo: {
      en: "The Guardian Judge (District Court) under the Guardians and Wards Act 1890.",
      roman_urdu: "Guardians and Wards Act 1890 ke tehat Guardian Judge (District Court)."
    },
    whoCanFile: {
      en: "A relative or any person interested in the minor's welfare applies for appointment.",
      roman_urdu: "Koi rishtedar ya bache ki khair khawahi mein dilchaspi rakhne wala shakhs taqarruri ki darkhwast karta hai."
    },
    documents: {
      en: ["Minor's birth certificate", "Death certificate of parents (if applicable)", "Property details of the minor", "Applicant's CNIC"],
      roman_urdu: ["Na baligh ka birth certificate", "Waldain ka death certificate (agar moqood ho)", "Bache ki jaedad ki details", "Darkhwast den wale ka CNIC"]
    },
    steps: {
      en: [
        "File the application under Sections 7-10 of the Guardians and Wards Act 1890.",
        "The court issues notices to interested persons.",
        "The court examines the minor's welfare and the applicant's fitness.",
        "The court issues a guardianship certificate defining the guardian's powers."
      ],
      roman_urdu: [
        "Guardians and Wards Act 1890 ke Section 7-10 ke tehat application den.",
        "Adalat mutaliqa afraad ko notice jari karti hai.",
        "Adalat bache ki khair khawahi aur darkhwast den wale ki aahliyat dekhti hai.",
        "Adalat sarparast ke ikhtiyarat batane wala guardianship certificate jari karti hai."
      ]
    },
    possibleOutcome: {
      en: "A guardian is appointed for the minor's person or property.",
      roman_urdu: "Bache ki zaat ya jaedad ke liye sarparast muqarrar ho jata hai."
    },
    nextStep: {
      en: "The guardian must manage the property faithfully; the court supervises and can remove a guardian.",
      roman_urdu: "Sarparast jaedad amanat dari se chalay; adalat nigerani karti hai aur sarparast ko hata bhi sakti hai."
    },
    law: {
      en: "Guardians and Wards Act 1890 (Sections 7-19).",
      roman_urdu: "Guardians and Wards Act 1890 (Section 7-19)."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "property_dispute",
    icon: Home,
    category: "Property & Tenancy",
    title: { en: "Property Dispute", roman_urdu: "Jaedad Ka Tanaza" },
    situation: {
      en: "A dispute over ownership, possession, or title of land or a house.",
      roman_urdu: "Zameen ya makaan ki milkiyat, qabza ya title par tanaza."
    },
    whereToGo: {
      en: "The civil court for title and possession suits; revenue courts/authorities for mutation and record correction.",
      roman_urdu: "Title aur qabze ke muqadmat ke liye civil court; intiqal (mutation) aur record ki durustgi ke liye revenue adalaten/idaray."
    },
    whoCanFile: {
      en: "The owner, co-owner, or any person whose rights over the property are affected.",
      roman_urdu: "Malik, shareek malik ya koi bhi shakhs jis ke jaedad par haqooq mutassir hon."
    },
    documents: {
      en: ["Title deed (registry/intiqal)", "Fard/record of rights", "CNICs", "Site plan if available"],
      roman_urdu: ["Title deed (registry/intiqal)", "Fard/record of rights", "CNIC", "Moqood ho to site plan"]
    },
    steps: {
      en: [
        "Verify title through the revenue record (fard) and registry.",
        "Send a legal notice to the other party (optional but helpful).",
        "File a suit for declaration and/or possession in the civil court.",
        "After the decree, get the revenue record corrected accordingly."
      ],
      roman_urdu: [
        "Revenue record (fard) aur registry se title ki tasdeeq karen.",
        "Doosre fareeq ko legal notice bhejen (zaroori nahi magar mufeed).",
        "Civil court mein declaration ya qabze ka muqadma karen.",
        "Decree ke baad revenue record durust karwayen."
      ]
    },
    possibleOutcome: {
      en: "A decree of declaration, possession, or partition as the case requires.",
      roman_urdu: "Muamle ke mutabiq declaration, qabze ya taqseem ka decree."
    },
    nextStep: {
      en: "Execute the decree and get mutation entered; appeal if the decision is adverse.",
      roman_urdu: "Decree ki tameel kara ke mutation darj karayen; faisla khilaf ho to appeal karen."
    },
    law: {
      en: "Code of Civil Procedure 1908; Specific Relief Act 1877 (Section 42); Land Revenue Act 1967.",
      roman_urdu: "Code of Civil Procedure 1908; Specific Relief Act 1877 (Section 42); Land Revenue Act 1967."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "tenancy_dispute",
    icon: Building2,
    category: "Property & Tenancy",
    title: { en: "Tenancy / Rent Dispute", roman_urdu: "Kiraya / Kiraiyedari Ka Tanaza" },
    situation: {
      en: "A landlord wants eviction or rent recovery, or a tenant faces unlawful eviction or rent increase.",
      roman_urdu: "Makan malik eviction ya kiraye ki wusooli chahta hai, ya kiraiyedar ghair qanooni be dakhli ya kiraye mein izafe ka samna kar raha hai."
    },
    whereToGo: {
      en: "The Rent Controller (or Rent Tribunal) under the applicable provincial/federal rent law.",
      roman_urdu: "Mutalqa soobai/safarti rent qanoon ke tehat Rent Controller (ya Rent Tribunal)."
    },
    whoCanFile: {
      en: "The landlord or the tenant, depending on the grievance.",
      roman_urdu: "Shikayat ke mutabiq makan malik ya kiraiyedar."
    },
    documents: {
      en: ["Rent agreement (if any)", "Rent receipts", "CNICs", "Notice exchanged between the parties"],
      roman_urdu: ["Kiraiya nama (agar ho)", "Kiraye ki raseeden", "CNIC", "Fareeqain ke darmiyan tabadla honay wale notices"]
    },
    steps: {
      en: [
        "File an application for eviction or rent fixation before the Rent Controller.",
        "The controller issues notice to the other party.",
        "Both parties are heard; the controller examines the statutory grounds.",
        "The controller passes an order for eviction or rent determination."
      ],
      roman_urdu: [
        "Rent Controller ke samne eviction ya kiraye ki taqseem ki darkhwast den.",
        "Controller doosre fareeq ko notice jari karta hai.",
        "Dono fareeqain suni jati hain; controller qanooni asbaab dekhta hai.",
        "Controller eviction ya kiraye ke ta'ayyun ka hukm deta hai."
      ]
    },
    possibleOutcome: {
      en: "An eviction order or rent fixed at a fair rate, enforceable by law.",
      roman_urdu: "Eviction ka hukm ya munsifana kiraya muqarrar, jo qanoon ke tehat nafiz hota hai."
    },
    nextStep: {
      en: "Appeal lies to the appellate authority under the rent law within the prescribed time.",
      roman_urdu: "Rent qanoon ke tehat muqarrara muddat mein appellate authority ke paas appeal ho sakti hai."
    },
    law: {
      en: "Rent Restriction Ordinance 1959 (Islamabad); provincial rent laws such as the Punjab Rented Premises Act 2009.",
      roman_urdu: "Rent Restriction Ordinance 1959 (Islamabad); soobai rent qawaneen jaise Punjab Rented Premises Act 2009."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "labour_complaint",
    icon: Briefcase,
    category: "Consumer & Labour",
    title: { en: "Labour Complaint", roman_urdu: "Mazdoor Ki Shikayat" },
    situation: {
      en: "A worker faces unpaid wages, illegal termination, withheld benefits, or poor working conditions.",
      roman_urdu: "Mazdoor ko wusool na hone wali ujrat, ghair qanooni barkhastgi, roki hui sahooliyat ya buray halaat ka samna hai."
    },
    whereToGo: {
      en: "Labour inspector/labour department first, then the Labour Court for adjudication of grievances.",
      roman_urdu: "Pehle labour inspector/labour department, phir faryad ki sam'at ke liye Labour Court."
    },
    whoCanFile: {
      en: "The worker personally, through a union (CBA), or through a labour inspector.",
      roman_urdu: "Mazdoor khud, union (CBA) ke zariye ya labour inspector ke zariye."
    },
    documents: {
      en: ["Appointment/employment letter", "Pay slips and attendance records", "CNIC", "Termination letter if any"],
      roman_urdu: ["Taqarruri/employment letter", "Pay slips aur hazri ka record", "CNIC", "Moqood ho to termination letter"]
    },
    steps: {
      en: [
        "Send a grievance to the employer in writing.",
        "If unresolved, complain to the labour inspector or labour department.",
        "The department attempts conciliation; failure leads to reference to the Labour Court.",
        "The Labour Court records evidence and passes an award."
      ],
      roman_urdu: [
        "Employer ko likhi shikayat bhejen.",
        "Hal na ho to labour inspector ya labour department se shikayat karen.",
        "Mahkama sulah ki koshish karta hai; na hone par mamla Labour Court ko bheja jata hai.",
        "Labour Court shawahid record kar ke award deti hai."
      ]
    },
    possibleOutcome: {
      en: "Reinstatement, payment of wages and benefits, or compensation under the court's award.",
      roman_urdu: "Adalat ke award ke tehat bahaali, ujrat aur sahooliyat ki adaeigi ya muawza."
    },
    nextStep: {
      en: "An appeal against the Labour Court award lies to the Labour Appellate Tribunal.",
      roman_urdu: "Labour Court ke award ke khilaf Labour Appellate Tribunal mein appeal hoti hai."
    },
    law: {
      en: "Provincial Industrial Relations legislation; Payment of Wages Act 1936; Minimum Wages Ordinance 1961.",
      roman_urdu: "Soobai Industrial Relations qawaneen; Payment of Wages Act 1936; Minimum Wages Ordinance 1961."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "consumer_complaint",
    icon: ShoppingBag,
    category: "Consumer & Labour",
    title: { en: "Consumer Complaint", roman_urdu: "Consumer Ki Shikayat" },
    situation: {
      en: "A defective product, overcharging, or deficient service from a seller or service provider.",
      roman_urdu: "Kharaab cheez, zyada qeemat ya seller/service provider ki nakis khidmat."
    },
    whereToGo: {
      en: "The Consumer Court (or Consumer Council) established under the applicable provincial/federal consumer protection law.",
      roman_urdu: "Mutalqa soobai/safarti consumer protection qanoon ke tehat qaem Consumer Court (ya Consumer Council)."
    },
    whoCanFile: {
      en: "The consumer who bought the goods or received the service.",
      roman_urdu: "Woh consumer jisne cheez khareedi ya khidmat hasil ki."
    },
    documents: {
      en: ["Purchase receipt/invoice", "Warranty or service documents", "Photos of the defect", "Copy of complaint to the seller"],
      roman_urdu: ["Kharidari ki receipt/invoice", "Warranty ya khidmat ki asnaad", "Kharabi ki photos", "Seller ko shikayat ki copy"]
    },
    steps: {
      en: [
        "Complain to the seller/provider in writing and keep proof.",
        "If unresolved, file a complaint with the Consumer Court or Council.",
        "Both sides are heard; the court may order inspection or expert opinion.",
        "The court can order refund, replacement, or compensation."
      ],
      roman_urdu: [
        "Seller/provider ko likhi shikayat karen aur suboot rakhen.",
        "Hal na ho to Consumer Court ya Council mein complaint karen.",
        "Dono fareeqain suni jati hain; adalat moaina ya mahir ki rai ka hukm de sakti hai.",
        "Adalat refund, replacement ya muawze ka hukm de sakti hai."
      ]
    },
    possibleOutcome: {
      en: "Refund, replacement, repair, or compensation for the consumer.",
      roman_urdu: "Consumer ke liye refund, replacement, marammat ya muawza."
    },
    nextStep: {
      en: "Appeal lies to the appellate authority under the consumer law; wilful non-compliance can attract penalties.",
      roman_urdu: "Consumer qanoon ke tehat appellate authority mein appeal hoti hai; jaan bujh kar na manne par jurmane ho sakte hain."
    },
    law: {
      en: "Islamabad Consumer Protection Act 1995; Punjab Consumer Protection Act 2005; Sindh Consumer Protection Act 2014.",
      roman_urdu: "Islamabad Consumer Protection Act 1995; Punjab Consumer Protection Act 2005; Sindh Consumer Protection Act 2014."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "cyber_complaint",
    icon: MonitorSmartphone,
    category: "Cybercrime",
    title: { en: "Cybercrime Complaint", roman_urdu: "Cybercrime Ki Shikayat" },
    situation: {
      en: "Online harassment, blackmail, hacking, fake social media accounts, or online fraud.",
      roman_urdu: "Online tang karna, blackmail, hacking, jali social media accounts ya online fraud."
    },
    whereToGo: {
      en: "FIA Cybercrime Wing (NR3C) — online portal complaint.fia.gov.pk, helpline 1991, or the nearest FIA office.",
      roman_urdu: "FIA Cybercrime Wing (NR3C) — online portal complaint.fia.gov.pk, helpline 1991 ya qareebi FIA office."
    },
    whoCanFile: {
      en: "The victim or their representative can report the offence.",
      roman_urdu: "Victim ya un ka numainda jurm ki report kar sakta hai."
    },
    documents: {
      en: ["Screenshots of messages/posts (with dates)", "URLs and account details of the accused", "CNIC", "Any threatening content saved"],
      roman_urdu: ["Messages/posts ke screenshots (tareekhon ke sath)", "Mulzim ke URLs aur account ki details", "CNIC", "Dhamki wala material mehfooz karen"]
    },
    steps: {
      en: [
        "Preserve all digital evidence (screenshots, URLs, chat backups).",
        "Report online at complaint.fia.gov.pk or call 1991.",
        "FIA registers the complaint and conducts a technical investigation.",
        "Prosecution proceeds under the Prevention of Electronic Crimes Act (PECA) 2016."
      ],
      roman_urdu: [
        "Tamam digital suboot (screenshots, URLs, chat backups) mehfooz karen.",
        "Cybercrime.gov.pk par online report karen ya 1991 par call karen.",
        "FIA complaint darj kar ke technical tehqeeq karti hai.",
        "Prevention of Electronic Crimes Act (PECA) 2016 ke tehat muqadma chalta hai."
      ]
    },
    possibleOutcome: {
      en: "Investigation, arrest of the accused, content removal, and trial under PECA 2016.",
      roman_urdu: "Tehqeeq, mulzim ki giraftari, material ka khatma aur PECA 2016 ke tehat trial."
    },
    nextStep: {
      en: "Track the complaint with FIA; consult the Digital Rights Foundation helpline (0800-39393) for victim support.",
      roman_urdu: "FIA ke paas complaint ka pata karen; madad ke liye Digital Rights Foundation helpline (0800-39393) se raabta karen."
    },
    law: {
      en: "Prevention of Electronic Crimes Act (PECA) 2016.",
      roman_urdu: "Prevention of Electronic Crimes Act (PECA) 2016."
    },
    sourceUrl: "https://complaint.fia.gov.pk/"
  },
  {
    id: "legal_notice",
    icon: Megaphone,
    category: "Notices & Legal Aid",
    title: { en: "Legal Notice", roman_urdu: "Qanooni Notice" },
    situation: {
      en: "Before filing a suit (especially against government) or to demand performance from the other party.",
      roman_urdu: "Muqadma daakhil karne se pehle (khaas kar sarkar ke khilaf) ya doosre fareeq se adaeigi ka mutalba karne ke liye."
    },
    whereToGo: {
      en: "Drafted and sent through a lawyer to the opposite party (or the government department).",
      roman_urdu: "Wakeel ke zariye tayar kar ke muqabil fareeq (ya sarkari mahkame) ko bheji jati hai."
    },
    whoCanFile: {
      en: "The aggrieved party, through their lawyer.",
      roman_urdu: "Mutassira fareeq, apne wakeel ke zariye."
    },
    documents: {
      en: ["Facts and timeline of the dispute", "Supporting documents", "Postal receipt of the notice"],
      roman_urdu: ["Tanaze ke waqiat aur tareekhen", "Taeedi asnaad", "Notice ki postal receipt"]
    },
    steps: {
      en: [
        "Have a lawyer draft the notice stating facts, breach, and the relief demanded.",
        "Send it by registered post/courier and keep proof of delivery.",
        "Wait for the notice period (for government suits: two months under Section 80 CPC).",
        "If there is no response, proceed to file the suit."
      ],
      roman_urdu: [
        "Wakeel se notice tayar karayen jis mein waqiat, khilaaf warzi aur mutalba ho.",
        "Registered post/courier se bhej kar raseed mehfooz karen.",
        "Notice ki muddat ka intizar karen (sarkar ke khilaf muqadma: Section 80 CPC ke tehat 2 mah).",
        "Jawab na aaye to muqadma daakhil karen."
      ]
    },
    possibleOutcome: {
      en: "Settlement without litigation, or a precondition for filing the suit.",
      roman_urdu: "Adalat ke baghair sulah, ya muqadme ke liye shart-e-awwal."
    },
    nextStep: {
      en: "File the suit if the notice is not complied with; the notice strengthens your case.",
      roman_urdu: "Notice par amal na ho to muqadma karen; notice aap ke muqadme ko mazboot karti hai."
    },
    law: {
      en: "Section 80, Code of Civil Procedure 1908 (suits against government); general contract practice.",
      roman_urdu: "Section 80, Code of Civil Procedure 1908 (sarkar ke khilaf muqadma); aam muahida practice."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "legal_aid_application",
    icon: HeartHandshake,
    category: "Notices & Legal Aid",
    title: { en: "Legal Aid Application", roman_urdu: "Mufit Qanooni Imdad Ki Darkhwast" },
    situation: {
      en: "You cannot afford a lawyer and need free legal representation or advice.",
      roman_urdu: "Aap wakeel ka kharch utha nahi sakte aur mufit qanooni numaindagi ya mashware ki zaroorat hai."
    },
    whereToGo: {
      en: "District Legal Empowerment Committees, the Legal Aid and Justice Authority (LAJA), provincial legal aid bodies, or MoHR helpline 1099.",
      roman_urdu: "District Legal Empowerment Committees, Legal Aid and Justice Authority (LAJA), soobai legal aid idare ya MoHR helpline 1099."
    },
    whoCanFile: {
      en: "Indigent citizens who qualify on a means assessment.",
      roman_urdu: "Nadaar shehri jo maali jaiza (means assessment) par ahal qarar payen."
    },
    documents: {
      en: ["CNIC", "Proof of income/indigence", "Case details (FIR, notice, or court papers)", "Application form of the legal aid body"],
      roman_urdu: ["CNIC", "Kam aamdani ka suboot", "Case ki details (FIR, notice ya adalati kaaghzat)", "Legal aid idare ka application form"]
    },
    steps: {
      en: [
        "Apply to the District Legal Empowerment Committee or LAJA with your case details.",
        "Your financial means are assessed.",
        "If eligible, a lawyer is assigned to your case.",
        "Representation continues through the proceedings without cost."
      ],
      roman_urdu: [
        "Case ki details ke sath District Legal Empowerment Committee ya LAJA ko darkhwast den.",
        "Aap ke maali halaat ka jaiza liya jata hai.",
        "Ahal qarar pane par aap ke case ke liye wakeel muqarrar hota hai.",
        "Numaindagi baghair kharch ke karwai mukammal hone tak jari rehti hai."
      ]
    },
    possibleOutcome: {
      en: "Free legal representation for your case.",
      roman_urdu: "Aap ke case ke liye mufit qanooni numaindagi."
    },
    nextStep: {
      en: "Cooperate with the assigned lawyer and provide all documents; keep the helpline 1099 for urgent guidance.",
      roman_urdu: "Muqarrar wakeel ke sath tawun karen aur tamam asnaad den; fori rehnumai ke liye helpline 1099 rakhen."
    },
    law: {
      en: "Legal Aid and Justice Authority Act 2020; Articles 10-A and 37(d) of the Constitution.",
      roman_urdu: "Legal Aid and Justice Authority Act 2020; Constitution ke Article 10-A aur 37(d)."
    },
    sourceUrl: "https://laja.gov.pk/"
  },
  {
    id: "constitutional_petition",
    icon: Landmark,
    category: "Constitutional",
    title: { en: "Constitutional Petition", roman_urdu: "Aaini Petition" },
    situation: {
      en: "A fundamental right (life, liberty, equality, dignity) has been violated by the state or a public body.",
      roman_urdu: "Riyasat ya kisi sarkari idare ne koi bunyadi haq (zindagi, azadi, musawat, izzat) paamaal kiya hai."
    },
    whereToGo: {
      en: "The High Court under Article 199 of the Constitution; the Supreme Court under Article 184(3) for matters of public importance.",
      roman_urdu: "Constitution ke Article 199 ke tehat High Court; ahem aam mamlat ke liye Article 184(3) ke tehat Supreme Court."
    },
    whoCanFile: {
      en: "The aggrieved citizen (or a public-interest petitioner with standing).",
      roman_urdu: "Mutassira shehri (ya mojoodgi rakhnay wala public-interest petitioner)."
    },
    documents: {
      en: ["Petition stating the facts and the right violated", "Evidence of the violation", "CNIC", "Any government orders challenged"],
      roman_urdu: ["Waqiat aur paamaal shuda haq bayan karti petition", "Khilaaf warzi ka suboot", "CNIC", "Mutnaza sarkari ahkaam"]
    },
    steps: {
      en: [
        "File the constitutional petition before the High Court.",
        "The court issues notices to the respondents and may pass interim orders.",
        "Both sides are heard on the constitutional question.",
        "The court declares the position and can order enforcement or compensation."
      ],
      roman_urdu: [
        "High Court mein aaini petition file karen.",
        "Adalat jawab deheen ko notice jari karti hai aur interim hukm de sakti hai.",
        "Aaini sawal par dono fareeqain suni jati hain.",
        "Adalat mawqaf wazeh karti hai aur tameel ya muawze ka hukm de sakti hai."
      ]
    },
    possibleOutcome: {
      en: "Enforcement of the fundamental right, quashing of illegal action, and possibly compensation.",
      roman_urdu: "Bunyadi haq ki tameel, ghair qanooni karwai ka khatma aur mumkin tor par muawza."
    },
    nextStep: {
      en: "An intra-court appeal or Supreme Court appeal lies against the High Court decision.",
      roman_urdu: "High Court ke faisle ke khilaf intra-court appeal ya Supreme Court appeal hoti hai."
    },
    law: {
      en: "Articles 184(3) and 199, Constitution of Pakistan 1973.",
      roman_urdu: "Constitution of Pakistan 1973 ke Article 184(3) aur 199."
    },
    sourceUrl: "https://na.gov.pk/"
  },
  {
    id: "writ",
    icon: ScrollText,
    category: "Constitutional",
    title: { en: "Writ Petition", roman_urdu: "Writ Petition" },
    situation: {
      en: "An illegal government order, unlawful detention, or a public body's failure to act needs judicial correction.",
      roman_urdu: "Ghair qanooni sarkari hukm, ghair qanooni nazar bandi ya sarkari idare ki kotahi par adalati durustgi chahiye."
    },
    whereToGo: {
      en: "The High Court, which can issue writs of mandamus, certiorari, prohibition, habeas corpus, and quo warranto.",
      roman_urdu: "High Court, jo mandamus, certiorari, prohibition, habeas corpus aur quo warranto ke writ jari kar sakti hai."
    },
    whoCanFile: {
      en: "The aggrieved person (habeas corpus can be filed by any person for a detained person).",
      roman_urdu: "Mutassira shakhs (habeas corpus koi bhi shakhs nazar band shakhs ke liye file kar sakta hai)."
    },
    documents: {
      en: ["Writ petition with grounds", "Copy of the impugned order/action", "CNIC", "Details of detention (for habeas corpus)"],
      roman_urdu: ["Asbaab ke sath writ petition", "Mutnaza hukm/karwai ki copy", "CNIC", "Nazar bandi ki details (habeas corpus ke liye)"]
    },
    steps: {
      en: [
        "File the writ petition in the High Court.",
        "The court hears the petition and issues notices to the authorities.",
        "The court examines the legality of the action.",
        "A writ is issued: the order is quashed, action is directed, or the person is released."
      ],
      roman_urdu: [
        "High Court mein writ petition file karen.",
        "Adalat sunwai kar ke ahle ikhtiyar ko notice jari karti hai.",
        "Adalat karwai ki qanooniyat dekhti hai.",
        "Writ jari hota hai: hukm mansookh, karwai ka hukm ya shakhs ki rehaai."
      ]
    },
    possibleOutcome: {
      en: "The illegal order is quashed or the authority is directed to act; in habeas corpus, release from unlawful custody.",
      roman_urdu: "Ghair qanooni hukm mansookh ya idare ko amal ka hukm; habeas corpus mein ghair qanooni hirasat se rehaai."
    },
    nextStep: {
      en: "Non-compliance with the writ invites contempt proceedings before the same court.",
      roman_urdu: "Writ par amal na hone par usi adalat mein contempt ki karwai hoti hai."
    },
    law: {
      en: "Article 199, Constitution of Pakistan 1973.",
      roman_urdu: "Constitution of Pakistan 1973 ka Article 199."
    },
    sourceUrl: "https://na.gov.pk/"
  },
  {
    id: "adr",
    icon: MessagesSquare,
    category: "Alternative Dispute Resolution",
    title: { en: "ADR (Alternative Dispute Resolution)", roman_urdu: "ADR (Muta'addil Tanaza Hal)" },
    situation: {
      en: "Parties want a faster, cheaper, private resolution instead of a full trial.",
      roman_urdu: "Fareeqain mukammal trial ke bajaye tez, sasti aur khufia hal chahte hain."
    },
    whereToGo: {
      en: "Court-annexed ADR under Section 89-A CPC, or a private ADR centre/neutral.",
      roman_urdu: "Section 89-A CPC ke tehat court-annexed ADR, ya private ADR centre/neutral."
    },
    whoCanFile: {
      en: "Both parties, by mutual consent or court referral.",
      roman_urdu: "Dono fareeqain, bahmi razamandi ya adalat ke hukm par."
    },
    documents: {
      en: ["Dispute summary", "Supporting documents", "Consent to the chosen ADR mode"],
      roman_urdu: ["Tanaze ka khulasa", "Taeedi asnaad", "Muntakhib ADR tareeqe par razamandi"]
    },
    steps: {
      en: [
        "Choose the ADR mode (mediation, arbitration, or conciliation).",
        "Appoint a neutral with both parties' consent.",
        "Sessions are held; parties work toward a settlement.",
        "The settlement agreement is signed and, if court-referred, adopted as binding."
      ],
      roman_urdu: [
        "ADR ka tareeqa chunen (mediation, arbitration ya conciliation).",
        "Dono fareeqain ki razamandi se ek neutral muqarrar karen.",
        "Sessions hoti hain; fareeqain sulah ki taraf barhte hain.",
        "Sulah nama sign hota hai aur court se ho to paband (binding) ban jata hai."
      ]
    },
    possibleOutcome: {
      en: "A binding settlement without trial, saving time and cost.",
      roman_urdu: "Baghair trial ke paband sulah, waqt aur kharch ki bachat ke sath."
    },
    nextStep: {
      en: "If ADR fails, the case returns to court for regular proceedings.",
      roman_urdu: "ADR nakam ho to case aam karwai ke liye court wapas chala jata hai."
    },
    law: {
      en: "Section 89-A CPC 1908; Alternative Dispute Resolution Act 2017.",
      roman_urdu: "Section 89-A CPC 1908; Alternative Dispute Resolution Act 2017."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "arbitration",
    icon: Handshake,
    category: "Alternative Dispute Resolution",
    title: { en: "Arbitration", roman_urdu: "Arbitration (Saalisi)" },
    situation: {
      en: "A contract contains an arbitration clause, or parties agree to resolve a commercial dispute outside court.",
      roman_urdu: "Contract mein arbitration clause hai, ya fareeqain tijarati tanaza adalat se bahar hal karne par razi hain."
    },
    whereToGo: {
      en: "An arbitrator or arbitral tribunal agreed by the parties.",
      roman_urdu: "Fareeqain ki razamandi se muqarrar arbitrator ya arbitral tribunal."
    },
    whoCanFile: {
      en: "Parties to the arbitration agreement invoke arbitration by notice.",
      roman_urdu: "Arbitration agreement ke fareeqain notice ke zariye arbitration ka aaghaz karte hain."
    },
    documents: {
      en: ["Contract with the arbitration clause", "Claim statement", "Supporting documents and evidence"],
      roman_urdu: ["Arbitration clause wala contract", "Claim statement", "Taeedi asnaad aur shawahid"]
    },
    steps: {
      en: [
        "Serve an arbitration notice invoking the clause.",
        "Appoint the arbitrator(s) as per the agreement (or through court assistance).",
        "Exchange pleadings and evidence; hearings are held.",
        "The arbitrator issues a binding award."
      ],
      roman_urdu: [
        "Clause istemal karte hue arbitration notice bhejen.",
        "Moahide ke mutabiq arbitrator(s) muqarrar karen (ya adalat ki madad se).",
        "Pleadings aur shawahid ka tabadla ho; hearings hoti hain.",
        "Arbitrator paband award jari karta hai."
      ]
    },
    possibleOutcome: {
      en: "A binding arbitral award, enforceable like a court decree.",
      roman_urdu: "Paband arbitral award, jo adalati decree ki tarah nafiz hota hai."
    },
    nextStep: {
      en: "The award can be challenged in court on limited grounds; otherwise it is filed for enforcement.",
      roman_urdu: "Award ko mehdood asbaab par court mein challenge kiya ja sakta hai; warna tameel ke liye file hota hai."
    },
    law: {
      en: "Arbitration Act 1940; Recognition and Enforcement (Arbitration Agreements and Foreign Arbitral Awards) Act 2011.",
      roman_urdu: "Arbitration Act 1940; Recognition and Enforcement (Arbitration Agreements and Foreign Arbitral Awards) Act 2011."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  },
  {
    id: "mediation",
    icon: MessageCircle,
    category: "Alternative Dispute Resolution",
    title: { en: "Mediation", roman_urdu: "Mediation (Salisah)" },
    situation: {
      en: "A family, property, or civil dispute can be resolved through facilitated negotiation with a neutral mediator.",
      roman_urdu: "Khandani, jaedad ya diwani tanaza ek neutral mediator ki madad se muzakrat ke zariye hal ho sakta hai."
    },
    whereToGo: {
      en: "Court-annexed mediation centres, ADR centres, or a private mediator agreed by both parties.",
      roman_urdu: "Court-annexed mediation centres, ADR centres ya dono fareeqain ki razamandi se private mediator."
    },
    whoCanFile: {
      en: "Both parties voluntarily (or on court reference under Section 89-A CPC).",
      roman_urdu: "Dono fareeqain apni marzi se (ya Section 89-A CPC ke tehat adalat ke hukm par)."
    },
    documents: {
      en: ["Dispute summary", "Relevant documents", "Authority/consent to settle"],
      roman_urdu: ["Tanaze ka khulasa", "Mutaliqa asnaad", "Sulah ka ikhtiyar/razamandi"]
    },
    steps: {
      en: [
        "The mediator explains the process and ground rules.",
        "Joint and private sessions are held with each party.",
        "Options for settlement are explored without any imposed decision.",
        "If agreement is reached, a settlement agreement is signed and enforced."
      ],
      roman_urdu: [
        "Mediator amal aur bunyadi usool samjhata hai.",
        "Dono fareeqain ke sath mushtarka aur infiradi sessions hote hain.",
        "Baghair kisi laazim faisle ke sulah ke raaste talash kiye jate hain.",
        "Razamandi ho to sulah nama sign hota hai aur nafiz hota hai."
      ]
    },
    possibleOutcome: {
      en: "A voluntary settlement both parties accept, avoiding litigation.",
      roman_urdu: "Dono fareeqain ki qubool shuda raza karana sulah, muqadma baazi se bachte hue."
    },
    nextStep: {
      en: "If mediation fails, parties may proceed to arbitration or court.",
      roman_urdu: "Mediation nakam ho to fareeqain arbitration ya court ka rukh kar sakte hain."
    },
    law: {
      en: "Section 89-A CPC 1908; Alternative Dispute Resolution Act 2017; provincial ADR rules.",
      roman_urdu: "Section 89-A CPC 1908; Alternative Dispute Resolution Act 2017; soobai ADR rules."
    },
    sourceUrl: "https://pakistancode.gov.pk/"
  }
];
