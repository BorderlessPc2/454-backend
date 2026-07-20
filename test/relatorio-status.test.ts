import assert from "node:assert/strict";
import {
  assertTransicaoStatusPermitida,
  getTransicoesPermitidas,
  isRelatorioStatus,
  parseRelatorioStatus,
  parseStatusFilter,
  RelatorioStatusTransitionError,
} from "../src/lib/relatorio-status.js";

assert.equal(isRelatorioStatus("AGENDADO"), true);
assert.equal(isRelatorioStatus("FINALIZADO"), true);
assert.equal(isRelatorioStatus("CANCELADO"), true);
assert.equal(isRelatorioStatus("PENDENTE"), false);
assert.equal(isRelatorioStatus(null), false);

assert.equal(parseRelatorioStatus("FINALIZADO"), "FINALIZADO");
assert.throws(
  () => parseRelatorioStatus("foo"),
  (err: unknown) => err instanceof RelatorioStatusTransitionError,
);

assert.deepEqual(getTransicoesPermitidas("AGENDADO"), [
  "FINALIZADO",
  "CANCELADO",
]);
assert.deepEqual(getTransicoesPermitidas("FINALIZADO"), [
  "CANCELADO",
  "AGENDADO",
]);
assert.deepEqual(getTransicoesPermitidas("CANCELADO"), ["AGENDADO"]);

assert.doesNotThrow(() =>
  assertTransicaoStatusPermitida("AGENDADO", "FINALIZADO"),
);
assert.doesNotThrow(() =>
  assertTransicaoStatusPermitida("AGENDADO", "CANCELADO"),
);
assert.doesNotThrow(() =>
  assertTransicaoStatusPermitida("FINALIZADO", "CANCELADO"),
);
assert.doesNotThrow(() =>
  assertTransicaoStatusPermitida("FINALIZADO", "AGENDADO"),
);
assert.doesNotThrow(() =>
  assertTransicaoStatusPermitida("CANCELADO", "AGENDADO"),
);

assert.throws(
  () => assertTransicaoStatusPermitida("AGENDADO", "AGENDADO"),
  (err: unknown) =>
    err instanceof RelatorioStatusTransitionError &&
    err.message.includes("já está"),
);

assert.throws(
  () => assertTransicaoStatusPermitida("CANCELADO", "FINALIZADO"),
  (err: unknown) =>
    err instanceof RelatorioStatusTransitionError &&
    err.message.includes("não é permitida"),
);

assert.deepEqual(parseStatusFilter(undefined), undefined);
assert.deepEqual(parseStatusFilter("AGENDADO"), ["AGENDADO"]);
assert.deepEqual(parseStatusFilter("AGENDADO,FINALIZADO"), [
  "AGENDADO",
  "FINALIZADO",
]);
assert.deepEqual(parseStatusFilter(["CANCELADO", "AGENDADO"]), [
  "CANCELADO",
  "AGENDADO",
]);
assert.deepEqual(parseStatusFilter(["AGENDADO,FINALIZADO"]), [
  "AGENDADO",
  "FINALIZADO",
]);
assert.throws(
  () => parseStatusFilter("INVALIDO"),
  (err: unknown) => err instanceof RelatorioStatusTransitionError,
);

console.log("relatorio-status tests OK");
