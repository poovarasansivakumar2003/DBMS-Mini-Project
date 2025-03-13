show databases;
create database DBMS_Mini_Project;
use DBMS_Mini_Project;

-- Admin notifications
CREATE TABLE admin_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,  -- Example: 'expired_medicine', 'low_stock', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	seen BOOLEAN DEFAULT false
);

-- Customer notifications
CREATE TABLE customer_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,  -- Example: 'expired_medicine', 'low_stock', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seen BOOLEAN DEFAULT false
);

-- Admin Table
create table admin(
	admin_username varchar(20) primary key,
    admin_password VARCHAR(255) not null
);
describe admin;
select * from admin;

-- Customers Table
create table customers(
	customer_id INT auto_increment PRIMARY KEY,
    customer_password varchar(255) not null,
    customer_name varchar(20) not null,
	customer_email varchar(50) not null unique,
    customer_ph_no varchar(15) not null unique,
    customer_address varchar(255),
    customer_feedback varchar(255),
    customer_photo varchar(255),
    customer_balance_amt DECIMAL(10, 2) DEFAULT 0
);
describe customers;
select * from customers;

-- Medicines Table
create table medicines(
	medicine_id int auto_increment primary key,
    medicine_name varchar(20) not null,
    medicine_composition varchar(100) not null,
    medicine_price int not null, 
    medicine_expiry_date DATE NOT NULL, -- CHECK(medicine_expiry_date > CURRENT_DATE)
    medicine_img varchar(255)
);
describe medicines;
select * from medicines;

ALTER TABLE medicines ADD CONSTRAINT unique_medicine UNIQUE (medicine_name, medicine_composition);

DELIMITER $$

CREATE TRIGGER medicine_expiry_trigger
AFTER INSERT ON medicines
FOR EACH ROW
BEGIN
    IF NEW.medicine_expiry_date < CURDATE() THEN
        INSERT INTO admin_notifications (message, type)
        VALUES (CONCAT('Medicine "', NEW.medicine_name, '" is expired!'), 'expired_medicine');
    END IF;
END$$

DELIMITER ;

-- Suppliers Table
create table suppliers(
	supplier_id int auto_increment primary key,
    supplier_name varchar(20) not null,
    supplier_email varchar(50) unique,
    supplier_ph_no varchar(15) not null unique,
    supplier_address varchar(100)
);
describe suppliers;
select * from suppliers;

-- Purchases Table
create table purchases(
	purchase_id INT auto_increment Primary key,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    admin_username VARCHAR(20),
    customer_id int,
    medicine_id int,
	supplier_id INT,
    purchased_quantity INT NOT NULL, -- CHECK(purchased_quantity > 0)
    total_amt DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (admin_username) REFERENCES admin(admin_username) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE
);
describe purchases;
select * from purchases;

DELIMITER $$

CREATE TRIGGER prevent_negative_purchase
BEFORE INSERT ON purchases
FOR EACH ROW
BEGIN
    IF NEW.purchased_quantity <= 0 THEN
		INSERT INTO customer_notifications (message, type)
        VALUES (CONCAT('Purchase from  "', NEW.purchase_id, '" lesser than zero!'), 'not_purchased');
    END IF;
END$$

DELIMITER ;

-- Invoice Table
create table invoice(
	invoice_no INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT,
    discount DECIMAL(10, 2) DEFAULT 0,
    paid DECIMAL(10, 2) DEFAULT 0,
    total_amt_to_pay DECIMAL(10, 2), GENERATED ALWAYS AS (
--         (SELECT total_amt FROM purchases WHERE purchase_id = invoice.purchase_id) + 
--         (SELECT customer_balance FROM customers WHERE customer_id = (SELECT customer_id FROM purchases WHERE purchase_id = invoice.purchase_id))
--     ) STORED,
    net_total DECIMAL(10, 2) GENERATED ALWAYS AS (total_amt_to_pay - discount) STORED,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (net_total - paid) STORED,
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id) ON DELETE CASCADE
);
describe invoice;
select * from invoice;

DELIMITER $$

CREATE PROCEDURE update_invoice_total_amt()
BEGIN
    UPDATE invoice i
    JOIN purchases p ON i.purchase_id = p.purchase_id
    JOIN customers c ON p.customer_id = c.customer_id
    SET i.total_amt = p.total_amt + c.customer_balance_amt;
END $$

DELIMITER ;

SET SQL_SAFE_UPDATES = 0;
CALL update_invoice_total_amt();
SET SQL_SAFE_UPDATES = 1; -- Re-enable safe mode


DELIMITER $$

