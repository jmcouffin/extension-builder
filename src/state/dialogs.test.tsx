import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogHost } from "../components/DialogHost";
import { showAlert, showConfirm } from "./dialogs";

describe("dialogs", () => {
  it("resolves a confirm with the button pressed", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    let result: Promise<boolean> = Promise.resolve(false);
    act(() => {
      result = showConfirm("Really?", { title: "Check", confirmLabel: "Yes" });
    });
    expect(screen.getByRole("alertdialog", { name: "Check" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await expect(result).resolves.toBe(true);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancels on Escape and queues alerts in order", async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    let confirm: Promise<boolean> = Promise.resolve(true);
    act(() => {
      confirm = showConfirm("First");
      void showAlert("Second", { title: "Next" });
    });
    await user.keyboard("{Escape}");
    await expect(confirm).resolves.toBe(false);
    expect(screen.getByRole("alertdialog", { name: "Next" })).toHaveTextContent("Second");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
