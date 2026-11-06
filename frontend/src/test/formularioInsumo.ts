import { expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type Usuario = ReturnType<typeof userEvent.setup>;

/** Waits for the productor's ingredients (the options of «Asociar a un ingrediente») to be on screen. */
export async function esperarIngredientes() {
  await waitFor(() => expect(screen.getAllByRole("radio").length).toBeGreaterThan(0));
}

/** Chooses the ingredient by its name in «Asociar a un ingrediente». */
export async function elegirIngrediente(user: Usuario, nombre: string) {
  await user.click(await screen.findByRole("radio", { name: nombre }));
}

/** The answer «El envase no indica “puede contener”» (CA17), for a review with no trace declared. */
export async function responderSinTrazas(user: Usuario) {
  await user.click(screen.getByRole("button", { name: "El envase no indica “puede contener”" }));
}
