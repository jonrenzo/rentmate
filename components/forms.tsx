"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  options?: { value: string; label: string }[];
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  hint?: string;
};
export type FormSpec = {
  title: string;
  description?: string;
  fields: Field[];
  content?: ReactNode;
  submit?: string;
  run: (data: FormData) => Promise<void>;
};
export function FormDialog({
  spec,
  close,
}: {
  spec: FormSpec;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <div className="dialog-head">
        <h2>{spec.title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {spec.description && <p className="muted">{spec.description}</p>}
      {spec.content}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await spec.run(data);
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          {spec.fields.map((f) => (
            <label
              className={f.type === "checkbox" ? "check-field" : "field"}
              key={f.name}
            >
              {f.type === "checkbox" ? (
                <>
                  <input
                    name={f.name}
                    type="checkbox"
                    defaultChecked={f.value === "true"}
                  />
                  {f.label}
                </>
              ) : (
                <>
                  {f.label}
                  {f.options ? (
                    <select
                      name={f.name}
                      defaultValue={f.value}
                      required={f.required !== false}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      name={f.name}
                      defaultValue={f.value}
                      required={f.required !== false}
                    />
                  ) : (
                    <input
                      name={f.name}
                      type={f.type || "text"}
                      defaultValue={f.type === "file" ? undefined : f.value}
                      required={f.required !== false}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      accept={
                        f.type === "file"
                          ? "image/png,image/jpeg,image/webp"
                          : undefined
                      }
                      autoComplete={
                        f.type === "password" ? "new-password" : "off"
                      }
                    />
                  )}
                </>
              )}
              {f.hint && <small>{f.hint}</small>}
            </label>
          ))}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary full" type="submit">
            {busy ? "Saving…" : spec.submit || "Save changes"}
          </button>
        </fieldset>
      </form>
    </dialog>
  );
}
export const str = (data: FormData, key: string) => String(data.get(key) || "");
