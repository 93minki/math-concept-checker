// Next.js는 `process.env.NEXT_PUBLIC_*` 정적 참조만 빌드 때 값으로 바꾼다.
// `process.env[name]` 같은 동적 참조는 인라인되지 않는다.
// https://nextjs.org/docs/app/guides/environment-variables

export const publicEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_API_BASE_URL",
] as const;

export type PublicEnvKey = (typeof publicEnvKeys)[number];

export type RawPublicEnv = Record<PublicEnvKey, string | undefined>;

export type PublicEnv = Record<PublicEnvKey, string>;

const PUBLISHABLE_KEY_PREFIX = "sb_publishable_";

export class PublicEnvError extends Error {
  readonly invalidKeys: readonly PublicEnvKey[];

  constructor(invalidKeys: readonly PublicEnvKey[]) {
    super(
      `공개 환경 변수가 없거나 형식이 틀립니다: ${invalidKeys.join(", ")}`,
    );
    this.name = "PublicEnvError";
    this.invalidKeys = invalidKeys;
  }
}

function isHttpsUrl(value: string): boolean {
  return value.startsWith("https://");
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isPublishableKey(value: string): boolean {
  return value.startsWith(PUBLISHABLE_KEY_PREFIX);
}

export function parsePublicEnv(raw: RawPublicEnv): PublicEnv {
  const invalidKeys: PublicEnvKey[] = [];

  const supabaseUrl = raw.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl === undefined || !isHttpsUrl(supabaseUrl)) {
    invalidKeys.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  const publishableKey = raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (publishableKey === undefined || !isPublishableKey(publishableKey)) {
    invalidKeys.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const apiBaseUrl = raw.NEXT_PUBLIC_API_BASE_URL;
  if (apiBaseUrl === undefined || !isHttpUrl(apiBaseUrl)) {
    invalidKeys.push("NEXT_PUBLIC_API_BASE_URL");
  }

  if (
    invalidKeys.length > 0 ||
    supabaseUrl === undefined ||
    publishableKey === undefined ||
    apiBaseUrl === undefined
  ) {
    throw new PublicEnvError(invalidKeys);
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
  };
}

function readPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  });
}

let cachedPublicEnv: PublicEnv | undefined;

function loadPublicEnv(): PublicEnv {
  // .env.local이 없는 CI에서도 이 파일을 import할 수 있게, 처음 읽을 때 검증한다.
  cachedPublicEnv ??= readPublicEnv();
  return cachedPublicEnv;
}

export const publicEnv: PublicEnv = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return loadPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY() {
    return loadPublicEnv().NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  },
  get NEXT_PUBLIC_API_BASE_URL() {
    return loadPublicEnv().NEXT_PUBLIC_API_BASE_URL;
  },
};
