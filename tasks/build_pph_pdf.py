# Builds the PPH showcase PDF for Jordan & Sam. Palette matches the live app
# (near-black + amber accent), so the document reads like the product.
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
import os

OUT = r"C:\Users\info\Downloads\The-Physical-Performance-Hub.pdf"

BG      = HexColor("#0a0a0a")
SURFACE = HexColor("#161616")
SURF2   = HexColor("#222222")
LINE    = HexColor("#333333")
TEXT    = HexColor("#ffffff")
MUTED   = HexColor("#a0a0a0")
ACCENT  = HexColor("#eca41d")
ACC_HI  = HexColor("#ffbb3d")
ONACC   = HexColor("#0a0a0a")
GREEN   = HexColor("#3ad598")

W, H = A4
M = 50            # page margin
c = canvas.Canvas(OUT, pagesize=A4)

def page_bg():
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)

def panel(x, y, w, h, fill=SURFACE, stroke=LINE, r=10, lw=1):
    if fill is not None:
        c.setFillColor(fill)
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)
    if stroke is not None:
        c.setStrokeColor(stroke); c.setLineWidth(lw)
        c.roundRect(x, y, w, h, r, fill=0, stroke=1)

def _tracked_width(s, font, size, tracking):
    return sum(c.stringWidth(ch, font, size) + tracking for ch in s) - (tracking if s else 0)

def text(x, y, s, font="Helvetica", size=10.5, color=TEXT, tracking=0, align="l"):
    c.setFillColor(color); c.setFont(font, size)
    if tracking:
        if align == "c": x -= _tracked_width(s, font, size, tracking) / 2
        elif align == "r": x -= _tracked_width(s, font, size, tracking)
        cx = x
        for ch in s:
            c.drawString(cx, y, ch)
            cx += c.stringWidth(ch, font, size) + tracking
        return
    if align == "c": c.drawCentredString(x, y, s)
    elif align == "r": c.drawRightString(x, y, s)
    else: c.drawString(x, y, s)

def eyebrow(x, y, s, color=ACCENT):
    text(x, y, s.upper(), font="Helvetica-Bold", size=8.5, color=color, tracking=2.2)

def para(x, y, s, w, font="Helvetica", size=10.5, color=MUTED, leading=15):
    lines = simpleSplit(s, font, size, w)
    for ln in lines:
        text(x, y, ln, font=font, size=size, color=color)
        y -= leading
    return y

def tick(x, y, size=9, color=ACCENT):
    c.setStrokeColor(color); c.setLineWidth(1.8); c.setLineCap(1)
    c.line(x, y+size*0.35, x+size*0.38, y)
    c.line(x+size*0.38, y, x+size, y+size)

def dash(x, y, size=9, color=MUTED):
    c.setStrokeColor(color); c.setLineWidth(1.6); c.setLineCap(1)
    c.line(x, y+size*0.5, x+size, y+size*0.5)

def mark(x, y, s=26):
    # amber rounded square with "PPH"
    c.setFillColor(ACCENT); c.roundRect(x, y, s, s, 6, fill=1, stroke=0)
    text(x+s/2, y+s/2-4.5, "PPH", font="Helvetica-Bold", size=9.5, color=ONACC, align="c")

def footer(pnum, label):
    c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, 42, W-M, 42)
    text(M, 30, "The Physical Performance Hub", font="Helvetica", size=8, color=MUTED)
    text(W-M, 30, f"{label}   ·   {pnum}", font="Helvetica", size=8, color=MUTED, align="r")

# ---------------------------------------------------------------- PAGE 1: COVER
page_bg()
# subtle amber top accent bar
c.setFillColor(ACCENT); c.rect(0, H-6, W, 6, fill=1, stroke=0)
mark(M, H-118, 30)
text(M+42, H-108, "THE PHYSICAL PERFORMANCE HUB", font="Helvetica-Bold", size=10.5, color=TEXT, tracking=1.5)
text(M+42, H-122, "Complete support for every athlete", font="Helvetica", size=9, color=MUTED)

# hero headline
c.setFillColor(TEXT)
text(M, H-300, "Your performance", font="Helvetica-Bold", size=42, color=TEXT)
text(M, H-346, "platform.", font="Helvetica-Bold", size=42, color=TEXT)
text(M, H-392, "Your brand.", font="Helvetica-Bold", size=42, color=ACCENT)

y = H-440
y = para(M, y, "A complete athlete-management system — programming, testing, monitoring, "
               "rehab and nutrition — built for The Physical Performance Hub. Your name on "
               "every screen, an AI coach behind every plan.", W-2*M-120, size=12, color=MUTED, leading=18)

