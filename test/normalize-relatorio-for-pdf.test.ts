import assert from "node:assert/strict";
import { normalizeRelatorioForPdf } from "../src/lib/normalize-relatorio-for-pdf.js";
import {
  formatDateWallClock,
  formatHorarioWallClock,
  parseDataVisita,
  parseHorario,
} from "../src/lib/horario-datetime.js";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

const dataVisita = parseDataVisita("2026-06-19");
const relatorio = normalizeRelatorioForPdf({
  id: 11,
  dataVisita,
  observacoes: null,
  cliente: { nomeFantasia: "Borderless", cidade: "Porto Alegre", estado: "RS" },
  contato: { nome: "Pedro", cargo: "Gerente TI" },
  criadoPor: { nome: "Tecnico" },
  tecnicos: [{ nome: "Tecnico" }],
  setores: [],
  horarios: [
    {
      horaChegada: parseHorario("2026-06-19", "08:00"),
      horaSaida: parseHorario("2026-06-19", "12:00"),
    },
    {
      horaChegada: parseHorario("2026-06-19", "08:00"),
      horaSaida: parseHorario("2026-06-19", "12:00"),
    },
  ],
});

assert.equal(formatDateWallClock(toDate(relatorio.dataVisita)), "19/06/2026");
assert.equal(
  formatHorarioWallClock(toDate(relatorio.horarios[0]!.horaChegada)),
  "08:00",
);
assert.equal(
  formatHorarioWallClock(toDate(relatorio.horarios[0]!.horaSaida)),
  "12:00",
);

console.log("normalize-relatorio-for-pdf tests OK");
