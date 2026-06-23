#!/usr/bin/env node
/**
 * Render: Internal DATABASE_URL usa host curto "dpg-xxx-a", que muitas vezes NÃO resolve
 * dentro do container Docker do Web Service se o Postgres não estiver linkado ao serviço.
 * Expande para o hostname público da região Oregon + sslmode=require.
 *
 * Se já for URL externa (hostname com "." além do formato curto) ou outro host, não altera.
 */
const raw = process.env["DATABASE_URL"];
if (!raw || typeof raw !== "string") {
	process.stdout.write(raw ?? "");
	process.exit(0);
}

try {
	const url = new URL(raw);
	const h = url.hostname;
	const shortRenderPg = /^dpg-[a-z0-9]+-a$/i.test(h);
	if (shortRenderPg) {
		url.hostname = `${h}.oregon-postgres.render.com`;
		if (!url.searchParams.has("sslmode")) {
			url.searchParams.set("sslmode", "require");
		}
		process.stderr.write(
			"[normalize-db-url] Internal host curto detectado → usando endpoint Oregon + SSL.\n",
		);
	}

	// Neon pooler: Prisma Client em runtime — recomendado pgbouncer=true
	if (h.includes("-pooler") && !url.searchParams.has("pgbouncer")) {
		url.searchParams.set("pgbouncer", "true");
	}

	process.stdout.write(url.toString());
} catch {
	process.stdout.write(raw);
}
