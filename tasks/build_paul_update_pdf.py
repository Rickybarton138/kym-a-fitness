# ReDefine Academy "what's new this week" one-pager for Paul. Palette + logo match
# the live app (near-black, emerald + gold).
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
import os

OUT = r"C:\Users\info\Downloads\ReDefine-Academy-Whats-New.pdf"
LOGO = r"C:\Users\info\kym-a-fitness\public\brands\paul\logo.png"

BG      = HexColor("#0d0f0e")
SURF    = HexColor("#171a18")
LINE    = HexColor("#2d322f")
TEXT    = HexColor("#f4f6f5")
MUTED   = HexColor("#9aa4a0")
EM      = HexColor("#18c07d")
EMHI    = HexColor("#3ad598")
GOLD    = HexColor("#f5c518")

W, H = A4
M = 48
c = canvas.Canvas(OUT, pagesize=A4)
c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
# emerald top rule
c.setFillColor(EM); c.rect(0, H-5, W, 5, fill=1, stroke=0)

def text(x, y, s, font="Helvetica", size=10.5, color=TEXT, align="l"):
    c.setFillColor(color); c.setFont(font, size)
    if align == "c": c.drawCentredString(x, y, s)
    elif align == "r": c.drawRightString(x, y, s)
    else: c.drawString(x, y, s)

def para(x, y, s, w, font="Helvetica", size=10, color=MUTED, leading=13.5):
    for ln in simpleSplit(s, font, size, w):
        text(x, y, ln, font=font, size=size, color=color); y -= leading
    return y

def tick(x, y, s=9, color=EM):
    c.setStrokeColor(color); c.setLineWidth(1.8); c.setLineCap(1)
    c.line(x, y+s*0.35, x+s*0.38, y); c.line(x+s*0.38, y, x+s, y+s)

# ---- header: logo + title ----
try: c.drawImage(LOGO, M, H-118, 74, 74, mask='auto', preserveAspectRatio=True, anchor='sw')
except Exception: pass
text(M+92, H-58, "REDEFINE ACADEMY", font="Helvetica-Bold", size=11, color=TEXT)
text(M+92, H-74, "What's new this week", font="Helvetica", size=10, color=EMHI)
text(M+92, H-104, "Your app, levelled up.", font="Helvetica-Bold", size=22, color=TEXT)

SECTIONS = [
    ("It's fully yours now", [
        "Your real ReDefine logo is in — across the app, the home-screen icon and the browser tab.",
        "Shared links now preview as ReDefine Academy with your logo, not the old placeholder.",
        "Your Instagram and TikTok (@paulandrewspt) are wired in for clients to follow.",
    ]),
    ("Recipes", [
        "Create three ways: paste a link (pulls the ingredients, image and macros), build your own (ingredients + servings works out a portion — great for batch cooking), or paste the text / snap a photo.",
        "Every recipe has a one-tap shopping list that copies the ingredients.",
        "Generate your own recipe library with AI by category — your content, not a rented one.",
    ]),
    ("Programmes", [
        "Draft a full programme with AI — goal, days, equipment, level — then tweak and publish.",
        "Control who sees the programme library by tag, so you can keep it to standard members.",
    ]),
    ("Food logging  (from your client's feedback)", [
        "A proper daily food diary — meals grouped into breakfast, lunch, dinner and snacks, with a delete on every entry so mis-logs are easy to fix.",
        "You can open and amend any client's diary yourself.",
        "Weekly averages of calories, macros and fibre against target, with a chart of the week — for you and them.",
    ]),
    ("Also this week", [
        "Tap an exercise name for a how-to demo and coaching cues.",
        "Schedule check-ins, measurements, weight and progress photos on any day — each weekly, fortnightly or monthly.",
    ]),
]

y = H-140
for title, bullets in SECTIONS:
    y -= 12
    text(M, y, title, font="Helvetica-Bold", size=12.5, color=EM)
    y -= 7
    c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, y, W-M, y)
    y -= 16
    for b in bullets:
        tick(M, y-1)
        y = para(M+18, y, b, W-2*M-18, size=10, color=MUTED, leading=13.5) - 6
    y -= 2

# ---- footer ----
c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, 58, W-M, 58)
text(M, 42, "The time to redefine is now.", font="Helvetica-Bold", size=9.5, color=EMHI)
text(W-M, 42, "app.redefineacademy.com", font="Helvetica-Bold", size=9.5, color=GOLD, align="r")

c.save()
print("SAVED", OUT, os.path.getsize(OUT), "bytes")
