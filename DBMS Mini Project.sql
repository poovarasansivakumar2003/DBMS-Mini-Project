DROP DATABASE IF EXISTS pharmacyDB;
CREATE DATABASE pharmacyDB;
use pharmacyDB;

-- Admin Table
CREATE TABLE admin (
    admin_username VARCHAR(20) PRIMARY KEY,
    admin_password VARCHAR(255) NOT NULL
);
describe admin;

-- Customers Table
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_name VARCHAR(20) NOT NULL,
    customer_email VARCHAR(50) NOT NULL UNIQUE,
    customer_ph_no VARCHAR(15) NOT NULL UNIQUE,
    customer_photo MEDIUMBLOB,
    customer_password VARCHAR(255) NOT NULL,
    customer_balance_amt DECIMAL(10, 2) DEFAULT 0
);
CREATE INDEX idx_customer_email ON customers(customer_email);
CREATE INDEX idx_customer_ph_no ON customers(customer_ph_no);
describe customers;

-- Customers Addresses Table
CREATE TABLE customer_addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    street VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    address_type ENUM('Home', 'Work', 'Other'),  -- Categorizing addresses
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
describe customer_addresses;

-- Customers feedbacks Table
CREATE TABLE feedbacks (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT, 
    rating INT NOT NULL,
    feedback_text TEXT NOT NULL,
    feedback_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
describe feedbacks;

-- Medicines Table
CREATE TABLE medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name VARCHAR(50) NOT NULL,
    medicine_composition VARCHAR(100) NOT NULL,
    medicine_price DECIMAL(10 , 2 ) NOT NULL,
    medicine_type ENUM('Tablet', 'Syrup', 'Capsule', 'Injection', 'Ointment') NOT NULL,
    medicine_expiry_date DATE NOT NULL,
    medicine_img MEDIUMBLOB,
    CONSTRAINT unique_medicine UNIQUE (medicine_name , medicine_composition)
);
CREATE INDEX idx_medicine_name ON medicines(medicine_name);
CREATE INDEX idx_medicine_expiry_date ON medicines(medicine_expiry_date);
describe medicines;

-- Suppliers Table
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(50) NOT NULL,
    supplier_email VARCHAR(50) UNIQUE,
    supplier_ph_no VARCHAR(15) NOT NULL UNIQUE,
    supplier_address VARCHAR(100)
);
describe suppliers;

-- Suppliers Addresses Table
CREATE TABLE supplier_addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT,
    street VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE
);
describe supplier_addresses;

-- Stocks Table
CREATE TABLE stocks (
    medicine_id INT,
    supplier_id INT,
    stock_quantity INT NOT NULL CHECK(stock_quantity >= 0),
    PRIMARY KEY (medicine_id, supplier_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE
);
CREATE INDEX idx_stock_medicine ON stocks(medicine_id);
CREATE INDEX idx_stock_supplier ON stocks(supplier_id);
describe stocks;

-- Purchases Table
CREATE TABLE purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    customer_id INT,
    medicine_id INT,
    supplier_id INT NULL,
    purchased_quantity INT NOT NULL CHECK(purchased_quantity > 0),
    total_amt DECIMAL(10,2) NOT NULL, 
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL
);
CREATE INDEX idx_purchase_customer ON purchases(customer_id);
CREATE INDEX idx_purchase_medicine ON purchases(medicine_id);
CREATE INDEX idx_purchase_time ON purchases(purchase_time);
describe purchases;

-- Purchase Sessions Table
CREATE TABLE purchase_sessions (
    purchase_session_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    purchase_time TIMESTAMP, -- have a relation through trigger
    actual_amt_to_pay DECIMAL(10,2),
    CONSTRAINT unique_purchase UNIQUE (customer_id , purchase_time),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
describe purchase_sessions;

CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    payment_amt DECIMAL(10,2),
    payment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
);
describe payments;

