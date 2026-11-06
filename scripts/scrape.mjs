// Scrapes graduate "aluno especial" editais (PDF) + PGBCS/IOC academic calendar -> data/disciplines.json (generated).
// Run: npm run scrape   (certs/rnp-intermediate.pem: Fiocruz server omits its intermediate cert)
// ponytail: editais come from SEEDS (crawled) + EDITAIS (fixed URLs); regex parsers, any miss -> null, never a guess.
import { PDFParse } from "pdf-parse";
import fs from "node:fs";

// fetch with 2 retries: Brazilian university servers time out now and then
const get = async (u, o = {}) => {
  for (let i = 0; ; i++) {
    try { return await fetch(u, { signal: AbortSignal.timeout(20000), ...o }); } catch (e) { if (i >= 2) throw e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
};
const pool = async (items, n, fn) => { // run fn over items, n at a time
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).then((value) => ({ value }), (reason) => ({ reason })); } }));
  return out;
};

const OUT = new URL("../data/disciplines.json", import.meta.url);
const BASE = "https://pgbcs.ioc.fiocruz.br";

// Add each new semester's edital here. Find them on the program site ("aluno especial" / "disciplinas isoladas").
export const EDITAIS = []; // optional hand-added { institution, url } PDFs that crawling cannot reach

// Program pages crawled for new editais on every run (no PDF URL needed). Add a page once; later semesters are found automatically.
export const SEEDS = [
  { institution: "UFRGS – PPGC", url: "https://www.inf.ufrgs.br/ppgc/" },
  { institution: "UFPel – PPGC", url: "https://wp.ufpel.edu.br/computacao/" },
  { institution: "FURG – PPGComp", url: "https://ppgcomp.furg.br/" },
  { institution: "UFG – PPGCC", url: "https://ppgcc.inf.ufg.br/" },
  { institution: "UFES – PPGI", url: "https://informatica.ufes.br/pt-br/pos-graduacao/PPGI" },
  { institution: "UEPG – Computação Aplicada", url: "https://www2.uepg.br/computacaoaplicada/" },
  { institution: "UFG – PPGGMP (Genética e Biologia Molecular)", url: "https://ppggmp.ufg.br/" },
  { institution: "UFMG – Bioinformática", url: "https://www.pgbioinfo.icb.ufmg.br/" },
  { institution: "UFMG – PPGCC", url: "https://ppgcc.dcc.ufmg.br/" }, // offers "Introdução à Programação de GPUs" to external students
];
const EDITAL_LINK = /aluno.{0,3}especial|alunos.{0,3}especiais|disciplinas?.{0,3}isoladas?|aluno.{0,3}externo|estudantes?.{0,3}especiais?/i;

// Project topics: GPU computing + peptide docking.
const TOPIC = /\b(GPU|CUDA|docking|alto desempenho|paralel[oa]s?|modelagem molecular|bioinform\w*|pept[ií]de?\w*)/i;

const MONTHS = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(" ");
const iso = (d, m, y) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function parseWindow(text) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/inscri/i.test(lines[i])) continue;
    const num = [...lines[i].matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
    if (num.length >= 2) return { regStart: iso(num[0][1], num[0][2], num[0][3]), regEnd: iso(num.at(-1)[1], num.at(-1)[2], num.at(-1)[3]) };
    const t = (lines[i] + " " + (lines[i + 1] ?? "")).toLowerCase();
    const m = t.match(/(\d{1,2}) de (\p{L}+)(?: de (\d{4}))? (?:até|a|à) (\d{1,2}) de (\p{L}+) de (\d{4})/u);
    if (m && MONTHS.includes(m[2]) && MONTHS.includes(m[5]))
      return { regStart: iso(m[1], MONTHS.indexOf(m[2]) + 1, m[3] ?? m[6]), regEnd: iso(m[4], MONTHS.indexOf(m[5]) + 1, m[6]) };
  }
  // fallback: dates sit on neighbouring lines, year may appear only on the last date
  for (let i = 0; i < lines.length; i++) {
    if (!/per[ií]odo de inscri|no per[ií]odo\b/i.test(lines[i])) continue;
    const d = [...lines.slice(Math.max(0, i - 2), i + 2).join(" ").matchAll(/(\d{2})\/(\d{2})(?!\d)(?:\/(\d{4}))?/g)];
    if (d.length < 2) continue;
    const y = d.find((m) => m[3])?.[3];
    if (y) return { regStart: iso(d[0][1], d[0][2], d[0][3] ?? y), regEnd: iso(d[1][1], d[1][2], d[1][3] ?? y) };
  }
  return { regStart: null, regEnd: null };
}

