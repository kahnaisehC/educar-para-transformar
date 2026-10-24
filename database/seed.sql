BEGIN;

-- All demo accounts use Educar2027!. Change or remove these accounts before deployment.
-- The hash was generated with bcrypt (12 rounds).
INSERT INTO users (id, username, display_name, password_hash, email, role, status)
VALUES
    (1, 'ana.alumna', 'Ana Alumna', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'ana.alumna@educar.local', 'student', 'active'),
    (2, 'marta.madre', 'Marta Madre', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'marta.madre@educar.local', 'parent', 'active'),
    (3, 'bruno.alumno', 'Bruno Alumno', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'bruno.alumno@educar.local', 'student', 'active'),
    (4, 'carlos.padre', 'Carlos Padre', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'carlos.padre@educar.local', 'parent', 'active'),
    (5, 'laura.docente', 'Laura Docente', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDC2w4YXwqdarA4nYfa6', 'laura.docente@educar.local', 'teacher', 'active'),
    (6, 'admin.demo', 'Administracion', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'admin.demo@educar.local', 'admin', 'active'),
    (7, 'director.demo', 'Direccion', '$2b$12$xmOZOKyNNvdyZqXdsBfXoOiKwUIjId7fFNDc2w4YXwqdarA4nYfa6', 'director.demo@educar.local', 'director', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO levels (id, name)
VALUES (1, 'Primario'), (2, 'Secundario')
ON CONFLICT (id) DO NOTHING;

INSERT INTO courses (id, level_id, name)
VALUES (1, 1, '5to A'), (2, 2, '2do B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (id, user_id, record_number, dni, full_name, birth_date, address, phone, email, course_id, status)
VALUES
    (1, 1, 'AL-0001', '40111222', 'Ana Alumna', '2014-05-15', 'Av. Sarmiento 123', '3624-111111', 'ana.alumna@educar.local', 1, 'active'),
    (2, 3, 'AL-0002', '40222333', 'Bruno Alumno', '2011-08-20', 'Av. Alberdi 456', '3624-222222', 'bruno.alumno@educar.local', 2, 'active')
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

INSERT INTO course_subjects (id, course_id, subject_id, teacher_id, weekday, start_time, end_time)
VALUES
    (1, 1, 1, 1, 1, '08:00', '09:00'),
    (2, 1, 2, 1, 2, '08:00', '09:00'),
    (3, 1, 3, 1, 3, '08:00', '09:00'),
    (4, 2, 1, 1, 4, '10:00', '11:00'),
    (5, 2, 3, 1, 5, '10:00', '11:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO school_years (id, year, active)
VALUES (1, 2026, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO school_year_enrollments (student_id, school_year_id, course_id, status, created_by)
VALUES
    (1, 1, 1, 'enrolled', 6),
    (2, 1, 2, 'enrolled', 6)
ON CONFLICT (student_id, school_year_id) DO NOTHING;

INSERT INTO sports (id, name)
VALUES (1, 'Futbol'), (2, 'Natacion'), (3, 'Atletismo'), (4, 'Ajedrez')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sport_groups (id, sport_id, teacher_id, level_id, weekday, start_time, end_time)
VALUES
    (1, 1, 2, NULL, 1, '16:00', '17:00'),
    (2, 2, 2, NULL, 1, '16:30', '17:30'),
    (3, 3, 3, NULL, 2, '16:00', '17:00'),
    (4, 4, 3, NULL, 3, '16:00', '17:00'),
    (5, 1, 2, NULL, 4, '16:00', '17:00'),
    (6, 2, 2, NULL, 5, '16:00', '17:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transport_routes (id, name, description, active)
VALUES
    (1, 'Recorrido Norte', 'Acceso norte y barrios cercanos', TRUE),
    (2, 'Recorrido Centro', 'Centro y zona urbana central', TRUE),
    (3, 'Recorrido Sur', 'Acceso sur y barrios cercanos', TRUE),
    (4, 'Recorrido Oeste', 'Acceso oeste y zona rural', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Inscripciones demo para componer las facturas del módulo económico.
INSERT INTO sport_enrollments (student_id, group_id)
VALUES (1, 1), (2, 3)
ON CONFLICT (student_id, group_id) DO NOTHING;

INSERT INTO transport_enrollments (student_id, route_id)
VALUES (1, 1)
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO cafeteria_enrollments (student_id, active)
VALUES (2, TRUE)
ON CONFLICT (student_id) DO NOTHING;

-- Tarifas vigentes del ciclo 2026 (histórico simple).
INSERT INTO billing_tariffs (id, kind, sport_id, transport_route_id, amount, valid_from, created_by)
VALUES
    (1, 'monthly', NULL, NULL, 50000.00, '2026-01-01', 6),
    (2, 'sport', 1, NULL, 8000.00, '2026-01-01', 6),
    (3, 'sport', 2, NULL, 8000.00, '2026-01-01', 6),
    (4, 'sport', 3, NULL, 7000.00, '2026-01-01', 6),
    (5, 'sport', 4, NULL, 6000.00, '2026-01-01', 6),
    (6, 'transport', NULL, 1, 12000.00, '2026-01-01', 6),
    (7, 'transport', NULL, 2, 12000.00, '2026-01-01', 6),
    (8, 'transport', NULL, 3, 12000.00, '2026-01-01', 6),
    (9, 'transport', NULL, 4, 12000.00, '2026-01-01', 6),
    (10, 'cafeteria', NULL, NULL, 10000.00, '2026-01-01', 6)
ON CONFLICT (id) DO NOTHING;

-- Facturas demo del período 2026-10.
INSERT INTO invoices (id, student_id, period_year, period_month, issue_date, due_date, total_amount, status, created_by)
VALUES
    (1, 1, 2026, 10, '2026-10-01', '2026-11-10', 70000.00, 'pending', 6),
    (2, 2, 2026, 10, '2026-10-01', '2026-11-10', 67000.00, 'pending', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, kind, description, sport_id, transport_route_id, tariff_id, amount)
VALUES
    (1, 1, 'monthly', 'Cuota mensual 2026-10', NULL, NULL, 1, 50000.00),
    (2, 1, 'sport', 'Futbol', 1, NULL, 2, 8000.00),
    (3, 1, 'transport', 'Transporte · Recorrido Norte', NULL, 1, 6, 12000.00),
    (4, 2, 'monthly', 'Cuota mensual 2026-10', NULL, NULL, 1, 50000.00),
    (5, 2, 'sport', 'Atletismo', 3, NULL, 4, 7000.00),
    (6, 2, 'cafeteria', 'Comedor', NULL, NULL, 10, 10000.00)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('levels', 'id'), GREATEST((SELECT MAX(id) FROM levels), 1));
SELECT setval(pg_get_serial_sequence('courses', 'id'), GREATEST((SELECT MAX(id) FROM courses), 1));
SELECT setval(pg_get_serial_sequence('students', 'id'), GREATEST((SELECT MAX(id) FROM students), 1));
SELECT setval(pg_get_serial_sequence('parents', 'id'), GREATEST((SELECT MAX(id) FROM parents), 1));
SELECT setval(pg_get_serial_sequence('teachers', 'id'), GREATEST((SELECT MAX(id) FROM teachers), 1));
SELECT setval(pg_get_serial_sequence('subjects', 'id'), GREATEST((SELECT MAX(id) FROM subjects), 1));
SELECT setval(pg_get_serial_sequence('course_subjects', 'id'), GREATEST((SELECT MAX(id) FROM course_subjects), 1));
SELECT setval(pg_get_serial_sequence('school_years', 'id'), GREATEST((SELECT MAX(id) FROM school_years), 1));
SELECT setval(pg_get_serial_sequence('school_year_enrollments', 'id'), GREATEST((SELECT MAX(id) FROM school_year_enrollments), 1));
SELECT setval(pg_get_serial_sequence('sports', 'id'), GREATEST((SELECT MAX(id) FROM sports), 1));
SELECT setval(pg_get_serial_sequence('sport_groups', 'id'), GREATEST((SELECT MAX(id) FROM sport_groups), 1));
SELECT setval(pg_get_serial_sequence('transport_routes', 'id'), GREATEST((SELECT MAX(id) FROM transport_routes), 1));
SELECT setval(pg_get_serial_sequence('billing_tariffs', 'id'), GREATEST((SELECT MAX(id) FROM billing_tariffs), 1));
SELECT setval(pg_get_serial_sequence('invoices', 'id'), GREATEST((SELECT MAX(id) FROM invoices), 1));
SELECT setval(pg_get_serial_sequence('invoice_items', 'id'), GREATEST((SELECT MAX(id) FROM invoice_items), 1));
SELECT setval(pg_get_serial_sequence('payment_receipts', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM payment_receipts), 1));
SELECT setval(pg_get_serial_sequence('payments', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM payments), 1));
SELECT setval(pg_get_serial_sequence('payment_allocations', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM payment_allocations), 1));
SELECT setval(pg_get_serial_sequence('notification_deliveries', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM notification_deliveries), 1));
SELECT setval(pg_get_serial_sequence('password_reset_tokens', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM password_reset_tokens), 1));

COMMIT;