-- Invoice Table
CREATE TABLE invoice (
    invoice_no INT AUTO_INCREMENT PRIMARY KEY,
	invoice_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    purchase_session_id INT,
    admin_username VARCHAR(20),
    discount DECIMAL(10, 2) DEFAULT 0,
    payment_id INT,
    prev_balance DECIMAL(10, 2),
    total_amt_to_pay DECIMAL(10, 2),
    net_total DECIMAL(10, 2) GENERATED ALWAYS AS (total_amt_to_pay - discount) STORED,
    curr_balance DECIMAL(10, 2),
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_username) REFERENCES admin(admin_username) ON DELETE NO ACTION,
    FOREIGN KEY (purchase_session_id) REFERENCES purchase_sessions(purchase_session_id) ON DELETE CASCADE
);
describe invoice;

show tables;

DELIMITER $$

-- Stored Procedure: Check Expiry Before Insert
CREATE TRIGGER check_expiry_before_insert
BEFORE INSERT ON medicines
FOR EACH ROW
BEGIN
    IF NEW.medicine_expiry_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot insert expired medicine!';
    END IF;
END$$

-- Stored Procedure: Prevent Purchase of Expired Medicine
CREATE PROCEDURE PreventPurchaseOfExpiredStock(IN p_medicine_id INT)
BEGIN
    DECLARE medicine_expiry DATE;
    SELECT medicine_expiry_date INTO medicine_expiry FROM medicines WHERE medicine_id = p_medicine_id;
    IF medicine_expiry IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medicine not found!';
    ELSEIF medicine_expiry < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot purchase expired medicine!';
    END IF;
END$$

-- Trigger to prevent purchase of expired stock
CREATE TRIGGER prevent_purchase_of_expired_stock
BEFORE INSERT ON purchases
FOR EACH ROW
BEGIN
    CALL PreventPurchaseOfExpiredStock(NEW.medicine_id);
END$$

-- Stored Procedure: Calculate Total Amount for Purchases
CREATE PROCEDURE CalculateTotalAmount(IN p_medicine_id INT, IN p_purchased_quantity INT, OUT p_total_amount DECIMAL(10,2))
BEGIN
    DECLARE price DECIMAL(10,2);
    SELECT medicine_price INTO price FROM medicines WHERE medicine_id = p_medicine_id LIMIT 1;
    IF price IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Medicine not found!';
    ELSE
        SET p_total_amount = p_purchased_quantity * price;
    END IF;
END$$

-- Trigger: Calculate total amount before insert/update
CREATE TRIGGER calculate_total_amt_before_insert
BEFORE INSERT ON purchases
FOR EACH ROW
BEGIN
    DECLARE calculated_amount DECIMAL(10,2);
    CALL CalculateTotalAmount(NEW.medicine_id, NEW.purchased_quantity, calculated_amount);
    SET NEW.total_amt = calculated_amount;
END$$

CREATE TRIGGER calculate_total_amt_before_update
BEFORE UPDATE ON purchases
FOR EACH ROW
BEGIN
    DECLARE calculated_amount DECIMAL(10,2);
    CALL CalculateTotalAmount(NEW.medicine_id, NEW.purchased_quantity, calculated_amount);
    SET NEW.total_amt = calculated_amount;
END$$

-- Stored Procedure: Reduce Stock on Purchase
CREATE PROCEDURE ReduceStockOnPurchase(IN p_medicine_id INT, IN p_supplier_id INT, IN p_purchased_quantity INT)
BEGIN
    DECLARE available_stock INT;
    SELECT stock_quantity INTO available_stock FROM stocks 
    WHERE medicine_id = p_medicine_id AND supplier_id = p_supplier_id;
    
    IF available_stock IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock not found!';
    ELSEIF available_stock < p_purchased_quantity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock for this purchase!';
    ELSE
        UPDATE stocks SET stock_quantity = stock_quantity - p_purchased_quantity WHERE medicine_id = p_medicine_id AND supplier_id = p_supplier_id;
    END IF;
