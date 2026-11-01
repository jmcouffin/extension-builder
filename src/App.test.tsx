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

  it("BUTTON adds a command at once and selects it in Properties", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole("button", { name: "BUTTON" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelector('[data-name="Button 2"]')).toHaveClass("is-selected");
    expect(container.querySelector('#propertiesPalette [data-field="name"]')).toHaveValue(
      "Button 2",
    );
  });

  it("adds a stack with two rows", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole("button", { name: "STACK" }));
    expect(container.querySelectorAll(".stack .stack-items > .button")).toHaveLength(2);
  });
});
