"""
Generate synthetic student document images for OCR E2E testing.
Creates 6 document types as PNG images that Tesseract (eng) can read.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def make_image(lines, filename, width=800, height=600):
    """Create a simple text image with black text on white background."""
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
        font_bold = ImageFont.truetype("arial.ttf", 20)
    except:
        font = ImageFont.load_default()
        font_bold = font

    y = 30
    for i, line in enumerate(lines):
        if i == 0:
            draw.text((40, y), line, fill='black', font=font_bold)
            y += 35
        else:
            draw.text((40, y), line, fill='black', font=font)
            y += 25
            if y > height - 30:
                break

    path = os.path.join(OUT_DIR, filename)
    img.save(path, 'PNG')
    print(f"Created: {filename} ({width}x{height})")
    return path

# 1. Show-Cause Notice
show_cause_lines = [
    "UNIVERSITY OF SINDH - OFFICE OF THE DEAN OF STUDENTS",
    "",
    "SHOW CAUSE NOTICE",
    "",
    "Ref: SU/DOS/2024/SC-047",
    "Date: 15 March 2024",
    "",
    "To: Mr. Ahmed Ali",
    "Registration No: 2021-CS-147",
    "Department: Computer Science",
    "",
    "WHEREAS it has been reported that you were involved in ragging",
    "of junior students on 10 March 2024 in the university hostel;",
    "",
    "AND WHEREAS this constitutes a violation of University Discipline",
    "Rules Chapter IV, Section 12;",
    "",
    "YOU ARE HEREBY NOTIFIED to show cause within 7 days why disciplinary",
    "action should not be taken against you.",
    "",
    "DEAN OF STUDENTS",
    "University of Sindh, Jamshoro"
]
make_image(show_cause_lines, "show_cause_notice.png")

# 2. Fee Challan
fee_challan_lines = [
    "UNIVERSITY OF ENGINEERING AND TECHNOLOGY, MUET",
    "FEE CHALLAN / FEE VOUCHER",
    "",
    "Challan No: MUET/FIN/2024/3291",
    "Date: 20 January 2024",
    "",
    "Student Name: Fatima Khan",
    "Registration No: 2022-EE-089",
    "Department: Electrical Engineering",
    "Semester: 4th (Spring 2024)",
    "",
    "Fee Details:",
    "  Tuition Fee:              Rs. 25,000/-",
    "  Examination Fee:          Rs. 5,000/-",
    "  Library Fee:              Rs. 2,000/-",
    "  Laboratory Fee:           Rs. 3,000/-",
    "  Student Welfare Fund:     Rs. 1,000/-",
    "  TOTAL:                    Rs. 36,000/-",
    "",
    "Last Date for Deposit: 10 February 2024",
    "Bank: National Bank of Pakistan, MUET Branch",
    "",
    "TREASURER, MUET Jamshoro"
]
make_image(fee_challan_lines, "fee_challan.png", height=650)

# 3. Transcript Request
transcript_lines = [
    "APPLICATION FOR ISSUANCE OF OFFICIAL TRANSCRIPT",
    "",
    "To: The Registrar",
    "University of Sindh, Jamshoro",
    "",
    "Subject: Request for Official Transcript",
    "",
    "Respected Sir/Madam,",
    "",
    "I, Sana Bhutto, Registration No. 2019-BS-234, have completed my",
    "BS Computer Science degree in Fall 2023. I require an official",
    "transcript for the purpose of higher education applications abroad.",
    "",
    "Details Required:",
    "  - Official Transcript (sealed): 2 copies",
    "  - Degree Attestation: 1 copy",
    "  - Medium of Instruction Certificate: 1 copy",
    "",
    "I have paid the requisite fee of Rs. 3,000/- via challan",
    "No. SU/REG/2024/1156 dated 5 January 2024.",
    "",
    "Kindly issue the documents at your earliest convenience.",
    "",
    "Yours sincerely,",
    "Sana Bhutto",
    "Contact: 0300-1234567",
    "Email: sana.bhutto@email.com"
]
make_image(transcript_lines, "transcript_request.png", height=650)

# 4. Hostel Application
hostel_lines = [
    "APPLICATION FOR HOSTEL ACCOMMODATION",
    "",
    "To: The Provost / Hostel Superintendent",
    "Mehran University of Engineering and Technology (MUET)",
    "Jamshoro",
    "",
    "Subject: Application for Hostel Seat Allotment",
    "",
    "Respected Sir,",
    "",
    "I am Muhammad Usman, son of Ghulam Rasool, a student of BS",
    "Electronics Engineering, 2nd Semester (Reg. No. 2023-EL-045).",
    "My permanent address is House No. 12, Street 5, Qasimabad,",
    "Hyderabad.",
    "",
    "As I am from outside Jamshoro and my daily commute is not",
    "feasible, I request hostel accommodation for the current",
    "academic session 2024.",
    "",
    "I undertake to abide by all hostel rules and regulations.",
    "",
    "Enclosed:",
    "  1. Admission letter copy",
    "  2. Father's CNIC copy",
    "  3. Domicile certificate",
    "  4. Fee challan (current semester)",
    "",
    "Yours obediently,",
    "Muhammad Usman",
    "Contact: 0333-9876543"
]
make_image(hostel_lines, "hostel_application.png", height=700)

# 5. Admit Card
admit_lines = [
    "UNIVERSITY OF SINDH - EXAMINATION DEPARTMENT",
    "ADMIT CARD / ROLL NO SLIP",
    "",
    "Examination: BS 4th Semester Final Examination 2024",
    "",
    "Student Name: Ayesha Memon",
    "Father's Name: Abdul Kareem Memon",
    "Registration No: 2021-BS-567",
    "Department: English Literature",
    "Roll No: EL-2024-142",
    "",
    "Exam Schedule:",
    "  Date           Subject              Time",
    "  01-Jun-2024    English Poetry       09:00 AM",
    "  04-Jun-2024    English Prose        09:00 AM",
    "  07-Jun-2024    Literary Criticism   09:00 AM",
    "  10-Jun-2024    Linguistics          09:00 AM",
    "",
    "Exam Center: Arts Faculty Building, University of Sindh",
    "",
    "INSTRUCTIONS:",
    "1. Bring this admit card and university ID to every paper.",
    "2. Arrive 30 minutes before the scheduled time.",
    "3. No mobile phones or electronic devices allowed.",
    "",
    "CONTROLLER OF EXAMINATIONS",
    "University of Sindh"
]
make_image(admit_lines, "admit_card.png", height=700)

# 6. University ID Card
id_lines = [
    "======================================",
    "     UNIVERSITY OF SINDH, JAMSHORO",
    "        STUDENT IDENTITY CARD",
    "======================================",
    "",
    "Name: ZAINAB ALI",
    "Father's Name: MUHAMMAD ALI",
    "",
    "Registration No: 2023-MS-078",
    "Department: MATHEMATICS",
    "Program: MS Mathematics",
    "Session: 2023-2025",
    "",
    "Date of Birth: 15-August-2000",
    "Blood Group: B+",
    "",
    "Address: House 45, Block C,",
    "Latifabad, Hyderabad",
    "",
    "Contact: 0312-5567890",
    "",
    "Valid Until: July 2025",
    "",
    "=============  ============",
    "  SIGNATURE     UNIVERSITY SEAL",
    "",
    "REGISTRAR, UNIVERSITY OF SINDH"
]
make_image(id_lines, "university_id.png")

print("\nAll 6 synthetic student document fixtures created.")
print("Location:", OUT_DIR)
