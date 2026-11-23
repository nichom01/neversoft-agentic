import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button, Card, ErrorBox } from "./ui";

describe("ui.tsx components", () => {
  // T-31: UI primitives Button, Card and ErrorBox match the pipeline classes
  describe("T-31: UI primitives Button, Card and ErrorBox match the pipeline classes", () => {
    it("Button variants have expected class tokens", () => {
      const { unmount } = render(<Button variant="default">Default</Button>);
      let btn = screen.getByRole("button", { name: "Default" });
      expect(btn.className).toContain("bg-white border border-slate-300 hover:bg-slate-100 text-slate-800");
      expect(btn.className).toContain("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed");
      unmount();

      render(<Button variant="primary">Primary</Button>);
      btn = screen.getByRole("button", { name: "Primary" });
      expect(btn.className).toContain("bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700");
      unmount();

      render(<Button variant="danger">Danger</Button>);
      btn = screen.getByRole("button", { name: "Danger" });
      expect(btn.className).toContain("bg-white border border-red-300 text-red-700 hover:bg-red-50");
      unmount();

      render(<Button variant="ghost">Ghost</Button>);
      btn = screen.getByRole("button", { name: "Ghost" });
      expect(btn.className).toContain("text-slate-600 hover:bg-slate-100");
      unmount();

      render(<Button className="custom-class">Custom</Button>);
      btn = screen.getByRole("button", { name: "Custom" });
      expect(btn.className).toContain("custom-class");
      unmount();
    });

    it("Card has expected class tokens and merges className", () => {
      const { container, unmount } = render(<Card className="my-card">Content</Card>);
      const cardDiv = container.firstChild as HTMLElement;
      expect(cardDiv.className).toContain("rounded-lg border border-slate-200 bg-white shadow-sm");
      expect(cardDiv.className).toContain("my-card");
      expect(cardDiv.textContent).toBe("Content");
      unmount();
    });

    it("ErrorBox renders nothing for falsy error, message for Error, string for non-Error", () => {
      const { container, rerender } = render(<ErrorBox error={null} />);
      expect(container.firstChild).toBeNull();

      rerender(<ErrorBox error={undefined} />);
      expect(container.firstChild).toBeNull();

      rerender(<ErrorBox error={new Error("Something failed")} />);
      expect(screen.getByText("Something failed")).toBeDefined();
      expect(container.firstChild).toHaveProperty("className");
      const errDiv = container.firstChild as HTMLElement;
      expect(errDiv.className).toContain("rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800");

      rerender(<ErrorBox error="String error" />);
      expect(screen.getByText("String error")).toBeDefined();
    });
  });
});
