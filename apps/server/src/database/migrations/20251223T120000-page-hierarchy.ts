import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('page_hierarchy')
    .ifNotExists()
    .addColumn('ancestor_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('descendant_id', 'uuid', (col) =>
      col.notNull().references('pages.id').onDelete('cascade'),
    )
    .addColumn('depth', 'integer', (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('page_hierarchy_pkey', [
      'ancestor_id',
      'descendant_id',
    ])
    .execute();

  // indexes
  await db.schema
    .createIndex('idx_page_hierarchy_descendant')
    .ifNotExists()
    .on('page_hierarchy')
    .column('descendant_id')
    .execute();

  await db.schema
    .createIndex('idx_page_hierarchy_ancestor_depth')
    .ifNotExists()
    .on('page_hierarchy')
    .columns(['ancestor_id', 'depth'])
    .execute();

  await db.schema
    .createIndex('idx_page_hierarchy_descendant_depth')
    .ifNotExists()
    .on('page_hierarchy')
    .columns(['descendant_id', 'depth'])
    .execute();

  // rebuild function
  await sql`
    CREATE OR REPLACE FUNCTION rebuild_page_hierarchy()
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      TRUNCATE page_hierarchy;

      WITH RECURSIVE page_tree AS (
        SELECT id AS ancestor_id, id AS descendant_id, 0 AS depth
        FROM pages WHERE deleted_at IS NULL
        UNION ALL
        SELECT pt.ancestor_id, p.id AS descendant_id, pt.depth + 1
        FROM page_tree pt
        JOIN pages p ON p.parent_page_id = pt.descendant_id
        WHERE p.deleted_at IS NULL
      )
      INSERT INTO page_hierarchy (ancestor_id, descendant_id, depth)
      SELECT ancestor_id, descendant_id, depth FROM page_tree;
    END;
    $$;
  `.execute(db);

  // Create insert trigger function
  await sql`
    CREATE OR REPLACE FUNCTION page_hierarchy_after_insert()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
      END IF;

      IF NEW.parent_page_id IS NULL THEN
        INSERT INTO page_hierarchy (ancestor_id, descendant_id, depth)
        VALUES (NEW.id, NEW.id, 0);
      ELSE
        INSERT INTO page_hierarchy (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, NEW.id, depth + 1
        FROM page_hierarchy
        WHERE descendant_id = NEW.parent_page_id
        UNION ALL
        SELECT NEW.id, NEW.id, 0;
      END IF;

      RETURN NEW;
    END;
    $$;
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER page_hierarchy_after_insert_trigger
    AFTER INSERT ON pages
    FOR EACH ROW
    EXECUTE FUNCTION page_hierarchy_after_insert();
  `.execute(db);

  // Create update trigger function
  await sql`
    CREATE OR REPLACE FUNCTION page_hierarchy_after_update()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      subtree_ids UUID[];
    BEGIN
      -- Only process if parent_page_id or deleted_at changed
      IF OLD.parent_page_id IS NOT DISTINCT FROM NEW.parent_page_id
         AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at THEN
        RETURN NEW;
      END IF;

      -- Handle soft-delete: remove from closure when deleted_at is set
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        SELECT array_agg(descendant_id) INTO subtree_ids
        FROM page_hierarchy
        WHERE ancestor_id = NEW.id;

        DELETE FROM page_hierarchy
        WHERE descendant_id = ANY(subtree_ids);

        RETURN NEW;
      END IF;

      -- Handle restore: rebuild closure when deleted_at is cleared
      IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        IF NEW.parent_page_id IS NULL THEN
          INSERT INTO page_hierarchy (ancestor_id, descendant_id, depth)
          VALUES (NEW.id, NEW.id, 0);
        ELSE
          INSERT INTO page_hierarchy (ancestor_id, descendant_id, depth)
          SELECT ancestor_id, NEW.id, depth + 1
          FROM page_hierarchy
          WHERE descendant_id = NEW.parent_page_id
          UNION ALL
          SELECT NEW.id, NEW.id, 0;
        END IF;
        RETURN NEW;
      END IF;

      -- Skip if page is soft-deleted
      IF NEW.deleted_at IS NOT NULL THEN
        RETURN NEW;
      END IF;

      -- Move operation: parent changed
      -- Get all descendants of the moved page (including itself)
      SELECT array_agg(descendant_id) INTO subtree_ids
      FROM page_hierarchy
      WHERE ancestor_id = NEW.id;

      -- Delete old ancestor relationships (keep internal subtree links)
      DELETE FROM page_hierarchy
      WHERE descendant_id = ANY(subtree_ids)
        AND NOT (ancestor_id = ANY(subtree_ids));

      -- Insert new ancestor relationships (if new parent exists)
      IF NEW.parent_page_id IS NOT NULL THEN
        INSERT INTO page_hierarchy (ancestor_id, descendant_id, depth)
        SELECT
          new_anc.ancestor_id,
          sub.descendant_id,
          new_anc.depth + sub.depth + 1
        FROM page_hierarchy new_anc
        CROSS JOIN page_hierarchy sub
        WHERE new_anc.descendant_id = NEW.parent_page_id
          AND sub.ancestor_id = NEW.id
          AND sub.descendant_id = ANY(subtree_ids);
      END IF;

      RETURN NEW;
    END;
    $$;
  `.execute(db);

  await sql`
    CREATE OR REPLACE TRIGGER page_hierarchy_after_update_trigger
    AFTER UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION page_hierarchy_after_update();
  `.execute(db);

  await sql`SELECT rebuild_page_hierarchy()`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS page_hierarchy_after_update_trigger ON pages`.execute(
    db,
  );
  await sql`DROP TRIGGER IF EXISTS page_hierarchy_after_insert_trigger ON pages`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS page_hierarchy_after_update()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS page_hierarchy_after_insert()`.execute(db);
  await sql`DROP FUNCTION IF EXISTS rebuild_page_hierarchy()`.execute(db);
  await db.schema.dropTable('page_hierarchy').ifExists().execute();
}
