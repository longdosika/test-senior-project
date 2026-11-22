import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes headers and rows with CRLF line endings", () => {
    expect(toCsv(["a", "b"], [[1, "x"], [2, "y"]])).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["t"], [['say "hi", ok\nnext']])).toBe('t\r\n"say ""hi"", ok\nnext"\r\n');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(toCsv(["v"], [["=SUM(A1)"], ["+1"], ["-2"], ["@x"]])).toBe("v\r\n'=SUM(A1)\r\n'+1\r\n'-2\r\n'@x\r\n");
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,\r\n");
  });
});
