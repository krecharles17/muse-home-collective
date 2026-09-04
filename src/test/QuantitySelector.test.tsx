import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuantitySelector } from "@/components/QuantitySelector";

describe("QuantitySelector", () => {
  it("increases and decreases within bounds", () => {
    const onQuantityChange = vi.fn();
    render(<QuantitySelector quantity={2} onQuantityChange={onQuantityChange} max={5} />);

    fireEvent.click(screen.getByLabelText("Increase quantity"));
    fireEvent.click(screen.getByLabelText("Decrease quantity"));
    expect(onQuantityChange).toHaveBeenNthCalledWith(1, 3);
    expect(onQuantityChange).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables decrease at the minimum and increase at the maximum", () => {
    const { rerender } = render(<QuantitySelector quantity={1} onQuantityChange={() => {}} max={3} />);
    expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();

    rerender(<QuantitySelector quantity={3} onQuantityChange={() => {}} max={3} />);
    expect(screen.getByLabelText("Increase quantity")).toBeDisabled();
  });

  it("shows the current quantity", () => {
    render(<QuantitySelector quantity={4} onQuantityChange={() => {}} max={10} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
