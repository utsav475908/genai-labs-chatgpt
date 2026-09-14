import base64
import io
import os
import re
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.shared import Inches, Pt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    SimpleDocTemplate,
    PageBreak,
)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TEXT_MODEL = os.getenv("OPENAI_TEXT_MODEL", "gpt-5.6-luna")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not configured in backend/.env")

client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(
    title="GenAI-Labs V15",
    description="Document Generation Lab",
    version="15.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3015",
        "http://127.0.0.1:3015",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DocumentRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=12000)
    document_type: str = "Technical Report"
    format: str = "pdf"
    title: str = ""
    length: str = "standard"
    include_table: bool = False


class EnhanceRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=8000)


TEMPLATES = [
    {
        "id": "technical-report",
        "name": "Technical Report",
        "description": "Structured technical documentation with introduction, concepts, analysis and conclusion.",
    },
    {
        "id": "project-report",
        "name": "Project Report",
        "description": "Academic or engineering project report with objectives, methodology, implementation and results.",
    },
    {
        "id": "research-report",
        "name": "Research Report",
        "description": "Research-style document with background, methodology, findings and conclusion.",
    },
    {
        "id": "assignment",
        "name": "College Assignment",
        "description": "Well-structured academic assignment with headings, explanations and conclusion.",
    },
    {
        "id": "business-report",
        "name": "Business Report",
        "description": "Professional business report with executive summary, findings and recommendations.",
    },
    {
        "id": "meeting-report",
        "name": "Meeting Report",
        "description": "Professional meeting summary with agenda, decisions, action items and next steps.",
    },
]


@app.get("/")
def root():
    return {
        "status": "ok",
        "application": "GenAI-Labs",
        "version": "V15",
        "name": "Document Generation Lab",
        "text_model": TEXT_MODEL,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "15.0.0",
        "text_model": TEXT_MODEL,
    }


@app.get("/templates")
def templates():
    return {"success": True, "templates": TEMPLATES}


def build_generation_instructions(request: DocumentRequest) -> str:
    length_map = {
        "short": "Create a concise document of approximately 800-1200 words.",
        "standard": "Create a detailed document of approximately 1500-2200 words.",
        "long": "Create a comprehensive document of approximately 2500-3500 words.",
    }

    table_instruction = (
        "Include one useful table when appropriate."
        if request.include_table
        else "Do not create a table unless it materially improves the document."
    )

    return f"""
You are the document-generation engine for GenAI-Labs V15.

Create a professional {request.document_type} from the user's request.

USER REQUEST:
{request.prompt}

DOCUMENT REQUIREMENTS:
- {length_map.get(request.length, length_map["standard"])}
- {table_instruction}
- Use clear professional language.
- Use a logical hierarchy of sections and subsections.
- Include an introduction and conclusion where appropriate.
- Do not invent citations, statistics, research papers, URLs, or factual sources.
- If the user asks for something that requires unknown factual data, clearly state assumptions.
- Make the document useful as a real downloadable document.

OUTPUT FORMAT:
Return ONLY the document content in this simple structure:

TITLE: <document title>

HEADING: <section heading>
PARAGRAPH: <paragraph>

HEADING: <section heading>
PARAGRAPH: <paragraph>

For multiple paragraphs under a heading, repeat PARAGRAPH.

For bullet points:
BULLET: <item>

For numbered points:
NUMBER: <item>

For a table:
TABLE: <table title>
ROW: <cell 1> | <cell 2> | <cell 3>
ROW: <cell 1> | <cell 2> | <cell 3>

Do not use Markdown fences.
"""


def generate_content(request: DocumentRequest) -> str:
    try:
        response = client.responses.create(
            model=TEXT_MODEL,
            instructions=build_generation_instructions(request),
            input=request.prompt.strip(),
        )
        content = (response.output_text or "").strip()

        if not content:
            raise HTTPException(
                status_code=500,
                detail="The AI returned an empty document.",
            )

        return content

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document generation failed: {exc}",
        )


