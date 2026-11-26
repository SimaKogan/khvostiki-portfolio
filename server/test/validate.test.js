import { test } from "node:test";
import assert from "node:assert/strict";
import { validateApplication, formatMessage } from "../lib/validate.js";

const good = { name: "Анна", phone: "+7 900 000-12-34", pet: "Рокси", msg: "Есть опыт" };

test("корректная заявка проходит и значения очищаются", () => {
  const r = validateApplication({ ...good, name: "  Анна  " });
  assert.equal(r.ok, true);
  assert.equal(r.value.name, "Анна");
});

test("питомец и «о себе» необязательны", () => {
  const r = validateApplication({ name: "Анна", phone: "+79000001234" });
  assert.equal(r.ok, true);
  assert.equal(r.value.pet, "");
});

test("слишком короткое имя и плохой телефон отклоняются", () => {
  const r = validateApplication({ name: "А", phone: "abc" });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.fields).sort(), ["name", "phone"]);
});

test("слишком длинный текст отклоняется", () => {
  const r = validateApplication({ ...good, msg: "я".repeat(1001) });
  assert.equal(r.ok, false);
  assert.equal(r.fields.msg, "invalid");
});

test("нестроковые значения отклоняются", () => {
  assert.equal(validateApplication({ ...good, name: { a: 1 } }).ok, false);
  assert.equal(validateApplication({ ...good, phone: 79000001234 }).ok, false);
});

test("не объект: ошибка тела запроса", () => {
  for (const bad of [null, "строка", 42, []]) {
    assert.equal(validateApplication(bad).error, "invalid_body");
  }
});

test("заполненная ловушка помечает заявку как спам", () => {
  const r = validateApplication({ ...good, website: "http://spam.example" });
  assert.deepEqual(r, { ok: true, spam: true });
});

test("управляющие символы вырезаются", () => {
  const r = validateApplication({ ...good, name: "Ан\u0000на" });
  assert.equal(r.value.name, "Анна");
});

test("текст сообщения: подставляется «пока не выбран»", () => {
  const text = formatMessage({ name: "Анна", phone: "+7 900 000-00-00", pet: "", msg: "" });
  assert.match(text, /Питомец: пока не выбран/);
  assert.doesNotMatch(text, /О себе/);
});