END$$

-- Trigger: Reduce stock on purchase
CREATE TRIGGER reduce_stock_on_purchase_before_insert
BEFORE INSERT ON purchases
FOR EACH ROW
BEGIN
    CALL ReduceStockOnPurchase(NEW.medicine_id, NEW.supplier_id, NEW.purchased_quantity);
END$$

-- Stored Procedure: Restore Stock on Purchase Deletion
CREATE PROCEDURE RestoreStockOnPurchaseDelete(IN p_medicine_id INT, IN p_supplier_id INT, IN p_purchased_quantity INT)
BEGIN
    IF p_supplier_id IS NOT NULL THEN
        UPDATE stocks SET stock_quantity = stock_quantity + p_purchased_quantity 
        WHERE medicine_id = p_medicine_id AND supplier_id = p_supplier_id;
    END IF;
END$$

-- Trigger: Restore stock after purchase deletion
CREATE TRIGGER restore_stock_on_purchase_delete
AFTER DELETE ON purchases
FOR EACH ROW
BEGIN
    CALL RestoreStockOnPurchaseDelete(OLD.medicine_id, OLD.supplier_id, OLD.purchased_quantity);
END$$


-- Stored Procedure: Assign Purchase Session and Update Amount
CREATE PROCEDURE AssignPurchaseSession(IN p_customer_id INT, IN p_purchase_time DATETIME, IN p_total_amount DECIMAL(10,2))
BEGIN
    DECLARE existing_session_id INT;

    -- Find an existing session for the same customer and time
    SELECT purchase_session_id INTO existing_session_id 
    FROM purchase_sessions 
    WHERE customer_id = p_customer_id AND purchase_time = p_purchase_time 
    LIMIT 1;

    IF existing_session_id IS NOT NULL THEN
        -- Update existing session
        UPDATE purchase_sessions 
        SET actual_amt_to_pay = p_total_amount 
        WHERE purchase_session_id = existing_session_id;
    ELSE
        -- Insert a new session
        INSERT INTO purchase_sessions (customer_id, purchase_time, actual_amt_to_pay) 
        VALUES (p_customer_id, p_purchase_time, p_total_amount);
    END IF;
END$$

-- Trigger: Assign purchase session
CREATE TRIGGER create_purchase_session
AFTER INSERT ON purchases
FOR EACH ROW
BEGIN
    DECLARE total_amount DECIMAL(10,2);
    
    -- Calculate total amount for the session
    SELECT SUM(total_amt) INTO total_amount 
    FROM purchases 
    WHERE customer_id = NEW.customer_id 
    AND purchase_time = NEW.purchase_time;
    
    -- Call the stored procedure
    CALL AssignPurchaseSession(NEW.customer_id, NEW.purchase_time, total_amount);
END$$

-- Stored Procedure: Calculate Total Amount to Pay for Invoice
CREATE PROCEDURE CalculateTotalAmtToPay(IN p_purchase_session_id INT, OUT p_total_amt_to_pay DECIMAL(10,2), OUT p_prev_balance DECIMAL(10,2))
BEGIN
    DECLARE customer_balance DECIMAL(10,2);
    DECLARE actual_amt DECIMAL(10,2);
    DECLARE cust_id INT;
    
    SELECT customer_id INTO cust_id FROM purchase_sessions WHERE purchase_session_id = p_purchase_session_id;
	IF cust_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid Purchase Session ID!';
    ELSE
        SELECT customer_balance_amt INTO customer_balance FROM customers WHERE customer_id = cust_id;
        SELECT actual_amt_to_pay INTO actual_amt FROM purchase_sessions WHERE purchase_session_id = p_purchase_session_id;
        SET p_prev_balance = customer_balance;
        SET p_total_amt_to_pay = actual_amt + IFNULL(customer_balance, 0);
    END IF;
