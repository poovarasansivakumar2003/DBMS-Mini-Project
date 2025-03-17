show databases;
create database DBMS_Mini_Project;
use DBMS_Mini_Project;

-- Admin Table
CREATE TABLE admin (
    admin_username VARCHAR(20) PRIMARY KEY,
    admin_password VARCHAR(255) NOT NULL
);
describe admin;
select * from admin;

-- Customers Table
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_password VARCHAR(255) NOT NULL,
    customer_name VARCHAR(20) NOT NULL,
    customer_email VARCHAR(50) NOT NULL UNIQUE,
    customer_ph_no VARCHAR(15) NOT NULL UNIQUE,
    customer_feedback VARCHAR(255),
    customer_photo VARCHAR(255),
    customer_balance_amt DECIMAL(10, 2) DEFAULT 0
);
describe customers;
select * from customers;

-- Customers Addresses Table
CREATE TABLE customers_addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    street VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    address_type ENUM('Home', 'Work', 'Other'),  -- Categorizing addresses
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
describe customers_addresses;
select * from customers_addresses;

-- Customers feedbacks Table
CREATE TABLE feedbacks (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT, 
    feedback_text TEXT NOT NULL,
    feedback_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);

-- Medicines Table
CREATE TABLE medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(50) NOT NULL,
    medicine_composition VARCHAR(100) NOT NULL,
    medicine_price DECIMAL(10, 2) NOT NULL,
    medicine_type ENUM('Tablet', 'Syrup', 'Capsule', 'Injection', 'Ointment') NOT NULL,
    medicine_expiry_date DATE NOT NULL,
    medicine_img VARCHAR(255),
    CONSTRAINT unique_medicine UNIQUE (medicine_name, medicine_composition)
);
describe medicines;
select * from medicines;

-- Suppliers Table
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(50) NOT NULL,
    supplier_email VARCHAR(50) UNIQUE,
    supplier_ph_no VARCHAR(15) NOT NULL UNIQUE,
    supplier_address VARCHAR(100)
);
describe suppliers;
select * from suppliers;

-- Suppliers Addresses Table
CREATE TABLE suppliers_addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    suppliers_id INT,
    street VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    FOREIGN KEY (suppliers_id) REFERENCES suppliers_id(suppliers_id) ON DELETE CASCADE
);
describe suppliers_addresses;
select * from suppliers_addresses;

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

-- Purchases Table
CREATE TABLE purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INT,
    medicine_id INT,
    supplier_id INT NULL,
    purchased_quantity INT NOT NULL CHECK(purchased_quantity > 0),
    total_amt DECIMAL(10,2) NOT NULL, 
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL
);
describe purchases;
select * from purchases;

-- Purchase Sessions Table
CREATE TABLE purchase_sessions (
    purchase_session_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    purchase_time TIMESTAMP, -- have a relation through trigger
    actual_amt_to_pay DECIMAL(10,2),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL
);
describe purchase_sessions;
select * from purchase_sessions;

-- Invoice Table
CREATE TABLE invoice (
    invoice_no INT AUTO_INCREMENT PRIMARY KEY,
	invoice_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    purchase_session_id INT,
    admin_username VARCHAR(20),
    discount DECIMAL(10, 2) DEFAULT 0,
    paid DECIMAL(10, 2) DEFAULT 0,
    total_amt_to_pay DECIMAL(10, 2),
    net_total DECIMAL(10, 2) GENERATED ALWAYS AS (total_amt_to_pay - discount) STORED,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (net_total - paid) STORED,
    FOREIGN KEY (admin_username) REFERENCES admin(admin_username) ON DELETE SET NULL,
    FOREIGN KEY (purchase_session_id) REFERENCES purchase_sessions(purchase_session_id) ON DELETE SET NULL
);
describe invoice;
select * from invoice;

show tables;

DELIMITER $$

-- Prevent expired medicine from being inserted
CREATE TRIGGER check_expiry_before_insert
BEFORE INSERT ON medicines
FOR EACH ROW
BEGIN
    IF NEW.medicine_expiry_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot insert expired medicine!';
    END IF;
