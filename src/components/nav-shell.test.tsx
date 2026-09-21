import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavShell } from "./nav-shell";

describe("NavShell", () => {
  it("renders the product name and primary nav links", () => {
    render(<NavShell />);

    expect(screen.getByText("Hospital & USG Records")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Patients" })).toHaveAttribute("href", "/patients");
  });
});
