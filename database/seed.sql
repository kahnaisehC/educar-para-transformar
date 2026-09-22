BEGIN;

-- All demo accounts use Educar2027!. Change or remove these accounts before deployment.
-- The hash was generated with bcrypt (12 rounds).
INSERT INTO users (id, username, display_name, password_hash, role, status)
VALUES
    (1, 'ana.alumna', 'Ana Alumna', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'student', 'active'),
    (2, 'marta.madre', 'Marta Madre', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'parent', 'active'),
    (3, 'bruno.alumno', 'Bruno Alumno', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'student', 'active'),
    (4, 'carlos.padre', 'Carlos Padre', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'parent', 'active'),
    (5, 'laura.docente', 'Laura Docente', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'teacher', 'active'),
    (6, 'admin.demo', 'Administracion', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'admin', 'active'),
    (7, 'director.demo', 'Direccion', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'director', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, user_id, record_number, dni, full_name, birth_date, address, phone, email, level, course, status)
VALUES
    (1, 1, 'AL-0001', '40111222', 'Ana Alumna', '2014-05-15', 'Av. Sarmiento 123', '3624-111111', 'ana.alumna@educar.local', 'Primario', '5to A', 'active'),
    (2, 3, 'AL-0002', '40222333', 'Bruno Alumno', '2011-08-20', 'Av. Alberdi 456', '3624-222222', 'bruno.alumno@educar.local', 'Secundario', '2do B', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO parents (id, user_id, full_name)
VALUES
    (1, 2, 'Marta Madre'),
    (2, 4, 'Carlos Padre')
ON CONFLICT (id) DO NOTHING;

INSERT INTO parent_students (parent_id, student_id)
VALUES (1, 1), (2, 2)
ON CONFLICT DO NOTHING;

INSERT INTO teachers (id, user_id, record_number, dni, full_name, specialty, email, phone, status)
VALUES
    (1, 5, 'PR-0001', '30111222', 'Laura Docente', 'Educacion Primaria', 'laura.docente@educar.local', '3624-100000', 'active'),
    (2, NULL, 'PR-0002', '30222333', 'Diego Profesor', 'Educacion Fisica', 'diego.profesor@educar.local', '3624-200000', 'active'),
    (3, NULL, 'PR-0003', '30333444', 'Sofia Entrenadora', 'Actividades deportivas', 'sofia.entrenadora@educar.local', '3624-300000', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subjects (id, name)
VALUES (1, 'Matematica'), (2, 'Lengua'), (3, 'Ciencias Naturales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO student_subjects (student_id, subject_id, teacher_id)
VALUES
    (1, 1, 1), (1, 2, 1), (1, 3, 1),
    (2, 1, 1), (2, 3, 1)
ON CONFLICT DO NOTHING;

INSERT INTO sports (id, name)
VALUES (1, 'Futbol'), (2, 'Natacion'), (3, 'Atletismo'), (4, 'Ajedrez')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sport_groups (id, sport_id, teacher_id, level, weekday, start_time, end_time)
VALUES
    (1, 1, 2, 'Todos', 1, '16:00', '17:00'),
    (2, 2, 2, 'Todos', 1, '16:30', '17:30'),
    (3, 3, 3, 'Todos', 2, '16:00', '17:00'),
    (4, 4, 3, 'Todos', 3, '16:00', '17:00'),
    (5, 1, 2, 'Todos', 4, '16:00', '17:00'),
    (6, 2, 2, 'Todos', 5, '16:00', '17:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transport_routes (id, name, description, active)
VALUES
    (1, 'Recorrido Norte', 'Acceso norte y barrios cercanos', TRUE),
    (2, 'Recorrido Centro', 'Centro y zona urbana central', TRUE),
    (3, 'Recorrido Sur', 'Acceso sur y barrios cercanos', TRUE),
    (4, 'Recorrido Oeste', 'Acceso oeste y zona rural', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('students', 'id'), GREATEST((SELECT MAX(id) FROM students), 1));
SELECT setval(pg_get_serial_sequence('parents', 'id'), GREATEST((SELECT MAX(id) FROM parents), 1));
SELECT setval(pg_get_serial_sequence('teachers', 'id'), GREATEST((SELECT MAX(id) FROM teachers), 1));
SELECT setval(pg_get_serial_sequence('subjects', 'id'), GREATEST((SELECT MAX(id) FROM subjects), 1));
SELECT setval(pg_get_serial_sequence('sports', 'id'), GREATEST((SELECT MAX(id) FROM sports), 1));
SELECT setval(pg_get_serial_sequence('sport_groups', 'id'), GREATEST((SELECT MAX(id) FROM sport_groups), 1));
SELECT setval(pg_get_serial_sequence('transport_routes', 'id'), GREATEST((SELECT MAX(id) FROM transport_routes), 1));

COMMIT;