END$$

-- Calculate total amount in purchases before insert
CREATE TRIGGER calculate_total_amt_before_insert
BEFORE INSERT ON purchases
FOR EACH ROW
BEGIN
    DECLARE price DECIMAL(10,2);

    -- Get the medicine price from the medicines table
    SELECT medicine_price INTO price 
    FROM medicines 
    WHERE medicine_id = NEW.medicine_id;

    -- Calculate total amount
    SET NEW.total_amt = NEW.purchased_quantity * price;
END$$

-- Calculate total amount in purchases before update
CREATE TRIGGER calculate_total_amt_before_update
BEFORE UPDATE ON purchases
FOR EACH ROW
BEGIN
    DECLARE price DECIMAL(10,2);

    -- Get the medicine price from the medicines table
    SELECT medicine_price INTO price 
    FROM medicines 
    WHERE medicine_id = NEW.medicine_id;

    -- Recalculate total amount
    SET NEW.total_amt = NEW.purchased_quantity * price;
END$$

-- Reduce stock on purchase, prevent insufficient stock purchase before insert
CREATE TRIGGER reduce_stock_on_purchase_before_insert
BEFORE INSERT ON purchases
FOR EACH ROW
BEGIN
    DECLARE available_stock INT;
    
    SELECT stock_quantity INTO available_stock
    FROM stocks
    WHERE medicine_id = NEW.medicine_id AND supplier_id = NEW.supplier_id;
    
    IF available_stock IS NULL OR available_stock < NEW.purchased_quantity THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for this purchase!';
    ELSE
        UPDATE stocks
        SET stock_quantity = stock_quantity - NEW.purchased_quantity
        WHERE medicine_id = NEW.medicine_id AND supplier_id = NEW.supplier_id;
    END IF;
END$$

--restore_stock_on_purchase_on_delete
CREATE TRIGGER restore_stock_on_purchase_delete
AFTER DELETE ON purchases
FOR EACH ROW
BEGIN
    UPDATE stocks
    SET stock_quantity = stock_quantity + OLD.purchased_quantity 
    WHERE medicine_id = OLD.medicine_id AND supplier_id = OLD.supplier_id;
END $$

-- Assign purchases to a session and calculate actual_amt_to_pay
CREATE TRIGGER create_purchase_session
AFTER INSERT ON purchases
FOR EACH ROW
BEGIN
    DECLARE existing_session_id INT;
    DECLARE total_amount DECIMAL(10,2);

    -- Check if there is an existing purchase session for this customer at the same date, hour, and minute
    SELECT purchase_session_id INTO existing_session_id
    FROM purchase_sessions
    WHERE customer_id = NEW.customer_id
    AND DATE_FORMAT(purchase_time, '%Y-%m-%d %H:%i') = DATE_FORMAT(NEW.purchase_time, '%Y-%m-%d %H:%i')
    LIMIT 1;

    -- Calculate the total amount of all purchases for this customer at this date, hour, and minute
    SELECT SUM(total_amt) INTO total_amount
    FROM purchases
    WHERE customer_id = NEW.customer_id
    AND DATE_FORMAT(purchase_time, '%Y-%m-%d %H:%i') = DATE_FORMAT(NEW.purchase_time, '%Y-%m-%d %H:%i');

    IF existing_session_id IS NOT NULL THEN
        -- Update existing purchase session
        UPDATE purchase_sessions
        SET actual_amt_to_pay = total_amount
        WHERE purchase_session_id = existing_session_id;
    ELSE
        -- Insert new purchase session
        INSERT INTO purchase_sessions (customer_id, purchase_time, actual_amt_to_pay)
        VALUES (NEW.customer_id, NEW.purchase_time, total_amount);
    END IF;
END $$

