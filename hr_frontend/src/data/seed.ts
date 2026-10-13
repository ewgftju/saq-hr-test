import type {
  Assignment,
  Course,
  Employee,
  HrState,
  Question,
  Test,
} from "../api/types";
import { gradeAttempt, makeAttempt } from "../store/hrDomain";

const isoDay = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const atDay = (offset: number) => `${isoDay(offset)}T09:00:00.000Z`;
const question = (
  id: string,
  text: string,
  options: string[],
  correct = 0,
): Question => ({
  id,
  text,
  type: "single",
  options: options.map((text, i) => ({ id: `${id}-${i}`, text })),
  correctAnswers: [`${id}-${correct}`],
  points: 10,
  explanation:
    "Сопоставьте ответ с материалами курса и применяйте принцип документального подтверждения.",
});
const test = (id: string, title: string, questions: Question[]): Test => ({
  id,
  title,
  questions,
  description:
    "Проверка усвоения учебного материала. Демонстрационные вопросы.",
  timeLimitMinutes: 20,
  passPercent: 70,
  maxAttempts: 3,
  shuffleQuestions: false,
  shuffleAnswers: false,
  allowNegativeMarking: false,
  negativePoints: 1,
  questionLimit: 0,
  showAnswers: true,
  showHistory: true,
  status: "published",
});
const lessonText = [
  "Цель урока — освоить последовательность работы и понять, какие сведения необходимо фиксировать.\n\n1. Изучите задачу и определите ожидаемый результат.\n2. Соберите исходные документы и проверьте полноту данных.\n3. Зафиксируйте выводы со ссылкой на подтверждающие материалы.\n4. Передайте результат на проверку ответственному сотруднику.\n\nПрактическое задание\nПредставьте, что вам переданы материалы нового мероприятия. Составьте список недостающих сведений и определите последовательность действий. После изучения нажмите «Урок изучен».",
  "В SAQ процесс проходит по установленному маршруту: подготовка, согласование, утверждение и исполнение. Каждый участник действует в пределах своей роли.\n\nРабота с документами\nПроверьте обязательные поля, сведения об объекте и сроки. Изменения следует фиксировать до отправки на согласование. Если есть замечания, документ возвращается автору на доработку.\n\nКонтроль результата\nНе считайте процесс завершённым до получения итогового статуса. Следите за уведомлениями и сроками исполнения.",
];
function course(
  id: string,
  title: string,
  category: string,
  hours: number,
  testId?: string,
): Course {
  return {
    id,
    title,
    description:
      "Практическая программа для сотрудников государственного аудита. Материалы помогают закрепить порядок работы, освоить инструменты SAQ и проверить полученные знания.",
    category,
    durationHours: hours,
    status: "published",
    testId,
    coverColor: "#e5f2ef",
    updatedAt: atDay(-3),
    instructor: "Учебный центр SAQ",
    tags: ["Повышение квалификации", "Государственный аудит"],
    allowSelfEnrollment: true,
    certificateEnabled: true,
    chapters: [
      {
        id: `${id}-chapter1`,
        title: "Основы и порядок работы",
        lessons: [
          {
            id: `${id}-l1`,
            title: "Введение и основные понятия",
            type: "text",
            content: lessonText[0],
            durationMinutes: 15,
          },
          {
            id: `${id}-l2`,
            title: "Практическое применение в SAQ",
            type: "text",
            content: lessonText[1],
            durationMinutes: 20,
          },
        ],
      },
    ],
  };
}
export function createSeedState(): HrState {
  const names = [
    "Жукенов Каримжан Амангельдыевич",
    "Алиев Данияр Ерланович",
    "Серикова Алия Муратовна",
    "Ким Виктор Андреевич",
    "Садыкова Амина Нурлановна",
    "Омаров Тимур Рустемович",
    "Петрова Елена Викторовна",
    "Нуржанова Дана Асхатовна",
    "Исаев Арман Болатович",
    "Ахметова Мадина Ермековна",
  ];
  const departments = [
    "Кадровая служба",
    "Управление государственного аудита",
    "Управление государственного аудита",
    "Управление контроля качества",
    "Управление профилактического контроля",
    "Управление рисков",
    "Управление контроля качества",
    "Управление рисков",
    "Управление профилактического контроля",
    "Кадровая служба",
  ];
  const employees: Employee[] = names.map((name, i) => ({
    id: `employee-${i + 1}`,
    name,
    department: departments[i],
    email: `employee${i + 1}@demo.saq.local`,
    position:
      i === 0
        ? "Руководитель отдела"
        : i === 9
          ? "Специалист кадровой службы"
          : "Главный эксперт",
    status: "active",
    avatarColor: ["#d9ebe8", "#e7eaf4", "#f2e9de"][i % 3],
    hiredAt: "2023-04-10",
    registeredAt: atDay(-90 - i),
    seniorityYears: 2 + i,
  }));
  const tests: Test[] = [
    test("test-1", "Основы государственного аудита", [
      question("q1", "Что необходимо сделать перед формированием выводов?", [
        "Проверить подтверждающие документы",
        "Сразу направить заключение",
        "Закрыть мероприятие",
      ]),
      question(
        "q2",
        "Когда документ считается утверждённым?",
        [
          "После сохранения черновика",
          "После завершения маршрута утверждения",
          "После просмотра коллегой",
        ],
        1,
      ),
      {
        id: "q3",
        type: "multiple",
        text: "Что необходимо проверить перед согласованием?",
        options: [
          { id: "q3-a", text: "Полноту обязательных полей" },
          { id: "q3-b", text: "Подтверждающие материалы" },
          { id: "q3-c", text: "Цвет рабочего стола" },
        ],
        correctAnswers: ["q3-a", "q3-b"],
        points: 10,
        explanation:
          "Полнота сведений и наличие подтверждающих материалов необходимы для обоснованного решения.",
      },
    ]),
    test("test-2", "Информационная безопасность", [
      question(
        "s1",
        "Как следует хранить пароль?",
        [
          "В открытом документе",
          "В защищённом менеджере паролей",
          "В общем чате",
        ],
        1,
      ),
      question(
        "s2",
        "Что делать с подозрительным письмом?",
        [
          "Открыть вложение",
          "Переслать всем коллегам",
          "Сообщить ответственному за безопасность",
        ],
        2,
      ),
      {
        id: "s3",
        type: "text",
        text: "Как называется дополнительный этап подтверждения входа? Укажите аббревиатуру из трёх символов.",
        options: [],
        correctAnswers: ["2FA", "MFA"],
        points: 10,
        explanation: "2FA / MFA — дополнительная проверка при входе.",
      },
    ]),
    test("test-3", "Практикум по контролю качества", [
      question("k1", "Какие замечания помогают доработать документ?", [
        "Конкретные, с указанием места и причины",
        "Только общие",
        "Без указания основания",
      ]),
      {
        id: "k2",
        type: "open",
        text: "Опишите порядок возврата документа на доработку при выявлении неполных подтверждающих материалов.",
        options: [],
        correctAnswers: [],
        points: 20,
        explanation:
          "Оцените полноту и последовательность действий, конкретность замечаний.",
      },
    ]),
  ];
  const courses = [
    course(
      "course-1",
      "Основы государственного аудита",
      "Государственный аудит",
      8,
      "test-1",
    ),
    course(
      "course-2",
      "Информационная безопасность",
      "Обязательное обучение",
      4,
      "test-2",
    ),
    course(
      "course-3",
      "Контроль качества аудиторских материалов",
      "Контроль качества",
      12,
      "test-3",
    ),
    course("course-4", "Работа в системе SAQ", "Работа в SAQ", 6),
    course(
      "course-5",
      "Управление рисками и формирование перечня",
      "Управление рисками",
      10,
    ),
    {
      ...course(
        "course-6",
        "Профилактический контроль: практический курс",
        "Профилактический контроль",
        8,
      ),
      status: "draft" as const,
    },
  ];
  const assignments: Assignment[] = [];
  const add = (
    employee: number,
    courseNumber: number,
    deadline: number,
    progress = 0,
  ) => {
    const c = courses[courseNumber - 1];
    assignments.push({
      id: `assignment-${employee}-${courseNumber}`,
      employeeId: `employee-${employee}`,
      courseId: c.id,
      assignedAt: atDay(-14),
      deadline: isoDay(deadline),
      required: true,
      completedLessonIds: c.chapters
        .flatMap((ch) => ch.lessons)
        .slice(0, progress)
        .map((l) => l.id),
    });
  };
  add(1, 1, 7, 1);
  add(1, 2, -2);
  add(1, 4, 10, 2);
  add(1, 3, 14, 2);
  add(2, 1, 5, 2);
  add(2, 2, 8, 1);
  add(3, 1, -3, 2);
  add(3, 4, 9, 2);
  add(4, 3, 6, 2);
  add(5, 1, 12);
  add(5, 4, 4, 1);
  add(6, 5, 3, 1);
  add(6, 2, -1);
  add(7, 3, 15, 2);
  add(8, 5, 20, 2);
  add(9, 2, 2);
  add(10, 4, 10, 2);
  assignments.forEach((a) => {
    if (
      [
        "assignment-1-4",
        "assignment-3-4",
        "assignment-8-5",
        "assignment-10-4",
      ].includes(a.id)
    )
      a.completedAt = atDay(-2);
  });
  const state: HrState = {
    reviews: [
      {
        id: "review-1",
        courseId: "course-1",
        employeeId: "employee-2",
        rating: 5,
        text: "Понятная последовательность уроков и полезная проверка знаний.",
        createdAt: atDay(-1),
      },
    ],
    version: 1,
    employees,
    courses,
    tests,
    assignments,
    attempts: [],
    programs: [
      {
        id: "program-1",
        title: "Вводное обучение сотрудника",
        description:
          "Обязательная подготовка: основы аудита, безопасность и работа в системе.",
        courseIds: ["course-1", "course-2", "course-4"],
        employeeIds: ["employee-1", "employee-2", "employee-3"],
        deadline: isoDay(20),
        status: "published",
      },
      {
        id: "program-2",
        title: "Повышение квалификации экспертов",
        description: "Контроль качества и управление рисками.",
        courseIds: ["course-3", "course-5"],
        employeeIds: ["employee-4", "employee-7", "employee-8"],
        deadline: isoDay(30),
        status: "draft",
      },
    ],
    resources: [
      {
        id: "resource-1",
        title: "Официальный портал SAQ",
        description: "Доступ к системе государственного аудита.",
        category: "Полезные ссылки",
        type: "link",
        url: "https://saq.gov.kz/",
        updatedAt: atDay(-3),
      },
      {
        id: "resource-2",
        title: "Информационно-правовая система «Әділет»",
        description: "Поиск нормативных правовых актов Республики Казахстан.",
        category: "Нормативные материалы",
        type: "link",
        url: "https://adilet.zan.kz/rus",
        updatedAt: atDay(-5),
      },
    ],
    notifications: [
      {
        id: "notification-1",
        audience: "employee",
        employeeId: "employee-1",
        title: "Назначен новый курс",
        message:
          "Завершите «Основы государственного аудита» в установленный срок.",
        createdAt: atDay(-1),
        read: false,
        type: "assignment",
        href: "/my-learning",
      },
      {
        id: "notification-2",
        audience: "hr",
        title: "Требуется проверка открытых ответов",
        message:
          "Две попытки практикума по контролю качества ожидают проверки.",
        createdAt: atDay(-1),
        read: false,
        type: "result",
        href: "/results",
      },
      {
        id: "notification-3",
        audience: "employee",
        employeeId: "employee-1",
        title: "Истёк срок обучения",
        message:
          "Срок курса «Информационная безопасность» истёк. Пройдите обучение или обратитесь в кадровую службу.",
        createdAt: atDay(0),
        read: false,
        type: "deadline",
        href: "/my-learning",
      },
    ],
    settings: {
      organizationName: "SAQ · Система государственного аудита",
      certificatePrefix: "SAQ-HR",
      defaultPassPercent: 70,
      defaultTimeLimitMinutes: 20,
      defaultMaxAttempts: 3,
      notificationDaysBefore: 3,
    },
  };
  const addAttempt = (
    assignmentId: string,
    mode: "pass" | "fail" | "review",
  ) => {
    const a = makeAttempt(state, assignmentId, new Date(atDay(-2)));
    const answers = Object.fromEntries(
      a.questions.map((q) => [
        q.id,
        q.type === "open"
          ? [
              "Зафиксировать конкретное замечание, указать недостающие материалы, вернуть автору и повторно проверить после доработки.",
            ]
          : mode === "fail"
            ? [
                q.options.find((o) => !q.correctAnswers.includes(o.id))?.id ??
                  "неверно",
              ]
            : q.correctAnswers,
      ]),
    );
    const result = gradeAttempt(
      a,
      answers,
      new Date(Date.parse(a.startedAt) + 60_000),
    );
    state.attempts.push(result);
    if (result.status === "passed")
      state.assignments.find((item) => item.id === assignmentId)!.completedAt =
        result.submittedAt;
  };
  addAttempt("assignment-2-1", "pass");
  addAttempt("assignment-3-1", "fail");
  addAttempt("assignment-4-3", "review");
  addAttempt("assignment-7-3", "review");
  return state;
}
