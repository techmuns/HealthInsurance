#!/usr/bin/env python3
"""Client presentation deck — Healthcare Insurance Dashboard (landscape A4, premium)."""
import fitz
from PIL import Image
import os

SRC="scratch/final"
OUTDIR="progress-updates/healthcare-dashboard-client-update-2026-07-01"
OUT=OUTDIR+"/updated_client_progress_report.pdf"
DATE="2026-07-01"

NAVY=(18/255,33/255,64/255); NAVY2=(28/255,46/255,84/255)
GOLD=(182/255,138/255,58/255); GOLD_L=(214/255,178/255,110/255)
CREAM=(249/255,246/255,235/255); GREEN=(40/255,132/255,96/255)
AMBER=(193/255,138/255,38/255); INK=(0.16,0.20,0.29); INK2=(0.42,0.46,0.54)
WHITE=(1,1,1); LINE=(0.86,0.85,0.80)
STAGE=(0.936,0.947,0.965); STAGE_BD=(0.85,0.87,0.91)
W,H=842,595; M=50
SERIF="Times-Roman"; SERIFB="Times-Bold"; SERIFI="Times-Italic"
SANS="Helvetica"; SANSB="Helvetica-Bold"

doc=fitz.open()
_MAP={"“":'"',"”":'"',"‘":"'","’":"'","—":" - ","–":"-","→":"->","⇄":"/","↔":"/","≥":">=","≤":"<=","₹":"Rs ","×":"x"}
def asc(s):
    if not isinstance(s,str): return s
    for k,v in _MAP.items(): s=s.replace(k,v)
    return s
_oit=fitz.Page.insert_text; _oitb=fitz.Page.insert_textbox
fitz.Page.insert_text=lambda self,p,text,**k:_oit(self,p,asc(text),**k)
fitz.Page.insert_textbox=lambda self,r,text,**k:_oitb(self,r,asc(text),**k)
def spaced(s,n=1): return (" "*n).join(list(s))
def rrect(page,rect,fill=None,color=None,width=0.8,radius=0.06,fill_opacity=1,stroke_opacity=1):
    page.draw_rect(rect,color=color,fill=fill,width=width,radius=radius,fill_opacity=fill_opacity,stroke_opacity=stroke_opacity)
def img_size(path):
    with Image.open(path) as im: return im.size
def framed(page,path,box,pad=10,anchor="center"):
    iw,ih=img_size(path); bw,bh=box.width-2*pad,box.height-2*pad
    s=min(bw/iw,bh/ih); dw,dh=iw*s,ih*s
    cx=(box.x0+box.x1)/2; cy=(box.y0+dh/2+pad) if anchor=="top" else (box.y0+box.y1)/2
    img=fitz.Rect(cx-dw/2,cy-dh/2,cx+dw/2,cy+dh/2)
    card=fitz.Rect(img.x0-pad,img.y0-pad,img.x1+pad,img.y1+pad)
    page.draw_rect(card+(4,5,4,5),fill=(0.20,0.24,0.34),radius=0.05,fill_opacity=0.16,width=0)
    rrect(page,card,fill=WHITE,color=LINE,width=0.6,radius=0.05)
    page.insert_image(img,filename=path,keep_proportion=True)
    return card
def stage(page,rect):
    page.draw_rect(rect+(0,0,0,3),fill=(0.30,0.34,0.44),radius=0.045,fill_opacity=0.10,width=0)
    rrect(page,rect,fill=STAGE,color=STAGE_BD,width=0.7,radius=0.045)
    page.draw_line((rect.x0+14,rect.y0),(rect.x0+70,rect.y0),color=GOLD,width=1.6)
def kicker(page,x,y,text,color=GOLD,size=8.5):
    page.insert_text((x,y),spaced(text),fontsize=size,fontname=SANSB,color=color)
