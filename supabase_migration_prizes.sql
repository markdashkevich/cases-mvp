-- Создание таблицы prizes для управления призами
CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  type TEXT DEFAULT 'currency',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индекс для быстрого поиска активных призов
CREATE INDEX IF NOT EXISTS idx_prizes_active ON prizes(is_active) WHERE is_active = true;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prizes_updated_at
  BEFORE UPDATE ON prizes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RPC функция для получения случайного активного приза по весам
CREATE OR REPLACE FUNCTION get_random_prize()
RETURNS TABLE(id TEXT, title TEXT, weight INTEGER, type TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH weighted_prizes AS (
    SELECT 
      p.id,
      p.title,
      p.weight,
      p.type,
      SUM(p.weight) OVER (ORDER BY p.id) - p.weight as cumulative_start,
      SUM(p.weight) OVER (ORDER BY p.id) as cumulative_end
    FROM prizes p
    WHERE p.is_active = true
  ),
  total_weight AS (
    SELECT SUM(weight)::FLOAT as total FROM prizes WHERE is_active = true
  ),
  random_value AS (
    SELECT (random() * (SELECT COALESCE(total, 1) FROM total_weight))::FLOAT as r
  )
  SELECT 
    wp.id,
    wp.title,
    wp.weight,
    wp.type
  FROM weighted_prizes wp, random_value rv
  WHERE rv.r >= wp.cumulative_start AND rv.r < wp.cumulative_end
  ORDER BY wp.cumulative_start
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Вставка текущих призов из кода
INSERT INTO prizes (id, title, weight, type) VALUES
  ('L1', '1 000 000', 1, 'currency'),
  ('R1', '500 000', 2, 'currency'),
  ('R2', '300 000', 4, 'currency'),
  ('C1', '10 000', 3000, 'currency'),
  ('C2', '10 000', 3000, 'currency'),
  ('C3', '10 000', 3000, 'currency')
ON CONFLICT (id) DO NOTHING;

