import assert from "node:assert/strict";
import { formatModalidadeShort } from "../src/lib/calendario-datetime.js";

function assertLabel(input: string | null | undefined, expected: string) {
  assert.equal(formatModalidadeShort(input), expected);
}

assertLabel("local", "Local");
assertLabel("remoto", "Remoto");
assertLabel("Contrato - local", "Local");
assertLabel("Sem contrato - remoto", "Remoto");
assertLabel(null, "N/A");
assertLabel(undefined, "N/A");

console.log("modalidade-local-remoto tests OK");
