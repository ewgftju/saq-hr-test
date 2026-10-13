import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
} from "react";
import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";
import { Inbox, X } from "lucide-react";

export type Tone = "blue" | "green" | "amber" | "red" | "gray" | "test";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "blue",
  children,
  className = "",
}: PropsWithChildren<{ tone?: Tone; className?: string }>) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function PageHeading({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </section>
  );
}

export function StatCard({
  value,
  label,
  caption,
  tone = "blue",
  icon,
}: {
  value: string | number;
  label: string;
  caption?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <section className={`panel stat-card stat-${tone}`}>
      <div className="stat-card-top">
        <span>{label}</span>
        {icon && (
          <span className="stat-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon || <Inbox size={28} />}
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

export function Progress({
  value,
  label = "Прогресс обучения",
  showLabel = true,
  tone = "blue",
}: {
  value: number;
  label?: string;
  showLabel?: boolean;
  tone?: Tone;
}) {
  const progress = Math.min(
    100,
    Math.max(0, Number.isFinite(value) ? value : 0),
  );
  return (
    <div className={`progress-block progress-${tone}`}>
      <div
        className="progress"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      {showLabel && (
        <span className="progress-value">{Math.round(progress)}%</span>
      )}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className = "",
}: PropsWithChildren<{
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}>) {
  const fieldId = useId();
  const descriptionId = `${fieldId}-description`;
  type FieldChildProps = {
    id?: string;
    children?: ReactNode;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  };
  const controls: { id?: string }[] = [];
  const findControls = (nodes: ReactNode) =>
    Children.forEach(nodes, (node) => {
      if (!isValidElement<FieldChildProps>(node)) return;
      if (
        typeof node.type === "string" &&
        ["input", "select", "textarea"].includes(node.type)
      )
        controls.push({ id: node.props.id });
      else if (node.props.children) findControls(node.props.children);
    });
  findControls(children);
  const controlId = controls[0]?.id || fieldId;
  const description = error || hint;
  const labelContent = (
    <>
      {label}
      {required && (
        <span className="required" aria-label="Обязательное поле">
          {" "}
          *
        </span>
      )}
    </>
  );
  const feedback = description ? (
    <small
      id={descriptionId}
      className={error ? "field-error" : "field-hint"}
      role={error ? "alert" : undefined}
    >
      {description}
    </small>
  ) : null;
  const fieldClass = `field ${error ? "field-invalid" : ""} ${className}`;

  if (controls.length !== 1) {
    return (
      <fieldset
        className={`${fieldClass} field-group`}
        aria-describedby={description ? descriptionId : undefined}
      >
        <legend className="field-label">{labelContent}</legend>
        {children}
        {feedback}
      </fieldset>
    );
  }

  const associateControl = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (node) => {
      if (!isValidElement<FieldChildProps>(node)) return node;
      if (
        typeof node.type === "string" &&
        ["input", "select", "textarea"].includes(node.type)
      ) {
        return cloneElement(node, {
          id: controlId,
          "aria-describedby":
            [node.props["aria-describedby"], description ? descriptionId : ""]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : node.props["aria-invalid"],
          "aria-required": required ? true : node.props["aria-required"],
        });
      }
      return node.props.children
        ? cloneElement(node, {
            children: associateControl(node.props.children),
          })
        : node;
    });
  return (
    <div className={fieldClass}>
      <label className="field-label" htmlFor={controlId}>
        {labelContent}
      </label>
      {associateControl(children)}
      {feedback}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}>) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() =>
      (focusable()[0] || dialog.current)?.focus(),
    );
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) {
          event.preventDefault();
          dialog.current?.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === items[0] ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}
