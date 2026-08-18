# Elev8u — one-page app + web-presence pitch. Their real brand: green #45b263,
# navy #161f2e, white. Uses the green-disc "E" mark generated for the app.
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
import os

OUT = r"C:\Users\info\Downloads\Elev8u-App-Pitch.pdf"
ICON = r"C:\Users\info\kym-a-fitness\public\brands\elev8\icon-512.png"

GREEN = HexColor("#45b263")
GREEN_D = HexColor("#379a52")
GREEN_T = Color(69/255, 178/255, 99/255, 0.08)   # faint green tint
NAVY = HexColor("#161f2e")
SLATE = HexColor("#5b6675")
LINE = HexColor("#dde4ea")
WHITE = HexColor("#ffffff")
BG = HexColor("#f4f7f9")

W, H = A4
M = 42

c = canvas.Canvas(OUT, pagesize=A4)

# page background
c.setFillColor(WHITE); c.rect(0, 0, W, H, fill=1, stroke=0)
# top brand rule
c.setFillColor(GREEN); c.rect(0, H - 8, W, 8, fill=1, stroke=0)

y = H - 8

def text(x, yy, s, font="Helvetica", size=10, color=NAVY, align="l", tracking=0):
    c.setFillColor(color); c.setFont(font, size)
    if tracking:
        c.setFont(font, size)
        # manual tracking
        cx = x
        if align in ("c", "r"):
            tw = sum(c.stringWidth(ch, font, size) + tracking for ch in s) - tracking
            cx = x - tw/2 if align == "c" else x - tw
        for ch in s:
            c.drawString(cx, yy, ch); cx += c.stringWidth(ch, font, size) + tracking
        return
    if align == "c": c.drawCentredString(x, yy, s)
    elif align == "r": c.drawRightString(x, yy, s)
    else: c.drawString(x, yy, s)

# ---- header: mark + wordmark, eyebrow right ----
hy = y - 64
c.drawImage(ImageReader(ICON), M, hy, 52, 52, mask='auto')
text(M + 66, hy + 30, "ELEV8U", "Helvetica-Bold", 26, NAVY, tracking=1.5)
text(M + 67, hy + 12, "FITNESS  TRAINING", "Helvetica-Bold", 8.5, GREEN, tracking=1.2)
text(W - M, hy + 34, "YOUR APP · YOUR BRAND", "Helvetica-Bold", 8.5, SLATE, align="r", tracking=1.5)
text(W - M, hy + 18, "Bournemouth Hyrox & functional fitness", "Helvetica", 9, SLATE, align="r")

# ---- title ----
ty = hy - 40
text(M, ty, "Your own coaching app.", "Helvetica-Bold", 27, NAVY)
text(M, ty - 30, "Built for Hyrox.", "Helvetica-Bold", 27, GREEN)
text(M, ty - 58, "A fully-branded Elev8u app and web presence — training, testing, nutrition", "Helvetica", 11, SLATE)
text(M, ty - 74, "and a 24/7 AI coach, all under your name.", "Helvetica", 11, SLATE)

# ---- feature cards (2 cols x 3 rows) ----
feats = [
    ("Guided programmes", "Every session laid out — tick each set, log the load, never lose your place."),
    ("Hyrox station testing", "Ski, sled, row, carries, wall balls and full-sim times — tracked and trending."),
    ("AI coach in their pocket", "Ask anything, scan a meal, get macros — any time, in the Elev8u voice."),
    ("Nutrition made simple", "Snap a meal or scan a barcode: calories, macros and fibre logged instantly."),
    ("Leaderboards & community", "Squad rankings and a shared feed that keep members coming back for more."),
    ("Readiness & progress", "Check-ins, body stats and PBs — coach on real data, not guesswork."),
]
top = ty - 100
cw = (W - 2*M - 14) / 2
ch_ = 62
gap_x, gap_y = 14, 12
for i, (h, b) in enumerate(feats):
    col = i % 2; row = i // 2
    x = M + col * (cw + gap_x)
    yy = top - row * (ch_ + gap_y)
    c.setFillColor(BG); c.setStrokeColor(LINE); c.setLineWidth(1)
    c.roundRect(x, yy - ch_, cw, ch_, 9, fill=1, stroke=1)
    # green tick dot
    c.setFillColor(GREEN); c.circle(x + 16, yy - 18, 4.5, fill=1, stroke=0)
    text(x + 30, yy - 21, h, "Helvetica-Bold", 11.5, NAVY)
    # wrap body to ~two lines
    words = b.split(); lines = []; cur = ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if c.stringWidth(t, "Helvetica", 8.8) < cw - 40: cur = t
        else: lines.append(cur); cur = wd
    lines.append(cur)
    for j, ln in enumerate(lines[:2]):
        text(x + 30, yy - 36 - j*11, ln, "Helvetica", 8.8, SLATE)

