BEGIN;

ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address VARCHAR(200);
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(160);

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS record_number VARCHAR(30);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS dni VARCHAR(30);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS email VARCHAR(160);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_record_number ON teachers (record_number) WHERE record_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_dni ON teachers (dni) WHERE dni IS NOT NULL;

CREATE TABLE IF NOT EXISTS transport_routes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(240) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS transport_enrollments (
    student_id INTEGER PRIMARY KEY REFERENCES students (id) ON DELETE CASCADE,
    route_id INTEGER NOT NULL REFERENCES transport_routes (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafeteria_enrollments (
    student_id INTEGER PRIMARY KEY REFERENCES students (id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO transport_routes (id, name, description, active)
VALUES
    (1, 'Recorrido Norte', 'Acceso norte y barrios cercanos', TRUE),
    (2, 'Recorrido Centro', 'Centro y zona urbana central', TRUE),
    (3, 'Recorrido Sur', 'Acceso sur y barrios cercanos', TRUE),
    (4, 'Recorrido Oeste', 'Acceso oeste y zona rural', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    active = EXCLUDED.active;

UPDATE students
SET birth_date = COALESCE(birth_date, DATE '2014-05-15'),
    address = COALESCE(address, 'Domicilio pendiente'),
    phone = COALESCE(phone, '3624-000000'),
    email = COALESCE(students.email, username.email)
FROM (
    SELECT students.id, users.username || '@educar.local' AS email
    FROM students JOIN users ON users.id = students.user_id
) AS username
WHERE students.id = username.id;

UPDATE teachers
SET user_id = COALESCE(teachers.user_id, 5),
    record_number = COALESCE(record_number, 'PR-0001'),
    dni = COALESCE(dni, '30111222'),
    email = COALESCE(email, 'laura.docente@educar.local'),
    phone = COALESCE(phone, '3624-100000')
WHERE id = 1;

COMMIT;
