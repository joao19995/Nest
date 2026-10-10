-- 015: reverte 014 (volta ao template e plano mensal por categoria).
--
-- A app volta a assumir uma linha por categoria: UNIQUE(template_id, category_id)
-- e UNIQUE(monthly_plan_id, category_id). Os dados criados por 014 sao preservados:
-- a tabela item e as colunas item_id sao mantidas (item_id passa a NULL permitido),
-- nada e apagado. Se existirem categorias duplicadas com itens diferentes criadas
-- depois de 014, esta migracao falha com uma mensagem clara: nesse caso resolve
-- manualmente (escolhe a linha a manter) antes de voltar a correr a migracao.
-- Idempotente: so DROP INDEX IF EXISTS, ALTER ... DROP NOT NULL e ADD CONSTRAINT
-- quando ainda nao existir. Nao correr migracoes contra producao como parte de
-- tarefas de codigo.

DROP INDEX IF EXISTS uq_category_template_entry_template_item;
DROP INDEX IF EXISTS uq_monthly_plan_entry_plan_item;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM category_template_entry
    GROUP BY template_id, category_id
    HAVING COUNT(*) > 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Reversao 015 bloqueada: ha templates com a mesma categoria em mais do que uma linha (itens separados depois de 014). Junta as linhas manualmente antes de migrar.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_template_entry_template_id_category_id_key'
  ) THEN
    ALTER TABLE category_template_entry ADD CONSTRAINT category_template_entry_template_id_category_id_key UNIQUE (template_id, category_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM monthly_plan_entry
    GROUP BY monthly_plan_id, category_id
    HAVING COUNT(*) > 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Reversao 015 bloqueada: ha meses com a mesma categoria em mais do que uma linha (itens separados depois de 014). Junta as linhas manualmente antes de migrar.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monthly_plan_entry_monthly_plan_id_category_id_key'
  ) THEN
    ALTER TABLE monthly_plan_entry ADD CONSTRAINT monthly_plan_entry_monthly_plan_id_category_id_key UNIQUE (monthly_plan_id, category_id);
  END IF;
END $$;

ALTER TABLE category_template_entry ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE monthly_plan_entry ALTER COLUMN item_id DROP NOT NULL;
