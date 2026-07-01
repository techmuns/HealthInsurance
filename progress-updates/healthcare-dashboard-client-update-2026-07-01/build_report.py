#!/usr/bin/env python3
"""Updated client deck — Healthcare Insurance Dashboard build summary (landscape A4)."""
import fitz
from PIL import Image
import os

SRC = "scratch/final"
OUTDIR = "progress-updates/healthcare-dashboard-client-update-2026-07-01"
OUT = OUTDIR + "/updated_client_progress_report.pdf"
BUILD_COMMIT = "df5ef2c"
BRANCH = "claude/task-checklist-pdf-afg9ez"
DATE = "2026-07-01"

NAVY=(18/255,33/255,64/255); NAVY2=(28/255,46/255,84/255)
GOLD=(182/255,138/255,58/255); GOLD_L=(214/255,178/255,110/255)
CREAM=(249/255,246/255,235/255); GREEN=(40/255,132/255,96/255)
AMBER=(193/255,138/255,38/255); INK=(0.16,0.20,0.29); INK2=(0.42,0.46,0.54)
WHITE=(1,1,1); LINE=(0.86,0.85,0.80)
W,H=842,595; M=50
SERIF="Times-Roman"; SERIFB="Times-Bold"; SERIFI="Times-Italic"
SANS="Helvetica"; SANSB="Helvetica-Bold"

doc=fitz.open()
_MAP={"“":'"',"”":'"',"‘":"'","’":"'","—":" - ","–":"-","→":"->","⇄":"/","↔":"/","≥":">=","≤":"<=","₹":"Rs ","×":"x","·":"·"}
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
def framed(page,path,box,pad=9,anchor="center"):
    iw,ih=img_size(path); bw,bh=box.width-2*pad,box.height-2*pad
    s=min(bw/iw,bh/ih); dw,dh=iw*s,ih*s
    cx=(box.x0+box.x1)/2
    cy=(box.y0+dh/2+pad) if anchor=="top" else (box.y0+box.y1)/2
    img=fitz.Rect(cx-dw/2,cy-dh/2,cx+dw/2,cy+dh/2)
    card=fitz.Rect(img.x0-pad,img.y0-pad,img.x1+pad,img.y1+pad)
    page.draw_rect(card+(3.5,4.5,3.5,4.5),fill=(0.55,0.56,0.60),radius=0.05,fill_opacity=0.18,width=0)
    rrect(page,card,fill=WHITE,color=LINE,width=0.7,radius=0.05)
    page.insert_image(img,filename=path,keep_proportion=True)
    return card
def kicker(page,x,y,text,color=GOLD,size=8.5):
    page.insert_text((x,y),spaced(text),fontsize=size,fontname=SANSB,color=color)
def pill(page,x,y,txt,col,filled=True):
    tw=fitz.get_text_length(spaced(txt),SANSB,7.2); w=tw+30
    r=fitz.Rect(x,y,x+w,y+19)
    if filled:
        rrect(page,r,fill=col,radius=0.5,width=0); page.draw_circle((x+12,y+9.5),2.4,fill=WHITE,width=0)
        page.insert_text((x+19,y+12.6),spaced(txt),fontsize=7.2,fontname=SANSB,color=WHITE)
    else:
        rrect(page,r,fill=None,color=col,width=1,radius=0.5); page.insert_text((x+15,y+12.6),spaced(txt),fontsize=7.2,fontname=SANSB,color=col)
    return r
def pill_right(page,xr,y,txt,col):
    tw=fitz.get_text_length(spaced(txt),SANSB,7.2); w=tw+30; x=xr-w
    return pill(page,x,y,txt,col,filled=True)
def footer(page,pageno):
    y=H-30; page.draw_line((M,y),(W-M,y),color=LINE,width=0.7)
    page.insert_text((M,y+13),"Healthcare Insurance Dashboard - Updated Build Summary",fontsize=8,fontname=SANS,color=INK2)
    page.insert_text((W-M-90,y+13),f"{DATE}   ·   Page {pageno}",fontsize=8,fontname=SANS,color=INK2)

