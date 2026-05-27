import { useCallback, useRef } from "react";

/**
 * useFormFields — returns a stable `set` function that updates a single field
 * in a form state object without creating new function references on every render.
 *
 * Usage:
 *   const [form, setForm] = useState({ name: "", email: "" });
 *   const setField = useFormFields(setForm);
 *   // In JSX:
 *   <Field onChange={setField("name")} value={form.name} ... />
 *
 * The returned `setField("name")` reference is stable across renders because
 * it's memoized by field key. This allows React.memo on Field to work correctly
 * and prevents unnecessary re-renders when other form fields change.
 */
export function useFormFields<T extends Record<string, unknown>>(
  setter: React.Dispatch<React.SetStateAction<T>>
): (field: keyof T) => (value: string) => void {
  // Cache one callback per field key so references stay stable
  const cache = useRef<Partial<Record<keyof T, (value: string) => void>>>({});

  return useCallback(
    (field: keyof T) => {
      if (!cache.current[field]) {
        cache.current[field] = (value: string) =>
          setter((prev) => ({ ...prev, [field]: value }));
      }
      return cache.current[field]!;
    },
    [setter]
  );
}
