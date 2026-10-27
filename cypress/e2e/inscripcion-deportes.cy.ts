// TC-DEP-01 (RF-AL-03 / HU-01): un alumno no puede superar dos deportes activos.
// Datos demo: ana.alumna queda inscripta en Futbol (grupo 1). Los grupos 4 (Ajedrez, miércoles)
// y 3 (Atletismo, martes) no se superponen con Futbol.
describe("TC-DEP-01 · Inscripción a deportes (máximo dos)", () => {
  const user = "ana.alumna";

  beforeEach(() => {
    cy.resetSportEnrollments(user);
    cy.apiLogin(user).then((token) => {
      cy.request({
        method: "POST",
        url: `${Cypress.env("apiUrl")}/student/enrollments`,
        headers: { Authorization: `Bearer ${token}` },
        body: { groupId: 1 },
      });
    });
  });

  after(() => cy.resetSportEnrollments(user));

  it("permite el segundo deporte y bloquea el tercero en la interfaz", () => {
    cy.uiLogin(user);
    cy.contains("Mis inscripciones").should("be.visible");
    cy.contains(".enrollment-row", "Futbol").should("be.visible");

    cy.contains(".activity-card", "Ajedrez").contains("button", "Inscribirme").click();
    cy.contains(".enrollment-row", "Ajedrez").should("be.visible");

    // Con dos deportes activos el catálogo debe quedar bloqueado.
    cy.contains(".activity-card", "Atletismo").contains("button", "Límite alcanzado").should("be.disabled");
  });

  it("la API rechaza un tercer deporte aunque se omita la interfaz", () => {
    cy.apiLogin(user).then((token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const url = `${Cypress.env("apiUrl")}/student/enrollments`;
      cy.request({ method: "POST", url, headers, body: { groupId: 4 } }).its("status").should("be.within", 200, 201);
      cy.request({ method: "POST", url, headers, body: { groupId: 3 }, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(409);
        expect(response.body.code).to.eq("SPORT_LIMIT_REACHED");
      });
    });
  });
});