# ---------- COVER ----------
def cover():
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=NAVY,width=0)
    p.draw_circle((W-60,70),230,fill=NAVY2,fill_opacity=0.55,width=0)
    p.draw_circle((W-10,120),150,fill=(0.10,0.16,0.30),fill_opacity=0.4,width=0)
    rrect(p,fitz.Rect(W-60,70,W-49,H-120),fill=GOLD,radius=0.5,width=0)
    x=M+6; p.draw_line((x,120),(x+34,120),color=GOLD,width=2.2)
    p.insert_text((x,110),spaced("WEEKLY BUILD UPDATE  ·  UPDATED SUMMARY  ·  "+DATE),fontsize=8.5,fontname=SANSB,color=GOLD_L)
    p.insert_text((x-2,182),"Healthcare Insurance",fontsize=40,fontname=SERIFB,color=CREAM)
    p.insert_text((x-2,228),"Dashboard",fontsize=40,fontname=SERIFB,color=CREAM)
    p.insert_text((x,258),"Updated Build Summary",fontsize=19,fontname=SERIF,color=GOLD_L)
    p.insert_text((x,286),"Checklist progress, latest feature additions, and refreshed screenshots.",fontsize=11.5,fontname=SANS,color=(0.80,0.83,0.90))
    meta=[("DATE",DATE),("BRANCH",BRANCH),("COMMIT",BUILD_COMMIT+"  (latest build)"),
          ("ENVIRONMENT","Claude Code - remote sandbox"),("PREPARED FOR","Paragon Partners (India), by Munshot")]
    by=340
    for i,(lab,val) in enumerate(meta):
        col=i%3; row=i//3; cxx=x+col*250; cy=by+row*62
        p.draw_line((cxx,cy),(cxx+210,cy),color=(0.30,0.38,0.55),width=0.8)
        p.insert_text((cxx,cy+17),spaced(lab),fontsize=7.5,fontname=SANSB,color=GOLD_L)
        p.insert_text((cxx,cy+34),val,fontsize=11.5,fontname=SANSB,color=CREAM)
    py=498; txt="7 checklist items  ·  6 new features shipped today"
    tw=fitz.get_text_length(txt,SANSB,11); r=fitz.Rect(x,py,x+tw+46,py+32)
    rrect(p,r,fill=None,color=GOLD,width=1.4,radius=0.5); p.draw_circle((x+22,py+16),4,fill=GREEN,width=0)
    p.insert_text((x+36,py+20.5),txt,fontsize=11,fontname=SANSB,color=CREAM)

# ---------- EXEC SUMMARY ----------
def exec_summary():
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=CREAM,width=0)
    p.draw_circle((90,70),150,fill=GOLD,fill_opacity=0.05,width=0)
    p.draw_circle((W-70,H-60),170,fill=GREEN,fill_opacity=0.05,width=0)
    kicker(p,M,66,"EXECUTIVE SUMMARY")
    p.insert_text((M-2,100),"What's in this build",fontsize=27,fontname=SERIFB,color=NAVY)
    p.insert_text((M,122),"All earlier checklist items are still here, refreshed against the latest dashboard - plus six new features shipped today.",fontsize=10.5,fontname=SANS,color=INK2)
    # three stat cards
    cards=[("7","CHECKLIST ITEMS","Earlier client requests - all delivered and re-verified.",GREEN),
           ("6","NEW TODAY","Insights, Signal Stack, Add to Calendar, AI Mode, Instant Charts, Pulse.",GOLD),
           ("100%","SCREENSHOTS REFRESHED","Every image recaptured on build "+BUILD_COMMIT+" ("+DATE+").",NAVY)]
    cw=(W-2*M-2*20)/3; cy=150; ch=120
    for i,(big,lab,desc,col) in enumerate(cards):
        cx=M+i*(cw+20); r=fitz.Rect(cx,cy,cx+cw,cy+ch)
        p.draw_rect(r+(2.5,3,2.5,3),fill=(0.55,0.56,0.60),radius=0.08,fill_opacity=0.12,width=0)
        rrect(p,r,fill=WHITE,color=LINE,width=0.7,radius=0.08)
        rrect(p,fitz.Rect(cx,cy,cx+5,cy+ch),fill=col,radius=0.2,width=0)
        p.insert_text((cx+20,cy+52),big,fontsize=34,fontname=SERIFB,color=col)
        p.insert_text((cx+20,cy+72),spaced(lab),fontsize=7.5,fontname=SANSB,color=INK)
        p.insert_textbox(fitz.Rect(cx+20,cy+80,cx+cw-14,cy+ch-8),desc,fontsize=8.8,fontname=SANS,color=INK2,lineheight=1.3)
    # whats new / whats refreshed columns
    ly=300
    p.insert_text((M,ly),spaced("NEW THIS BUILD"),fontsize=8,fontname=SANSB,color=GOLD)
    new=["Insights - a daily market-intelligence view","Signal Stack - events, risks & opportunities","Add to Calendar - keyless Google Calendar link","Data Audit AI Mode - ask questions on the data","Instant Visualisation - selection to chart","Pulse - a curated view of what matters now"]
    for i,t in enumerate(new):
        yy=ly+18+i*17; p.draw_circle((M+4,yy-3),1.8,fill=GOLD,width=0)
        p.insert_text((M+13,yy),t,fontsize=9.4,fontname=SANS,color=INK)
    cx2=M+ (W-2*M)/2 + 10
    p.insert_text((cx2,ly),spaced("EARLIER CHECKLIST - REFRESHED"),fontsize=8,fontname=SANSB,color=GREEN)
    old=["Life insurance removed from industry data","GI segment pie (Health, Motor, ...)","FY25 -> FY26 across the dashboard","Star Health data visibility","IGAAP / IFRS accounting toggle","Channel / retail-mix conflict resolved","'60% guidance delivered' clarified (3 of 5)"]
    for i,t in enumerate(old):
        yy=ly+18+i*17; p.draw_circle((cx2+4,yy-3),3,fill=GREEN,width=0)
        p.draw_line((cx2+2.2,yy-3),(cx2+3.6,yy-1.6),color=WHITE,width=0.9); p.draw_line((cx2+3.6,yy-1.6),(cx2+6,yy-4.6),color=WHITE,width=0.9)
        p.insert_text((cx2+13,yy),t,fontsize=9.4,fontname=SANS,color=INK)
    footer(p,2)