CREATE TRIGGER only_admin_can_invoice
BEFORE INSERT ON invoice
FOR EACH ROW
BEGIN
    DECLARE admin_username_val VARCHAR(20);
    
    SELECT admin_username INTO admin_username_val 
    FROM purchases 
    WHERE purchase_id = NEW.purchase_id;
    
    IF admin_username_val IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only admins can generate invoices!';
    END IF;
END$$

DELIMITER ;

-- Stocks Table
CREATE TABLE stocks (
	medicine_id INT,
    supplier_id INT,
    stock_quantity INT NOT NULL CHECK(stock_quantity >= 0),
    PRIMARY KEY (medicine_id, supplier_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE
);
describe stocks;
select * from stocks;

DELIMITER $$

CREATE TRIGGER low_stock_trigger
AFTER INSERT ON stocks
FOR EACH ROW
BEGIN
    IF NEW.stock_quantity < 5 THEN
        INSERT INTO admin_notifications (message, type)
        VALUES (CONCAT('Low stock: Medicine ID ', NEW.medicine_id, ' has only ', NEW.stock_quantity, ' left!'), 'low_stock');
    END IF;
END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER reduce_stock_on_purchase
AFTER INSERT ON purchases
FOR EACH ROW
BEGIN
    DECLARE remaining_stock INT;

    -- Reduce stock quantity
    UPDATE stocks
    SET stock_quantity = stock_quantity - NEW.purchased_quantity
    WHERE medicine_id = NEW.medicine_id 
    AND supplier_id = NEW.supplier_id;

    -- Get the updated stock quantity
    SELECT stock_quantity INTO remaining_stock 
    FROM stocks 
    WHERE medicine_id = NEW.medicine_id 
    AND supplier_id = NEW.supplier_id;

    -- Insert notification if stock is low
    IF remaining_stock < 5 THEN
        INSERT INTO admin_notifications (message, type)
        VALUES (CONCAT('Low stock: Medicine ID ', NEW.medicine_id, ' has only ', remaining_stock, ' left!'), 'low_stock');
    END IF;
END$$

DELIMITER ;

show tables;

INSERT INTO admin (admin_username, admin_password) VALUES 
('admin1', '$2a$10$nw35QHHaWQXowfPROS70A.mjbeYj8kPhpE5mBowZmJRHOg/G6/x8a'),-- Admin@123
('admin2', '$2a$10$rth0XhJlmKXXd.HuU948cuIrTGa1XRyVsp9HNEeq7rE7l8XnXPhea');-- SecurePass

INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_password, customer_photo) VALUES 
('John Doe', 'john.doe@example.com', '9876543210', '123 Main Street, NY', 'Great service, fast delivery and helpful staff.', '$2a$10$rwXscApWpvq2s5wazkzPYOkmxWQGn89/B8nQNSG1nYb.QRPB6pKM6',null), -- password
('Alice Smith', 'alice.smith@example.com', '9876543211', '456 Elm Street, LA', 'The medication arrived on time, and everything was as expected.', '$2a$10$ClmJYIzo8c15tO0oSP/WK.ZyUlrC7st9EZdPDinNKIrDnPv5Vat8',null),-- 1234567890
('Bob Johnson', 'bob.johnson@example.com', '9876543212', '789 Pine Street, TX', 'I had a smooth experience, and the quality of the product was good.', '$2a$10$.FGHozodkweJZOG4qFwQseKEhME20sdpQINxtJCgDwZSIxMhaEfl6','./private/uploads/customersPhotos/3_photo.png'),-- 9876543210
('Jane Smith', 'janesmith@yahoo.com', '9123456789', '456 Avenue, City', 'Excellent support and easy ordering process.', '$2a$10$1icoY.4NSVHxZHlrTZCRHOgZVath6i/Eb83pOvNsb1tfcV0tJioc',null);-- super

INSERT INTO suppliers (supplier_name, supplier_email, supplier_ph_no, supplier_address) VALUES 
('MediSuppliers Inc.', 'contact@medisuppliers.com', '9988776655', '1st Avenue, NY'),
('Pharma Distributors', 'sales@pharmadist.com', '9988776644', 'Market Street, LA'),
('Wellness Suppliers', 'info@wellnesssup.com', '9988776633', 'Health Road, TX'),
('Pharma Inc.', 'contact@pharmainc.com', '8800112233', '789 Pharma St, City'),
('MediCo', 'support@medico.com', '8000223344', '321 Health Rd, City');

INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img)
VALUES 
('Paracetamol', 'Acetaminophen 500mg', 10, '2025-12-31','./public/img/medicinesImg/paracetamol.jpg'),
('Aspirin', 'Aspirin 100mg', 5, '2026-06-30','./public/img/medicinesImg/aspirin.jpg'),
('Amoxicillin', 'Amoxicillin 500mg', 15, '2026-04-30','./public/img/medicinesImg/amoxicillin.jpg'),
('Ibuprofen', 'Ibuprofen 400mg', 30, '2025-08-15','./public/img/medicinesImg/ibuprofen.jpg'),
('Amoxicillin', 'Amoxicillin 250mg', 50, '2024-05-01','./public/img/medicinesImg/amoxicillin.jpg'), -- Expired
('Cough Syrup', 'Dextromethorphan, Guaifenesin', 80, '2026-09-10','./public/img/medicinesImg/coughSyrup.jpg'),
('Vitamin C', 'Ascorbic Acid 500mg', 25, '2025-06-20','./public/img/medicinesImg/vitaminC.jpg');

INSERT INTO stocks (medicine_id, supplier_id, stock_quantity) VALUES 
(1, 1, 100),  -- 100 units of Paracetamol supplied by MediSuppliers Inc. (Supplier ID: 1)
(1, 2, 50),   -- 50 units of Paracetamol supplied by Pharma Distributors (Supplier ID: 2)
(2, 1, 200),  -- 200 units of Aspirin supplied by MediSuppliers Inc. (Supplier ID: 1)
(3, 2, 0),    -- 0 units (out of stock) of Amoxicillin supplied by Pharma Distributors (Supplier ID: 2)
(4, 3, 50),   -- 50 units of Ibuprofen supplied by Wellness Suppliers (Supplier ID: 3)
(5, 2, 200);  -- 200 units of expired Amoxicillin supplied by Pharma Distributors (Supplier ID: 2)

-- Insert purchase data
INSERT INTO purchases (admin_username, customer_id, medicine_id, supplier_id, purchased_quantity, total_amt) VALUES
('admin1', 1, 1, 1, 10, 100.00),  -- John Doe bought 10 Paracetamol from MediSuppliers Inc.
('admin2', 2, 2, 1, 5, 25.00),    -- Alice Smith bought 5 Aspirin from MediSuppliers Inc.
('admin1', 3, 3, 2, 3, 45.00),    -- Bob Johnson bought 3 Amoxicillin from Pharma Distributors
('admin2', 4, 4, 3, 2, 60.00),    -- Jane Smith bought 2 Ibuprofen from Wellness Suppliers
('admin1', 1, 6, 2, 1, 80.00);    -- John Doe bought 1 Cough Syrup from Pharma Distributors

-- Insert invoice data
INSERT INTO invoice (purchase_id, total_amt, discount, paid) VALUES 
(1, 100, 10, 90),  -- Invoice for Purchase ID 1: Total amount = 100, Discount = 10, Paid = 90, Balance = 0
(2, 25, 5, 20),    -- Invoice for Purchase ID 2: Total amount = 25, Discount = 5, Paid = 20, Balance = 0
(3, 240, 20, 220), -- Invoice for Purchase ID 3: Total amount = 240, Discount = 20, Paid = 220, Balance = 0
(4, 125, 10, 115); -- Invoice for Purchase ID 4: Total amount = 125, Discount = 10, Paid = 115, Balance = 0

SHOW TRIGGERS;

SELECT * FROM admin_notifications ORDER BY created_at DESC;
SELECT * FROM customer_notifications ORDER BY created_at DESC;

SHOW GRANTS FOR CURRENT_USER;

-- Grant TRIGGER privilege on a specific database
GRANT TRIGGER ON dbms_mini_project.* TO 'root'@'localhost';

-- Grant SUPER privilege globally
GRANT SUPER ON *.* TO 'root'@'localhost';

-- Apply the changes
FLUSH PRIVILEGES;

drop database DBMS_Mini_Project;

-- How Can Suppliers View Their Stock?
-- How Can Suppliers Update Their Stock?
-- Show Medicine Stock for Each Supplier
-- How to See All Suppliers for a Medicine?
-- How to Get the Combined Stock of Each Medicine?
-- How to Get Stock per Supplier for a Medicine?
-- How to Get Supplier of Medicine Purchased by a Customer?
-- How to See All Suppliers for a Customer’s Purchased Medicines?
-- How to Fetch Only Non-Expired Medicines for Purchase?
-- How to Prevent Expired Medicines from Being Purchased?
-- Query to Get Total Amount Spent by Each Customer
-- make invoice
-- reduce stock as purchase happens
-- only admin can generate bill