-- Trigger to update total_amt_to_pay before insert
CREATE TRIGGER calculate_total_amt_to_pay_before_insert
BEFORE INSERT ON invoice
FOR EACH ROW
BEGIN
    DECLARE customer_balance DECIMAL(10,2);
    DECLARE actual_amt DECIMAL(10,2);
    DECLARE cust_id INT;
    SELECT customer_id INTO cust_id FROM purchase_sessions WHERE purchase_session_id = NEW.purchase_session_id;
    SELECT customer_balance_amt INTO customer_balance FROM customers WHERE customer_id = cust_id;
    SELECT actual_amt_to_pay INTO actual_amt FROM purchase_sessions WHERE purchase_session_id = NEW.purchase_session_id;
    SET NEW.total_amt_to_pay = actual_amt + customer_balance;
END$$

-- Update customer_balance_amt after inserting an invoice
CREATE TRIGGER update_customer_balance_after_invoice_insert
AFTER INSERT ON invoice
FOR EACH ROW
BEGIN
    -- Update customer balance with the latest invoice balance
    UPDATE customers 
    SET customer_balance_amt = NEW.balance
    WHERE customer_id = (SELECT customer_id FROM purchase_sessions WHERE purchase_session_id = NEW.purchase_session_id);
END$$

-- Update customer_balance_amt after updating an invoice
CREATE TRIGGER update_customer_balance_after_invoice_update
AFTER UPDATE ON invoice
FOR EACH ROW
BEGIN
    -- Update customer balance with the latest invoice balance
    UPDATE customers 
    SET customer_balance_amt = NEW.balance
    WHERE customer_id = (SELECT customer_id FROM purchase_sessions WHERE purchase_session_id = NEW.purchase_session_id);
END$$

DELIMITER ;

SHOW TRIGGERS;

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
('Amoxicillin', 'Amoxicillin 250mg', 50, '2026-05-01','./public/img/medicinesImg/amoxicillin.jpg'),
('Cough Syrup', 'Dextromethorphan, Guaifenesin', 80, '2026-09-10','./public/img/medicinesImg/coughSyrup.jpg'),
('Vitamin C', 'Ascorbic Acid 500mg', 25, '2025-06-20','./public/img/medicinesImg/vitaminC.jpg');

INSERT INTO stocks (medicine_id, supplier_id, stock_quantity) VALUES 
(1, 1, 100),  -- 100 units of Paracetamol supplied by MediSuppliers Inc. (Supplier ID: 1)
(1, 2, 50),   -- 50 units of Paracetamol supplied by Pharma Distributors (Supplier ID: 2)
(2, 1, 200),  -- 200 units of Aspirin supplied by MediSuppliers Inc. (Supplier ID: 1)
(3, 2, 7),    -- 7 units of Amoxicillin supplied by Pharma Distributors (Supplier ID: 2)
(4, 3, 50),   -- 50 units of Ibuprofen supplied by Wellness Suppliers (Supplier ID: 3)
(5, 2, 200),  -- 200 units of expired Amoxicillin supplied by Pharma Distributors (Supplier ID: 2)
(6, 4, 50);  -- 200 units of expired Cough Syrup supplied by MediCo (Supplier ID: 4)

-- Insert purchase data
INSERT INTO purchases (admin_username, customer_id, medicine_id, supplier_id, purchased_quantity) VALUES
('admin1', 1, 1, 1, 4),  -- John Doe bought 10 Paracetamol from MediSuppliers Inc.
('admin2', 2, 2, 1, 5),  -- Alice Smith bought 5 Aspirin from MediSuppliers Inc.
('admin1', 3, 3, 2, 3),  -- Bob Johnson bought 3 Amoxicillin from Pharma Distributors
('admin2', 4, 4, 3, 2),  -- Jane Smith bought 2 Ibuprofen from Wellness Suppliers
('admin1', 1, 6, 4, 1);  -- John Doe bought 1 Cough Syrup from MediCo

-- Insert invoice data
INSERT INTO invoice (purchase_id, discount, paid) VALUES 
(1, 10, 80),  -- Invoice for Purchase ID 1: Discount = 10, Paid = 90
(2, 5, 20),    -- Invoice for Purchase ID 2: Discount = 5, Paid = 20 
(3, 20, 210), -- Invoice for Purchase ID 3: Discount = 20, Paid = 210,
(4, 10, 50); -- Invoice for Purchase ID 4: Discount = 10, Paid = 115,

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