# ---------- FEATURE PAGE ----------
def feature(label,headline,expl,image,pageno,top_strip=None,mode="top"):
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=CREAM,width=0)
    p.draw_circle((W-60,60),150,fill=GOLD,fill_opacity=0.045,width=0)
    pill_right(p,W-M,44,"SHIPPED",GREEN)
    kicker(p,M,60,label)
    if mode=="side":
        p.insert_textbox(fitz.Rect(M,74,M+300,150),headline,fontsize=21,fontname=SERIFB,color=NAVY,lineheight=1.05)
        p.insert_textbox(fitz.Rect(M,170,M+300,H-60),expl,fontsize=11,fontname=SANS,color=INK2,lineheight=1.4)
        framed(p,image,fitz.Rect(M+320,74,W-M,H-46))
    else:
        p.insert_text((M-2,92),headline,fontsize=22,fontname=SERIFB,color=NAVY)
        p.insert_textbox(fitz.Rect(M,102,W-M-150,140),expl,fontsize=11,fontname=SANS,color=INK2,lineheight=1.35)
        itop=150
        if top_strip:
            iw,ih=img_size(top_strip); sw=min((W-2*M)*ih/iw,46) # capped height
            sw2=sw*iw/ih; framed(p,top_strip,fitz.Rect(M,itop,M+sw2,itop+sw+4),pad=5,anchor="top"); itop+=sw+16
        framed(p,image,fitz.Rect(M,itop,W-M,H-46),anchor="top")
    footer(p,pageno)

# ---------- THANK YOU ----------
def thanks():
    p=doc.new_page(width=W,height=H); p.draw_rect(fitz.Rect(0,0,W,H),fill=NAVY,width=0)
    p.draw_circle((W-60,H-60),230,fill=NAVY2,fill_opacity=0.55,width=0)
    x=M+6; p.draw_line((x,250),(x+34,250),color=GOLD,width=2.2)
    p.insert_text((x,242),spaced("HEALTHCARE INSURANCE DASHBOARD  ·  BUILD SUMMARY"),fontsize=8.5,fontname=SANSB,color=GOLD_L)
    p.insert_text((x-2,320),"Thank you",fontsize=50,fontname=SERIFB,color=CREAM)
    p.insert_text((x,356),"Prepared for Paragon Partners (India), by Munshot",fontsize=12.5,fontname=SANS,color=(0.80,0.83,0.90))
    p.insert_text((x,384),DATE+"   ·   7 checklist items refreshed   ·   6 new features shipped",fontsize=10.5,fontname=SANSB,color=GOLD_L)

