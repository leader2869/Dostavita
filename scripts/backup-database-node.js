// Скрипт для резервного копирования базы данных Supabase и отправки на почту (Node.js версия)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

(async function main() {
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const DB_CONNECTION_STRING = process.env.SUPABASE_DB_CONNECTION_STRING;
const BACKUP_EMAIL = process.env.BACKUP_EMAIL;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL не найден в .env.local');
  process.exit(1);
}

if (!DB_CONNECTION_STRING) {
  console.error('❌ SUPABASE_DB_CONNECTION_STRING не найден в .env.local');
  console.error('\n📋 Получите connection string из Supabase Dashboard:');
  console.error('   Settings -> Database -> Connection string -> Connection pooling');
  process.exit(1);
}

// Создаем директорию для бэкапов
const BACKUP_DIR = path.join(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Имя файла бэкапа
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFile = path.join(BACKUP_DIR, `dostavita_backup_${timestamp}.sql`);
const backupFileZip = `${backupFile}.gz`;

console.log('📦 Начинаем резервное копирование базы данных...');

// Проверяем наличие pg_dump
try {
  execSync('which pg_dump', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ pg_dump не найден. Установите PostgreSQL:');
  console.error('   macOS: brew install postgresql@15');
  process.exit(1);
}

// Создаем дамп базы данных
console.log('🔄 Создаем дамп базы данных...');
try {
  execSync(
    `pg_dump "${DB_CONNECTION_STRING}" --no-owner --no-acl --clean --if-exists --format=plain -f "${backupFile}"`,
    { stdio: 'inherit' }
  );
} catch (error) {
  console.error('❌ Ошибка создания дампа:', error.message);
  process.exit(1);
}

if (!fs.existsSync(backupFile) || fs.statSync(backupFile).size === 0) {
  console.error('❌ Файл бэкапа пуст или не создан');
  process.exit(1);
}

// Сжимаем файл
console.log('🗜️  Сжимаем файл бэкапа...');
try {
  execSync(`gzip -f "${backupFile}"`);
} catch (error) {
  console.error('❌ Ошибка сжатия файла:', error.message);
  process.exit(1);
}

const fileSize = (fs.statSync(backupFileZip).size / 1024 / 1024).toFixed(2);
console.log(`✅ Бэкап создан: ${path.basename(backupFileZip)} (${fileSize} MB)`);

// Отправляем на почту
if (BACKUP_EMAIL) {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.warn('⚠️  SMTP_USER или SMTP_PASSWORD не указаны. Пропускаем отправку на почту.');
    console.warn('   Добавьте в .env.local:');
    console.warn('   SMTP_USER=your-email@gmail.com');
    console.warn('   SMTP_PASSWORD=your-app-password');
  } else {
    console.log(`📧 Отправляем бэкап на ${BACKUP_EMAIL}...`);
    
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });

    const mailOptions = {
      from: SMTP_USER,
      to: BACKUP_EMAIL,
      subject: `Dostavita DB Backup - ${new Date().toLocaleDateString('ru-RU')}`,
      text: `Резервная копия базы данных Dostavita от ${new Date().toLocaleString('ru-RU')}\n\nРазмер файла: ${fileSize} MB`,
      attachments: [
        {
          filename: path.basename(backupFileZip),
          path: backupFileZip,
        },
      ],
    };

    transporter.sendMail(mailOptions)
      .then(() => {
        console.log('✅ Бэкап отправлен на почту');
      })
      .catch((error) => {
        console.error('❌ Ошибка отправки на почту:', error.message);
      });
  }
} else {
  console.log(`ℹ️  BACKUP_EMAIL не указан. Бэкап сохранен локально: ${backupFileZip}`);
}

// Удаляем старые бэкапы (оставляем последние 7 дней)
console.log('🧹 Удаляем старые бэкапы (старше 7 дней)...');
try {
  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  files.forEach(file => {
    if (file.startsWith('dostavita_backup_') && file.endsWith('.sql.gz')) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`   Удален: ${file}`);
      }
    }
  });
} catch (error) {
  console.warn('⚠️  Ошибка удаления старых бэкапов:', error.message);
}

console.log('✅ Резервное копирование завершено!');
})();