def parse_document(content: str):
    title = "GenAI-Labs Document"
    sections = []

    current_heading = None
    current_items = []

    def flush():
        nonlocal current_items
        if current_heading is not None or current_items:
            sections.append(
                {
                    "heading": current_heading or "",
                    "items": current_items[:],
                }
            )
        current_items = []

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if not line:
            continue

        upper = line.upper()

        if upper.startswith("TITLE:"):
            value = line.split(":", 1)[1].strip()
            if value:
                title = value
            continue

        if upper.startswith("HEADING:"):
            flush()
            current_heading = line.split(":", 1)[1].strip()
            continue

        if upper.startswith("PARAGRAPH:"):
            current_items.append(
                ("paragraph", line.split(":", 1)[1].strip())
            )
            continue

        if upper.startswith("BULLET:"):
            current_items.append(
                ("bullet", line.split(":", 1)[1].strip())
            )
            continue

        if upper.startswith("NUMBER:"):
            current_items.append(
                ("number", line.split(":", 1)[1].strip())
            )
            continue

        if upper.startswith("TABLE:"):
            current_items.append(
                ("table_title", line.split(":", 1)[1].strip())
            )
            continue

        if upper.startswith("ROW:"):
            cells = [
                cell.strip()
                for cell in line.split(":", 1)[1].split("|")
            ]
            current_items.append(("row", cells))
            continue

        # Fallback for unexpected plain text.
        current_items.append(("paragraph", line))

    flush()

    if not sections:
        sections = [{"heading": "", "items": [("paragraph", content.strip())]}]

    return title, sections


def safe_filename(name: str, extension: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name.strip())
    cleaned = cleaned.strip("._")
    if not cleaned:
        cleaned = "genai-labs-document"
    return f"{cleaned[:100]}.{extension}"


def make_docx(title: str, sections) -> bytes:
    document = Document()

    section = document.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

    title_paragraph = document.add_paragraph()
    title_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

    run = title_paragraph.add_run(title)
    run.bold = True
    run.font.size = Pt(20)

    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subrun = subtitle.add_run("Generated with GenAI-Labs V15")
    subrun.italic = True
    subrun.font.size = Pt(9)

    document.add_paragraph()

    for section_data in sections:
        heading = section_data["heading"]
        items = section_data["items"]

        if heading:
            p = document.add_paragraph()
            run = p.add_run(heading)
            run.bold = True
            run.font.size = Pt(14)

        table_rows = []

        for item_type, value in items:
            if item_type == "paragraph":
                p = document.add_paragraph(value)
                p.paragraph_format.space_after = Pt(8)

            elif item_type == "bullet":
                p = document.add_paragraph(value, style="List Bullet")
                p.paragraph_format.space_after = Pt(4)

            elif item_type == "number":
                p = document.add_paragraph(value, style="List Number")
                p.paragraph_format.space_after = Pt(4)

            elif item_type == "table_title":
                p = document.add_paragraph()
                r = p.add_run(value)
                r.bold = True
                table_rows = []

            elif item_type == "row":
                table_rows.append(value)

                # Render when the next non-row item appears or at section end.
                # A compact table is sufficient for the lab.
                if len(table_rows) >= 2:
                    table = document.add_table(
                        rows=len(table_rows),
                        cols=max(len(row) for row in table_rows),
                    )
                    table.style = "Table Grid"

                    for r_index, row in enumerate(table_rows):
                        for c_index, cell in enumerate(row):
                            if c_index < len(table.rows[r_index].cells):
                                table.rows[r_index].cells[c_index].text = cell

                    document.add_paragraph()
                    table_rows = []

        if table_rows:
            table = document.add_table(
                rows=len(table_rows),
                cols=max(len(row) for row in table_rows),
            )
            table.style = "Table Grid"

            for r_index, row in enumerate(table_rows):
                for c_index, cell in enumerate(row):
                    table.rows[r_index].cells[c_index].text = cell

            document.add_paragraph()

    output = io.BytesIO()
    document.save(output)
    return output.getvalue()