END$$

-- Trigger: Calculate total_amt_to_pay before invoice insert
CREATE TRIGGER calculate_total_amt_to_pay_before_insert
BEFORE INSERT ON invoice
FOR EACH ROW
BEGIN
    DECLARE calculated_total DECIMAL(10,2);
    DECLARE prev_balance DECIMAL(10,2);
    CALL CalculateTotalAmtToPay(NEW.purchase_session_id, calculated_total, prev_balance);
    SET NEW.total_amt_to_pay = calculated_total;
    SET NEW.prev_balance = prev_balance;
END$$

DELIMITER $$

-- Stored Procedure: Update Customer Balance After Invoice Insert
CREATE PROCEDURE UpdateCustomerBalanceAfterInvoice(
    IN p_purchase_session_id INT, 
    IN p_total_amt_to_pay DECIMAL(10,2), 
    IN p_payment_id INT, 
    OUT p_balance_amt DECIMAL(10,2)
)
BEGIN
    DECLARE paid_amount DECIMAL(10,2);
    DECLARE cust_id INT;
    
    -- Get customer_id from purchase_sessions
    SELECT customer_id INTO cust_id 
    FROM purchase_sessions 
    WHERE purchase_session_id = p_purchase_session_id;
    
    -- Get paid amount from payments
    IF p_payment_id IS NOT NULL THEN
        SELECT payment_amt INTO paid_amount 
        FROM payments 
        WHERE payment_id = p_payment_id;
    ELSE
        SET paid_amount = 0;
    END IF;
    
    -- Calculate balance
    SET p_balance_amt = p_total_amt_to_pay - paid_amount;
    
    -- Update customer's balance
    UPDATE customers 
    SET customer_balance_amt = p_balance_amt
    WHERE customer_id = cust_id;
END$$

-- Trigger: Update customer balance after invoice insert
CREATE TRIGGER update_customer_balance_after_invoice_insert
BEFORE INSERT ON invoice
FOR EACH ROW
BEGIN
    DECLARE balance_amt DECIMAL(10,2);
    -- Call the stored procedure with correct parameters
    CALL UpdateCustomerBalanceAfterInvoice(NEW.purchase_session_id, NEW.total_amt_to_pay, NEW.payment_id, balance_amt);
    SET NEW.curr_balance = balance_amt;
END$$

DELIMITER ;

SHOW TRIGGERS;

-- Admin Table
INSERT INTO admin (admin_username, admin_password) VALUES 
('admin1', '$2a$10$nw35QHHaWQXowfPROS70A.mjbeYj8kPhpE5mBowZmJRHOg/G6/x8a'), -- Admin@123
('admin2', '$2a$10$rth0XhJlmKXXd.HuU948cuIrTGa1XRyVsp9HNEeq7rE7l8XnXPhea'); -- SecurePass
select * from admin;

