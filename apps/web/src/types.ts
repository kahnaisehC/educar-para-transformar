export type UserRole = "student" | "parent" | "teacher" | "admin" | "director";
export type UserStatus = "active" | "inactive";

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
}

export interface Student {
  id: number;
  record_number: string;
  dni: string;
  full_name: string;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  level: string;
  course: string;
  status: UserStatus;
}

export interface SportGroup {
  groupId: number;
  sportId: number;
  sport: string;
  level: string;
  weekday: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  teacher: string;
  enrolledAt?: string;
}

export interface StudentDashboardData {
  student: Student;
  subjects: Array<{ subject: string; teacher: string }>;
  catalog: SportGroup[];
  enrollments: SportGroup[];
  transportRoutes: TransportRoute[];
  transportEnrollment: TransportEnrollment | null;
  cafeteriaEnrollment: CafeteriaEnrollment | null;
}

export interface TransportRoute {
  id: number;
  name: string;
  description: string;
}

export interface TransportEnrollment extends TransportRoute {
  enrolledAt: string;
}

export interface CafeteriaEnrollment {
  active: boolean;
  enrolledAt: string;
}

export interface StudentReport {
  generatedAt: string;
  profile: Student;
  subjects: Array<{ subject: string; teacher: string }>;
  sports: SportGroup[];
  transport: TransportEnrollment | null;
  cafeteria: CafeteriaEnrollment | null;
}

export interface Child {
  id: number;
  fullName: string;
  recordNumber: string;
  level: string;
  course: string;
  status: string;
}

export interface ChildSummary {
  id: number;
  recordNumber: string;
  dni: string;
  fullName: string;
  level: string;
  course: string;
  status: string;
  subjects: Array<{ subject: string; teacher: string }>;
  sports: Array<{
    sport: string;
    weekdayName: string;
    startTime: string;
    endTime: string;
    teacher: string;
  }>;
}

export interface AdminUser extends User {
  createdAt: string;
}

export interface TeacherCourse {
  subjectId: number;
  subject: string;
  level: string;
  course: string;
}

export interface CourseStudent {
  recordNumber: string;
  dni: string;
  fullName: string;
  level: string;
  course: string;
  subject: string;
  teacher: string;
}

export interface AcademicLevel {
  id: number;
  name: string;
}

export interface AcademicCourse {
  id: number;
  levelId: number;
  level: string;
  name: string;
}

export interface AcademicSubject {
  id: number;
  name: string;
}

export interface TeacherProfile {
  id: number;
  userId: number | null;
  username: string | null;
  recordNumber: string | null;
  dni: string | null;
  fullName: string;
  specialty: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
}

export interface StudentProfile {
  id: number;
  userId: number;
  recordNumber: string;
  dni: string;
  fullName: string;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  courseId: number | null;
  level: string;
  course: string;
  status: UserStatus;
}

export interface ParentProfile {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  children: Array<{ id: number; fullName: string }>;
}

export interface CourseSubjectOffering {
  id: number;
  courseId: number;
  course: string;
  level: string;
  subjectId: number;
  subject: string;
  teacherId: number;
  teacher: string;
  weekday: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface SchoolYear {
  id: number;
  year: number;
  active: boolean;
  enrollmentCount: number;
}

export interface AcademicOverview {
  levels: AcademicLevel[];
  courses: AcademicCourse[];
  subjects: AcademicSubject[];
  teachers: TeacherProfile[];
  students: StudentProfile[];
  parents: ParentProfile[];
  courseSubjects: CourseSubjectOffering[];
  schoolYears: SchoolYear[];
}

export interface SportAdmin {
  id: number;
  name: string;
  groupCount: number;
}

export interface SportGroupAdmin {
  id: number;
  sportId: number;
  sport: string;
  teacherId: number;
  teacher: string;
  levelId: number | null;
  level: string;
  weekday: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  active: boolean;
  enrollmentCount: number;
}

export interface TransportRouteAdmin {
  id: number;
  name: string;
  description: string;
  active: boolean;
  enrolledCount: number;
}

export interface ServicesOverview {
  sports: SportAdmin[];
  sportGroups: SportGroupAdmin[];
  transportRoutes: TransportRouteAdmin[];
}

export interface EnrollmentsOverview {
  sportEnrollments: Array<{
    id: number;
    studentId: number;
    student: string;
    sport: string;
    level: string;
    weekdayName: string;
    startTime: string;
    endTime: string;
  }>;
  transportEnrollments: Array<{
    studentId: number;
    student: string;
    route: string;
    createdAt: string;
  }>;
  cafeteria: Array<{
    studentId: number;
    student: string;
    level: string;
    course: string;
    active: boolean;
    createdAt: string | null;
  }>;
  matriculas: Array<{
    id: number;
    studentId: number;
    student: string;
    schoolYearId: number;
    year: number;
    courseId: number;
    level: string;
    course: string;
    status: "enrolled" | "cancelled";
    createdAt: string;
  }>;
}

export interface ReportField {
  key: string;
  label: string;
}

export interface ReportEntity {
  key: string;
  label: string;
  description: string;
  fields: ReportField[];
}

export interface ReportTemplate {
  id: number;
  name: string;
  entity: string;
  fields: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedReport {
  entity: string;
  columns: ReportField[];
  rows: Array<Record<string, string>>;
  generatedAt: string;
}
