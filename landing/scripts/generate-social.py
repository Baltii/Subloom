"""Generate exact branded OG artwork. Requires fonttools and Node/Next's sharp.
Run from landing/: python3 scripts/generate-social.py
The canonical logo, local typefaces, and existing wallet illustration are reused.
No logo geometry or new product claims are generated.
"""
import json
from pathlib import Path
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

root = Path(__file__).resolve().parents[1]
identity_source = (root / 'components/brand-identity.ts').read_text()
identity = json.loads(identity_source.split('export const brandIdentity = ', 1)[1].rsplit(' as const;', 1)[0])
font = TTFont(root / 'public/fonts/manrope-bold.ttf')
body = TTFont(root / 'public/fonts/dm-sans-regular.ttf')

def text(value, x, y, size, color, face=font, tracking=-.025):
    glyphs = face.getGlyphSet()
    cmap = face.getBestCmap()
    scale = size / face['head'].unitsPerEm
    pen = SVGPathPen(glyphs)
    for character in value:
        name = cmap[ord(character)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
        x += glyphs[name].width * scale + size * tracking
    return f'<path d="{pen.getCommands()}" fill="{color}"/>'

for dark in (False, True):
    ground, ink, green, stage, paper, detail = ('#101a16','#e7f2e9','#70d2ad','#243e2e','#18251e','#adc1b2') if dark else ('#f4f5ed','#182d25','#087c65','#e1f0de','#ffffff','#586f61')
    logo_mark = '#e1f0de' if dark else '#087c65'
    logo_text = '#e1f0de' if dark else '#182d25'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="{ground}"/>
    <g transform="translate(56 48) scale(.7)"><path d="{identity['markPath']}" fill="{logo_mark}"/><path d="{identity['wordmarkPath']}" transform="translate({identity['wordmarkOffsetX']} 0)" fill="{logo_text}"/></g>
    <path d="M770 530V310C770 213 850 135 947 135S1124 213 1124 310V530Q1124 558 1096 558H798Q770 558 770 530Z" fill="{stage}"/>
    {text('Less money',56,226,68,ink)}
    {text('admin. More',56,308,68,ink)}
    {text('peace of mind.',56,390,68,green)}
    <path d="M58 407H500" stroke="{green}" stroke-width="3" stroke-linecap="round"/>
    {text('Your subscriptions, in a calmer place.',58,483,24,detail,body,0)}
    {text('See the forgotten. Keep what matters.',58,521,24,detail,body,0)}
    <rect x="807" y="151" width="280" height="65" rx="20" fill="{paper}"/>
    <circle cx="842" cy="184" r="13" fill="{green}"/><path d="m836 184 4 4 8-9" fill="none" stroke="{paper}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    {text('Renewals, remembered.',867,190,16,ink,body,0)}
    </svg>'''
    filename = 'social-dark' if dark else 'social'
    master = root / 'scripts' / f'{filename}.svg'
    master.write_text(svg)
    subprocess.run(['node','-e', 'const sharp=require("sharp");(async()=>{const wallet=await sharp("public/illustrations/wallet-coins.webp").resize({width:450}).png().toBuffer();await sharp(process.argv[1]).composite([{input:wallet,left:710,top:222}]).png().toFile(process.argv[2]);})().catch(e=>{console.error(e);process.exitCode=1});',str(master),str(root/'public'/f'{filename}.png')], cwd=root, check=True)
    master.unlink()
    print(f'Generated public/{filename}.png (1200 × 630)')
