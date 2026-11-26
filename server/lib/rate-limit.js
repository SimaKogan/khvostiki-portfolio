/**
 * Простой ограничитель частоты запросов в памяти (скользящее окно).
 *
 * Важно: в serverless-среде состояние живёт только в пределах одного «тёплого»
 * экземпляра функции, поэтому защита приблизительная. Она отсекает быстрые
 * повторы и простых ботов, а от серьёзной атаки защищают Vercel Firewall и
 * проверка Origin. Для строгого лимита нужно общее хранилище (например, Redis).
 */
export function createRateLimiter({ limit = 5, windowMs = 60_000, maxKeys = 5000, now = () => Date.now() } = {}) {
  const hits = new Map();

  function prune(from) {
    for (const [key, times] of hits) {
      if (times[times.length - 1] <= from) hits.delete(key);
    }
    /* страховка от разрастания памяти: выбрасываем самые старые ключи */
    while (hits.size > maxKeys) hits.delete(hits.keys().next().value);
  }

  return {
    /** @returns {boolean} true, если запрос разрешён */
    check(key) {
      const t = now();
      const from = t - windowMs;
      const times = (hits.get(key) || []).filter((x) => x > from);
      if (times.length >= limit) {
        hits.set(key, times);
        return false;
      }
      times.push(t);
      hits.set(key, times);
      if (hits.size > maxKeys) prune(from);
      return true;
    },
  };
}
