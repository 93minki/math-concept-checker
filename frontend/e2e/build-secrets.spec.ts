import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const forbiddenStrings = ["SUPABASE_SECRET_KEY", "sb_secret_"] as const;

function isEnvFile(filePath: string): boolean {
  return path.basename(filePath).startsWith(".env");
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

test("빌드 결과물에 비밀 키 문자열이 없다", async () => {
  test.setTimeout(120_000);

  const nextDir = path.join(process.cwd(), ".next");
  let nextStat: Awaited<ReturnType<typeof stat>>;
  try {
    nextStat = await stat(nextDir);
  } catch {
    throw new Error(
      ".next 빌드 결과물이 없습니다. pnpm build 뒤에 이 검사를 실행해야 합니다.",
    );
  }
  expect(nextStat.isDirectory()).toBe(true);

  const files = await listFiles(nextDir);
  const envFiles = files.filter(isEnvFile);
  expect(envFiles).toEqual([]);

  const hits: string[] = [];
  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");
    for (const forbidden of forbiddenStrings) {
      if (text.includes(forbidden)) {
        hits.push(`${path.relative(nextDir, filePath)}: ${forbidden}`);
      }
    }
  }

  expect(hits).toEqual([]);
});
