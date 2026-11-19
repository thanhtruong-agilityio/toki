import { describe, expect, it } from "vitest";
import { operatorName } from "../../src/cli/operator.js";

// The name of the operating-system user that ran the command (TOKI-026 R35). `os.userInfo()` throws
// when the user id has no passwd entry, as in a container run with `docker exec --user <uid>`; the
// command must still run then.
const gone = () => {
  throw new Error("uv_os_get_passwd returned ENOENT");
};

describe("operatorName", () => {
  it("is the user name of the system", () => {
    expect(operatorName({ userInfo: () => ({ username: "ops" }) })).toBe("ops");
  });

  it("falls back to USER, then LOGNAME, when the system knows no such user", () => {
    expect(operatorName({ userInfo: gone, env: { USER: "ada" } })).toBe("ada");
    expect(operatorName({ userInfo: gone, env: { LOGNAME: "bob" } })).toBe(
      "bob",
    );
  });

  it("falls back to the user id when nothing names the user", () => {
    expect(operatorName({ userInfo: gone, env: {}, uid: () => 4321 })).toBe(
      "uid:4321",
    );
  });

  it("falls back to unknown when even the user id is unavailable", () => {
    expect(
      operatorName({
        userInfo: gone,
        env: {},
        uid: () => {
          throw new Error("no getuid");
        },
      }),
    ).toBe("unknown");
  });

  it("ignores an empty name", () => {
    expect(
      operatorName({
        userInfo: () => ({ username: "" }),
        env: { USER: "ada" },
      }),
    ).toBe("ada");
  });
});
