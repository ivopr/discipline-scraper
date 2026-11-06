"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const today = () => new Date().toLocaleDateString("sv", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

function status(d, now) {
  if (!d.regEnd && d.endDate) return d.startDate && now < d.startDate ? "classSoon" : "classOn"; // class period only (Bionorte)
  if (!d.regEnd) return "unknown";
  if (now > d.regEnd) return "closed";
  return d.regStart && now < d.regStart ? "soon" : "open";
}

const LABEL = { open: "Aberta", soon: "Em breve", closed: "Encerrada", unknown: "Sem datas", classOn: "Aulas em curso", classSoon: "Aulas em breve" };
const TONE = { open: "text-open border-open/50 bg-open/10", soon: "text-soon border-soon/50 bg-soon/10" };
const SORTS = { relevance: "Relevância", deadline: "Prazo", institution: "Instituição" };

const DAY = 864e5;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const br = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "—");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function deadline(d, s, now) {
  if (s === "open") {
    const n = daysBetween(now, d.regEnd);
    return { main: n === 0 ? "Último dia" : plural(n, "dia"), sub: `até ${br(d.regEnd)}`, urgent: n <= 3 };
  }
  if (s === "soon") return { main: br(d.regStart), sub: `até ${br(d.regEnd)}` };
  if (d.endDate) return { main: `até ${br(d.endDate)}`, sub: `início ${br(d.startDate)}` };
  return { main: "—", sub: "datas não informadas" };
}

function Row({ d, s, now }) {
  const dl = deadline(d, s, now);
  const mode = d.remote === true ? "Remota" : d.remote === false ? "Presencial" : "Modalidade ?";
  return (
    <li className="border-b border-border last:border-b-0">
      <Collapsible>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-3 py-3 sm:grid-cols-[8.5rem_1fr_7.5rem_auto] sm:px-4">
          <Badge variant="outline" className={`sm:col-start-1 sm:row-start-1 h-6 w-fit rounded-md px-2 text-sm font-semibold ${TONE[s] ?? "text-muted-foreground"}`}>{LABEL[s]}</Badge>
          <div className="text-right font-heading sm:col-start-3 sm:row-start-1 sm:text-left">
            <p className={`text-lg leading-none font-semibold ${dl.urgent ? "text-soon" : ""}`}>{dl.main}</p>
            <p className="mt-0.5 font-sans text-xs text-muted-foreground">{dl.sub}</p>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <p className="font-medium sm:truncate" title={d.name}>{d.name}</p>
            <p className="text-sm sm:truncate text-muted-foreground">
              {d.institution} · {mode}{d.inRondonia ? " · Rondônia" : ""}
            </p>
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1 sm:col-start-4 sm:row-start-1">
            <CollapsibleTrigger render={<Button variant="ghost" size="icon" aria-label="Detalhes" className="group" />}>
              <ChevronDown className="transition-transform group-aria-expanded:rotate-180" />
            </CollapsibleTrigger>
            <Button size="sm" nativeButton={false} render={<a href={d.regUrl} target="_blank" rel="noreferrer" />}>
              Edital <ExternalLink data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className="space-y-2 px-4 pb-4 text-sm sm:pl-[10.5rem]">
            {d.matches.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">Temas:</span>
                {d.matches.map((m) => <Badge key={m} variant="secondary">{m}</Badge>)}
              </p>
            )}
            <p className="text-muted-foreground">
              Inscrição: {d.regStart ? `${br(d.regStart)} a ${br(d.regEnd)}` : d.regEnd ? `até ${br(d.regEnd)}` : "não informada"}
              {d.enrollStart ? ` · Matrícula: ${d.enrollEnd && d.enrollEnd !== d.enrollStart ? `${br(d.enrollStart)} a ${br(d.enrollEnd)}` : br(d.enrollStart)}` : ""}
              {d.endDate ? ` · Aulas: ${br(d.startDate)} a ${br(d.endDate)}` : ""}
            </p>
            {d.note && <p>{d.note}</p>}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function Toggle({ id, checked, onChange, children }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      {children}
    </label>
  );
}

export default function List({ items }) {
  const [now, setNow] = useState(null);
  useEffect(() => setNow(today()), []); // date only on client: prerender can't read the clock
  const [q, setQ] = useState("");
  const [inst, setInst] = useState(null);
  const [sort, setSort] = useState("relevance");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyRemote, setOnlyRemote] = useState(true);
  const [onlyTopic, setOnlyTopic] = useState(false);

  const institutions = useMemo(() => [...new Set(items.map((d) => d.institution))].sort((a, b) => a.localeCompare(b, "pt")), [items]);

  if (!now) return null;

  const shown = items.filter((d) => {
    const s = status(d, now);
    if ((d.regEnd ?? d.endDate ?? "9999") < now) return false; // already over: never show
    if (onlyOpen && s !== "open") return false;
    if (onlyRemote && d.remote !== true && !d.inRondonia) return false;
    if (onlyTopic && !d.matches.length) return false;
    if (inst && d.institution !== inst) return false;
    return `${d.name} ${d.institution} ${d.matches.join(" ")}`.toLowerCase().includes(q.toLowerCase());
  }).sort((a, b) => {
    if (sort === "deadline") return (a.regEnd ?? "9999").localeCompare(b.regEnd ?? "9999");
    if (sort === "institution") return a.institution.localeCompare(b.institution, "pt");
    return b.matches.length - a.matches.length;
  });

  return (
    <section aria-label="Editais">
      <div className="mb-4 space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Buscar disciplina ou tema" aria-label="Buscar" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Combobox items={institutions} value={inst} onValueChange={setInst}>
            <ComboboxInput placeholder="Todas as instituições" aria-label="Instituição" showClear className="w-full sm:w-64" />
            <ComboboxContent>
              <ComboboxEmpty>Nenhuma instituição encontrada.</ComboboxEmpty>
              <ComboboxList>{(i) => <ComboboxItem key={i} value={i}>{i}</ComboboxItem>}</ComboboxList>
            </ComboboxContent>
          </Combobox>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Ordenar" className="w-full sm:w-40"><SelectValue>{SORTS[sort]}</SelectValue></SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Toggle id="f-open" checked={onlyOpen} onChange={setOnlyOpen}>Só abertas</Toggle>
          <Toggle id="f-topic" checked={onlyTopic} onChange={setOnlyTopic}>Só GPU / docking</Toggle>
          <Toggle id="f-remote" checked={onlyRemote} onChange={setOnlyRemote}>Remotas ou em Rondônia</Toggle>
        </div>
      </div>

      <p className="mb-2 px-1 text-sm text-muted-foreground" aria-live="polite">{shown.length} de {items.length} editais</p>

      {shown.length ? (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((d) => <Row key={d.name + d.institution} d={d} s={status(d, now)} now={now} />)}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">Nenhum edital com esses filtros.</p>
          <p className="mt-1 text-sm text-muted-foreground">Desligue “Remotas ou em Rondônia” para ver editais com modalidade não informada.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setQ(""); setInst(null); setOnlyOpen(false); setOnlyTopic(false); setOnlyRemote(false); }}>Limpar filtros</Button>
        </div>
      )}
    </section>
  );
}
