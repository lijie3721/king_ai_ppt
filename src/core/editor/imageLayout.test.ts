import { describe, expect, it } from "vitest";
import { normalizeImageLayout } from "./imageLayout";

describe("image layout", () => {
  it("allows free image centers to reach the full slide canvas", () => {
    expect(normalizeImageLayout({ x: -20, y: -12, width: 42 })).toEqual({
      x: 0,
      y: 0,
      width: 42
    });
    expect(normalizeImageLayout({ x: 130, y: 140, width: 42 })).toEqual({
      x: 100,
      y: 100,
      width: 42
    });
  });

  it("allows images to be resized beyond the canvas width but keeps handles usable", () => {
    expect(normalizeImageLayout({ x: 50, y: 50, width: 4 })).toEqual({
      x: 50,
      y: 50,
      width: 12
    });
    expect(normalizeImageLayout({ x: 50, y: 50, width: 180 })).toEqual({
      x: 50,
      y: 50,
      width: 120
    });
  });
});