# four quick badges
badges = ["Live weight-room squad mode", "AI coach + full nutrition engine",
          "Injury & return-to-play", "Readiness + workload monitoring"]
by = 250
for i, b in enumerate(badges):
    row = i // 2; col = i % 2
    bx = M + col*260; byy = by - row*40
    tick(bx, byy, 10, ACCENT)
    text(bx+18, byy, b, font="Helvetica-Bold", size=10.5, color=TEXT)

panel(M, 70, W-2*M, 46, fill=SURFACE, stroke=LINE, r=10)
text(M+18, 92, "Prepared for Sam & Jordan", font="Helvetica-Bold", size=10, color=TEXT)
text(M+18, 79, "Founding-partner build  ·  July 2026", font="Helvetica", size=8.5, color=MUTED)
text(W-M-18, 88, "thepph.co.uk", font="Helvetica-Bold", size=10, color=ACCENT, align="r")
c.showPage()

# ---------------------------------------------------------- PAGE 2: POSITIONING
page_bg()
eyebrow(M, H-70, "Why this beats what you have")
text(M, H-100, "Everything Lumin does.", font="Helvetica-Bold", size=25, color=TEXT)
text(M, H-130, "Plus the things it doesn't.", font="Helvetica-Bold", size=25, color=ACCENT)
y = para(M, H-165, "You already know the AMS basics — programming, testing, load monitoring. "
         "This platform matches them, then adds the layers a performance department actually "
         "asks for: a real nutrition engine, an AI coach that writes and explains the plans, a "
         "rehab and return-to-play module, and a live weight-room mode for the gym floor. "
         "All under your brand, not a vendor's.", W-2*M, size=11, color=MUTED, leading=16)

wins = [
    ("Live weight-room squad mode", "Run the whole squad through one session on a tablet. Each "
     "athlete's weights pre-fill from their last lift, so you nudge deltas instead of typing. "
     "Session load and progress update automatically."),
    ("AI coach + nutrition engine", "An AI coach that writes and explains programmes and answers "
     "athlete questions — plus meal, fridge and body scans from a photo. Lumin has neither."),
    ("Injury & return-to-play", "Injury log, staged RTP ladder, clearance sign-off and availability "
     "status. Soreness reports automatically pull an athlete's readiness light down."),
    ("Readiness + workload", "Daily wellness and session-RPE feed an acute:chronic workload ratio "
     "with red-flag lights — the injury-risk signal, computed from the sessions you already run."),
]
cardw = (W-2*M-16)/2; cardh = 150; gx = 16; gy = 18
top = H-330
for i, (t, d) in enumerate(wins):
    row = i//2; col = i%2
    x = M + col*(cardw+gx); yy = top - row*(cardh+gy)
    panel(x, yy-cardh, cardw, cardh, fill=SURFACE, stroke=LINE, r=12)
    c.setFillColor(ACCENT); c.roundRect(x+18, yy-40, 30, 4, 2, fill=1, stroke=0)
    text(x+18, yy-70, t, font="Helvetica-Bold", size=13.5, color=TEXT)
    para(x+18, yy-92, d, cardw-36, size=9.5, color=MUTED, leading=13.5)
footer("02", "Overview")
c.showPage()

# ------------------------------------------------------- PAGE 3: FEATURE TOUR 1
def feature_page(title_lines, groups, pnum):
    page_bg()
    eyebrow(M, H-70, "What's inside")
    text(M, H-100, title_lines[0], font="Helvetica-Bold", size=25, color=TEXT)
    y = H-135
    for gname, items in groups:
        text(M, y, gname, font="Helvetica-Bold", size=12.5, color=ACCENT)
        y -= 8
        c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, y, W-M, y)
        y -= 20
        for name, desc in items:
            tick(M, y-1, 10, ACCENT)
            text(M+20, y, name, font="Helvetica-Bold", size=10.8, color=TEXT)
            yy = para(M+20, y-14, desc, W-2*M-20, size=9.5, color=MUTED, leading=13)
            y = yy - 8
        y -= 12
    footer(pnum, "Feature tour")
    c.showPage()

feature_page(
    ["On the gym floor"],
    [("Programming & delivery", [
        ("Full workout builder", "Supersets, drop sets, pyramids, clusters, target RPE and RIR — the way you actually programme."),
        ("Guided session player", "Athletes tick sets and log real reps and load as they train; it all feeds their history."),
        ("Templates & video library", "Save sessions as templates and attach demo videos to any exercise."),
    ]),
    ("Live weight-room squad mode", [
        ("One tablet, whole squad", "Run every athlete through the session live — athlete-by-athlete tabs or a set-by-set station view for a rack rotation."),
        ("Weight-seeding from history", "Each athlete's sets pre-fill from their own last logged lift — edit deltas, not every number."),
        ("Automatic load & progress", "Finishing writes each athlete's actuals, session completion and workload in one tap — nothing re-entered."),
    ]),
    ("Prove progress", [
        ("Testing battery", "Record and trend performance tests, with squad leaderboards and peer comparison."),
        ("Strength trends", "Every logged lift builds an athlete's weights-lifted history automatically."),
    ])],
    "03")

