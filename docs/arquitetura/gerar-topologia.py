"""Gera o diagrama de topologia do Veridit (T3) no estilo das figuras do livro
Fundamentals of Software Architecture (caixas azuis com extrusão, banco em cilindro)."""
import html, sys

W, H = 1600, 790
LIGHT = "#B5D6EE"   # caixa externa (serviço)
MID = "#6FB0DF"     # caixa interna / faixa
DARK = "#1271BA"    # cilindro
DARK_TOP = "#4E9BD5"
INK = "#111"
SW = 2.4
D = 10              # profundidade da extrusão
FONT = "'TeX Gyre Heros Cn', 'DejaVu Sans Condensed', sans-serif"
SERIF = "'TeX Gyre Pagella', 'Lora', serif"

out = []
def a(s): out.append(s)
def esc(t): return html.escape(t)

def text(x, y, t, size=18, weight="normal", fill=INK, anchor="middle", style="normal", family=FONT):
    a(f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
      f'font-style="{style}" fill="{fill}" text-anchor="{anchor}" dominant-baseline="middle">{esc(t)}</text>')

def box3d(x, y, w, h, fill=LIGHT, d=D, dash=None):
    st = f'stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"'
    if dash: st += f' stroke-dasharray="{dash}"'
    a(f'<polygon points="{x},{y} {x+d},{y-d} {x+w+d},{y-d} {x+w},{y}" fill="{fill}" {st}/>')
    a(f'<polygon points="{x+w},{y} {x+w+d},{y-d} {x+w+d},{y+h-d} {x+w},{y+h}" fill="{fill}" {st}/>')
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" {st}/>')

def pill(cx, y, w, t, h=34):
    a(f'<rect x="{cx-w/2}" y="{y}" width="{w}" height="{h}" rx="9" fill="#fff" stroke="{INK}" stroke-width="2"/>')
    text(cx, y + h/2 + 1, t, 18)

