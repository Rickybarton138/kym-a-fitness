# Elev8u platform pricing — 2-page A4 sheet mirroring the ReDefine pricing deck,
# in Elev8u's real palette (their navy as the dark base + their green + the E mark).
# Tailored to a Hyrox gym: "members" not "clients", Hyrox testing + squad mode.
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
import os, fitz

OUT = r"C:\Users\info\Downloads\Elev8u-Platform-Pricing.pdf"

# Elev8u palette
BG      = HexColor("#0e141c")   # dark navy base
SURF    = HexColor("#161f2e")   # their navy
SURF2   = HexColor("#1e2937")
LINE    = HexColor("#2a3341")
WHITE   = HexColor("#f4f7f9")
MUT     = HexColor("#93a0b0")
GREEN   = HexColor("#45b263")
GREEN_H = HexColor("#5cc97a")
GREEN_T = Color(69/255, 178/255, 99/255, 0.10)

W, H = A4
M = 42
c = canvas.Canvas(OUT, pagesize=A4)

def font(sz, bold=True):
    return ("Helvetica-Bold" if bold else "Helvetica", sz)

def text(x, y, s, bold=True, size=10, color=WHITE, align="l", track=0):
    fn, fs = font(bold, size) if isinstance(bold, bool) else (bold, size)
    fam = "Helvetica-Bold" if (bold is True) else ("Helvetica" if bold is False else bold)
    c.setFillColor(color); c.setFont(fam, size)
    if track:
        cx = x
        if align in ("c", "r"):
            tw = sum(c.stringWidth(ch, fam, size) + track for ch in s) - track
            cx = x - tw/2 if align == "c" else x - tw
        for ch in s:
            c.drawString(cx, y, ch); cx += c.stringWidth(ch, fam, size) + track
        return
    if align == "c": c.drawCentredString(x, y, s)
    elif align == "r": c.drawRightString(x, y, s)
    else: c.drawString(x, y, s)

def wrap(x, y, s, size, color, lead, maxw, bold=False, maxlines=99):
    fam = "Helvetica-Bold" if bold else "Helvetica"
    c.setFillColor(color); c.setFont(fam, size)
    words = s.split(); line = ""; lines = []
    for w in words:
        t = (line + " " + w).strip()
        if c.stringWidth(t, fam, size) <= maxw: line = t
        else: lines.append(line); line = w
    lines.append(line)
    for i, ln in enumerate(lines[:maxlines]):
        c.drawString(x, y - i*lead, ln)
    return y - (len(lines[:maxlines]) - 1) * lead

def disc_e(cx, cy, r):
    c.setFillColor(GREEN); c.circle(cx, cy, r, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", int(r*1.35))
    c.drawCentredString(cx, cy - r*0.47, "E")

def price(x, y, amount):
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20); c.drawString(x, y + 20, "£")
    c.setFont("Helvetica-Bold", 46); c.drawString(x + 15, y, amount)
    w = c.stringWidth(amount, "Helvetica-Bold", 46)
    c.setFillColor(MUT); c.setFont("Helvetica", 13); c.drawString(x + 15 + w + 4, y + 4, "/mo")

# ============================== PAGE 1 ==============================
c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(GREEN); c.rect(0, H - 7, W, 7, fill=1, stroke=0)

y = H - 52
disc_e(M + 16, y + 6, 16)
text(M + 42, y, "Elev8u", size=15, color=WHITE)
tw = c.stringWidth("Elev8u", "Helvetica-Bold", 15)
text(M + 42 + tw + 6, y, "· platform pricing", bold=False, size=12, color=MUT)

y -= 34
text(M, y, "YOUR APP.  YOUR BRAND.  PRICED TO GROW.", size=9.5, color=GREEN, track=1.6)

y -= 34
text(M, y, "One platform that ", size=27, color=WHITE)
w1 = c.stringWidth("One platform that ", "Helvetica-Bold", 27)
text(M + w1, y, "grows with", size=27, color=GREEN)
y -= 32
text(M, y, "your gym", size=27, color=GREEN)
w2 = c.stringWidth("your gym", "Helvetica-Bold", 27)
text(M + w2, y, ", not against it.", size=27, color=WHITE)

y -= 30
yend = wrap(M, y, "The app your members train with and a web presence for your gym — the AI coach, meal scanner, Hyrox testing and programmes, all under the Elev8u name. You pay for the members actually using it, and the per-member rate drops as you grow.", 12, MUT, 17, W - 2*M)
y = yend - 26

