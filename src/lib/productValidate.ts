export type ValidateResult = { ok: true } | { ok: false; error: string };

export function validateOptionGroups(optionGroups: any[]): ValidateResult {
  if (!Array.isArray(optionGroups)) return { ok: false, error: "optionGroups должен быть массивом" };

  for (const g of optionGroups) {
    if (!g?.id || typeof g.id !== "string") return { ok: false, error: "У группы опций должен быть id" };
    if (!g?.name || typeof g.name !== "string" || !g.name.trim()) return { ok: false, error: "У группы опций должно быть имя" };
    if (!["select", "radio", "checkbox", "text"].includes(g.type)) return { ok: false, error: "Некорректный тип ввода группы" };

    if (g.type !== "text") {
      if (!Array.isArray(g.values) || g.values.length === 0) {
        return { ok: false, error: `Группа "${g.name}" должна иметь значения` };
      }
      const labels: string[] = g.values.map((v: { label?: string }) => String(v?.label ?? "").trim());
      if (labels.some((label: string) => !label)) {
        return { ok: false, error: `Группа "${g.name}" содержит пустые значения` };
      }
      const set = new Set(labels.map((label: string) => label.toLowerCase()));
      if (set.size !== labels.length) return { ok: false, error: `Группа "${g.name}" содержит дубли значений` };
    }
  }
  return { ok: true };
}

export function validateVariants(optionGroups: any[], variants: any[]): ValidateResult {
  if (!Array.isArray(variants)) return { ok: false, error: "variants должен быть массивом" };

  const groups = (Array.isArray(optionGroups) ? optionGroups : []).filter((g) => g?.type !== "text");
  const requiredGroups = groups.filter((g) => !!g.required);

  for (const v of variants) {
    if (!v?.id) return { ok: false, error: "У варианта должен быть id" };
    if (!v?.selections || typeof v.selections !== "object") return { ok: false, error: "У варианта должен быть selections" };

    for (const g of requiredGroups) {
      const sel = v.selections[g.id];
      const bad =
        sel === undefined ||
        sel === null ||
        sel === "" ||
        (Array.isArray(sel) && sel.length === 0);
      if (bad) return { ok: false, error: "Нельзя иметь вариант без полного набора обязательных опций" };
    }
  }

  return { ok: true };
}