def pill(page,x,y,txt,col):
    tw=fitz.get_text_length(spaced(txt),SANSB,7.2); w=tw+30; r=fitz.Rect(x,y,x+w,y+19)
    rrect(page,r,fill=col,radius=0.5,width=0); page.draw_circle((x+12,y+9.5),2.4,fill=WHITE,width=0)
    page.insert_text((x+19,y+12.6),spaced(txt),fontsize=7.2,fontname=SANSB,color=WHITE); return r
def pill_right(page,xr,y,txt,col):
    tw=fitz.get_text_length(spaced(txt),SANSB,7.2); return pill(page,xr-(tw+30),y,txt,col)
def chip(page,x,y,txt,col):
    tw=fitz.get_text_length(spaced(txt),SANSB,7); r=fitz.Rect(x,y,x+tw+22,y+17)
    rrect(page,r,fill=None,color=col,width=1,radius=0.5); page.insert_text((x+11,y+11.6),spaced(txt),fontsize=7,fontname=SANSB,color=col); return r
def footer(page,pageno):
    y=H-30; page.draw_line((M,y),(W-M,y),color=LINE,width=0.7)
    page.insert_text((M,y+13),"Healthcare Insurance Dashboard   ·   Prepared for Paragon Partners (India), by Munshot",fontsize=8,fontname=SANS,color=INK2)
    page.insert_text((W-M-40,y+13),f"Page {pageno}",fontsize=8,fontname=SANS,color=INK2)

# ---------- COVER (clean, client-facing) ----------
def cover():
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=NAVY,width=0)
    p.draw_circle((W-60,70),240,fill=NAVY2,fill_opacity=0.55,width=0)
    p.draw_circle((W-10,120),150,fill=(0.10,0.16,0.30),fill_opacity=0.4,width=0)
    rrect(p,fitz.Rect(W-60,80,W-49,H-110),fill=GOLD,radius=0.5,width=0)
    x=M+6; p.draw_line((x,150),(x+40,150),color=GOLD,width=2.4)
    p.insert_text((x,140),spaced("HEALTHCARE INSURANCE DASHBOARD"),fontsize=9,fontname=SANSB,color=GOLD_L)
    p.insert_text((x-2,232),"Product & Build",fontsize=44,fontname=SERIFB,color=CREAM)
    p.insert_text((x-2,282),"Update",fontsize=44,fontname=SERIFB,color=CREAM)
    p.insert_text((x,318),"The latest additions, refreshed - led by a reimagined Insights experience.",fontsize=12.5,fontname=SANS,color=(0.82,0.85,0.91))
    # minimal client metadata: date + prepared for
    by=402
    for i,(lab,val) in enumerate([("DATE","July 2026"),("PREPARED FOR","Paragon Partners (India)")]):
        cxx=x+i*300
        p.draw_line((cxx,by),(cxx+250,by),color=(0.30,0.38,0.55),width=0.8)
        p.insert_text((cxx,by+18),spaced(lab),fontsize=8,fontname=SANSB,color=GOLD_L)
        p.insert_text((cxx,by+37),val,fontsize=13,fontname=SANSB,color=CREAM)
    py=470; txt="Insights, reimagined  ·  6 new features  ·  7 refinements delivered"
    tw=fitz.get_text_length(txt,SANSB,11); r=fitz.Rect(x,py,x+tw+46,py+33)
    rrect(p,r,fill=None,color=GOLD,width=1.4,radius=0.5); p.draw_circle((x+22,py+16.5),4,fill=GREEN,width=0)
    p.insert_text((x+36,py+21),txt,fontsize=11,fontname=SANSB,color=CREAM)