# How it works panel
ph = 70
c.setFillColor(SURF); c.setStrokeColor(LINE); c.setLineWidth(1)
c.roundRect(M, y - ph, W - 2*M, ph, 12, fill=1, stroke=1)
text(M + 18, y - 24, "How it works", size=12, color=WHITE)
wrap(M + 18, y - 44, "You're billed on active members — people using the app this month. Inactive or paused members don't count. Move up or down a band any time.", 10.5, MUT, 15, W - 2*M - 36)
y -= ph + 26

# PLANS
text(M, y, "PLANS", size=9.5, color=MUT, track=1.6)
c.setStrokeColor(LINE); c.line(M + 52, y + 3, W - M, y + 3)
y -= 14

plans = [
    ("STARTER", "Up to 25 active members", "125", "Plenty of room to grow your roster", True),
    ("GROWTH", "Up to 75 active members", "249", "Works out at £3.32 per active member", False),
    ("SCALE", "Up to 200 active members", "549", "Works out at £2.75 per active member", False),
]
gap = 12
cw = (W - 2*M - 2*gap) / 3
ch_ = 150
cy = y
for i, (nm, cap, amt, note, hl) in enumerate(plans):
    x = M + i * (cw + gap)
    c.setFillColor(SURF if not hl else SURF2)
    c.setStrokeColor(GREEN if hl else LINE); c.setLineWidth(1.6 if hl else 1)
    c.roundRect(x, cy - ch_, cw, ch_, 12, fill=1, stroke=1)
    ty = cy - 26
    if hl:
        c.setFillColor(GREEN); c.roundRect(x + 14, cy - 20, 118, 16, 8, fill=1, stroke=0)
        text(x + 20, cy - 16, "WHERE YOU START", size=7.5, color=HexColor("#06120b"), track=0.8)
        ty = cy - 40
    text(x + 16, ty, nm, size=12.5, color=WHITE)
    text(x + 16, ty - 16, cap, bold=False, size=9.5, color=MUT)
    price(x + 14, ty - 62, amt)
    wrap(x + 16, ty - 82, note, 9, MUT, 12, cw - 30)
y = cy - ch_ - 20

wrap(M, y, "More than 200 members? The Beyond band runs at roughly £2.50 per active member — we'll size it to your gym. Every plan is billed monthly, cancel any time, no setup fee.", 9.5, MUT, 14, W - 2*M)
y -= 44

# Web-presence callout (the up-sell — Elev8u have no website today)
bh = 104
c.setFillColor(GREEN_T); c.setStrokeColor(GREEN); c.setLineWidth(1.3)
c.roundRect(M, y - bh, W - 2*M, bh, 12, fill=1, stroke=1)
text(M + 20, y - 28, "No website yet? Sorted.", size=15, color=WHITE)
wrap(M + 20, y - 50, "Every plan includes a branded Elev8u web page — a proper front door for the gym with your hero, classes, the Hyrox stations and a link straight into your app. Live and ready to share, nothing to build.", 10.5, MUT, 15, W - 2*M - 40)
text(M + 20, y - 92, "See it live:", bold=False, size=10, color=MUT)
text(M + 20 + c.stringWidth("See it live:", "Helvetica", 10) + 6, y - 92, "elev8-landing.netlify.app", size=10, color=GREEN)

# ============================== PAGE 2 ==============================
c.showPage()
c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
c.setFillColor(GREEN); c.rect(0, H - 7, W, 7, fill=1, stroke=0)

features = [
    ("White-label app in your brand", "Your name, colours and coaching voice throughout — members see Elev8u, never us."),
    ("Ask Elev8u — your AI coach, 24/7", "Answers in your method and tone, trained on your knowledge, any time of day."),
    ("Meal & fridge scanner", "Photo to calories and macros in seconds, checked against each member's targets."),
    ("Hyrox testing battery", "Full simulation plus all eight stations — members watch every metre and second improve."),
    ("Programmes & session templates", "Build once — supersets, drop sets, pyramids — members start it themselves."),
    ("Squad / class mode", "Run a Hyrox class through the stations and log the whole squad in one go."),
    ("Form check on video", "Members upload a lift or a sled; AI gives instant pointers, you give the final word."),
    ("Progress & adherence tracking", "Weight, body-fat, PBs and weekly check-ins, plus an at-a-glance adherence view for you."),
]
yh = H - 52
text(M, yh, "EVERY PLAN INCLUDES", size=9.5, color=MUT, track=1.6)
c.setStrokeColor(LINE); c.line(M + 148, yh + 3, W - M, yh + 3)
y = H - 92
colw = (W - 2*M - 24) / 2
rowh = 62
for i, (h, b) in enumerate(features):
    col = i % 2; row = i // 2
    x = M + col * (colw + 24)
    yy = y - row * rowh
    c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 12); c.drawString(x, yy, "✓")
    text(x + 18, yy, h, size=11.5, color=WHITE)
    wrap(x + 18, yy - 15, b, 9.2, MUT, 12, colw - 20)
    if row < 3:
        c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(x, yy - 40, x + colw - 10, yy - 40)
