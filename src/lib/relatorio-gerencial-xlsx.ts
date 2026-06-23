import ExcelJS from "exceljs";
import type { RelatorioGerencialResponse } from "../types/relatorio-gerencial.js";
import { formatHorasDecimalAsHhmm } from "./relatorio-gerencial-horas.js";

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
}

export async function buildRelatorioGerencialWorkbook(
  data: RelatorioGerencialResponse,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Linq Relatórios";
  workbook.created = new Date();

  switch (data.tipo) {
    case "resumo-cliente": {
      const sheet = workbook.addWorksheet("Resumo por Cliente");
      sheet.columns = [
        { header: "Cliente ID", key: "clienteId", width: 12 },
        { header: "Cliente", key: "clienteNome", width: 36 },
        { header: "Total Visitas", key: "totalVisitas", width: 14 },
        { header: "Total Horas", key: "totalHoras", width: 14 },
        { header: "Total Horas (HH:mm)", key: "totalHorasHhmm", width: 18 },
        { header: "Setores Visitados", key: "totalSetoresVisitados", width: 18 },
        { header: "Período", key: "periodo", width: 12 },
      ];
      styleHeaderRow(sheet.getRow(1));

      for (const item of data.itens) {
        sheet.addRow({
          ...item,
          totalHorasHhmm: formatHorasDecimalAsHhmm(item.totalHoras),
        });
      }
      break;
    }
    case "produtividade-tecnico": {
      const sheet = workbook.addWorksheet("Produtividade");
      sheet.columns = [
        { header: "Técnico", key: "tecnicoNome", width: 32 },
        { header: "Total Visitas", key: "totalVisitas", width: 14 },
        { header: "Total Horas", key: "totalHoras", width: 14 },
        { header: "Total Horas (HH:mm)", key: "totalHorasHhmm", width: 18 },
        { header: "Clientes Atendidos", key: "clientesAtendidos", width: 18 },
        { header: "Período", key: "periodo", width: 12 },
      ];
      styleHeaderRow(sheet.getRow(1));

      for (const item of data.itens) {
        sheet.addRow({
          ...item,
          totalHorasHhmm: formatHorasDecimalAsHhmm(item.totalHoras),
        });
      }
      break;
    }
    case "sla-contratos": {
      const sheet = workbook.addWorksheet("SLA Contratos");
      sheet.columns = [
        { header: "Contrato ID", key: "contratoId", width: 14 },
        { header: "Cliente", key: "clienteNome", width: 36 },
        { header: "Visitas Realizadas", key: "visitasRealizadas", width: 18 },
        { header: "Visitas Esperadas", key: "visitasEsperadas", width: 18 },
        { header: "SLA (%)", key: "slaPercentual", width: 12 },
        { header: "Status SLA", key: "slaStatus", width: 14 },
        { header: "Período", key: "periodo", width: 12 },
      ];
      styleHeaderRow(sheet.getRow(1));

      for (const item of data.itens) {
        sheet.addRow(item);
      }
      break;
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