-- Customers Table
INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_password, customer_created_at) VALUES 
('John Doe', 'john.doe@example.com', '9876543210', '$2a$10$rwXscApWpvq2s5wazkzPYOkmxWQGn89/B8nQNSG1nYb.QRPB6pKM6', '2025-03-01'), -- password
('Alice Smith', 'alice.smith@example.com', '9876543211', '$2a$10$ClmJYIzo8c15tO0oSP/WK.ZyUlrC7st9EZdPDinNKIrDnPv5Vat8', '2025-03-02'),  -- 1234567890
('Bob Johnson', 'bob.johnson@example.com', '9876543212', '$2a$10$.FGHozodkweJZOG4qFwQseKEhME20sdpQINxtJCgDwZSIxMhaEfl6', '2025-03-03'), -- 9876543210
('Jane Smith', 'janesmith@yahoo.com', '9123456789', '$2a$10$1icoY.4NSVHxZHlrTZCRHOgZVath6i/Eb83pOvNsb1tfcV0tJioc', '2025-03-04'),-- super
('Chris Evans', 'chris.evans@example.com', '9234567890', '$2a$10$rwXscApWpvq2s5wazkzPYOkmxWQGn89/B8nQNSG1nYb.QRPB6pKM6', '2025-03-05'), -- password
('Emma Watson', 'emma.watson@example.com', '9345678901', '$2a$10$ClmJYIzo8c15tO0oSP/WK.ZyUlrC7st9EZdPDinNKIrDnPv5Vat8', '2025-03-06'),  -- 1234567890
('David Warner', 'david.warner@example.com', '9456789012', '$2a$10$.FGHozodkweJZOG4qFwQseKEhME20sdpQINxtJCgDwZSIxMhaEfl6', DEFAULT), -- 9876543210
('Sophia Lee', 'sophia.lee@example.com', '9567890123', '$2a$10$1icoY.4NSVHxZHlrTZCRHOgZVath6i/Eb83pOvNsb1tfcV0tJioc', '2025-03-08'),-- super
('Michael Brown', 'michael.brown@example.com', '9678901234', '$2a$10$rwXscApWpvq2s5wazkzPYOkmxWQGn89/B8nQNSG1nYb.QRPB6pKM6', '2025-03-09'), -- password
('Olivia Green', 'olivia.green@example.com', '9789012345', '$2a$10$ClmJYIzo8c15tO0oSP/WK.ZyUlrC7st9EZdPDinNKIrDnPv5Vat8', '2025-03-10'),  -- 1234567890
('Liam Miller', 'liam.miller@example.com', '9890123456', '$2a$10$.FGHozodkweJZOG4qFwQseKEhME20sdpQINxtJCgDwZSIxMhaEfl6', DEFAULT), -- 9876543210
('Ava Wilson', 'ava.wilson@example.com', '9901234567', '$2a$10$1icoY.4NSVHxZHlrTZCRHOgZVath6i/Eb83pOvNsb1tfcV0tJioc', DEFAULT),-- super
('James Anderson', 'james.anderson@example.com', '9012345678', '$2a$10$rwXscApWpvq2s5wazkzPYOkmxWQGn89/B8nQNSG1nYb.QRPB6pKM6', '2025-03-13'), -- password
('Mia Robinson', 'mia.robinson@example.com', '9123456780', '$2a$10$ClmJYIzo8c15tO0oSP/WK.ZyUlrC7st9EZdPDinNKIrDnPv5Vat8', DEFAULT);  -- 1234567890
select * from customers;

-- Customers Addresses Table
INSERT INTO customer_addresses (customer_id, street, city, state, zip_code, address_type) VALUES 
(1, '123', 'Main Street', 'NY', '001203', 'Home'),
(2, '456', 'Elm Street', 'LA', '034203', 'Other'),
(3, '789', 'Pine Street', 'TX', '671203', 'Work'),
(4, '456', 'Avenue', 'City', '001323', 'Home');
select * from customer_addresses;

-- Feedbacks Table
INSERT INTO feedbacks (customer_id, rating, feedback_text) VALUES 
(1, 1, 'Worst.'),
(1, 4, 'Great service, fast delivery and helpful staff.'),
(2, 4, 'The medication arrived on time, and everything was as expected.'),
(3, 5, 'I had a smooth experience, and the quality of the product was good.'),
(4, 3, 'Excellent support and easy ordering process.');
select * from feedbacks;

-- Medicines Table
INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_type) VALUES 
-- Tablets
('Paracetamol', 'Acetaminophen 500mg', 10, '2025-12-31', 'Tablet'), 
('Aspirin', 'Aspirin 100mg', 5, '2026-06-30', 'Tablet'),
('Amoxicillin', 'Amoxicillin 500mg', 15, '2026-04-30', 'Capsule'),
('Ibuprofen', 'Ibuprofen 400mg', 30, '2025-08-15', 'Tablet'),
('Amoxicillin', 'Amoxicillin 250mg', 50, '2026-05-01', 'Capsule'),
('Vitamin C', 'Ascorbic Acid 500mg', 25, '2025-06-20', 'Tablet'),

