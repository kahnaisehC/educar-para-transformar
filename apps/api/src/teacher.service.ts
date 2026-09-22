import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import { AppError, isAppError } from "./errors.js";
import type { ContactInput } from "./student.service.js";

export async function updateTeacherContact(
  pool: DatabasePool,
  actorUserId: number,
  input: ContactInput,
): Promise<ContactInput> {
  try {
    return await withTransaction(pool, async (client) => {
      const result = await client.query<{ id: number }>(
        "SELECT id FROM teachers WHERE user_id = $1 AND status = 'active' FOR UPDATE",
        [actorUserId],
      );
      if (!result.rows[0]) {
        throw new AppError(404, "No existe un perfil docente activo", "TEACHER_NOT_FOUND");
      }
      await client.query(
        "UPDATE teachers SET email = $1, phone = $2 WHERE id = $3",
        [input.email, input.phone, result.rows[0].id],
      );
      await writeAudit(client, actorUserId, "update_teacher_contact", "success", {
        email: input.email,
        phone: input.phone,
      });
      return input;
    });
  } catch (error) {
    const normalized = isAppError(error) ? error : new Error("No se pudieron actualizar los datos de contacto");
    await tryWriteAudit(pool, actorUserId, "update_teacher_contact", "rejected", { reason: normalized.message });
    throw normalized;
  }
}
