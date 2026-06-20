# Архітектура проекту UTRADE

Цей документ описує загальну гібридну архітектуру платформи UTRADE. Проект поєднує в собі генерацію статичних JSON-файлів з бекенд-джерел та динамічний React-додаток (Single Page Application).

## Схема потоку даних (Data Flow)

1. **Джерела (Suppliers):** `ЯВШОКЕ` (XML) та `Mastereva` (XML).
2. **Бекенд/Парсинг (`process.mjs`):**
   - Node.js скрипт, який працює за розкладом або вручну.
   - Скачує XML-фіди від постачальників.
   - Парсить, чистить, фільтрує товари.
   - Розрізає товари на дрібні JSON-шарди (`shards/`), генерує головний `index.json` та файли категорій `categories.json`.
   - Також генерує готові XML автопрайси у директорії `exports/`.
   - Усі ці файли фізично зберігаються у папці `frontend/public/data` та `frontend/public/exports`.
3. **Фронтенд (`frontend/`):**
   - Побудовано на `Vite` + `React` + `TypeScript`.
   - Компонент `Catalog.tsx` динамічно завантажує `index.json` з папки `data/` і відображає товари.
   - Авторизація реалізована через `Supabase` (Context API).
   - Стилізація: `Tailwind CSS` + `Shadcn UI`.
4. **Збірка та Деплой (`.github/workflows/update.yml`):**
   - GitHub Actions виконує `npm install`.
   - Запускає `node process.mjs` (який наповнює `frontend/public/`).
   - Переходить у папку `frontend`, запускає `npm run build` (Vite збирає весь проект і копіює public у `dist`).
   - Директорія `frontend/dist` публікується на GitHub Pages.

## Структура директорій

```
/
├── .github/
│   └── workflows/
│       └── update.yml         # CI/CD пайплайн для збірки та деплою
├── frontend/
│   ├── public/
│   │   ├── data/              # (Генерується автоматично) JSON файли каталогу
│   │   └── exports/           # (Генерується автоматично) XML автопрайси
│   ├── src/
│   │   ├── components/        # UI компоненти (Layout, Shadcn компоненти)
│   │   ├── contexts/          # React Context (AuthContext)
│   │   ├── lib/               # Утиліти (supabase client, tailwind utils)
│   │   ├── pages/             # Сторінки додатку (Catalog, Cabinet, AuthPage)
│   │   ├── App.tsx            # Головний роутер
│   │   └── index.css          # Глобальні стилі та Tailwind-змінні
│   ├── index.html             # Точка входу Vite
│   ├── package.json           # Залежності фронтенду
│   ├── tailwind.config.js     # Конфіг стилів
│   └── tsconfig.json          # Конфіг TypeScript
├── presets/                   # Збережені автопрайси користувачів (JSON конфіги)
├── process.mjs                # Скрипт парсингу і генерації даних
├── suppliers.js               # Довідник категорій/маппінгу постачальників
├── AI_RULES.md                # Правила для ШІ
├── ARCHITECTURE.md            # Цей файл
└── CHANGELOG.md               # Журнал змін
```

## Структура бази даних (Supabase)

Проект використовує Supabase для аутентифікації та зберігання даних користувачів. 
- **Таблиця `profiles` (запланована):** Зберігає додаткові дані користувача (телефон, налаштування).
- **Таблиця `orders` (запланована):** Зберігає історію замовлень, згенерованих через кошик.

## Формат `index.json` (Головний каталог)

Згенерований файл `frontend/public/data/index.json` має наступну структуру (максимально мініфіковано для продуктивності):
```json
{
  "meta": { "totalProducts": 116000, "updatedAt": "..." },
  "products": [
    {
      "id": "123",      // Унікальний ID товару
      "a": 1,           // Наявність (1 - є, 0 - немає)
      "c": "12",        // Категорія
      "pr": 100,        // Ціна закупівлі (Опт)
      "n": "Назва",     // Назва товару
      "i": "url",       // Відносний шлях до фотографії або повний URL
      "s": "yavshoke"   // Джерело постачальника (yavshoke, mastereva)
    }
  ]
}
```

## Вирішення типових проблем (Troubleshooting)
1. **Збій при парсингу (`process.mjs`):** Якщо падає з помилкою `heap out of memory`, потрібно запускати його з розширеною пам'яттю: `node --max-old-space-size=4096 process.mjs` (вже налаштовано в GitHub Actions).
2. **Відсутність модулів (ERR_MODULE_NOT_FOUND):** Спершу завжди запускайте `npm install` в корені проекту для `process.mjs`, а потім `npm install` всередині `frontend/` для React.
3. **Дані не оновлюються на фронтенді:** Перевірте, чи був викликаний `process.mjs` локально, і чи з'явились оновлені файли у `frontend/public/data/`.
