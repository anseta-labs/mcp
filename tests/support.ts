import type { AnsetaApi } from "../src/client.js";
import type { ToolContext } from "../src/tools/types.js";

/**
 * A tool context backed by whichever methods a test stubs. Anything not
 * stubbed throws, so a test that reaches an unexpected call fails loudly
 * rather than silently receiving undefined.
 */
export function stubClient(impl: Partial<AnsetaApi>): ToolContext {
  return {
    client: {
      get: impl.get ?? (() => Promise.reject(new Error("get was not stubbed"))),
      post:
        impl.post ?? (() => Promise.reject(new Error("post was not stubbed"))),
    },
  };
}
