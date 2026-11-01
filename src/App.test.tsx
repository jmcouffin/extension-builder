import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { useStore } from "./state/store";

beforeEach(() => {
  useStore.getState().reset();
  vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 404 })));
});

describe("App", () => {
  it("renders the default tab, panel and command", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".tab.active input")).toHaveValue("My Tab");
    expect(container.querySelector(".panel-name")).toHaveValue("My Panel");
    expect(screen.getByText("Button 1")).toBeInTheDocument();
  });

  it("creates a command through the modal", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "BUTTON" }));
    expect(screen.getByRole("heading", { name: "New Command" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name (required)")).toHaveValue("Button 2");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.queryByRole("heading", { name: "New Command" })).not.toBeInTheDocument();
    expect(screen.getByText("Button 2")).toBeInTheDocument();
  });

  it("adds a stack with two rows", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole("button", { name: "STACK" }));
    expect(container.querySelectorAll(".stack .stack-items > .button")).toHaveLength(2);
  });
});
