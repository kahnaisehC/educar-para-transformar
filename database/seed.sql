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

INSERT INTO students (id, user_id, record_number, dni, full_name, level, course, status)
VALUES
    (1, 1, 'AL-0001', '40111222', 'Ana Alumna', 'Primario', '5to A', 'active'),
    (2, 3, 'AL-0002', '40222333', 'Bruno Alumno', 'Secundario', '2do B', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO parents (id, user_id, full_name)
VALUES
    (1, 2, 'Marta Madre'),
    (2, 4, 'Carlos Padre')
ON CONFLICT (id) DO NOTHING;

INSERT INTO parent_students (parent_id, student_id)
VALUES (1, 1), (2, 2)
ON CONFLICT DO NOTHING;

INSERT INTO teachers (id, full_name, specialty)
VALUES
    (1, 'Laura Docente', 'Educacion Primaria'),
    (2, 'Diego Profesor', 'Educacion Fisica'),
    (3, 'Sofia Entrenadora', 'Actividades deportivas')
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

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('students', 'id'), GREATEST((SELECT MAX(id) FROM students), 1));
SELECT setval(pg_get_serial_sequence('parents', 'id'), GREATEST((SELECT MAX(id) FROM parents), 1));
SELECT setval(pg_get_serial_sequence('teachers', 'id'), GREATEST((SELECT MAX(id) FROM teachers), 1));
SELECT setval(pg_get_serial_sequence('subjects', 'id'), GREATEST((SELECT MAX(id) FROM subjects), 1));
SELECT setval(pg_get_serial_sequence('sports', 'id'), GREATEST((SELECT MAX(id) FROM sports), 1));
SELECT setval(pg_get_serial_sequence('sport_groups', 'id'), GREATEST((SELECT MAX(id) FROM sport_groups), 1));

COMMIT;
