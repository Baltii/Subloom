"""Build the printable Subloom guide from the canonical vector identity.
Requires reportlab, pillow and fonttools. No network access is used.
"""
import json, math
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from fontTools.pens.basePen import BasePen
from fontTools.svgLib.path import parse_path

B=Path(__file__).resolve().parents[1]; I=json.loads((B/'source/identity.json').read_text()); C=I['colors']; W,H=1000,700
for name,file in [('Manrope','manrope-bold.ttf'),('ManropeMedium','manrope-semibold.ttf'),('DM','dm-sans-regular.ttf'),('DMMedium','dm-sans-medium.ttf'),('DMBold','dm-sans-semibold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(B/'fonts'/file)))

class Pen(BasePen):
    def __init__(self,path): super().__init__(None); self.path=path
    def _moveTo(self,p): self.path.moveTo(*p)
    def _lineTo(self,p): self.path.lineTo(*p)
    def _curveToOne(self,p1,p2,p3): self.path.curveTo(*p1,*p2,*p3)
    def _closePath(self): self.path.close()
    def _endPath(self): pass

out=B/'output/Subloom-Brand-Guide.pdf'; c=canvas.Canvas(str(out),pagesize=(W,H)); c.setTitle('Subloom Brand Guide - Fourfold Bloom 1.0'); c.setAuthor('Subloom'); c.setSubject('Canonical visual identity and practical website/app brand guidelines')
page=0

def fill(color): c.setFillColor(HexColor(C.get(color,color)))
def rect(x,t,w,h,color,r=0):
    fill(color)
    if r: c.roundRect(x,H-t-h,w,h,r,stroke=0,fill=1)
    else: c.rect(x,H-t-h,w,h,stroke=0,fill=1)
def text(s,x,t,w=850,size=17,font='DM',color='forest',leading=1.45):
    fill(color); c.setFont(font,size); yy=t
    for paragraph in s.split('\n'):
        if not paragraph: yy+=size*leading; continue
        words=paragraph.split(); line=''
        for word in words:
            trial=(line+' '+word).strip()
            if pdfmetrics.stringWidth(trial,font,size)>w and line:
                c.drawString(x,H-yy-size*.82,line); yy+=size*leading; line=word
            else: line=trial
        if line: c.drawString(x,H-yy-size*.82,line); yy+=size*leading
    return yy

def vector_path(d,color):
    p=c.beginPath(); parse_path(d,Pen(p)); fill(color); c.drawPath(p,stroke=0,fill=1,fillMode=1)
def mark(x,t,size,color='green',second=None):
    c.saveState(); c.translate(x,H-t); c.scale(size/64,-size/64)
    vector_path(I['mark']['path'],color)
    c.restoreState()
def logo(x,t,width=300,variant='primary',symbol=True):
    if not symbol:
        vw=I['wordmark']['width']; height=width*64/vw
        c.saveState();c.translate(x,H-t);c.scale(width/vw,-width/vw);vector_path(I['wordmark']['path'],'mint' if variant=='inverse' else 'forest');c.restoreState();return height
    vw=I['wordmark']['lockupWidth'];size=width*64/vw
    col='mint' if variant=='inverse' else 'forest' if variant=='forest' else 'green'; mark(x,t,size,col)
    c.saveState(); c.translate(x+I['wordmark']['offsetX']*width/vw,H-t);c.scale(width/vw,-width/vw);vector_path(I['wordmark']['path'],'mint' if variant=='inverse' else 'forest');c.restoreState();return size

def heading(s,t=102): return text(s,64,t,870,42,'Manrope',leading=1.12)
def label(s,x,t,w=800,color='secondary'): return text(s,x,t,w,12,'DMMedium',color)
def image(file,x,t,w,h=None):
    im=ImageReader(str(file)); iw,ih=im.getSize(); hh=h or w*ih/iw
    c.drawImage(im,x,H-t-hh,width=w,height=hh,mask='auto',preserveAspectRatio=True)
def new(section,background='cloud'):
    global page
    if page: c.showPage()
    page+=1;rect(0,0,W,H,background);logo(64,30,112,variant='inverse' if background=='forest' else 'primary')
    label(section,680,38,260,color='mint' if background=='forest' else 'secondary')
    label('Subloom / Fourfold Bloom / Brand guide 1.0',64,660,600,color='mint' if background=='forest' else 'secondary')
    label(f'{page:02}',906,660,35,color='mint' if background=='forest' else 'secondary')

# Cover
new('One identity. Website + app.')
logo(64,142,560)
text('A little clarity.\nRoom to breathe.',64,290,600,42,'Manrope',leading=1.14)
text(I['tagline'],64,418,550,19)
label('The fixed identity, the rules, and the assets to use it well.',64,458,590)
rect(715,137,220,220,'green',48);mark(740,162,170,'mint')
for j,(name,key) in enumerate([('Forest','forest'),('Subloom Green','green'),('Bloom Mint','mint'),('Cloud','cloud')]):
    x=64+j*218;rect(x,527,207,90,key,14)
    col='mint' if key in ['forest','green'] else 'forest'
    text(name,x+17,544,180,14,'DMBold',col);label(C[key],x+17,575,180,col)

# Meaning
new('The idea')
heading('A familiar bloom, made consistent.')
text('Four soft petals. One familiar bloom. A calm recurring rhythm.',64,163,820,19)
rect(64,231,406,355,'mint',28);mark(105,240,320,'green')
text('Fourfold Bloom',532,245,380,28,'Manrope')
text('Four matching petals turn around one shared center. The rounded pinwheel preserves the four-petal mark you already know.',532,299,390,18)
text('The soft shape carries the bloom in Subloom. Quarter turns give it a gentle recurring rhythm, while the fixed silhouette makes it recognizable across every surface.',532,408,390,18)
label('Built from the original Subloom four-petal header mark.',532,550,380)

# Family
new('The logo family')
heading('One master. Every context.')
rect(64,190,550,171,'white',22);logo(96,237,440);label('Primary / Green symbol + Forest wordmark',96,320,460)
rect(635,190,301,171,'forest',22);mark(745,224,80,'mint');label('Symbol / Mint on Forest',666,320,250,'mint')
rect(64,382,550,171,'forest',22);logo(96,429,440,'inverse');label('Inverse / fixed Mint artwork',96,512,460,'mint')
rect(635,382,301,171,'mint',22);logo(670,423,229,'forest',False);label('Wordmark / secondary use',666,512,250)
text('Use supplied outlines. Do not retype, add a period, or rebuild the spacing.',64,585,870,16)

# Spacing
new('Space + scale')
heading('Let the mark breathe.')
text('Clear space = one quarter of the 64-unit symbol design box.',64,164,850,19)
rect(64,228,570,235,'mint',22);rect(96,261,506,169,'white',0);logo(127,302,444)
label('The light field represents required outside clear space.',96,477,530)
text('16 px',698,232,220,38,'Manrope');text('Minimum symbol box.\nPrefer 24-32 px in UI.',698,286,220,16)
text('140 px',698,385,220,38,'Manrope');text('Minimum full lockup width.\nPrefer 160-180 px in headers.',698,440,235,16)
text('At 32 px high, leave at least 8 px around the full lockup. The transparent margin inside the SVG is not a substitute. Give interactive logos a 44 px touch target.',64,548,840,18)

# Palette
new('Color')
heading('Forest, green, mint, cloud.')
for j,(name,key,role) in enumerate([('Forest','forest','Headings + wordmark'),('Subloom Green','green','Actions + symbol'),('Bloom Mint','mint','Fields + inverse logo'),('Cloud','cloud','Main app canvas')]):
    x=64+j*218;rect(x,187,207,176,key,20); col='mint' if key in ['forest','green'] else 'forest'
    text(name,x+17,206,177,17,'DMBold',col);text(C[key],x+17,242,177,16,'DM',col);text(role,x+17,311,177,12,'DM',col)
text('Built to read clearly.',64,404,430,27,'Manrope')
pairs=[('forest','cloud'),('green','white'),('white','green'),('mint','forest')]
def lum(h):
    rgb=[int(h[i:i+2],16)/255 for i in (1,3,5)];v=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb];return .2126*v[0]+.7152*v[1]+.0722*v[2]
contrast=[]
for j,(fg,bg) in enumerate(pairs):
    ratio=(max(lum(C[fg]),lum(C[bg]))+.05)/(min(lum(C[fg]),lum(C[bg]))+.05);contrast.append({'foreground':C[fg],'background':C[bg],'ratio':round(ratio,2)})
    y=458+j*34;rect(64,y,36,25,bg,5);text('Aa',69,y+5,30,15,'DMBold',fg);text(f'{fg.title()} on {bg.title()}',115,y+3,295,15);text(f'{ratio:.2f}:1',420,y+3,100,15,'DMBold')
rect(574,403,362,206,'forest',22);text('Brand stays fixed.',601,429,300,25,'Manrope','mint');text('Personal app accents can change controls and charts. The logo stays Green in light mode and Mint in dark mode.',601,475,300,17,'DM','mint')
(B/'tokens/contrast.json').write_text(json.dumps({'method':'WCAG relative luminance; sRGB','normalTextMinimum':4.5,'pairs':contrast},indent=2)+'\n')

# Typography
new('Typography')
heading('Warm type. Clear hierarchy.')
text('Manrope',64,196,440,55,'Manrope');text('Display / 600 + 700',67,264,430,16,'DMMedium','secondary')
text('A little clarity.\nA calmer month.',64,323,450,39,'Manrope',leading=1.17)
text('DM Sans',570,196,365,47,'DMBold');text('Reading + controls / 400, 500, 600',573,264,362,16,'DMMedium','secondary')
text('Your subscriptions, all in one place. See what is coming up, understand the cost, and choose what still feels worth it.',574,327,350,20)
text('Monthly estimate  EUR 27.47',574,454,350,17,'DMBold')
text('Keep price precision, currency labels and dates readable. The logo is supplied as outlines so its typography never drifts.',64,550,840,18)

# System
new('Interface + illustration')
heading('Friendly, with a clear purpose.')
rect(64,191,440,382,'mint',26);image(B/'illustrations/renewal-calendar.webp',78,209,412)
rect(548,191,388,382,'white',24);logo(574,218,172);text('Coming up next',574,284,320,25,'Manrope');text('Illustrative interface sample',574,324,320,12,'DMMedium','secondary')
for j,(service,price,date) in enumerate([('Spotify','EUR 10.99','24 Oct'),('Netflix','EUR 13.49','26 Oct'),('iCloud+','EUR 2.99','28 Oct')]):
    yy=365+j*62;rect(574,yy,336,51,'cloud',12);text(service,588,yy+10,190,15,'DMBold');text(price,799,yy+9,100,13,'DMBold');label(date,799,yy+29,100)
text('Rounded 10 / 16 / 24 px app surfaces. Consistent Lucide icons. Tactile financial objects. One illustration carries each moment; the logo remains flat.',64,605,850,16)

# Voice
new('Voice + motion')
heading('Calm words. Honest promises.')
text('Say this',64,193,408,24,'Manrope');text('Leave this behind',546,193,390,24,'Manrope')
examples=[('See your upcoming renewals.','Unlock financial freedom.'),('Start on this device.','Connect everything to begin.'),('Your changes are still here. Try again.','Something went wrong.'),('Cancel with the provider, then record it.','We stopped your next payment.')]
for j,(yes,no) in enumerate(examples):
    y=241+j*66;rect(64,y,438,52,'mint',12);text(yes,80,y+17,405,15,'DMMedium');rect(546,y,390,52,'white',12);text(no,562,y+17,357,15,'DM','secondary')
text('Motion should explain the action.',64,537,850,25,'Manrope');text('Use 150-240 ms feedback. Respect reduced motion. Keep final values readable. Never spin the logo, pulse it endlessly or animate the petals separately.',64,582,850,17)

# Applications
new('App + website applications')
heading('Recognizable at every size.')
rect(64,189,872,104,'white',20);logo(90,221,180);text('Why Subloom',511,233,145,15);text('Take a look',660,233,125,15);rect(787,215,122,47,'forest',24);text('Open app',807,230,95,14,'DMBold','white')
rect(64,318,570,247,'forest',24);logo(91,345,185,'inverse');text('Your space.\nAt your pace.',91,414,470,38,'Manrope','mint',leading=1.15)
rect(668,318,268,247,'mint',24);image(B/'icons/subloom-app-icon.png',712,347,178);label('App icon / opaque square source',691,536,240)
text('The app header, website, launcher icon and favicon all share exactly the same symbol. Only the container and approved color treatment change.',64,602,850,17)

# Donts
new('Usage rules')
heading('Protect the shape.')
for j,(title,body) in enumerate([('No substitutes','Retire the eight-petal icon and sprout. Use the master artwork.'),('No restyling','No gradients, outline versions, shadows, extra petals or trailing period.'),('No distortion','Do not stretch, rotate, crop, split or rearrange the petals.'),('No accent drift','Personal app themes never recolor the fixed Green / Mint identity.')]):
    x=64+(j%2)*453;y=193+(j//2)*197;rect(x,y,419,171,'white',20);text(title,x+24,y+23,370,25,'Manrope');text(body,x+24,y+72,365,17)
text('Use a quiet, high-contrast field. Keep the required clear space. The same rules apply to sponsors, presentations, app screens and future campaigns.',64,607,850,16)

# Governance
new('The source of truth')
heading('Keep it consistent from here.')
text('Use the assets. Do not redraw them.',64,180,850,27,'Manrope')
rows=[('The master','source/identity.json + source/subloom-master.svg'),('Ready-to-use artwork','logos/ - primary, inverse, forest, black and white'),('App + web icons','icons/ - square, adaptive, monochrome, splash, favicon'),('Shared foundations','tokens/ + fonts/ + illustrations/'),('Full written guidance','GUIDE.md - voice, spacing, accessibility and product truth')]
for j,(name,desc) in enumerate(rows):
    y=239+j*55;text(name,64,y,267,16,'DMBold');text(desc,351,y,580,16)
rect(64,532,872,73,'mint',17);text('Regenerate together. Check together.',85,550,830,20,'Manrope');text('The app and website consume generated geometry; the manifest detects stale or changed exports.',85,582,830,13)
label('Platform reference: developer.android.com/develop/ui/compose/system/icon_design_adaptive',64,620,865)
c.linkURL('https://developer.android.com/develop/ui/compose/system/icon_design_adaptive',(64,H-638,936,H-618),relative=0,thickness=0)
c.save();print(f'Created {out} ({page} pages)')
