BEGIN;

-- Modelo académico: niveles, cursos, oferta de materias con horarios,
-- años lectivos y matrículas (RF-AD-01, RF-PA-02, RN-03).

CREATE TABLE IF NOT EXISTS levels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    level_id INTEGER NOT NULL REFERENCES levels (id) ON DELETE RESTRICT,
    name VARCHAR(80) NOT NULL,
    UNIQUE (level_id, name)
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses (id) ON DELETE SET NULL;

-- Migra los datos de students.level/course (texto libre) al modelo normalizado.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'level'
    ) THEN
        INSERT INTO levels (name)
        SELECT DISTINCT level FROM students
        WHERE level IS NOT NULL AND level <> 'Pendiente'
        ON CONFLICT (name) DO NOTHING;

        INSERT INTO courses (level_id, name)
        SELECT l.id, s.course
        FROM students s
        JOIN levels l ON l.name = s.level
        WHERE s.course IS NOT NULL AND s.course <> 'Pendiente'
        ON CONFLICT DO NOTHING;

        UPDATE students s
        SET course_id = c.id
        FROM courses c
        JOIN levels l ON l.id = c.level_id
        WHERE l.name = s.level AND c.name = s.course AND s.course_id IS NULL;

        ALTER TABLE students DROP COLUMN level;
        ALTER TABLE students DROP COLUMN course;
    END IF;
END $$;

ALTER TABLE sport_groups ADD COLUMN IF NOT EXISTS level_id INTEGER REFERENCES levels (id) ON DELETE RESTRICT;

-- Migra sport_groups.level (texto libre; 'Todos' pasa a NULL).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sport_groups' AND column_name = 'level'
    ) THEN
        INSERT INTO levels (name)
        SELECT DISTINCT level FROM sport_groups
        WHERE level IS NOT NULL AND level <> 'Todos'
        ON CONFLICT (name) DO NOTHING;

        UPDATE sport_groups sg
        SET level_id = l.id
        FROM levels l
        WHERE l.name = sg.level AND sg.level_id IS NULL;

        ALTER TABLE sport_groups DROP CONSTRAINT IF EXISTS sport_groups_sport_id_level_weekday_start_time_key;
        ALTER TABLE sport_groups DROP COLUMN level;
    END IF;
END $$;

ALTER TABLE sport_groups DROP CONSTRAINT IF EXISTS sport_groups_sport_id_level_id_weekday_start_time_key;
ALTER TABLE sport_groups ADD CONSTRAINT sport_groups_sport_id_level_id_weekday_start_time_key
    UNIQUE (sport_id, level_id, weekday, start_time);

CREATE INDEX IF NOT EXISTS idx_students_course_id ON students (course_id);
CREATE INDEX IF NOT EXISTS idx_courses_level_id ON courses (level_id);
CREATE INDEX IF NOT EXISTS idx_sport_groups_level_id ON sport_groups (level_id);

CREATE TABLE IF NOT EXISTS course_subjects (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
    teacher_id INTEGER NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (course_id, subject_id, weekday, start_time),
    CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_course_subjects_course_id ON course_subjects (course_id);
CREATE INDEX IF NOT EXISTS idx_course_subjects_teacher_id ON course_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS idx_course_subjects_subject_id ON course_subjects (subject_id);

CREATE TABLE IF NOT EXISTS school_years (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS school_year_enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    school_year_id INTEGER NOT NULL REFERENCES school_years (id) ON DELETE RESTRICT,
    course_id INTEGER NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'cancelled')),
    created_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, school_year_id)
);

CREATE INDEX IF NOT EXISTS idx_school_year_enrollments_student_id ON school_year_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_school_year_enrollments_course_id ON school_year_enrollments (course_id);

COMMIT;
