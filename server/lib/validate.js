/**
 * Валидация и форматирование заявки на усыновление.
 * Чистые функции без обращения к сети: их легко тестировать.
 */

export const LIMITS = Object.freeze({
  name: { min: 2, max: 80 },
  phone: { min: 7, max: 20 },
  pet: { max: 80 },
  msg: { max: 1000 },
});

const PHONE_RE = /^[0-9+()\-\s]+$/;
/* управляющие символы, кроме перевода строки и табуляции */
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function asString(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null; /* число, объект и т.п. - ошибка */
  return value.replace(CONTROL_RE, "").trim();
}

/**
 * @param {unknown} input тело запроса после JSON.parse
 * @returns {{ok: true, spam?: boolean, value?: {name:string, phone:string, pet:string, msg:string}}
 *         | {ok: false, error: string, fields?: Record<string,string>}}
 */
export function validateApplication(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "invalid_body" };
  }

  /* Поле-ловушка: человек его не видит. Если оно заполнено, это бот. */
  if (typeof input.website === "string" && input.website.trim() !== "") {
    return { ok: true, spam: true };
  }

  const name = asString(input.name);
  const phone = asString(input.phone);
  const pet = asString(input.pet);
  const msg = asString(input.msg);
  const fields = {};

  if (name === null || name.length < LIMITS.name.min || name.length > LIMITS.name.max) fields.name = "invalid";
  if (
    phone === null ||
    !PHONE_RE.test(phone) ||
    phone.length < LIMITS.phone.min ||
    phone.length > LIMITS.phone.max ||
    phone.replace(/\D/g, "").length < 7
  ) {
    fields.phone = "invalid";
  }
  if (pet === null || pet.length > LIMITS.pet.max) fields.pet = "invalid";
  if (msg === null || msg.length > LIMITS.msg.max) fields.msg = "invalid";

  if (Object.keys(fields).length > 0) return { ok: false, error: "validation_failed", fields };
  return { ok: true, value: { name, phone, pet, msg } };
}

/** Текст сообщения для Telegram (обычный текст, без разметки, поэтому HTML-инъекций нет). */
export function formatMessage({ name, phone, pet, msg }) {
  const lines = [
    "🐾 Новая заявка на усыновление",
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `Питомец: ${pet || "пока не выбран"}`,
  ];
  if (msg) lines.push(`О себе: ${msg}`);
  return lines.join("\n");
}
