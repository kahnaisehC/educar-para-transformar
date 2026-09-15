The current app is a proof of concept, not a usable product: it has demo-user switching, a basic vanilla frontend, SQLite, and only Sprint 1 behavior. The best way to steer me is to define one vertical slice at a time instead of saying "implement the plan."

DECISIONS NEEDED

1. Stack
   - Keep Python/SQLite for a fast prototype.
   - Rebuild with React + TypeScript + Node + PostgreSQL.
   - Use React + FastAPI + PostgreSQL.

   For the documented project, I recommend React + TypeScript + PostgreSQL with a proper backend.

2. First usable slice
   - Login and role-based dashboards.
   - Student sports enrollment.
   - Parent child-information portal.
   - Admin user management.

3. Visual direction
   - Provide screenshots or examples you like.
   - Specify colors, density, typography and whether it should feel formal, modern, institutional, etc.

4. Data behavior
   - Demo seed data only.
   - Real database persistence.
   - Real authentication and passwords.
   - Exportable reports.

USEFUL PROMPT FORMAT

Rebuild Sprint 1 as a production-quality application.

Stack: React + TypeScript + [backend] + PostgreSQL.
Users: Student, Parent, Teacher, Administrator, Director.
First flow: Student logs in, views sports, enrolls, and receives clear validation errors.
Second flow: Parent logs in, sees only associated children and their academic information.

Required screens:
- Login
- Student dashboard
- Sports catalog
- Enrollment confirmation/error states
- Parent dashboard
- Child information view

Design:
- Responsive desktop/mobile layout
- Formal but modern educational visual style
- Use the existing institution colors and logos
- Include loading, empty, error and success states

Acceptance criteria:
- No demo user selector
- Data persists after restart
- Parent cannot access another student
- Third sport is rejected
- Overlapping schedules are rejected
- Tests cover the business rules

Do not implement later sprints yet.

The best next step is to rebuild the current prototype into a real Sprint 1 slice with authentication, proper dashboards, persistent data, and a polished responsive UI.
