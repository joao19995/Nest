-- 014: separa Item de Categoria (modelo do Excel).
--
-- No Excel cada linha é um Item (Luz, Água, Internet, Gás...) com Categoria
-- (Casa), Conta e Tipo. Na app, UNIQUE(template_id, category_id) e
-- UNIQUE(monthly_plan_id, category_id) obrigavam a uma conta por categoria.
-- A partir daqui o template mensal e o plano mensal são por item: cada item
-- tem a sua conta, por isso a mesma categoria pode ter itens em contas
-- diferentes. O cálculo de contribuições não muda (continua por conta e
-- valores, sem olhar a itens/categorias).
--
-- Efeito nos dados existentes:
-- - Cria a tabela item e, para cada categoria existente, um item com o
--   mesmo nome e o mesmo estado ativo (1:1 automático; o utilizador pode
--   depois dividir a categoria em vários itens na página Categorias).
-- - category_template_entry e monthly_plan_entry ganham item_id preenchido
--   a partir da categoria (NOT NULL) e a unicidade passa para
--   (template_id, item_id) / (monthly_plan_id, item_id) via índices únicos.
-- - category_id é mantido nas duas tabelas como snapshot histórico.
-- - Meses fechados ficam exatamente iguais: planned, actual, category_id e
--   account_id nunca são alterados — só é preenchido o novo item_id.
--
-- Idempotente e nunca apaga dados: só CREATE/ADD COLUMN IF NOT EXISTS,
-- INSERT ... WHERE NOT EXISTS, UPDATE de preenchimento, DROP CONSTRAINT
-- IF EXISTS e CREATE UNIQUE INDEX IF NOT EXISTS. Sem DELETE nem DROP COLUMN.
-- Nao correr migracoes contra producao como parte de tarefas de codigo.

CREATE TABLE IF NOT EXISTS item (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category_id UUID NOT NULL REFERENCES category(id),
    active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_item_category ON item (category_id);

INSERT INTO item (id, name, category_id, active)
SELECT gen_random_uuid(), c.name, c.id, c.active
FROM category c
WHERE NOT EXISTS (SELECT 1 FROM item i WHERE i.category_id = c.id);

ALTER TABLE category_template_entry ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES item(id);
UPDATE category_template_entry e
SET item_id = (SELECT i.id FROM item i WHERE i.category_id = e.category_id ORDER BY i.name LIMIT 1)
WHERE e.item_id IS NULL;
ALTER TABLE category_template_entry ALTER COLUMN item_id SET NOT NULL;
ALTER TABLE category_template_entry DROP CONSTRAINT IF EXISTS category_template_entry_template_id_category_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_template_entry_template_item ON category_template_entry (template_id, item_id);

ALTER TABLE monthly_plan_entry ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES item(id);
UPDATE monthly_plan_entry e
SET item_id = (SELECT i.id FROM item i WHERE i.category_id = e.category_id ORDER BY i.name LIMIT 1)
WHERE e.item_id IS NULL;
ALTER TABLE monthly_plan_entry ALTER COLUMN item_id SET NOT NULL;
ALTER TABLE monthly_plan_entry DROP CONSTRAINT IF EXISTS monthly_plan_entry_monthly_plan_id_category_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_plan_entry_plan_item ON monthly_plan_entry (monthly_plan_id, item_id);
