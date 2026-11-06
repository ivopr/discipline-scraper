import disciplines from "@/data/disciplines.json";
import List from "./List";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Disciplinas isoladas</h1>
        <p className="mt-1 max-w-prose text-muted-foreground">Editais de aluno especial em pós-graduação, com prazo e modalidade. Atualizado duas vezes ao dia.</p>
      </header>
      <List items={disciplines} />
    </main>
  );
}
