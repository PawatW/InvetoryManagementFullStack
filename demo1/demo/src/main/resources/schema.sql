-- ========================
-- Supplier
-- ========================
CREATE TABLE IF NOT EXISTS Supplier (
    supplier_id VARCHAR(20) PRIMARY KEY,
    supplier_name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    active BOOLEAN DEFAULT TRUE
);

-- ========================
-- Product
-- ========================
CREATE TABLE IF NOT EXISTS Product (
    product_id VARCHAR(20) PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    cost_price DECIMAL(10,2) DEFAULT 0 CHECK (cost_price >= 0),
    sell_price DECIMAL(10,2) DEFAULT 0 CHECK (sell_price >= 0),
    quantity INT DEFAULT 0 CHECK (quantity >= 0),
    supplier_id VARCHAR(20) REFERENCES Supplier(supplier_id),
    image_url VARCHAR(255),
    active BOOLEAN DEFAULT TRUE
);

-- ========================
-- Customer
-- ========================
CREATE TABLE IF NOT EXISTS Customer (
    customer_id VARCHAR(20) PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    address VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    active BOOLEAN DEFAULT TRUE
);

-- ========================
-- Staff
-- ========================
CREATE TABLE IF NOT EXISTS Staff (
    staff_id VARCHAR(20) PRIMARY KEY,
    staff_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(100) NOT NULL,
    active BOOLEAN DEFAULT TRUE
);

-- ========================
-- "Order" (ใช้ Double Quote เพราะ Order เป็น Reserved Word)
-- ========================
CREATE TABLE IF NOT EXISTS "Order" (
    order_id VARCHAR(20) PRIMARY KEY,
    order_date TIMESTAMP NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(50) DEFAULT 'Pending',
    customer_id VARCHAR(20) REFERENCES Customer(customer_id),
    staff_id VARCHAR(20) REFERENCES Staff(staff_id) -- แก้ไข: ลบ comma ที่เกินมา
);
-- ========================
-- OrderItem
-- ========================
CREATE TABLE IF NOT EXISTS OrderItem (
    order_item_id VARCHAR(20) PRIMARY KEY,
    order_id VARCHAR(20) REFERENCES "Order"(order_id),
    product_id VARCHAR(20) REFERENCES Product(product_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    fulfilled_qty INT DEFAULT 0,
    remaining_qty INT GENERATED ALWAYS AS (quantity - fulfilled_qty) STORED
);

-- ========================
-- Request
-- ========================
CREATE TABLE IF NOT EXISTS Request (
    request_id VARCHAR(20) PRIMARY KEY,
    request_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'Awaiting Approval',
    order_id VARCHAR(20) REFERENCES "Order"(order_id),
    customer_id VARCHAR(20) REFERENCES Customer(customer_id),
    staff_id VARCHAR(20) REFERENCES Staff(staff_id),
    description TEXT,
    approved_by VARCHAR(20) REFERENCES Staff(staff_id),
    approved_date TIMESTAMP
);

-- ========================
-- RequestItem
-- ========================
CREATE TABLE IF NOT EXISTS RequestItem (
    request_item_id VARCHAR(20) PRIMARY KEY,
    request_id VARCHAR(20) REFERENCES Request(request_id),
    product_id VARCHAR(20) REFERENCES Product(product_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    fulfilled_qty INT DEFAULT 0,
    remaining_qty INT GENERATED ALWAYS AS (quantity - fulfilled_qty) STORED
);

-- ========================
-- StockTransaction
-- ========================
CREATE TABLE IF NOT EXISTS PurchaseOrder (
    po_id VARCHAR(20) PRIMARY KEY,
    po_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    supplier_id VARCHAR(20) REFERENCES Supplier(supplier_id),
    staff_id VARCHAR(20) REFERENCES Staff(staff_id),
    total_amount DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'New order'
);

CREATE TABLE IF NOT EXISTS PurchaseItem (
    po_item_id VARCHAR(20) PRIMARY KEY,
    po_id VARCHAR(20) REFERENCES PurchaseOrder(po_id),
    product_id VARCHAR(20) REFERENCES Product(product_id),
    quantity INT CHECK (quantity > 0),
    unit_price DECIMAL(10,2) CHECK (unit_price > 0)
);

CREATE TABLE IF NOT EXISTS ProductBatch (
    batch_id VARCHAR(20) PRIMARY KEY,
    product_id VARCHAR(20) REFERENCES Product(product_id),
    po_id VARCHAR(20) REFERENCES PurchaseOrder(po_id),
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quantity_in INT NOT NULL,
    quantity_remaining INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    expiry_date DATE
);

CREATE TABLE IF NOT EXISTS StockTransaction (
    transaction_id VARCHAR(20) PRIMARY KEY,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(10) CHECK (type IN ('IN','OUT','ADJUST')),
    product_id VARCHAR(20) REFERENCES Product(product_id) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    staff_id VARCHAR(20) REFERENCES Staff(staff_id) NOT NULL,
    description TEXT,
    batch_id VARCHAR(20) REFERENCES ProductBatch(batch_id),
    reference_id VARCHAR(20)
);