# ---- why it works band ----
band_y = top - 3*(ch_ + gap_y) - 6
c.setFillColor(NAVY); c.roundRect(M, band_y - 100, W - 2*M, 100, 10, fill=1, stroke=0)
text(M + 18, band_y - 24, "WHY IT WORKS FOR ELEV8U", "Helvetica-Bold", 9.5, GREEN, tracking=1.5)
whys = [
    "Keeps members engaged between sessions — better retention.",
    "A premium edge no other Bournemouth Hyrox box offers.",
    "New recurring revenue: online coaching, app tiers, PT upsells.",
    "Your brand on their home screen, every single day.",
]
wy = band_y - 46
for i, wtxt in enumerate(whys):
    yy = wy - i * 15
    c.setFillColor(GREEN); c.circle(M + 21, yy + 3, 2.4, fill=1, stroke=0)
    text(M + 30, yy, wtxt, "Helvetica", 9.8, WHITE)

# ---- web presence callout ----
wp_y = band_y - 114
c.setFillColor(GREEN_T); c.setStrokeColor(GREEN); c.setLineWidth(1.2)
c.roundRect(M, wp_y - 60, W - 2*M, 60, 10, fill=1, stroke=1)
text(M + 18, wp_y - 22, "No website yet? You do now.", "Helvetica-Bold", 13, NAVY)
text(M + 18, wp_y - 40, "A branded Elev8u landing page — hero, classes, the eight stations and a direct", "Helvetica", 9.5, SLATE)
text(M + 18, wp_y - 52, "link to your app. Your web presence, live and ready to share.", "Helvetica", 9.5, SLATE)

# ---- try it live ----
tl_y = wp_y - 80
text(M, tl_y, "TRY IT LIVE", "Helvetica-Bold", 9.5, GREEN, tracking=1.5)
text(M, tl_y - 20, "App", "Helvetica-Bold", 10.5, NAVY)
text(M + 40, tl_y - 20, "elev8-hyrox.netlify.app", "Helvetica-Bold", 10.5, GREEN_D)
text(M + 300, tl_y - 20, "Web", "Helvetica-Bold", 10.5, NAVY)
text(M + 340, tl_y - 20, "elev8-landing.netlify.app", "Helvetica-Bold", 10.5, GREEN_D)

# ---- closing CTA band (green) ----
cta_y = tl_y - 42
c.setFillColor(GREEN); c.roundRect(M, cta_y - 58, W - 2*M, 58, 10, fill=1, stroke=0)
text(M + 18, cta_y - 24, "Ready to make it yours?", "Helvetica-Bold", 15, NAVY)
text(M + 18, cta_y - 44, "Log in with the details we've sent, explore every screen, and we'll tailor it to Elev8u.", "Helvetica", 10, NAVY)
text(W - M - 18, cta_y - 34, "Let's talk  →", "Helvetica-Bold", 13, WHITE, align="r")

# ---- footer ----
c.setStrokeColor(LINE); c.setLineWidth(1); c.line(M, 52, W - M, 52)
text(M, 38, "Built by Ricky Barton  ·  rickybarton138@btinternet.com", "Helvetica", 9, SLATE)
text(W - M, 38, "Train. Race. Elevate.", "Helvetica-Bold", 9.5, GREEN, align="r", tracking=1)

c.save()
print("SAVED", OUT, "exists:", os.path.exists(OUT))

# render preview
import fitz
doc = fitz.open(OUT)
pix = doc[0].get_pixmap(dpi=130)
prev = r"C:\Users\info\AppData\Local\Temp\claude\C--Users-info\c6b40c54-1338-4d9a-8eab-d3876341b0a9\scratchpad\elev8u_pitch_preview.png"
pix.save(prev)
print("PREVIEW", prev)
