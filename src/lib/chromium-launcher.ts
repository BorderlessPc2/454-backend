import { existsSync, rmSync, statSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import type { Browser, LaunchOptions } from "puppeteer-core";

export class RelatorioPdfUnavailableError extends Error {
  constructor(message = "Chromium indisponível para geração de PDF") {
    super(message);
    this.name = "RelatorioPdfUnavailableError";
  }
}

const WINDOWS_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env["LOCALAPPDATA"]
    ? `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`
    : "",
].filter(Boolean);

function isExecutableFile(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function clearSparticuzCacheIfInvalid(): void {
  const cachePath = join(tmpdir(), "chromium");
  if (existsSync(cachePath) && !isExecutableFile(cachePath)) {
    rmSync(cachePath, { recursive: true, force: true });
  }
}

async function tryPuppeteerCacheExecutable(): Promise<string | null> {
  const { Browser, getInstalledBrowsers } = await import("@puppeteer/browsers");
  const cacheDirs = [
    process.env["PUPPETEER_CACHE_DIR"],
    join(process.cwd(), ".cache", "puppeteer"),
    "/opt/render/project/.cache/puppeteer",
    "/opt/render/.cache/puppeteer",
    join(homedir(), ".cache", "puppeteer"),
  ].filter((dir): dir is string => Boolean(dir?.trim()));

  for (const cacheDir of cacheDirs) {
    try {
      const installed = await getInstalledBrowsers({ cacheDir });
      const browser = installed.find(
        (item) =>
          item.browser === Browser.CHROME ||
          item.browser === Browser.CHROMIUM ||
          item.browser === Browser.CHROMEHEADLESSSHELL,
      );

      if (browser && isExecutableFile(browser.executablePath)) {
        return browser.executablePath;
      }
    } catch {
      // tenta próximo diretório
    }
  }

  return null;
}

async function trySparticuzExecutable(): Promise<string> {
  clearSparticuzCacheIfInvalid();
  const chromium = (await import("@sparticuz/chromium")).default;
  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath();
  if (!isExecutableFile(executablePath)) {
    throw new RelatorioPdfUnavailableError(
      `Chromium extraído em "${executablePath}" não é um executável válido.`,
    );
  }

  return executablePath;
}

async function resolveExecutablePath(): Promise<{
  executablePath: string;
  useSparticuzArgs: boolean;
}> {
  const envPath = process.env["PUPPETEER_EXECUTABLE_PATH"]?.trim();
  if (envPath && isExecutableFile(envPath)) {
    return { executablePath: envPath, useSparticuzArgs: false };
  }

  const cachedChrome = await tryPuppeteerCacheExecutable();
  if (cachedChrome) {
    return { executablePath: cachedChrome, useSparticuzArgs: false };
  }

  if (process.platform === "linux") {
    const sparticuzPath = await trySparticuzExecutable();
    return { executablePath: sparticuzPath, useSparticuzArgs: true };
  }

  for (const chromePath of WINDOWS_CHROME_PATHS) {
    if (isExecutableFile(chromePath)) {
      return { executablePath: chromePath, useSparticuzArgs: false };
    }
  }

  if (process.platform === "darwin") {
    const macPath =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (isExecutableFile(macPath)) {
      return { executablePath: macPath, useSparticuzArgs: false };
    }
  }

  throw new RelatorioPdfUnavailableError(
    "Navegador Chromium/Chrome não encontrado. No Render, instale o Chrome no build e defina PUPPETEER_CACHE_DIR.",
  );
}

export async function launchChromiumBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  const { executablePath, useSparticuzArgs } = await resolveExecutablePath();
  const headless = useSparticuzArgs ? ("shell" as const) : true;

  const launchOptions: LaunchOptions = {
    executablePath,
    headless,
    args: useSparticuzArgs
      ? await puppeteer.defaultArgs({
          args: (await import("@sparticuz/chromium")).default.args,
          headless: "shell",
        })
      : [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
  };

  return puppeteer.launch(launchOptions);
}
