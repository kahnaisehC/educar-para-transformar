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
