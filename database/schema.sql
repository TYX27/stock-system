-- Stock Inventory System - PostgreSQL schema
-- Phones, monitors, printers can have IC/serial numbers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users (login)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(150) DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (username, password_hash, display_name, role)
VALUES (
  'admin',
  crypt('admin123', gen_salt('bf')),
  'Administrator',
  'admin'
)
ON CONFLICT (username) DO NOTHING;



-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL DEFAULT 'Other',
  starting_stock INTEGER NOT NULL DEFAULT 0 CHECK (starting_stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction log (date/time stored as fixed values — never auto-change)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  hour VARCHAR(2) NOT NULL DEFAULT '00',
  min VARCHAR(2) NOT NULL DEFAULT '00',
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('Take Out', 'Add Stock')),
  qty INTEGER NOT NULL CHECK (qty > 0),
  notes TEXT DEFAULT '',
  taken_by VARCHAR(150) DEFAULT '',
  recorded_by VARCHAR(150) DEFAULT '',
  serial VARCHAR(500) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_txn_item ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_txn_branch ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_txn_ym ON transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(type);

-- Serial / IC registry (phones, monitors, printers — including stock already on hand)
CREATE TABLE IF NOT EXISTS serial_registry (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id),
  serial VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'In Stock'
    CHECK (status IN ('In Stock', 'Taken Out')),
  branch_id INTEGER REFERENCES branches(id),
  taken_by VARCHAR(150) DEFAULT '',
  recorded_by VARCHAR(150) DEFAULT '',
  notes TEXT DEFAULT '',
  year INTEGER,
  month INTEGER,
  day INTEGER,
  hour VARCHAR(2) DEFAULT '00',
  min VARCHAR(2) DEFAULT '00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, serial)
);

CREATE INDEX IF NOT EXISTS idx_serial_status ON serial_registry(status);
CREATE INDEX IF NOT EXISTS idx_serial_item ON serial_registry(item_id);

-- Seed branches
INSERT INTO branches (name) VALUES
  ('HQ'), ('WH'), ('SHOWROOM'), ('CY1'), ('CY2'),
  ('SMY1'), ('SMY2'), ('SB1'), ('SA1'), ('SA2'), ('SA3'),
  ('Elmina'), ('BR1'), ('BR2'), ('SR1'), ('SR2'), ('SR3')
ON CONFLICT (name) DO NOTHING;

-- Seed items
INSERT INTO items (name, category, starting_stock) VALUES
  ('CPU', 'Computing Hardware', 7),
  ('PC-216B Cartridge', 'Computing Hardware', 17),
  ('Desktop Hard Drive', 'Computing Hardware', 5),
  ('UGreen USB-C Hub', 'Computing Hardware', 1),
  ('Lenovo Monitor', 'Computing Hardware', 2),
  ('Desktop Switch', 'Networking & Storage', 1),
  ('Synology', 'Networking & Storage', 1),
  ('Cash Drawer', 'POS Equipment', 3),
  ('Thermal Label Printer', 'POS Equipment', 3),
  ('HPRT Thermal Pos Printer', 'POS Equipment', 1),
  ('Barcode Scanner', 'POS Equipment', 1),
  ('(Epson) Cartridge', 'Printers & Cartridges', 1),
  ('B-TN2480 Cartridge', 'Printers & Cartridges', 3),
  ('Premium Toner Cartridge TN2560', 'Printers & Cartridges', 2),
  ('H-W136X Cartridge', 'Printers & Cartridges', 6),
  ('Printer (Brother)', 'Printers & Cartridges', 1),
  ('Insta360 Cam', 'Cameras', 1),
  ('Samsung Galaxy A14', 'Mobile Phones', 1),
  ('(5G) Realme 12', 'Mobile Phones', 1),
  ('Realme Note 10', 'Mobile Phones', 1),
  ('(5G) Realme 11', 'Mobile Phones', 1),
  ('Huawei Nova 4', 'Mobile Phones', 1),
  ('(5G) OnePlus Nord N10', 'Mobile Phones', 1),
  ('Samsung Galaxy A07 (5G)', 'Mobile Phones', 1),
  ('Motorola T101 Phone', 'Mobile Phones', 1),
  ('Motorola Voice T401+ Phone', 'Mobile Phones', 1)
ON CONFLICT (name) DO NOTHING;

-- Sample transactions (from your Excel)
INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 16, '12', '06', b.id, i.id, 'Take Out', 1, 'Reception Printer', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'H-W136X Cartridge';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 16, '17', '10', b.id, i.id, 'Add Stock', 2, 'Printer', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'Premium Toner Cartridge TN2560';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 16, '17', '10', b.id, i.id, 'Take Out', 2, '1 Warehouse 1 HR', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'Premium Toner Cartridge TN2560';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 19, '10', '00', b.id, i.id, 'Take Out', 1, 'Warehouse', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'Lenovo Monitor';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 19, '10', '00', b.id, i.id, 'Take Out', 1, 'Warehouse', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'CPU';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 19, '14', '57', b.id, i.id, 'Take Out', 1, 'Reception', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'Desktop Switch';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 19, '14', '58', b.id, i.id, 'Take Out', 1, 'SA1', '', 'Yi Xian', ''
FROM branches b, items i WHERE b.name = 'SA1' AND i.name = 'HPRT Thermal Pos Printer';

INSERT INTO transactions (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
SELECT 2026, 10, 19, '15', '00', b.id, i.id, 'Add Stock', 3, '', '', '', ''
FROM branches b, items i WHERE b.name = 'WH' AND i.name = 'Samsung Galaxy A07 (5G)';
