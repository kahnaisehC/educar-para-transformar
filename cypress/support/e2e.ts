const PASSWORD = "Educar2027!";

interface LoginResponse {
  token: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Inicia sesión por la API y devuelve el JWT. */
      apiLogin(username: string): Chainable<string>;
      /** Cancela todas las inscripciones deportivas del alumno (deja el estado limpio). */
      resetSportEnrollments(username: string): Chainable<void>;
      /** Inicia sesión por la interfaz con las credenciales demo. */
      uiLogin(username: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("apiLogin", (username: string) =>
  cy
    .request<LoginResponse>("POST", `${Cypress.env("apiUrl")}/auth/login`, { username, password: PASSWORD })
    .its("body.token"),
);

Cypress.Commands.add("resetSportEnrollments", (username: string) => {
  cy.apiLogin(username).then((token) => {
    const headers = { Authorization: `Bearer ${token}` };
    cy.request({ url: `${Cypress.env("apiUrl")}/student/dashboard`, headers }).then((response) => {
      const enrollments = response.body.enrollments as Array<{ groupId: number }>;
      enrollments.forEach(({ groupId }) => {
        cy.request({ method: "DELETE", url: `${Cypress.env("apiUrl")}/student/enrollments/${groupId}`, headers });
      });
    });
  });
});

Cypress.Commands.add("uiLogin", (username: string) => {
  cy.visit("/");
  cy.get("input[autocomplete=username]").type(username);
  cy.get("input[autocomplete=current-password]").type(PASSWORD, { log: false });
  cy.contains("button", "Iniciar sesión").click();
});

export {};
