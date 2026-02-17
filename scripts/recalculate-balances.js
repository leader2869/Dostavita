// Скрипт для автоматического пересчета балансов через Supabase API
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Отсутствуют переменные окружения SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql) {
  // Используем RPC для выполнения SQL
  // Но лучше использовать прямой запрос через PostgREST или psql
  // Для этого нужно использовать connection string к базе
  
  // Альтернатива: выполняем SQL через Supabase REST API
  // Но это требует использования PostgREST напрямую
  
  console.log('Выполняем SQL через Supabase...');
  
  // Читаем SQL из миграции
  const migrationPath = path.join(__dirname, '../supabase/migrations/102_recalculate_all_balances.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  
  // Разбиваем на отдельные запросы
  const queries = sqlContent
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0 && !q.startsWith('--'));
  
  console.log(`Найдено ${queries.length} SQL запросов`);
  
  // К сожалению, Supabase JS client не поддерживает выполнение произвольного SQL
  // Нужно использовать psql или Supabase Management API
  
  console.log('⚠️  Supabase JS client не поддерживает выполнение произвольного SQL');
  console.log('📋 Выполните SQL вручную в Supabase Dashboard -> SQL Editor');
  console.log('\nSQL для выполнения:');
  console.log('='.repeat(50));
  console.log(sqlContent);
  console.log('='.repeat(50));
}

async function main() {
  try {
    await executeSQL();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();

