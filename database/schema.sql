BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(160) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'parent', 'teacher', 'admin', 'director')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    record_number VARCHAR(30) NOT NULL UNIQUE,
    dni VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(160) NOT NULL,
    level VARCHAR(80) NOT NULL,
    course VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students (user_id);

CREATE TABLE IF NOT EXISTS parents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    full_name VARCHAR(160) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents (user_id);

CREATE TABLE IF NOT EXISTS parent_students (
    parent_id INTEGER NOT NULL REFERENCES parents (id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_student_id ON parent_students (student_id);

CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    specialty VARCHAR(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS student_subjects (
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
    PRIMARY KEY (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_student_subjects_teacher_id ON student_subjects (teacher_id);

CREATE TABLE IF NOT EXISTS sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sport_groups (
    id SERIAL PRIMARY KEY,
    sport_id INTEGER NOT NULL REFERENCES sports (id) ON DELETE RESTRICT,
    teacher_id INTEGER NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
    level VARCHAR(80) NOT NULL,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (sport_id, level, weekday, start_time),
    CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_sport_groups_schedule ON sport_groups (weekday, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_sport_groups_sport_id ON sport_groups (sport_id);

CREATE TABLE IF NOT EXISTS sport_enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES sport_groups (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_sport_enrollments_student_id ON sport_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_sport_enrollments_group_id ON sport_enrollments (group_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    operation VARCHAR(80) NOT NULL,
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'rejected')),
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_created_at ON audit_logs (operation, created_at DESC);

COMMIT;