# ---------- EXEC SUMMARY ----------
def exec_summary():
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=CREAM,width=0)
    p.draw_circle((90,70),150,fill=GOLD,fill_opacity=0.05,width=0)
    p.draw_circle((W-70,H-60),170,fill=GREEN,fill_opacity=0.05,width=0)
    kicker(p,M,66,"AT A GLANCE")
    p.insert_text((M-2,100),"What's new in this update",fontsize=27,fontname=SERIFB,color=NAVY)
    p.insert_text((M,122),"A reimagined Insights experience leads the release, alongside new Data Audit tools and refreshed earlier work.",fontsize=10.5,fontname=SANS,color=INK2)
    cards=[("Insights","THE BIG UPDATE","A daily market-intelligence view - presented over the next five pages.",GOLD),
           ("6","NEW FEATURES","Insights, Signal Stack, Add to Calendar, AI Mode, Instant Charts, Pulse.",GREEN),
           ("7","REFINEMENTS","Earlier requests - all delivered, verified and freshly captured.",NAVY)]
    cw=(W-2*M-2*20)/3; cy=150; ch=118
    for i,(big,lab,desc,col) in enumerate(cards):
        cx=M+i*(cw+20); r=fitz.Rect(cx,cy,cx+cw,cy+ch)
        p.draw_rect(r+(2.5,3,2.5,3),fill=(0.55,0.56,0.60),radius=0.08,fill_opacity=0.12,width=0)
        rrect(p,r,fill=WHITE,color=LINE,width=0.7,radius=0.08); rrect(p,fitz.Rect(cx,cy,cx+5,cy+ch),fill=col,radius=0.2,width=0)
        fs=30 if len(big)>3 else 34
        p.insert_text((cx+20,cy+50),big,fontsize=fs,fontname=SERIFB,color=col)
        p.insert_text((cx+20,cy+70),spaced(lab),fontsize=7.5,fontname=SANSB,color=INK)
        p.insert_textbox(fitz.Rect(cx+20,cy+78,cx+cw-14,cy+ch-8),desc,fontsize=8.8,fontname=SANS,color=INK2,lineheight=1.3)
    ly=302
    p.insert_text((M,ly),spaced("NEW THIS UPDATE"),fontsize=8,fontname=SANSB,color=GOLD)
    new=["Insights - a daily market-intelligence view","Signal Stack - events, risks & opportunities","Add to Calendar - one-tap Google Calendar","Data Audit AI Mode - ask questions on the data","Instant Visualisation - selection to chart","Pulse - a curated view of what matters now"]
    for i,t in enumerate(new):
        yy=ly+18+i*17; p.draw_circle((M+4,yy-3),1.8,fill=GOLD,width=0); p.insert_text((M+13,yy),t,fontsize=9.4,fontname=SANS,color=INK)
    cx2=M+(W-2*M)/2+10
    p.insert_text((cx2,ly),spaced("REFINED & VERIFIED"),fontsize=8,fontname=SANSB,color=GREEN)
    old=["Life insurance removed from industry data","GI segment pie (Health, Motor, ...)","All figures now on FY26 (2026)","Star Health data visibility","IGAAP / IFRS accounting toggle","Channel / retail-mix conflict resolved","'60% guidance delivered' clarified (3 of 5)"]
    for i,t in enumerate(old):
        yy=ly+18+i*17; p.draw_circle((cx2+4,yy-3),3,fill=GREEN,width=0)
        p.draw_line((cx2+2.2,yy-3),(cx2+3.6,yy-1.6),color=WHITE,width=0.9); p.draw_line((cx2+3.6,yy-1.6),(cx2+6,yy-4.6),color=WHITE,width=0.9)
        p.insert_text((cx2+13,yy),t,fontsize=9.4,fontname=SANS,color=INK)
    footer(p,2)