// Enrollment ("matrícula") dates of selected students: first line mentioning matrícula that carries dates.
// Handles "03/08/2026 à 04/08/2026", "05 a 10/08/2026", "12 a 14 de agosto de 2026", "17 de março de 2026". Lines about regular students/diplomas are skipped.
export function parseEnrollment(text) {
  const none = { enrollStart: null, enrollEnd: null };
  for (const l of text.split("\n")) {
    if (!/matr[ií]cula/i.test(l) || /regulares|efetiva[cç][aã]o|diploma/i.test(l)) continue;
    let m;
    if ((m = l.match(/(?<![\d/])(\d{1,2}) (?:a|à|até) (\d{1,2})\/(\d{2})\/(\d{4})/))) return { enrollStart: iso(m[1], m[3], m[4]), enrollEnd: iso(m[2], m[3], m[4]) };
    if ((m = l.match(/(?<![\d/])(\d{1,2}) (?:a|à|até) (\d{1,2}) de (\p{L}+) de (\d{4})/u)) && MONTHS.includes(m[3])) return { enrollStart: iso(m[1], MONTHS.indexOf(m[3]) + 1, m[4]), enrollEnd: iso(m[2], MONTHS.indexOf(m[3]) + 1, m[4]) };
    const n = [...l.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
    if (n.length) return { enrollStart: iso(n[0][1], n[0][2], n[0][3]), enrollEnd: iso(n.at(-1)[1], n.at(-1)[2], n.at(-1)[3]) };
    if ((m = l.match(/(?<![\d/])(\d{1,2}) de (\p{L}+)(?: de)+ (\d{4})/u)) && MONTHS.includes(m[2])) { const d = iso(m[1], MONTHS.indexOf(m[2]) + 1, m[3]); return { enrollStart: d, enrollEnd: d }; }
  }
  return none;
}

// PGBCS calendar: "A partir de dd/mm/yyyy  Confirmação de Matrícula em Disciplina para alunos externos SIEF"
export function parseExternalEnrollment(text, who = "externos") {
  const m = text.match(new RegExp(`(\\d{2})/(\\d{2})/(\\d{4})\\s*\tConfirmação de Matrícula em Disciplina para alunos\\s+${who}`));
  const d = m ? iso(m[1], m[2], m[3]) : null;
  return { enrollStart: d, enrollEnd: d };
}

// true/false only on explicit statements about class format; otherwise null (unknown).
export function parseRemote(text) {
  const t = text.replace(/\s+/g, " ");
  if (/em formato presencial|formato: ?presencial|modalidade presencial/i.test(t)) return false;
  if (/formato: ?(remoto|online|a distância|EaD)|ensino remoto|totalmente (remot|a distância|online)|modalidade (remota|EaD|a distância)/i.test(t)) return true;
  return null;
}

export const topicLines = (text) => [...new Set(text.split("\n").map((l) => l.trim()).filter((l) => l.length < 90 && TOPIC.test(l)))].slice(0, 6);

async function pdfText(url) {
  const r = await get(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return (await new PDFParse({ data: Buffer.from(await r.arrayBuffer()) }).getText()).text;
}

const links = (html, base) => [...html.matchAll(/<a [^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map((m) => { try { return [new URL(m[1].replace(/&amp;/g, "&"), base).href, m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()]; } catch { return null; } })
  .filter(Boolean);

const NAV = /edital|editais|sele[cç][aã]o|seletivo|aluno|especia|isolad|ingress|matr[ií]cula/i; // menu links worth following
const isPdf = (h) => /\.pdf($|\?)/i.test(h);
const NOT_EDITAL = /resultado|homolog|lista|retifica|cancel|formul[aá]rio|requerimento|\bform\b|recurso|ata\b/i;
const stale = (x) => /20(0\d|1\d|2[0-5])/.test(x) && !/202[67]/.test(x); // mentions only past years (e.g. 2023)

// Crawl a program site from its home page (same host, <=3 levels, <=30 pages) and collect aluno-especial edital PDFs.
export async function discoverEditais({ institution, url }, maxPages = 30) {
  const host = new URL(url).host, seen = new Set([url]), pdfs = new Set();
  const queue = [{ url, depth: 0, ctx: false }];
  for (let n = 0; queue.length && n < maxPages; n++) {
    const { url: u, depth, ctx } = queue.shift();
    let r, html;
    try { r = await get(u); if (!/html/.test(r.headers.get("content-type") ?? "")) continue; html = await r.text(); } catch { continue; } // dead page: skip
    for (const [h, t] of links(html, r.url)) {
      const hit = EDITAL_LINK.test(h + " " + t);
      if (isPdf(h)) { if ((hit || (ctx && /edita[li]|aluno|especia|isolad/i.test(h + " " + t))) && !stale(h + " " + t) && !NOT_EDITAL.test(h + " " + t) && pdfs.size < 25) pdfs.add(h); continue; }
      if (seen.has(h) || depth >= 3 || new URL(h).host !== host || !(hit || NAV.test(h + " " + t))) continue;
      seen.add(h);
      queue[hit ? "unshift" : "push"]({ url: h, depth: depth + 1, ctx: hit || ctx || /edita[li]/i.test(h + " " + t) }); // pages that look like edital pages first
    }
  }
  return [...pdfs].map((u) => ({ institution, url: u, discovered: true }));
}

async function scrapeEdital({ institution, url, discovered }) {
  const text = await pdfText(url);
  if (discovered && !EDITAL_LINK.test(text)) return null; // crawled PDF that never mentions aluno especial: not ours
  return {
    name: `Edital de aluno especial – ${institution}`,
    institution,
    remote: parseRemote(text),
    ...parseWindow(text),
    ...parseEnrollment(text),
    regUrl: url,
    matches: topicLines(text),
    note: "Dados lidos do PDF do edital. Confira o PDF antes de se inscrever.",
    source: "edital",
  };
}

// Calendar rows look like "<dates>\t<activity, may wrap lines>"; split at each line that starts with a date. who: "externos" | "regulares"
export function parseCalendarWindow(text, who = "externos") {
  const row = text.split(/\n(?=\d{2}(?:\/|,))/).find((r) => new RegExp(`Solicitação de Inscrição[^]*alunos\\s+${who}`).test(r));
  if (!row) throw new Error(`${who} row not found: PDF layout changed?`);
  const dates = [...row.split("\t")[0].matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((m) => `${m[3]}-${m[2]}-${m[1]}`);
  return { regStart: dates[0], regEnd: dates.at(-1) };
}
export const parseExternalWindow = (text) => parseCalendarWindow(text, "externos");

// PDFs linked on /disciplinas: one calendar per term, plus (once published) the offering list / enrollment procedure per audience.
export function pgbcsPdfs(html) {
  return [...html.matchAll(/<a [^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, href, t]) => ({ href, text: t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }));
}
export function pgbcsOffer(pdfs, term, who) { // link text e.g. "OFERTA DE DISCIPLINAS 2025.2", "Inscrição em disciplina para alunos REGULARES - 2026.1"
  return pdfs.find((a) => a.text.includes(term) && /oferta|inscri/i.test(a.text) && !(/regulares/i.test(a.text) && who === "externos") && !(/externos/i.test(a.text) && who === "regulares"));
}

async function scrapePgbcs() {
  const pdfs = pgbcsPdfs(await (await get(`${BASE}/disciplinas`)).text());
  const calendars = pdfs.filter((a) => /calend[aá]rio/i.test(a.text) && /\d{4}\.\d/.test(a.text));
  if (!calendars.length) throw new Error("calendar link not found on /disciplinas");
  const perTerm = await Promise.all(calendars.map(async ({ href, text: label }) => {
    const term = label.match(/\d{4}\.\d/)[0], calendar = new URL(href, BASE).href, text = await pdfText(calendar);
    const entry = (who, name, note) => {
      const offer = pgbcsOffer(pdfs, term, who);
      return {
        name: `Disciplinas ${term} (${name})`,
        institution: "Fiocruz – IOC (PGBCS e demais PGs do IOC)",
        remote: null,
        ...parseCalendarWindow(text, who),
        ...parseExternalEnrollment(text, who),
        regUrl: offer ? new URL(offer.href, BASE).href : calendar,
        matches: [],
        note: `Datas do calendário acadêmico. ${note} ${offer ? "O link abre a oferta de disciplinas do semestre." : "A oferta de disciplinas ainda não foi publicada; o link abre o calendário."} Modalidade: confira na oferta.`,
        source: "pgbcs-calendar",
      };
    };
    return [
      entry("externos", "alunos externos", "Inscrição pelo SIEF."),
      entry("regulares", "alunos regulares", "Para alunos dos programas de pós-graduação do IOC; inscrição pelo SIEF."),
    ];
  }));
  return perTerm.flat();
}

// ---- Rede Bionorte (doutorado em rede, Amazônia Legal): offerings per state; modality is written in each offering's notes.
const BIONORTE = "https://bionorte.org.br";
const UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]; // idc = index + 1 on the site
const plain = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<(\/tr|\/p|\/li|\/h\d|br|\/td|\/th|\/div)[^>]*>/g, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*/g, "\n");
const between = (t, a, b) => t.split(a)[1]?.split(b)[0].trim() ?? "";

export function bionorteModality(text) {
  const virtual = /\b(virtual|remoto|on-?line|EaD|a distância)\b/i.test(text), inPerson = /presencial/i.test(text);
  return virtual === inPerson ? null : virtual; // both or neither -> unknown
}

export function classDates(text) {
  const d = [...text.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)].map((m) => iso(m[1], m[2], m[3]));
  return { startDate: d[0] ?? null, endDate: d.at(-1) ?? null }; // "04/08/2026 a 01/12/2026"
}

async function scrapeBionorte() {
  const list = await (await get(`${BIONORTE}/disciplinas/ofertas.html`)).text();
  const periods = [...list.matchAll(/<td>(\d{2}\/\d{4})<\/td>\s*<td[^>]*><a href="[^"]*idp=(\d+)"/g)].slice(0, 2); // newest two terms
  const out = [];
  for (const [, term, idp] of periods) {
    for (const [i, uf] of UFS.entries()) {
      const html = await (await get(`${BIONORTE}/disciplinas/ofertas-periodo.html?idp=${idp}&idc=${i + 1}`)).text();
      for (const [row] of html.matchAll(/<tr><td[\s\S]*?<\/tr>/g)) {
        const [inst, name] = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
        const url = `${BIONORTE}/disciplinas/detalhes-oferta.html?ido=${row.match(/ido=(\d+)/)[1]}`;
        const t = plain(await (await get(url)).text());
        if (/^Tipo\s*\n\s*Obrigat/m.test(t)) continue; // thesis activities, seminars, etc.
        const remote = bionorteModality(between(t, "Observações", "Professores") + " " + between(t, "Horários", "Ementa"));
        if (remote !== true && uf !== "RO") continue; // user rule: remote anywhere, in-person only in Rondônia
        const ementa = between(t, "Ementa", "Bibliográfia");
        out.push({
          name: `${name} (Bionorte ${term})`,
          institution: `${inst} – Rede Bionorte (${uf})`,
          remote,
          inRondonia: uf === "RO",
          regStart: null,
          regEnd: null,
          ...classDates(between(t, "Período das Aulas", "Observações")),
          regUrl: url,
          matches: [...new Set((`${name} ${ementa}`.match(new RegExp(TOPIC.source, "gi")) ?? []).map((x) => x.toLowerCase()))].slice(0, 6),
          note: `Aulas: ${between(t, "Período das Aulas", "Observações")}. ${between(t, "Observações", "Professores")}. Bionorte é doutorado em rede: confirme com a secretaria se aceita aluno de mestrado e como se inscrever (sem janela de inscrição publicada).`,
          source: "bionorte",
        });
      }
    }
  }
  return out;
}

// ---- UTFPR PPGBIOINFO: one HTML page per semester (no PDF): "vai de 09 de julho de 2026 à 27 de julho de 2026".
const UTFPR = "https://www.utfpr.edu.br/cursos/coordenacoes/stricto-sensu/ppgbioinfo-cp/area-academica";

export function parseUtfprWindow(text) {
  const m = text.match(/vai de (\d{1,2}) de (\p{L}+) de (\d{4}) (?:à|a|até) (\d{1,2}) de (\p{L}+) de (\d{4})/u);
  if (!m || !MONTHS.includes(m[2]) || !MONTHS.includes(m[5])) return { regStart: null, regEnd: null };
  return { regStart: iso(m[1], MONTHS.indexOf(m[2]) + 1, m[3]), regEnd: iso(m[4], MONTHS.indexOf(m[5]) + 1, m[6]) };
}

export const utfprCourses = (text) => [...text.matchAll(/PGBIOINFO\d+ (.+?) Prof/g)].map((m) => m[1].trim());

async function scrapeUtfpr() {
  const index = await (await get(`${UTFPR}/aluno-externo`)).text();
  const terms = [...new Set([...index.matchAll(/inscricao-para-alunos-externos-em-(\d{4})-(\d)(?![\d-])/g)].map((m) => m[0]))].sort().slice(-1); // newest semester only
  if (!terms.length) throw new Error("no semester page found on UTFPR aluno-externo");
  const [, year, term] = terms[0].match(/(\d{4})-(\d)/);
  const url = `${UTFPR}/aluno-externo/${terms[0]}`;
  const win = parseUtfprWindow(plain(await (await get(url)).text()).replace(/\s+/g, " "));
  if (!win.regEnd) throw new Error("UTFPR window not found: page layout changed?");
  let courses = [];
  try { courses = utfprCourses(plain(await (await get(`${UTFPR}/disciplinas/cronograma-disciplinas-${year}-${term}`)).text()).replace(/\s+/g, " ")); } catch { /* schedule is optional */ }
  return [{
    name: `Disciplinas isoladas ${year}.${term} (alunos externos)`,
    institution: "UTFPR – PPGBIOINFO",
    remote: null,
    ...win,
    enrollStart: null,
    enrollEnd: null,
    regUrl: url,
    matches: courses.filter((c) => TOPIC.test(c)),
    note: `Seleção depende da aprovação do docente. Disciplinas (híbridas, com encontros presenciais em Cornélio Procópio): ${courses.join("; ") || "veja o cronograma na página"}.`,
    source: "utfpr",
  }];
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
  const out = [], stale = []; // stale: last run's entries for sources that failed now (old data beats none)
  const failed = (what, e, pred) => { console.log("FAIL", what, e?.cause?.code ?? e?.message); stale.push(...prev.filter(pred)); };

  const seeds = await pool(SEEDS, 4, (sd) => discoverEditais(sd));
  const editais = new Map(EDITAIS.map((e) => [e.url, e]));
  seeds.forEach((r, i) => {
    const sd = SEEDS[i], n = r.value?.length ?? 0;
    if (!n) failed(`crawl ${sd.institution} (0 editais)`, r.reason, (d) => d.source === "edital" && d.institution === sd.institution);
    (r.value ?? []).forEach((e) => editais.set(e.url, e));
  });
  console.log(`editais: ${editais.size} PDFs from ${SEEDS.length} seeds`);

  const pdfs = await pool([...editais.values()], 5, async (e) => { const x = await scrapeEdital(e); return x && !(e.discovered && !x.regEnd) ? [x] : []; }); // discovered PDFs without a parsable window are forms
  [...editais.values()].forEach((e, i) => pdfs[i].reason ? failed(e.url.slice(-50), pdfs[i].reason, (d) => d.regUrl === e.url) : out.push(...pdfs[i].value));

  for (const [name, source, job] of [["pgbcs", "pgbcs-calendar", scrapePgbcs], ["bionorte", "bionorte", scrapeBionorte], ["utfpr", "utfpr", scrapeUtfpr]]) {
    try { out.push(...(await job())); } catch (e) { failed(name, e, (d) => d.source === source); }
  }

  const all = [...out, ...stale];
  const uniq = [...new Map(all.map((d) => [d.regEnd && d.source === "edital" ? `${d.institution}|${d.regStart}|${d.regEnd}` : `${d.regUrl}|${d.name}`, d])).values()]; // same edital published at two URLs
  fs.writeFileSync(OUT, JSON.stringify(uniq, null, 2) + "\n");
  console.log(`wrote ${uniq.length} (${stale.length} kept from previous run)`);
}