# ------------------------------------------------------- PAGE 4: FEATURE TOUR 2
feature_page(
    ["Keep them healthy, fuelled & engaged"],
    [("Monitoring & readiness", [
        ("Daily readiness check-in", "Sleep, energy, mood, soreness — a fast wellness score with green/amber/red lights."),
        ("Acute:chronic workload", "Session-RPE load rolls into an ACWR with spike and detraining flags, per athlete and per squad."),
    ]),
    ("Injury & return-to-play", [
        ("Injury record & RTP ladder", "Log injuries, set availability, move athletes through staged return-to-play gates with clearance sign-off."),
        ("Soreness feeds readiness", "An athlete reporting real pain drops their readiness light automatically — the red flag surfaces before you ask."),
    ]),
    ("Fuel & AI coaching", [
        ("Full nutrition engine", "Macro targets and tracking, recipes, barcode scanning and supplements — a layer Lumin simply doesn't have."),
        ("AI coach & vision scans", "An AI coach writes and explains plans and answers questions; meal, fridge and body scans work from a single photo."),
    ]),
    ("Engagement & your brand", [
        ("Activity feed, reminders & community", "See what every athlete's doing, send per-athlete nudges and push notifications, and run a team community feed."),
        ("Youth growth, Strava & white-label", "Growth and maturation tracking for youth athletes, Strava sync, and your branding on every screen."),
    ])],
    "04")

# ----------------------------------------------------------- PAGE 5: COMPARISON
page_bg()
eyebrow(M, H-70, "Side by side")
text(M, H-100, "The Physical Performance Hub", font="Helvetica-Bold", size=22, color=TEXT)
text(M, H-124, "vs Lumin", font="Helvetica-Bold", size=22, color=MUTED)

rows = [
    ("Your brand on every screen", True, False),
    ("Coaches run it from a phone", True, False),
    ("Live weight-room squad mode", True, True),
    ("Weight-seeding from last session", True, False),
    ("Full nutrition engine", True, False),
    ("AI coach that writes & explains plans", True, False),
    ("AI meal / fridge / body scan", True, False),
    ("Injury & return-to-play module", True, True),
    ("Readiness + acute:chronic workload", True, True),
    ("Testing battery + leaderboards", True, True),
    ("Athlete self-entry burden", "low", "high"),
]
tabx = M; tabw = W-2*M
colA = M + tabw - 200; colB = M + tabw - 90
ry = H-165
# header row
panel(M, ry-30, tabw, 30, fill=SURF2, stroke=None, r=8)
text(M+16, ry-20, "Capability", font="Helvetica-Bold", size=10, color=MUTED)
text(colA, ry-20, "PPH", font="Helvetica-Bold", size=10, color=ACCENT, align="c")
text(colB, ry-20, "Lumin", font="Helvetica-Bold", size=10, color=MUTED, align="c")
ry -= 30
for i, (label, a, b) in enumerate(rows):
    rh = 30
    if i % 2 == 0:
        c.setFillColor(SURFACE); c.rect(M, ry-rh, tabw, rh, fill=1, stroke=0)
    text(M+16, ry-19, label, font="Helvetica", size=10, color=TEXT)
    def cell(val, cx):
        if val is True: tick(cx-5, ry-24, 11, ACCENT)
        elif val is False: dash(cx-5, ry-19, 11, MUTED)
        elif val == "low": text(cx, ry-19, "Low", font="Helvetica-Bold", size=9, color=GREEN, align="c")
        elif val == "high": text(cx, ry-19, "High", font="Helvetica-Bold", size=9, color=MUTED, align="c")
    cell(a, colA); cell(b, colB)
    ry -= rh
c.setStrokeColor(LINE); c.setLineWidth(1); c.roundRect(M, ry, tabw, (H-165)-ry, 8, fill=0, stroke=1)

para(M, ry-20, "Lumin covers the AMS fundamentals well. The gaps are the layer around them — a "
     "full nutrition engine, a real AI coach, and a phone-first experience for staff (their own "
     "most-requested feature). That's exactly where this platform is built to win.", tabw, size=9.5, color=MUTED, leading=14)
footer("05", "Comparison")
c.showPage()

