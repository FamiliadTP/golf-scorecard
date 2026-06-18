-- =============================================
-- Migración: combinación de vueltas de 9 hoyos
-- Ejecutar UNA VEZ en el SQL Editor de Supabase
-- (proyecto cmekpjrpifresudjmydm) antes de usar la nueva versión.
-- Es seguro re-ejecutar: usa "if not exists".
-- =============================================

-- Apellido de la vuelta (Sur / Este / Norte) para campos tipo "combinación de 9".
alter table courses
  add column if not exists loop_label text;

-- Segunda vuelta de 9 cuando una partida combina dos vueltas (null si no aplica).
alter table rounds
  add column if not exists second_course_id uuid references courses(id);
