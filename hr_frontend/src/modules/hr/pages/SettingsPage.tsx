import { useState } from "react";
import { Check, Info, Save, Settings2 } from "lucide-react";
import { useHr } from "../../../store/HrContext";
import { Button, Field, PageHeading } from "../../../components/ui";
import type { HrSettings } from "../../../api/types";
import { HrFeedback } from "./HrManagementShared";
import "./HrManagement.css";

export default function SettingsPage() {
  const { state, updateSettings } = useHr();
  const [form, setForm] = useState<HrSettings>({ ...state.settings });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = JSON.stringify(form) !== JSON.stringify(state.settings);
  const change = <K extends keyof HrSettings>(key: K, value: HrSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!form.organizationName.trim())
        throw new Error("Укажите название организации.");
      if (!form.certificatePrefix.trim())
        throw new Error("Укажите префикс номера сертификата.");
      if (
        !Number.isInteger(form.defaultPassPercent) ||
        form.defaultPassPercent < 1 ||
        form.defaultPassPercent > 100
      )
        throw new Error("Проходной балл должен быть целым числом от 1 до 100.");
      if (
        !Number.isInteger(form.defaultTimeLimitMinutes) ||
        form.defaultTimeLimitMinutes < 0 ||
        form.defaultTimeLimitMinutes > 1440
      )
        throw new Error("Время на тест — от 0 до 1440 минут.");
      if (
        !Number.isInteger(form.defaultMaxAttempts) ||
        form.defaultMaxAttempts < 0 ||
        form.defaultMaxAttempts > 100
      )
        throw new Error("Количество попыток — целое число от 0 до 100.");
      if (
        !Number.isInteger(form.notificationDaysBefore) ||
        form.notificationDaysBefore < 0 ||
        form.notificationDaysBefore > 365
      )
        throw new Error("Напоминание — от 0 до 365 дней до срока.");
      updateSettings({
        ...form,
        organizationName: form.organizationName.trim(),
        certificatePrefix: form.certificatePrefix.trim(),
      });
      setMessage(
        "Настройки сохранены. Новые тесты будут создаваться с указанными параметрами.",
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить настройки.",
      );
    }
  };
  return (
    <div className="page">
      <PageHeading
        title="Настройки модуля"
        subtitle="Организация и параметры обучения по умолчанию"
      />
      <HrFeedback message={error || message} error={Boolean(error)} />
      <div className="hr-settings-layout">
        <form className="panel" onSubmit={save}>
          <section className="hr-settings-section">
            <h3>
              <Settings2 size={17} className="hr-inline-icon" />
              Общие сведения
            </h3>
            <p>
              Данные организации используются в модуле и в сертификатах об
              окончании обучения.
            </p>
            <div className="form-grid">
              <Field label="Наименование организации" required>
                <input
                  value={form.organizationName}
                  maxLength={180}
                  onChange={(event) =>
                    change("organizationName", event.target.value)
                  }
                  required
                />
              </Field>
              <Field
                label="Префикс номера сертификата"
                required
                hint="Например: SAQ. Номер формируется при завершении курса."
              >
                <input
                  value={form.certificatePrefix}
                  maxLength={24}
                  onChange={(event) =>
                    change("certificatePrefix", event.target.value)
                  }
                  required
                />
              </Field>
            </div>
          </section>
          <section className="hr-settings-section">
            <h3>Параметры тестирования</h3>
            <p>
              Значения подставляются при создании нового теста. В каждом тесте
              их можно изменить отдельно.
            </p>
            <div className="form-grid">
              <Field label="Проходной балл, %" required>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={form.defaultPassPercent}
                  onChange={(event) =>
                    change("defaultPassPercent", Number(event.target.value))
                  }
                  required
                />
              </Field>
              <Field
                label="Время на тест, минут"
                required
                hint="0 — без ограничения времени."
              >
                <input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  value={form.defaultTimeLimitMinutes}
                  onChange={(event) =>
                    change(
                      "defaultTimeLimitMinutes",
                      Number(event.target.value),
                    )
                  }
                  required
                />
              </Field>
              <Field
                label="Количество попыток"
                required
                hint="0 — без ограничения количества попыток."
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.defaultMaxAttempts}
                  onChange={(event) =>
                    change("defaultMaxAttempts", Number(event.target.value))
                  }
                  required
                />
              </Field>
            </div>
          </section>
          <section className="hr-settings-section">
            <h3>Напоминания о сроках</h3>
            <p>
              Выберите, за сколько дней назначение будет отображаться среди
              ближайших сроков и требовать внимания кадровой службы.
            </p>
            <div className="form-grid">
              <Field
                label="Дней до окончания обучения"
                required
                hint="0 — только назначения со сроком сегодня и просроченные."
              >
                <input
                  type="number"
                  min="0"
                  max="365"
                  step="1"
                  value={form.notificationDaysBefore}
                  onChange={(event) =>
                    change("notificationDaysBefore", Number(event.target.value))
                  }
                  required
                />
              </Field>
            </div>
          </section>
          <footer className="hr-settings-buttons">
            <Button
              variant="outline"
              disabled={!changed}
              onClick={() => {
                setForm({ ...state.settings });
                setError("");
                setMessage("");
              }}
            >
              Отменить изменения
            </Button>
            <Button type="submit" disabled={!changed}>
              <Save size={16} />
              Сохранить настройки
            </Button>
          </footer>
        </form>
        <aside className="panel hr-settings-aside">
          <h3>
            <Info size={17} className="hr-inline-icon" />
            Как применяются настройки
          </h3>
          <ul>
            <li>Параметры уже созданных тестов сохраняются.</li>
            <li>
              Проходной балл влияет на успешность тестирования, а завершение
              курса также учитывает изученные материалы.
            </li>
            <li>
              Кадровая служба видит сроки, результаты и историю попыток
              сотрудников.
            </li>
          </ul>
          <p>
            <Check size={15} className="hr-inline-icon" />
            Сохранённые настройки действуют после перезагрузки страницы.
          </p>
        </aside>
      </div>
    </div>
  );
}
