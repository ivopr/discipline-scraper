import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-barlow" });
const condensed = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-barlow-condensed" });

export const metadata = {
  title: "Disciplinas PGBCS",
  description: "Editais de aluno especial em pós-graduação: o que está aberto, até quando e onde se inscrever.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`dark ${barlow.variable} ${condensed.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