# ================= ASSEMBLE =================
cover(); exec_summary()
S=SRC+"/"
pages=[
 # NEW THIS BUILD
 dict(label="NEW · INSIGHTS",headline="From static cards to daily market intelligence",
   expl="The Insights tab now opens on today's key readout first - a cleaner daily intelligence view.",
   image=S+"n1_intelligence.png",mode="top"),
 dict(label="NEW · SIGNAL STACK",headline="Upcoming events, risks & opportunities - one view",
   expl="A single streamlined feed: the fastest signal, a risk watch and an opportunity watch, each dated and tagged by priority.",
   image=S+"n2_signal_stack.png",mode="side"),
 dict(label="NEW · ADD TO CALENDAR",headline="Track key events without leaving the dashboard",
   expl="Dated signals open straight in your own Google Calendar, pre-filled - or download an .ics for Apple / Outlook. No sign-in, no integration.",
   image=S+"n3_add_calendar.png",mode="top"),
 dict(label="NEW · DATA AUDIT AI MODE",headline="Ask questions directly on the source data",
   expl="Turn on AI Mode, drag-select any range of audit cells, and open an AI panel that reads the numbers in context.",
   image=S+"n4_ai_mode.png",mode="top"),
 dict(label="NEW · INSTANT VISUALISATION",headline="Turn selected audit data into a chart",
   expl="The same selection instantly becomes a chart, with a quick read and the formula behind it - analysis in one click.",
   image=S+"n5_instant_chart.png",mode="side"),
 dict(label="NEW · PULSE",headline="A curated view of what matters now",
   expl="Pulse pulls correlations, management events and curated signals into one focused daily read.",
   image=S+"n6_pulse_curated.png",mode="top"),
 # EARLIER CHECKLIST - REFRESHED
 dict(label="CHECKLIST 01 · INDUSTRY DATA",headline="Life insurance removed from the industry view",
   expl="The industry snapshot now reads purely on general insurance - no life premium blended into any card.",
   image=S+"t1_industry_band.png",mode="top"),
 dict(label="CHECKLIST 02 · SEGMENT PIE",headline="A general-insurance pie, split by segment",
   expl="Health and Motor lead the GI pool - about 73% together - across seven segments, now with values on the ring.",
   image=S+"t2_gi_pie.png",mode="side"),
 dict(label="CHECKLIST 03 · FINANCIAL YEAR",headline="Headline year rolled to FY26",
   expl="The dashboard reads FY26 wherever the data is published; periods still awaiting FY26 stay honestly labelled.",
   image=S+"t3_fy26_premium.png",mode="top"),
 dict(label="CHECKLIST 04 · STAR HEALTH",headline="Star Health, fully visible",
   expl="Star Health is a complete row in the peer scorecard - every metric populated, no blanks.",
   image=S+"t4_star_scorecard_igaap.png",mode="side"),
 dict(label="CHECKLIST 05 · ACCOUNTING BASIS",headline="One-click IGAAP / IFRS toggle",
   expl="Switch the lens: the combined ratio restates to IFRS for insurers that publish it (Niva 101.2% -> 103.0%); others stay clearly marked.",
   image=S+"t5_scorecard_ifrs.png",mode="top",top_strip=S+"t5_toggle_ifrs.png"),
 dict(label="CHECKLIST 06 · PREMIUM & DISTRIBUTION",headline="The retail-mix conflict, resolved",
   expl="One derived figure now feeds every surface, so the old 67% vs 88-96% split is gone - the numbers agree by construction.",
   image=S+"t6_product_mix.png",mode="side"),
 dict(label="CHECKLIST 07 · GUIDANCE",headline="\"60% delivered\" - the exact 3 of 5",
   expl="The Promise Tracker shows which three targets were met and which two are still open, each with its source.",
   image=S+"t7_promise_tracker.png",mode="top"),
]
for i,pg in enumerate(pages):
    feature(pageno=i+3,**pg)
thanks()
os.makedirs(OUTDIR,exist_ok=True)
doc.save(OUT,deflate=True,garbage=4)
print("saved",OUT,"pages",doc.page_count)