# ---------- FEATURE (premium stage) ----------
def feature(label,headline,expl,image,pageno,mode="stage",top_strip=None,note=None):
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=CREAM,width=0)
    p.draw_circle((W-50,54),140,fill=GOLD,fill_opacity=0.04,width=0)
    pill_right(p,W-M,42,"SHIPPED",GREEN)
    kicker(p,M,58,label)
    if mode=="side":
        p.insert_textbox(fitz.Rect(M,72,M+300,140),headline,fontsize=20,fontname=SERIFB,color=NAVY,lineheight=1.06)
        p.draw_line((M,150),(M+44,150),color=GOLD,width=1.8)
        p.insert_textbox(fitz.Rect(M,162,M+300,H-70),expl,fontsize=11,fontname=SANS,color=INK2,lineheight=1.42)
        if note: chip(p,M,H-92,note,GOLD)
        st=fitz.Rect(M+318,80,W-M,H-52); stage(p,st); framed(p,image,st,pad=12)
    else:
        p.insert_text((M-2,90),headline,fontsize=22,fontname=SERIFB,color=NAVY)
        p.draw_line((M,100),(M+46,100),color=GOLD,width=1.8)
        p.insert_textbox(fitz.Rect(M,108,W-M-150,142),expl,fontsize=11,fontname=SANS,color=INK2,lineheight=1.35)
        if note: chip(p,W-M-fitz.get_text_length(spaced(note),SANSB,7)-22,110,note,GOLD)
        st=fitz.Rect(M,150,W-M,H-52); stage(p,st)
        inner=fitz.Rect(st.x0+14,st.y0+14,st.x1-14,st.y1-14)
        if top_strip:
            iw,ih=img_size(top_strip); sh=min(inner.width*ih/iw,44); sw=sh*iw/ih
            framed(p,top_strip,fitz.Rect(inner.x0,inner.y0,inner.x0+sw,inner.y0+sh+6),pad=6,anchor="top")
            inner=fitz.Rect(inner.x0,inner.y0+sh+16,inner.x1,inner.y1)
        framed(p,image,inner,pad=11)
    footer(p,pageno)

def divider(title,sub,idx,total,accent=GOLD):
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=NAVY,width=0)
    p.draw_circle((W-40,H-40),240,fill=NAVY2,fill_opacity=0.5,width=0)
    x=M+6; p.draw_line((x,236),(x+40,236),color=accent,width=2.4)
    p.insert_text((x,226),spaced(f"SECTION {idx} / {total}"),fontsize=9,fontname=SANSB,color=GOLD_L)
    p.insert_text((x-2,300),title,fontsize=40,fontname=SERIFB,color=CREAM)
    p.insert_textbox(fitz.Rect(x,320,x+560,400),sub,fontsize=12.5,fontname=SANS,color=(0.82,0.85,0.91),lineheight=1.4)

def thanks():
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=NAVY,width=0)
    p.draw_circle((W-60,H-60),230,fill=NAVY2,fill_opacity=0.55,width=0)
    x=M+6; p.draw_line((x,250),(x+34,250),color=GOLD,width=2.2)
    p.insert_text((x,242),spaced("HEALTHCARE INSURANCE DASHBOARD"),fontsize=8.5,fontname=SANSB,color=GOLD_L)
    p.insert_text((x-2,320),"Thank you",fontsize=50,fontname=SERIFB,color=CREAM)
    p.insert_text((x,356),"Prepared for Paragon Partners (India), by Munshot",fontsize=12.5,fontname=SANS,color=(0.80,0.83,0.90))
    p.insert_text((x,384),"July 2026   ·   Insights reimagined, plus new tools and refinements",fontsize=10.5,fontname=SANSB,color=GOLD_L)

# ================= ASSEMBLE =================
S=SRC+"/"; pageno=[3]
def add(**kw):
    feature(pageno=pageno[0],**kw); pageno[0]+=1
cover(); exec_summary()

# SECTION 1 - INSIGHTS (5 pages)
divider("Insights, reimagined","From static cards to a live daily market-intelligence view - the headline of this update, over the next five pages.",1,3); pageno[0]+=1
add(label="THE BIG UPDATE · INSIGHTS · 1 / 5",headline="From static cards to daily market intelligence",
    expl="The Insights tab now opens on a single, guided daily read - today's key takeaway first.",image=S+"i1_hero.png",mode="stage")
add(label="THE BIG UPDATE · INSIGHTS · 2 / 5",headline="Today's Read - the takeaway, first",
    expl="What changed, why it matters and what to watch next - the day's story in three lines.",image=S+"i2_today.png",mode="stage")