def arrow(x1, y1, x2, y2, dashed=False, both=False):
    dash = ' stroke-dasharray="2 6" stroke-linecap="round"' if dashed else ''
    me = ' marker-start="url(#ah-s)"' if both else ''
    a(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" stroke-width="{SW}"{dash}{me} marker-end="url(#ah)"/>')

def cylinder(x, y, w, h, ry):
    a(f'<path d="M{x},{y} L{x},{y+h} A{w/2},{ry} 0 0 0 {x+w},{y+h} L{x+w},{y} Z" fill="{DARK}" stroke="#0B4F86" stroke-width="2.4"/>')
    a(f'<ellipse cx="{x+w/2}" cy="{y}" rx="{w/2}" ry="{ry}" fill="{DARK_TOP}" stroke="#0B4F86" stroke-width="2.4"/>')

def queue(x, y, w, h=26):
    # tubo horizontal (fila), extremidade aberta à direita, como no livro
    r = h/2
    a(f'<path d="M{x+r},{y} L{x+w},{y} L{x+w},{y+h} L{x+r},{y+h} A{r/2},{r} 0 0 1 {x+r},{y} Z" fill="{DARK}" stroke="#0B3F6E" stroke-width="2.2"/>')
    a(f'<ellipse cx="{x+w}" cy="{y+r}" rx="{r/2.2}" ry="{r}" fill="#fff" stroke="#0B3F6E" stroke-width="2.2"/>')
    # seta cinza indicando o sentido
    a(f'<line x1="{x+4}" y1="{y-12}" x2="{x+w-6}" y2="{y-12}" stroke="#8a8a8a" stroke-width="3" marker-end="url(#ahg)"/>')

a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
a('<defs>'
  f'<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker>'
  f'<marker id="ah-s" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker>'
  '<marker id="ahg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8a8a8a"/></marker>'
  '</defs>')
a(f'<rect width="{W}" height="{H}" fill="#fff"/>')
# moldura fina, como as figuras do livro
a(f'<rect x="1" y="1" width="{W-2}" height="732" fill="none" stroke="#9a9a9a" stroke-width="1.5"/>')

# ---------- Navegador ----------
box3d(440, 26, 400, 50)
text(640, 52, "Navegador · interface web em React", 22, "bold")
arrow(640, 76, 640, 104)

# ---------- Nginx ----------
box3d(20, 110, 1240, 56, fill=MID)
text(640, 130, "Nginx :8080 · proxy reverso", 22, "bold")
text(640, 152, "serve o front-end e só as rotas públicas; /api/internal responde 404", 16)

# ---------- Serviços ----------
SY, SH = 212, 228
servicos = {
    "contas":    (20, 210, "Contas", "contas-api :3001", ["Cadastro", "Login e logout (JWT)", "Cifragem do CPF"]),
    "creditos":  (260, 210, "Créditos e Pagamentos", "creditos-api :3002", ["Carteira", "Reserva de crédito", "Efetivar e liberar"]),
    "relatorios":(1050, 210, "Registros e Relatórios", "relatorios-api :3005", ["Conclusão", "Lista de registros", "Detalhe do registro"]),
    "evidencia": (1290, 260, "Evidência", "evidencia-api :3004", ["Hash SHA-256", "Carimbo do tempo", "Trilha de auditoria"]),
}
for k, (x, w, t, sub, comps) in servicos.items():
    box3d(x, SY, w, SH)
    text(x + w/2, SY + 26, t, 22 if len(t) < 16 else 20, "bold")
    text(x + w/2, SY + 48, sub, 15, fill="#1d3b55")
    for i, c in enumerate(comps):
        pill(x + w/2, SY + 66 + i*48, w - 30, c)

# Registro e Captura: um serviço, duas unidades de implantação
RX, RW = 500, 520
box3d(RX, SY, RW, SH)
text(RX + RW/2, SY + 26, "Registro e Captura", 22, "bold")
text(RX + RW/2, SY + 48, "um serviço, duas unidades de implantação", 15, fill="#1d3b55")
inner = [(515, "registro-api :3003", ["Pedido de registro", "Validação de URL", "Publica na fila"]),
         (830, "captura-worker", ["Captura (Playwright)", "Bloqueio de SSRF", "Reconciliação"])]
IY, IH = SY + 62, 158
for x, t, comps in inner:
    a(f'<rect x="{x}" y="{IY}" width="175" height="{IH}" fill="{MID}" stroke="{INK}" stroke-width="{SW}"/>')
    text(x + 87.5, IY + 18, t, 17, "bold")
    for i, c in enumerate(comps):
        pill(x + 87.5, IY + 36 + i*40, 155, c, h=32)
queue(714, IY + 78, 92)
text(760, IY + 44, "fila captura", 16, "bold")
text(760, IY + 128, "SQS (ElasticMQ)", 14)
text(760, IY + 146, "DLQ após 3 falhas", 14)

# Nginx -> serviços públicos
for cx, top in [(125, SY), (365, SY), (602, IY), (1155, SY)]:
    arrow(cx, 166, cx, top - 2 if top == SY else top - 2)

# ---------- Armazenamento de objetos e carimbo (direita, no alto) ----------
cylinder(1292, 40, 128, 108, 13)
text(1356, 88, "RustFS", 20, "bold", fill="#fff")
text(1356, 110, "S3 · Object Lock", 14, fill="#fff")
text(1356, 128, "(ADR-006)", 13, fill="#d8ebf8")
box3d(1442, 52, 120, 96, fill="#fff", dash="7 5")
text(1502, 82, "FreeTSA", 20, "bold")
text(1502, 104, "carimbo RFC 3161", 14)
text(1502, 124, "externo (ADR-008)", 13, fill="#444")
arrow(1356, SY - D - 2, 1356, 172)
arrow(1500, SY - D - 2, 1500, 150)

# ---------- HTTP interno (barramento pontilhado) ----------
BUS = 478
a(f'<line x1="20" y1="{BUS}" x2="1562" y2="{BUS}" stroke="{INK}" stroke-width="{SW}" stroke-dasharray="2 6" stroke-linecap="round"/>')
for x in [55, 295, 560, 875, 1085, 1325]:
    arrow(x, SY + SH + 2 if x not in (560, 875) else SY + SH + 2, x, BUS - 3, dashed=True, both=True)
a(f'<rect x="618" y="{BUS-13}" width="246" height="26" fill="#fff"/>')
text(741, BUS + 1, "HTTP interno · /api/internal (ADR-010)", 16, style="italic")

# ---------- PostgreSQL ----------
DBX, DBY, DBW, DBH = 20, 540, 1542, 132
cylinder(DBX, DBY, DBW, DBH, 17)
segs = [(20, 245, "contas"), (245, 485, "creditos"), (485, 1035, "registro"), (1035, 1275, "relatorios"), (1275, 1562, "evidencia")]
for x1, x2, nome in segs:
    text((x1 + x2)/2, DBY + 44, nome, 20, "bold", fill="#fff")
    if x1 > 20:
        a(f'<line x1="{x1}" y1="{DBY+26}" x2="{x1}" y2="{DBY+62}" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>')
text(DBX + DBW/2, DBY + 88, "PostgreSQL 16 · uma instância, um esquema por serviço", 22, "bold", fill="#fff")
text(DBX + DBW/2, DBY + 112, "+ esquema compartilhado: tokens revogados e trilha de auditoria", 16, fill="#d8ebf8")
for x in [150, 390, 960, 1180, 1440]:
    arrow(x, SY + SH + 2, x, DBY - 19)

# ---------- legenda ----------
LY = 708
a(f'<line x1="30" y1="{LY}" x2="80" y2="{LY}" stroke="{INK}" stroke-width="{SW}" marker-end="url(#ah)"/>')
text(90, LY + 1, "HTTP público ou acesso ao banco", 15, anchor="start")
a(f'<line x1="330" y1="{LY}" x2="380" y2="{LY}" stroke="{INK}" stroke-width="{SW}" stroke-dasharray="2 6" stroke-linecap="round"/>')
text(390, LY + 1, "HTTP interno, só na rede do Docker", 15, anchor="start")
a(f'<rect x="650" y="{LY-9}" width="44" height="18" fill="#fff" stroke="{INK}" stroke-width="2" stroke-dasharray="6 4"/>')
text(704, LY + 1, "serviço externo", 15, anchor="start")
a(f'<rect x="830" y="{LY-10}" width="44" height="20" rx="6" fill="#fff" stroke="{INK}" stroke-width="2"/>')
text(884, LY + 1, "componente", 15, anchor="start")
text(1562, LY + 1, "Notificações, o 6º serviço do Grupo 4, ficou fora deste sprint", 15, anchor="end", style="italic", fill="#444")

# ---------- legenda da figura (estilo do livro) ----------
text(2, 762, "Figura 1. Topologia do Veridit no Trabalho III: estilo baseado em serviços (ADR-005) sobre infraestrutura local (ADR-006)",
     22, style="italic", anchor="start", family=SERIF)

a('</svg>')
open(sys.argv[1], "w").write("\n".join(out))
