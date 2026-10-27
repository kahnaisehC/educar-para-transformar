// Prueba de regresión: el defecto corregido en el commit "fix: reject overlapping schedules
// within the same course" no debe reaparecer. Un horario superpuesto debe seguir rechazándose.
// Futbol (grupo 1, lunes 16:00-17:00) y Natacion (grupo 2, lunes 16:30-17:30) se solapan.
describe("Regresión · horarios superpuestos en deportes", () => {
  const user = "ana.alumna";

  beforeEach(() => {
    cy.resetSportEnrollments(user);
  });

  after(() => cy.resetSportEnrollments(user));

  it("rechaza con SCHEDULE_CONFLICT un grupo que se superpone con uno ya inscripto", () => {
    cy.apiLogin(user).then((token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const url = `${Cypress.env("apiUrl")}/student/enrollments`;
      cy.request({ method: "POST", url, headers, body: { groupId: 1 } });
      cy.request({ method: "POST", url, headers, body: { groupId: 2 }, failOnStatusCode: false }).then((response) => {
        expect(response.status).to.eq(409);
        expect(response.body.code).to.eq("SCHEDULE_CONFLICT");
      });
    });
  });

  it("acepta un grupo adyacente sin superposición", () => {
    cy.apiLogin(user).then((token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const url = `${Cypress.env("apiUrl")}/student/enrollments`;
      cy.request({ method: "POST", url, headers, body: { groupId: 1 } });
      cy.request({ method: "POST", url, headers, body: { groupId: 4 } }).its("status").should("be.within", 200, 201);
    });
  });
});
