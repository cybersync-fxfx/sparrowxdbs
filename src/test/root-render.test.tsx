import React from "react";
import { render } from "@testing-library/react";
import { describe, it, beforeAll } from "vitest";
import { Route } from "@/routes/index";
import { CyberThreatGlobe } from "@/components/CyberThreatGlobe";

describe("Test Full Index Rendering", () => {
  beforeAll(() => {
    // Provide a safe getContext stub so JSDOM doesn't throw on Three.js WebGLRenderer instantiation
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("renders CyberThreatGlobe without crashing", () => {
    const { container } = render(<CyberThreatGlobe />);
    expect(container).toBeDefined();
  });

  it("renders Route component without crashing", () => {
    const Component = Route.options.component;
    if (!Component) throw new Error("No component");
    const { container } = render(React.createElement(Component));
    expect(container).toBeDefined();
  });
});
