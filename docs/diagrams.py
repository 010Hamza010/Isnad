# Generates the README diagrams: python3 docs/diagrams.py docs/images  (pure SVG, white background, no dependency)
import sys, os
OUT = sys.argv[1]
FONT = "'Noto Naskh Arabic', 'Amiri', 'Segoe UI', Tahoma, 'Noto Sans', sans-serif"
INK, MUTED, LINE = '#1f2937', '#6b7280', '#9ca3af'
GREEN, ORANGE, BLUE, PURPLE = '#15803d', '#c2410c', '#1d4ed8', '#7e22ce'

def svg(w, h, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="{FONT}">
<defs>
  <marker id="up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{LINE}"/></marker>
  <marker id="upg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{GREEN}"/></marker>
</defs>
<rect width="{w}" height="{h}" rx="14" fill="#ffffff"/>
{body}
</svg>'''

def text(x, y, s, size=15, color=INK, weight='normal', anchor='middle'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}" direction="rtl">{s}</text>'

def node(x, y, label, w=None, fill='#f3f4f6', stroke='#d1d5db', color=INK, weight='bold', size=15):
    w = w or max(70, 11 * len(label) + 26)
    return (f'<rect x="{x - w/2}" y="{y - 17}" width="{w}" height="34" rx="9" fill="{fill}" stroke="{stroke}"/>'
            + text(x, y + 5, label, size, color, weight)), w

def edge(x1, y1, x2, y2, color=LINE, dash=False, marker='up'):
    d = ' stroke-dasharray="6 5"' if dash else ''
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="2"{d} marker-end="url(#{marker})"/>'

def tag(x, y, s, color, size=13):
    w = 8 * len(s) + 22
    return (f'<rect x="{x - w/2}" y="{y - 13}" width="{w}" height="24" rx="12" fill="{color}" fill-opacity=".1" stroke="{color}"/>'
            + text(x, y + 4, s, size, color, 'bold'))

# ── 1. pipeline ──
def pipeline():
    steps = [
        ('الاتصالات', 'Links', 'من الطالب إلى الشيخ', 'tables: *_connections'),
        ('الطرق', 'Routes', 'كل طريق مني إلى المؤلف', 'services/graphService.js'),
        ('نص الإسناد', 'Isnad text', 'قرأتُ على، كلاهما، ح', 'services/isnadText/render.js'),
        ('الإجازة', 'Ijaza', 'القالب والشهادة ورمز التحقق', 'NewIjaza.jsx, Certificate.jsx'),
    ]
    W, bw, gap = 1000, 210, 30
    x0 = (W - (4 * bw + 3 * gap)) / 2
    b = []
    for i, (ar, en, ex, f) in enumerate(steps):
        x = x0 + i * (bw + gap)
        b.append(f'<rect x="{x}" y="30" width="{bw}" height="150" rx="14" fill="#f8fafc" stroke="#cbd5e1"/>')
        b.append(f'<circle cx="{x + 22}" cy="52" r="13" fill="{BLUE}"/>' + text(x + 22, 57, str(i + 1), 14, '#fff', 'bold'))
        b.append(text(x + bw / 2, 80, ar, 22, INK, 'bold'))
        b.append(text(x + bw / 2, 104, en, 14, MUTED))
        b.append(text(x + bw / 2, 134, ex, 15, PURPLE))
        b.append(text(x + bw / 2, 162, f, 11.5, MUTED))
        if i < 3:
            ax = x + bw + 4
            b.append(f'<line x1="{ax}" y1="105" x2="{ax + gap - 8}" y2="105" stroke="{BLUE}" stroke-width="3" marker-end="url(#up)"/>')
    return svg(W, 210, '\n'.join(b))

# ── 2. a network (a made-up example) ──
def network():
    N = {
        'author': (520, 50, 'المؤلف'),
        'maymun': (370, 125, 'عمر ... ياسر'),
        'majasi': (670, 125, 'إدريس ... مسلم'),
        'saghir': (520, 200, 'هاشم'),
        'ghazi': (520, 275, 'قاسم'),
        'ashir': (360, 350, 'يوسف ... صالح'),
        'qadi': (360, 425, 'يحيى'),
        'sadi': (190, 500, 'مالك ... سعد'),
        'fasi': (520, 500, 'عامر ... أنس'),
        'tahami': (440, 575, 'ربيع'),
        'sakyati': (610, 575, 'شريح'),
        'tahir': (190, 610, 'وهب'),
        'zawin': (520, 650, 'نوفل'),
        'ayyash': (520, 725, 'ثابت ... رافع'),
        'kattani': (840, 500, 'لبيد ... منصور'),
        'khalid': (110, 800, 'زياد'),
        'husayn': (330, 800, 'عمار'),
        'nuzha': (840, 800, 'هند'),
        'me': (520, 875, 'أنا'),
    }
    E = [('me', 'khalid'), ('me', 'husayn'), ('me', 'nuzha'), ('khalid', 'tahir'), ('husayn', 'tahir'), ('husayn', 'ayyash'),
         ('tahir', 'sadi'), ('sadi', 'qadi'), ('ayyash', 'zawin'), ('zawin', 'tahami'), ('zawin', 'sakyati'), ('tahami', 'fasi'),
         ('sakyati', 'fasi'), ('fasi', 'qadi'), ('qadi', 'ashir'), ('ashir', 'ghazi'), ('nuzha', 'kattani'), ('kattani', 'ghazi'),
         ('ghazi', 'saghir'), ('saghir', 'maymun'), ('saghir', 'majasi'), ('maymun', 'author'), ('majasi', 'author')]
    green = {('khalid', 'tahir'), ('husayn', 'tahir'), ('tahami', 'fasi'), ('sakyati', 'fasi'), ('zawin', 'tahami'), ('zawin', 'sakyati')}
    b = []
    for a, c in E:
        x1, y1, _ = N[a]; x2, y2, _ = N[c]
        g = (a, c) in green
        b.append(edge(x1, y1 - 17, x2, y2 + 19, GREEN if g else LINE, marker='upg' if g else 'up'))
    for k, (x, y, label) in N.items():
        if k == 'me': s, _ = node(x, y, label, 90, '#1d4ed8', '#1d4ed8', '#fff')
        elif k == 'author': s, _ = node(x, y, label, None, '#fef3c7', '#d97706')
        elif k in ('qadi', 'ghazi'): s, _ = node(x, y, label, None, '#ffedd5', ORANGE)
        else: s, _ = node(x, y, label)
        b.append(s)
    b += [
        tag(350, 612, 'كلاهما سمع من وهب', GREEN),
        tag(690, 614, 'وعن شريح، كلاهما عن عامر', GREEN),
        tag(150, 425, 'ح الأولى: ينتظر طريق عمار', ORANGE),
        tag(790, 275, 'ح الثانية: ينتظر طريق هند', ORANGE),
        tag(785, 200, 'بعد المؤلف لا ح: ويرويه أيضاً هاشم، عن إدريس', BLUE),
    ]
    # legend
    b.append(text(980, 925, 'الأخضر يُجمع بكلاهما دون ح، والبرتقالي ملتقى يقف عنده الطريق الأول بـ ح ويكمل الأخير.', 13.5, MUTED, anchor='end'))
    b.append(text(980, 945, 'كل اتصال يُكتب مرة واحدة.', 13.5, MUTED, anchor='end'))
    return svg(1000, 955, '\n'.join(b))

# ── 3. «بسنده المتقدم» ──
def refer():
    b = []
    panels = [
        (830, 'سهل: لا أحد من عنده', [('me', 'أنا', 0, 290), ('t', 'زياد', -60, 220), ('x', 'سهل', 0, 150), ('up', 'المؤلف', 0, 80)],
         [('me', 't', False), ('t', 'x', False), ('x', 'up', False), ('me', 'x', True)],
         ['وأرويه أيضاً سماعاً من شيخنا', 'سهل بسنده المتقدم'], GREEN),
        (500, 'عطاء: واحد من عنده', [('me', 'أنا', 0, 290), ('t', 'زياد', -70, 220), ('b', 'عطاء', 70, 220), ('x', 'وهب', 0, 150), ('up', 'المؤلف', 0, 80)],
         [('me', 't', False), ('t', 'x', False), ('x', 'up', False), ('me', 'b', True), ('b', 'x', True)],
         ['وأرويه أيضاً عن شيخنا عطاء', 'عن وهب بسنده المتقدم'], GREEN),
        (170, 'هند: سلسلة من عندها', [('me', 'أنا', 0, 290), ('t', 'عمار', -70, 220), ('n', 'هند', 70, 220), ('c', 'عشرة رواة', 70, 150), ('x', 'قاسم', 0, 80)],
         [('me', 't', False), ('t', 'x', False), ('me', 'n', False), ('n', 'c', False), ('c', 'x', False)],
         ['فرع من التحويل: يقف الأول', 'عند قاسم بـ ح ويكمل الأخير'], ORANGE),
    ]
    for cx, title, nodes, edges, out, color in panels:
        b.append(f'<rect x="{cx - 155}" y="20" width="310" height="400" rx="14" fill="#f8fafc" stroke="#e5e7eb"/>')
        b.append(text(cx, 50, title, 17, INK, 'bold'))
        pos = {k: (cx + dx, y + 20) for k, _, dx, y in nodes}
        for a, c, dashed in edges:
            (x1, y1), (x2, y2) = pos[a], pos[c]
            b.append(edge(x1, y1 - 17, x2, y2 + 19, PURPLE if dashed else LINE, dashed))
        for k, label, dx, y in nodes:
            fill, stroke, col = ('#1d4ed8', '#1d4ed8', '#fff') if k == 'me' else ('#f3f4f6', '#d1d5db', INK)
            s, _ = node(cx + dx, y + 20, label, None, fill, stroke, col)
            b.append(s)
        b.append(f'<rect x="{cx - 140}" y="345" width="280" height="62" rx="10" fill="{color}" fill-opacity=".08" stroke="{color}"/>')
        b.append(text(cx, 370, out[0], 14.5, color, 'bold'))
        b.append(text(cx, 395, out[1], 14.5, color, 'bold'))
    b.append(text(980, 445, 'المتقطّع البنفسجي طريقي الذي لا يُعاد. شخص واحد من عنده أو لا أحد: بسنده المتقدم في آخر الإسناد، وأكثر: فرع تحويل.', 13.5, MUTED, anchor='end'))
    return svg(1000, 465, '\n'.join(b))

for name, fn in [('pipeline', pipeline), ('isnad-network', network), ('bisanadihi', refer)]:
    open(os.path.join(OUT, f'{name}.svg'), 'w', encoding='utf-8').write(fn())
print('ok')
