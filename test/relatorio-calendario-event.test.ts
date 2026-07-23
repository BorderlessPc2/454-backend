import assert from "node:assert/strict";
import { mapRelatorioToCalendarioEvent } from "../src/services/relatorio-calendario.service.js";

const baseRelatorio = {
  id: 42,
  dataVisita: new Date("2026-07-21T00:00:00.000Z"),
  modalidadeServico: "local",
  impresso: false,
  criadoPorId: 1,
  cliente: { id: 10, nomeFantasia: "Visita" },
  tecnicos: [{ nome: "João" }],
  horarios: [
    {
      horaChegada: new Date("2026-07-21T11:00:00.000Z"),
      horaSaida: new Date("2026-07-21T12:00:00.000Z"),
    },
  ],
} as const;

const agendado = mapRelatorioToCalendarioEvent({
  ...baseRelatorio,
  status: "AGENDADO",
});

assert.equal(agendado.id, "42");
assert.equal(agendado.status, "AGENDADO");
assert.equal(agendado.extendedProps.status, "AGENDADO");
assert.deepEqual(agendado.classNames, ["status-agendado"]);

const cancelado = mapRelatorioToCalendarioEvent({
  ...baseRelatorio,
  status: "CANCELADO",
});

assert.equal(cancelado.status, "CANCELADO");
assert.equal(cancelado.extendedProps.status, "CANCELADO");
assert.deepEqual(cancelado.classNames, [
  "status-cancelado",
  "event-cancelado",
]);

console.log("relatorio-calendario-event tests OK");
