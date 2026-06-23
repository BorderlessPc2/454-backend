#!/usr/bin/env node
/**
 * Prisma Migrate precisa de conexão DIRETA ao Postgres (advisory locks).
 * Neon/Supabase pooler (-pooler / PgBouncer) causa P1002 em `migrate deploy`.
 *
 * Ordem de preferência:
 * 1. DIRECT_URL ou MIGRATE_DATABASE_URL (definidas no Render/Neon)
 * 2. DATABASE_URL com hostname pooler → remove "-pooler" do host (Neon)
 */
const explicit =
	process.env["DIRECT_URL"]?.trim() ||
	process.env["MIGRATE_DATABASE_URL"]?.trim();

if (explicit) {
	process.stdout.write(explicit);
	process.exit(0);
}

const raw = process.env["DATABASE_URL"];
if (!raw || typeof raw !== "string") {
	process.stderr.write(
		"[migrate-db-url] DATABASE_URL ausente — não foi possível resolver URL de migrate.\n",
	);
	process.stdout.write(raw ?? "");
	process.exit(0);
}

try {
	const url = new URL(raw);
	const host = url.hostname;

	if (host.includes("-pooler")) {
		url.hostname = host.replace("-pooler", "");
		process.stderr.write(
			"[migrate-db-url] Host pooler Neon detectado → usando conexão direta para migrate.\n",
		);
	}

	if (!url.searchParams.has("sslmode")) {
		url.searchParams.set("sslmode", "require");
	}

	if (!url.searchParams.has("connect_timeout")) {
		url.searchParams.set("connect_timeout", "30");
	}

	process.stdout.write(url.toString());
} catch {
	process.stderr.write(
		"[migrate-db-url] Falha ao parsear DATABASE_URL — usando valor bruto.\n",
	);
	process.stdout.write(raw);
}