y = y - 4 * rowh - 6

# VERSUS panel
ph = 166
c.setFillColor(SURF); c.setStrokeColor(GREEN); c.setLineWidth(1.2)
c.roundRect(M, y - ph, W - 2*M, ph, 12, fill=1, stroke=1)
text(M + 18, y - 26, "LIVE NOW — NOTHING TO BUILD", size=10, color=GREEN, track=1.4)
c.setStrokeColor(LINE); c.line(M + 232, y - 23, W - M - 18, y - 23)

inw = (W - 2*M - 54) / 2
iy = y - 40
ih = 92
# left: building it yourself
lx = M + 18
c.setFillColor(SURF2); c.setStrokeColor(LINE); c.setLineWidth(1)
c.roundRect(lx, iy - ih, inw, ih, 10, fill=1, stroke=1)
text(lx + 14, iy - 20, "BUILD IT YOURSELF", size=8.5, color=MUT, track=0.8)
c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 26); c.drawString(lx + 14, iy - 48, "£10,000+")
c.setFillColor(MUT); c.setFont("Helvetica", 11); c.drawString(lx + 14 + c.stringWidth("£10,000+", "Helvetica-Bold", 26) + 4, iy - 44, "upfront")
wrap(lx + 14, iy - 64, "A custom app and website, then months of dev — plus ongoing maintenance to keep it running.", 8.6, MUT, 11, inw - 26)
# right: elev8u
rx = M + 18 + inw + 18
c.setFillColor(SURF); c.setStrokeColor(GREEN); c.setLineWidth(1.4)
c.roundRect(rx, iy - ih, inw, ih, 10, fill=1, stroke=1)
text(rx + 14, iy - 20, "ELEV8U — STARTER", size=8.5, color=GREEN, track=0.8)
c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 26); c.drawString(rx + 14, iy - 48, "£125")
c.setFillColor(MUT); c.setFont("Helvetica", 12); c.drawString(rx + 14 + c.stringWidth("£125", "Helvetica-Bold", 26) + 4, iy - 44, "/mo")
wrap(rx + 14, iy - 64, "Your branded app AND web presence, live today. No setup fee, no build cost, nothing to maintain.", 8.6, MUT, 11, inw - 26)

yb = iy - ih - 22
text(M + 18, yb, "An app and a website for your gym — for less than the price of one PT session a month.", bold=False, size=10, color=WHITE)
y -= ph + 30

# Footer
c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, y, W - M, y)
y -= 16
text(M, y, "Ricky Barton", size=10, color=WHITE)
text(M + c.stringWidth("Ricky Barton", "Helvetica-Bold", 10) + 6, y, "·  rickybarton138@btinternet.com", bold=False, size=9.5, color=MUT)
text(W - M, y, "Live demo: elev8-hyrox.netlify.app", bold=False, size=9.5, color=GREEN, align="r")
y -= 26
wrap(M, y, "All AI features are included on every plan with generous fair use — enough for every member to scan meals, test their Hyrox stations and ask questions daily. Prices exclude VAT. Figures are per calendar month.", 8.5, MUT, 12, W - 2*M)

c.save()
print("SAVED", OUT, os.path.exists(OUT))

# copy to OneDrive Desktop like the ReDefine deck
import shutil
dest = os.path.expanduser(r"~/OneDrive/Desktop/Elev8u-Platform-Pricing.pdf")
try:
    shutil.copyfile(OUT, dest); print("COPIED", dest)
except Exception as e:
    print("copy skipped:", e)

# render previews
doc = fitz.open(OUT)
scratch = r"C:\Users\info\AppData\Local\Temp\claude\C--Users-info\c6b40c54-1338-4d9a-8eab-d3876341b0a9\scratchpad"
for i, pg in enumerate(doc):
    pg.get_pixmap(dpi=120).save(os.path.join(scratch, f"elev8u_pricing_{i+1}.png"))
print("PREVIEWS done")
