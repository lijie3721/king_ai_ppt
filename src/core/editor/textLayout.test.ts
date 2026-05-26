import { describe, expect, it } from "vitest";
import { normalizeTextBlockLayout } from "./textLayout";

describe("text layout", () => {
  it("clamps line height and letter spacing style controls", () => {
    expect(
      normalizeTextBlockLayout({
        x: 50,
        y: 50,
        style: {
          lineHeight: 0.2,
          letterSpacing: -4
        }
      })
    ).toEqual({
      x: 50,
      y: 50,
      style: {
        lineHeight: 0.8,
        letterSpacing: -1
      }
    });

    expect(
      normalizeTextBlockLayout({
        x: 50,
        y: 50,
        style: {
          lineHeight: 3,
          letterSpacing: 12
        }
      })
    ).toEqual({
      x: 50,
      y: 50,
      style: {
        lineHeight: 2.4,
        letterSpacing: 8
      }
    });
  });
});