# --------------------------------------------------------- PAGE 6: PRICING/NEXT
page_bg()
eyebrow(M, H-70, "Pricing")
text(M, H-100, "Priced per athlete.", font="Helvetica-Bold", size=24, color=TEXT)
text(M, H-127, "Scales as you grow.", font="Helvetica-Bold", size=24, color=ACCENT)
para(M, H-155, "Every tier includes the entire platform — programming, live squad mode, "
     "monitoring, rehab, testing, nutrition and the AI coach. You never pay more for "
     "features. Only for scale.", W-2*M, size=10.5, color=MUTED, leading=15)

tiers = [
    ("Starter", "up to 20 athletes", "£149", False),
    ("Squad", "up to 50 athletes", "£299", True),
    ("Academy", "up to 120 athletes", "£549", False),
]
gap = 14
cardw = (W-2*M - 2*gap)/3
cardh = 168
top = H-210
for i, (nm, cap, price, pop) in enumerate(tiers):
    x = M + i*(cardw+gap)
    stroke = ACCENT if pop else LINE
    lw = 1.6 if pop else 1
    panel(x, top-cardh, cardw, cardh, fill=SURFACE, stroke=stroke, r=12, lw=lw)
    if pop:
        text(x+cardw/2, top+8, "MOST POPULAR", font="Helvetica-Bold", size=7.5, color=ACCENT, tracking=1.6, align="c")
    text(x+16, top-30, nm, font="Helvetica-Bold", size=14, color=TEXT)
    text(x+16, top-46, cap, font="Helvetica", size=8.8, color=MUTED)
    pcol = ACCENT if pop else TEXT
    text(x+16, top-92, price, font="Helvetica-Bold", size=30, color=pcol)
    pw = c.stringWidth(price, "Helvetica-Bold", 30)
    text(x+16+pw+4, top-92, "/mo", font="Helvetica", size=10, color=MUTED)
    c.setStrokeColor(LINE); c.setLineWidth(1); c.line(x+16, top-108, x+cardw-16, top-108)
    tick(x+16, top-130, 9, ACCENT); text(x+30, top-129, "Full platform, your brand", font="Helvetica", size=8.6, color=TEXT)
    tick(x+16, top-150, 9, ACCENT); text(x+30, top-149, "Unlimited coaches & staff", font="Helvetica", size=8.6, color=TEXT)

# multi-team strip
my = top-cardh-16
panel(M, my-42, W-2*M, 42, fill=SURF2, stroke=None, r=10)
text(M+18, my-18, "Multi-team, academy or 120+ athletes?", font="Helvetica-Bold", size=10.5, color=TEXT)
text(M+18, my-31, "Custom pricing for multi-site setups.", font="Helvetica", size=8.6, color=MUTED)
text(W-M-18, my-25, "Let's talk", font="Helvetica-Bold", size=10.5, color=ACCENT, align="r")

ny = my-70
tick(M, ny-1, 9, ACCENT); text(M+16, ny, "Annual billing — two months free.", font="Helvetica-Bold", size=9.6, color=TEXT)
tick(M, ny-19, 9, ACCENT); text(M+16, ny-18, "Launch rates, locked in for our first partners before they rise.", font="Helvetica", size=9.6, color=MUTED)

eyebrow(M, ny-56, "How we start")
steps = [
    ("1", "You test it", "Log in as a coach on the live demo and run a squad session on the gym floor."),
    ("2", "We tune it", "Tell us what you'd change — we shape the platform around how you work."),
    ("3", "You go live", "Your athletes onboard under your brand; we keep building with you."),
]
sy = ny-82
for n, t, d in steps:
    c.setFillColor(ACCENT); c.circle(M+12, sy-9, 11, fill=1, stroke=0)
    text(M+12, sy-13, n, font="Helvetica-Bold", size=10.5, color=ONACC, align="c")
    text(M+34, sy-8, t, font="Helvetica-Bold", size=11.5, color=TEXT)
    para(M+34, sy-23, d, W-2*M-34, size=9.4, color=MUTED, leading=12.5)
    sy -= 52

panel(M, 66, W-2*M, 58, fill=SURF2, stroke=None, r=12)
text(M+20, 102, "Ready when you are", font="Helvetica-Bold", size=12, color=TEXT)
text(M+20, 85, "Ricky Barton  ·  rickybarton138@btinternet.com", font="Helvetica", size=10, color=MUTED)
text(W-M-20, 95, "thepph.co.uk", font="Helvetica-Bold", size=12, color=ACCENT, align="r")
c.showPage()

c.save()
print("SAVED", OUT, os.path.getsize(OUT), "bytes")