-- Syrups
('Cough Syrup', 'Dextromethorphan, Guaifenesin', 80, '2026-09-10', 'Syrup'),
('Iron Tonic', 'Ferrous Sulfate, Folic Acid', 90, '2026-07-15', 'Syrup'),
('Multivitamin Syrup', 'Vitamin A, B, C, D, E', 75, '2025-12-01', 'Syrup'),

-- Injections
('Vitamin B12 Injection', 'Cyanocobalamin 1000mcg/ml', 120, '2026-08-20', 'Injection'),
('Insulin Injection', 'Insulin Human Recombinant 100IU/ml', 500, '2026-10-10', 'Injection'),
('Pain Relief Injection', 'Diclofenac Sodium 75mg/ml', 150, '2026-11-30', 'Injection'),

-- Ointments
('Burn Relief Ointment', 'Silver Sulfadiazine 1%', 60, '2026-09-25', 'Ointment'),
('Antifungal Cream', 'Clotrimazole 1%', 50, '2026-07-30', 'Ointment'),
('Anti-Inflammatory Gel', 'Diclofenac Gel 1%', 80, '2026-05-15', 'Ointment');
select * from medicines;

-- Suppliers Table
INSERT INTO suppliers (supplier_name, supplier_email, supplier_ph_no, supplier_address) VALUES 
('MediSuppliers Inc.', 'contact@medisuppliers.com', '9988776655', '1st Avenue, NY'),
('Pharma Distributors', 'sales@pharmadist.com', '9988776644', 'Market Street, LA'),
('Wellness Suppliers', 'info@wellnesssup.com', '9988776633', 'Health Road, TX'),
('Pharma Inc.', 'contact@pharmainc.com', '8800112233', '789 Pharma St, City'),
('MediCo', 'support@medico.com', '8000223344', '321 Health Rd, City');
select * from suppliers;

-- Suppliers Addresses Table
INSERT INTO supplier_addresses (supplier_id, street, city, state, zip_code) VALUES 
(1, '123', 'Main Street', 'NY', '001203'),
(2, '456', 'Elm Street', 'LA', '034203'),
(3, '789', 'Pine Street', 'TX', '671203'),
(4, '456', 'Elm Street', 'LA', '034203'),
(5, '456', 'Avenue', 'City', '001323');
select * from supplier_addresses;

-- Stocks Table
INSERT INTO stocks (medicine_id, supplier_id, stock_quantity) VALUES 
(1, 1, 100), 
(1, 2, 50),  
(2, 1, 200), 
(3, 2, 50),  
(4, 3, 50),  
(6, 4, 50); 
select * from stocks; 

-- Purchases Table
INSERT INTO purchases (customer_id, medicine_id, supplier_id, purchased_quantity) VALUES
(1, 1, 1, 4),  
(2, 2, 1, 5),  
(3, 3, 2, 3),  
(4, 4, 3, 2),  
(1, 6, 4, 1);  
select * from purchases;
select * from purchase_sessions;

-- Payments Table
INSERT INTO payments (customer_id, payment_amt) VALUES 
(1, 80),
(2, 20),
(3, 210),
(4, 115);
select * from payments;

-- Invoice Table
INSERT INTO invoice (purchase_session_id, admin_username, discount, payment_id) VALUES 
(1, 'admin1', 10, 1),
(2, 'admin1', 5, 2),
(3, 'admin2', 20, 3),
(4, 'admin2', 10, 4);
select * from invoice;

SHOW ERRORS;
SHOW WARNINGS;

-- Recent Orders & Deliveries
-- Low Stock Alerts
-- Revenue Overview
-- Upcoming Expiry Alerts
-- Customer Growth Analytics
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