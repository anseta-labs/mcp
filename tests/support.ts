import type { AnsetaApis } from "../src/client.js";

type Method = (...args: never[]) => Promise<unknown>;

/**
 * Method names are checked against the real API; payload shapes are not. Tests
 * feed deliberately partial responses, and one feeds an extra field to prove
 * the projection drops it, so pinning fixtures to the generated types would
 * obscure what each test is about.
 */
type Stubs = Partial<
  Record<
    | keyof AnsetaApis["info"]
    | keyof AnsetaApis["staking"]
    | keyof AnsetaApis["restaking"],
    Method
  >
>;

/**
 * A tool context backed by whichever SDK methods a test stubs. Anything else
 * rejects by name, so a test that reaches an unexpected call says which one
 * rather than failing with "undefined is not a function".
 */
export function stubApis(stubs: Stubs): AnsetaApis {
  const group = new Proxy({} as never, {
    get: (_target, name: string) =>
      stubs[name as keyof Stubs] ??
      (() => Promise.reject(new Error(`${name} was not stubbed`))),
  });

  return { info: group, staking: group, restaking: group };
}