add(label="THE BIG UPDATE · INSIGHTS · 3 / 5",headline="Signal Stack - events, risks & opportunities",
    expl="One streamlined feed: the fastest signal, a risk watch and an opportunity watch, each dated and tagged.",image=S+"i3_signal.png",mode="side")
add(label="THE BIG UPDATE · INSIGHTS · 4 / 5",headline="Add to Calendar, in one tap",
    expl="Dated signals open pre-filled in the user's own Google Calendar, or download an .ics for Apple / Outlook. No sign-in.",image=S+"i4_calendar.png",mode="stage")
add(label="THE BIG UPDATE · INSIGHTS · 5 / 5",headline="Pulse - the connections behind the read",
    expl="Correlations, management events and curated signals - the longer-term picture behind today's story.",image=S+"i5_correlations.png",mode="stage")

# SECTION 2 - DATA AUDIT (2 pages)
divider("Smarter Data Audit","Ask questions of the source data and turn any selection into a chart - analysis without leaving the audit grid.",2,3,accent=GOLD); pageno[0]+=1
add(label="NEW · DATA AUDIT AI MODE",headline="Ask questions directly on the source data",
    expl="Turn on AI Mode, drag-select any range of audit cells, and open an AI panel that reads the numbers in context.",image=S+"n4_ai_mode.png",mode="stage")
add(label="NEW · INSTANT VISUALISATION",headline="Turn selected audit data into a chart",
    expl="The same selection instantly becomes a chart, with a quick read and the formula behind it.",image=S+"n5_instant_chart.png",mode="side")

# SECTION 3 - REFINEMENTS (7 pages)
divider("Refined & verified","The earlier requests - all delivered, re-verified, and freshly captured on the latest build.",3,3,accent=GREEN); pageno[0]+=1
add(label="REFINEMENT 01 · INDUSTRY DATA",headline="Life insurance removed from the industry view",
    expl="The industry snapshot now reads purely on general insurance - no life premium blended in.",image=S+"t1_industry_band.png",mode="stage")
add(label="REFINEMENT 02 · SEGMENT PIE",headline="A general-insurance pie, split by segment",
    expl="Health and Motor lead the pool - about 73% together - across seven segments, values on the ring.",image=S+"t2_gi_pie.png",mode="side")
add(label="REFINEMENT 03 · FINANCIAL YEAR",headline="Now on FY26 - the 2026 reporting year",
    expl="The dashboard's headline figures are updated to FY26 (2026), the latest published year.",image=S+"t3_fy26_premium.png",mode="stage",note="ALL FIGURES · FY2026")
add(label="REFINEMENT 04 · STAR HEALTH",headline="Star Health, fully visible",
    expl="Star Health is a complete row in the peer scorecard - every metric populated, no blanks.",image=S+"t4_star_scorecard_igaap.png",mode="side")
add(label="REFINEMENT 05 · ACCOUNTING BASIS",headline="One-click IGAAP / IFRS toggle",
    expl="Switch the lens: the combined ratio restates to IFRS for insurers that publish it; others stay clearly marked.",image=S+"t5_scorecard_ifrs.png",mode="stage",top_strip=S+"t5_toggle_ifrs.png")
add(label="REFINEMENT 06 · PREMIUM & DISTRIBUTION",headline="The retail-mix conflict, resolved",
    expl="One derived figure now feeds every surface, so the old 67% vs 88-96% split is gone.",image=S+"t6_product_mix.png",mode="side")
add(label="REFINEMENT 07 · GUIDANCE",headline="\"60% delivered\" - the exact 3 of 5",
    expl="The Promise Tracker shows which three targets were met and which two are still open.",image=S+"t7_promise_tracker.png",mode="stage")

thanks()
os.makedirs(OUTDIR,exist_ok=True)
doc.save(OUT,deflate=True,garbage=4)
print("saved",OUT,"pages",doc.page_count)