def make_pdf(title: str, sections) -> bytes:
    output = io.BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="GenAI-Labs V15",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "V15Title",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=20,
        leading=24,
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        "V15Subtitle",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=9,
        textColor=colors.grey,
        spaceAfter=18,
    )

    heading_style = ParagraphStyle(
        "V15Heading",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        spaceBefore=12,
        spaceAfter=7,
    )

    body_style = ParagraphStyle(
        "V15Body",
        parent=styles["BodyText"],
        fontSize=10.5,
        leading=15,
        spaceAfter=8,
    )

    bullet_style = ParagraphStyle(
        "V15Bullet",
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-8,
        bulletIndent=5,
        spaceAfter=4,
    )

    story = [
        Paragraph(title, title_style),
        Paragraph("Generated with GenAI-Labs V15", subtitle_style),
    ]

    for section_data in sections:
        heading = section_data["heading"]
        items = section_data["items"]

        if heading:
            story.append(Paragraph(heading, heading_style))

        pending_rows = []

        def flush_table():
            nonlocal pending_rows

            if len(pending_rows) >= 1:
                max_cols = max(len(row) for row in pending_rows)

                normalized = [
                    row + [""] * (max_cols - len(row))
                    for row in pending_rows
                ]

                table = Table(
                    normalized,
                    repeatRows=1 if len(normalized) > 1 else 0,
                    hAlign="LEFT",
                )

                table.setStyle(
                    TableStyle(
                        [
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                            ("LEFTPADDING", (0, 0), (-1, -1), 5),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                            ("TOPPADDING", (0, 0), (-1, -1), 5),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ]
                    )
                )

                story.append(Spacer(1, 4))
                story.append(table)
                story.append(Spacer(1, 8))

            pending_rows = []

        for item_type, value in items:
            if item_type == "row":
                pending_rows.append(value)
                continue

            flush_table()

            if item_type == "paragraph":
                story.append(
                    Paragraph(
                        escape_pdf_text(value),
                        body_style,
                    )
                )

            elif item_type == "bullet":
                story.append(
                    Paragraph(
                        escape_pdf_text(value),
                        bullet_style,
                        bulletText="•",
                    )
                )

            elif item_type == "number":
                story.append(
                    Paragraph(
                        escape_pdf_text(value),
                        body_style,
                    )
                )

            elif item_type == "table_title":
                story.append(
                    Paragraph(
                        escape_pdf_text(value),
                        heading_style,
                    )
                )

        flush_table()

    def add_page_number(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(
            A4[0] / 2,
            9 * mm,
            f"Page {document.page}",
        )
        canvas.restoreState()

    doc.build(
        story,
        onFirstPage=add_page_number,
        onLaterPages=add_page_number,
    )

    return output.getvalue()


def escape_pdf_text(text: str) -> str:
    replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


@app.post("/generate-document")
def generate_document(request: DocumentRequest):
    if request.format not in {"pdf", "docx"}:
        raise HTTPException(
            status_code=400,
            detail="Format must be either pdf or docx.",
        )

    content = generate_content(request)
    generated_title, sections = parse_document(content)

    final_title = request.title.strip() or generated_title

    try:
        if request.format == "pdf":
            file_bytes = make_pdf(final_title, sections)
            extension = "pdf"
            mime_type = "application/pdf"
        else:
            file_bytes = make_docx(final_title, sections)
            extension = "docx"
            mime_type = (
                "application/vnd.openxmlformats-officedocument."
                "wordprocessingml.document"
            )

        encoded = base64.b64encode(file_bytes).decode("utf-8")

        return {
            "success": True,
            "document_type": request.document_type,
            "format": request.format,
            "title": final_title,
            "filename": safe_filename(final_title, extension),
            "mime_type": mime_type,
            "content": content,
            "file_base64": encoded,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document file creation failed: {exc}",
        )


@app.post("/enhance-document-prompt")
def enhance_document_prompt(request: EnhanceRequest):
    system = """
You are the prompt designer for GenAI-Labs V15.

Improve a user's short document-generation idea into a clear,
specific instruction for creating a professional document.

Preserve the user's actual intent.
Add useful details such as:
- document purpose
- audience
- logical sections
- expected depth
- tone
- useful tables or lists when appropriate

Do not invent unrelated requirements.

Return ONLY the improved prompt.
"""

    try:
        response = client.responses.create(
            model=TEXT_MODEL,
            instructions=system,
            input=request.prompt.strip(),
        )

        enhanced = (response.output_text or "").strip()

        if not enhanced:
            raise HTTPException(
                status_code=500,
                detail="The AI returned an empty enhanced prompt.",
            )

        return {
            "success": True,
            "original": request.prompt.strip(),
            "enhanced": enhanced,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prompt enhancement failed: {exc}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8015,
    )
