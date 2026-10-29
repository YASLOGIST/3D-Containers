#!/usr/bin/env python3
"""Render the README artwork. Requires Pillow; source plate is an AI illustration.
Run from the repository root: python assets/readme/render_cinematic.py
The illustration is conceptual, not a dimensionally accurate ULD rendering.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
from pathlib import Path

OUT = Path('assets/readme')
W,H = 1440,540
source = Image.open(OUT/'uld-cinematic-source.png').convert('RGB').resize((W,H), Image.Resampling.LANCZOS)
# Darken the typographic side independently of the visual subject.
shade = Image.new('RGBA',(W,H)); px=shade.load()
for x in range(W):
    alpha = round(155 * max(0, min(1, (800-x)/390)))
    for y in range(H): px[x,y]=(2,9,14,alpha)
base = Image.alpha_composite(source.convert('RGBA'),shade)
d = ImageDraw.Draw(base)
fontdir='/usr/share/fonts/truetype/dejavu/'
def font(name,size): return ImageFont.truetype(fontdir+name,size)
regular=font('DejaVuSans.ttf',19); small=font('DejaVuSansMono.ttf',12)
mono=font('DejaVuSansMono.ttf',14); bold=font('DejaVuSans-Bold.ttf',59)
brand=font('DejaVuSans-Bold.ttf',20); mid=font('DejaVuSans.ttf',21)
# Restrained publication framing.
d.line((40,40,1400,40),fill=(83,126,136,90),width=1)
d.line((40,499,1400,499),fill=(83,126,136,110),width=1)
d.line((40,40,40,60),fill=(214,170,88,220),width=2)
d.line((1400,479,1400,499),fill=(214,170,88,220),width=2)
d.text((62,61),'YASLOGIST',font=brand,fill=(235,245,245,255),stroke_width=0)
d.line((213,63,213,83),fill=(231,180,83,255),width=2)
d.text((230,67),'SPATIAL ENGINEERING',font=small,fill=(139,169,176,255))
d.text((62,155),'AVIATION  /  PROCEDURAL GEOMETRY',font=mono,fill=(112,210,213,255))
d.text((58,191),'3D-CONTAINERS',font=bold,fill=(242,248,248,255))
d.text((62,279),'An aviation ULD geometry lab.',font=mid,fill=(218,231,232,255))
d.text((62,311),'Built in the browser, one profile at a time.',font=regular,fill=(157,183,187,255))
d.line((62,371,496,371),fill=(72,117,125,255),width=1)
d.text((62,389),'17 MODEL TYPES   /   THREE.JS   /   GLB · OBJ · STL',font=small,fill=(151,182,186,255))
d.text((62,466),'YASLOGIST  /  ENGINEERING IN MOTION',font=small,fill=(145,174,177,255))
d.text((1183,466),'CONCEPT STUDY',font=small,fill=(145,174,177,255))
# Technical motion is deliberately illustrative: no measurement or telemetry claims.
def render(t):
    im=base.copy(); overlay=Image.new('RGBA',(W,H)); q=ImageDraw.Draw(overlay)
    theta=2*math.pi*t
    # Floor datum arcs; the orbital point travels a closed path around the illustrated unit.
    box=(797,365,1380,469)
    q.arc(box, 188, 352, fill=(67,159,170,100),width=1)
    q.arc((839,382,1338,453),190,350,fill=(174,164,117,80),width=1)
    angle=theta-math.pi/2
    x=1088+291*math.cos(angle); y=417+52*math.sin(angle)
    q.ellipse((x-11,y-11,x+11,y+11),fill=(84,224,229,30))
    q.ellipse((x-3,y-3,x+3,y+3),fill=(150,245,240,225))
    # A gently oscillating scan across the subject, not a literal sensor readout.
    sx=1025+165*math.sin(theta)
    intensity=int(70+35*(1-math.cos(theta))/2)
    q.line((sx,150,sx,393),fill=(93,222,225,intensity),width=1)
    q.line((sx-6,150,sx+6,150),fill=(124,228,226,150),width=1)
    q.line((sx-6,393,sx+6,393),fill=(124,228,226,150),width=1)
    # Connection from title block to the model and a continuous traveling signal.
    path=[(514,372),(637,372),(724,342),(835,342)]
    q.line(path, fill=(71,151,159,145),width=1)
    # cosine motion returns along the same meaningful path, without an endpoint reset.
    u=(1-math.cos(theta))/2
    xx=514+321*u
    yy=372 if xx<637 else (372-(xx-637)*30/87 if xx<724 else 342)
    q.ellipse((xx-9,yy-9,xx+9,yy+9),fill=(101,231,224,27))
    q.ellipse((xx-3,yy-3,xx+3,yy+3),fill=(178,251,242,240))
    # Quiet breathing at the origin, synchronized with the scan.
    a=int(90+80*(1-math.cos(theta))/2)
    q.ellipse((507,365,521,379),outline=(92,213,216,a),width=1)
    return Image.alpha_composite(im,overlay).convert('RGB')

# One shared palette avoids palette shimmer between frames.
poster=render(0)
poster.resize((1920,720),Image.Resampling.LANCZOS).save(OUT/'uld-cinematic-poster.png',optimize=True)
palette=render(.25).quantize(colors=256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
frames=[render(i/60).quantize(palette=palette,dither=Image.Dither.NONE) for i in range(60)]
frames[0].save(OUT/'uld-cinematic-hero.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,optimize=True,disposal=1)

# Secondary motion: restrained animated diagram of the real workbench stages.
SW,SH=1000,100
sf=font('DejaVuSansMono.ttf',14)
static=Image.new('RGB',(SW,SH),(8,19,25)); sd=ImageDraw.Draw(static)
sd.line((80,39,920,39),fill=(45,89,98),width=2)
for x,label in [(80,'MODEL REGISTRY'),(360,'PROCEDURAL GEOMETRY'),(640,'THREE.JS VIEWER'),(920,'MESH EXPORT')]:
    sd.ellipse((x-5,34,x+5,44),fill=(85,170,176))
    box=sd.textbbox((0,0),label,font=sf); tw=box[2]-box[0]
    sd.text((x-tw/2,62),label,font=sf,fill=(177,204,204))
strip_palette=static.quantize(colors=128)
strip=[]
for i in range(60):
    layer=static.copy(); ld=ImageDraw.Draw(layer)
    u=(1-math.cos(2*math.pi*i/60))/2
    x=80+840*u
    ld.ellipse((x-9,30,x+9,48),fill=(26,78,83)); ld.ellipse((x-3,36,x+3,42),fill=(169,251,235))
    strip.append(layer.quantize(palette=strip_palette,dither=Image.Dither.NONE))
strip[0].save(OUT/'uld-flow.gif',save_all=True,append_images=strip[1:],duration=160,loop=0,optimize=True,disposal=1)
