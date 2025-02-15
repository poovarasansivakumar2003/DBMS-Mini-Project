show databases;
create database DBMS_Mini_Project;
use DBMS_Mini_Project;

drop database DBMS_Mini_Project;

-- Admin Table
create table admin(
	admin_username varchar(20) primary key,
    admin_password VARCHAR(255) not null,
    admin_logged_in BOOLEAN DEFAULT FALSE
);
describe admin;
select * from admin;

-- Customers Table
create table customers(
	customer_id INT auto_increment PRIMARY KEY,
    customer_password varchar(255) not null,
    customer_name varchar(20) not null,
	customer_email varchar(50) unique,
    customer_ph_no varchar(15) not null unique,
    customer_address varchar(255),
    customer_feedback varchar(255),
    customer_photo varchar(255),
    customer_balance_amt DECIMAL(10, 2) DEFAULT 0
);
describe customers;
select * from customers;

ALTER TABLE customers ADD CONSTRAINT unique_customer UNIQUE (customer_email, customer_ph_no);

-- Medicines Table
create table medicines(
	medicine_id int auto_increment primary key,
    medicine_name varchar(20) not null,
    medicine_composition varchar(100) not null,
    medicine_price int not null, 
    medicine_expiry_date DATE NOT NULL, -- CHECK(medicine_expiry_date > CURRENT_DATE)
    medicine_img_url VARCHAR(255)
);
describe medicines;
select * from medicines;

ALTER TABLE medicines ADD CONSTRAINT unique_medicine UNIQUE (medicine_name, medicine_composition);

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

-- Invoice Table
create table invoice(
	invoice_no INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT,
    discount DECIMAL(10, 2) DEFAULT 0,
    paid DECIMAL(10, 2) DEFAULT 0,
    total_amt DECIMAL(10, 2),--  GENERATED ALWAYS AS (
--         (SELECT total_amt FROM purchases WHERE purchase_id = invoice.purchase_id) + 
--         (SELECT customer_balance FROM customers WHERE customer_id = (SELECT customer_id FROM purchases WHERE purchase_id = invoice.purchase_id))
--     ) STORED,
    net_total DECIMAL(10, 2) GENERATED ALWAYS AS (total_amt - discount) STORED,
    balance DECIMAL(10, 2) GENERATED ALWAYS AS (net_total - paid) STORED,
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id) ON DELETE CASCADE
);
describe invoice;
select * from invoice;



-- Stocks Table
CREATE TABLE stocks (
	medicine_id INT,
    supplier_id INT,
    purchase_id int,
    stock_quantity INT NOT NULL CHECK(stock_quantity >= 0),
    PRIMARY KEY (medicine_id, supplier_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE CASCADE
);
describe stocks;
select * from stocks;

show tables;

INSERT INTO admin (admin_username, admin_password) VALUES 
('admin1', '$2a$10$nw35QHHaWQXowfPROS70A.mjbeYj8kPhpE5mBowZmJRHOg/G6/x8a'),-- Admin@123
('admin2', '$2a$10$rth0XhJlmKXXd.HuU948cuIrTGa1XRyVsp9HNEeq7rE7l8XnXPhea');-- SecurePass

update admin set admin_password =' $2a$10$nw35QHHaWQXowfPROS70A.mjbeYj8kPhpE5mBowZmJRHOg/G6/x8a' where admin_username = 'admin1' ; -- Admin@123
update admin set admin_password ='$2a$10$rth0XhJlmKXXd.HuU948cuIrTGa1XRyVsp9HNEeq7rE7l8XnXPhea' where admin_username = 'admin2' ;-- SecurePass

INSERT INTO customers (customer_name, customer_email, customer_ph_no, customer_address, customer_feedback, customer_password) VALUES 
('John Doe', 'john.doe@example.com', '9876543210', '123 Main Street, NY', 'Great service, fast delivery and helpful staff.', '$2a$10$rwXscApWpvq2s5wazkzPYOkmxWQGn89/B8nQNSG1nYb.QRPB6pKM6'), -- password
('Alice Smith', 'alice.smith@example.com', '9876543211', '456 Elm Street, LA', 'The medication arrived on time, and everything was as expected.', '$2a$10$ClmJYIzo8c15tO0oSP/WK.ZyUlrC7st9EZdPDinNKIrDnPv5Vat8'),-- 1234567890
('Bob Johnson', 'bob.johnson@example.com', '9876543212', '789 Pine Street, TX', 'I had a smooth experience, and the quality of the product was good.', '$2a$10$.FGHozodkweJZOG4qFwQseKEhME20sdpQINxtJCgDwZSIxMhaEfl6'),-- 9876543210
('Jane Smith', 'janesmith@yahoo.com', '9123456789', '456 Avenue, City', 'Excellent support and easy ordering process.', '$2a$10$1icoY.4NSVHxZHlrTZCRHOgZVath6i/Eb83pOvNsb1tfcV0tJioc');-- super

update customers set customer_password ='$2a$10$1icoY.4NSVHxZHlrTZCRHOgZVath6i/Eb83pOvNsb1tfcV0tJioc' where customer_ph_no = '9123456789'; 


INSERT INTO suppliers (supplier_name, supplier_email, supplier_ph_no, supplier_address) VALUES 
('MediSuppliers Inc.', 'contact@medisuppliers.com', '9988776655', '1st Avenue, NY'),
('Pharma Distributors', 'sales@pharmadist.com', '9988776644', 'Market Street, LA'),
('Wellness Suppliers', 'info@wellnesssup.com', '9988776633', 'Health Road, TX'),
('Pharma Inc.', 'contact@pharmainc.com', '8800112233', '789 Pharma St, City'),
('MediCo', 'support@medico.com', '8000223344', '321 Health Rd, City');

INSERT INTO medicines (medicine_name, medicine_composition, medicine_price, medicine_expiry_date, medicine_img_url)
VALUES 
('Paracetamol', 'Acetaminophen 500mg', 10, '2025-12-31','./public/img/paracetamol.jpg'),
('Aspirin', 'Aspirin 100mg', 5, '2026-06-30','./public/img/aspirin.jfif'),
('Amoxicillin', 'Amoxicillin 500mg', 15, '2026-04-30','./public/img/amoxicillin.jfif'),
('Ibuprofen', 'Ibuprofen 400mg', 30, '2025-08-15','./public/img/ibuprofen.jfif'),
('Amoxicillin', 'Amoxicillin 250mg', 50, '2024-05-01','./public/img/amoxicillin.jfif'), -- Expired
('Cough Syrup', 'Dextromethorphan, Guaifenesin', 80, '2026-09-10','./public/img/coughSyrup.jpg'),
('Vitamin C', 'Ascorbic Acid 500mg', 25, '2025-06-20','./public/img/vitaminC.webp');

INSERT INTO stocks (medicine_id, supplier_id, stock_quantity)
VALUES 
(1, 1, 100), 
(1, 2, 50),  
(2, 1, 200), 
(3, 2, 150),
(2, 1, 150), 
(3, 2, 0),    
(4, 3, 50), 
(5, 2, 200);

-- Insert purchase data
INSERT INTO purchases (customer_id, medicine_id, supplier_id, purchase_quantity, total_amt)
VALUES 
(1, 1, 1, 10, 100),
(2, 2, 1, 5, 25),  
(2, 2, 1, 1, 30), 
(3, 4, 3, 3, 240), 
(1, 5, 2, 5, 125); 


-- Insert invoice data
INSERT INTO invoice (purchase_id, total_amt, discount, paid)
VALUES 
(1, 100, 10, 90),
(2, 25, 5, 20),   
(3, 240, 20, 220),
(4, 125, 10, 115);



-- How Can Suppliers View Their Stock?
SELECT 
    s.supplier_name, 
    m.medicine_name, 
    st.medicine_quantity
FROM 
    stocks st
JOIN 
    suppliers s ON st.supplier_id = s.supplier_id
JOIN 
    medicines m ON st.medicine_id = m.medicine_id
WHERE 
    s.supplier_id = 1;

-- How Can Suppliers Update Their Stock?
UPDATE stocks 
SET medicine_quantity = medicine_quantity + 50
WHERE medicine_id = 1 AND supplier_id = 1;

-- Show Medicine Stock for Each Supplier
SELECT 
    s.supplier_name, 
    m.medicine_name, 
    st.medicine_quantity
FROM 
    stocks st
JOIN 
    suppliers s ON st.supplier_id = s.supplier_id
JOIN 
    medicines m ON st.medicine_id = m.medicine_id;

-- How to See All Suppliers for a Medicine?
SELECT 
    m.medicine_name, 
    s.supplier_name
FROM 
    stocks st
JOIN 
    medicines m ON st.medicine_id = m.medicine_id
JOIN 
    suppliers s ON st.supplier_id = s.supplier_id
WHERE 
    m.medicine_name = 'Paracetamol';

-- How to Get the Combined Stock of Each Medicine?
SELECT 
    m.medicine_name, 
    SUM(st.medicine_quantity) AS total_stock
FROM 
    stocks st
JOIN 
    medicines m ON st.medicine_id = m.medicine_id
GROUP BY 
    m.medicine_name;

-- How to Get Stock per Supplier for a Medicine?
SELECT 
    m.medicine_name, 
    s.supplier_name, 
    st.medicine_quantity
FROM 
    stocks st
JOIN 
    medicines m ON st.medicine_id = m.medicine_id
JOIN 
    suppliers s ON st.supplier_id = s.supplier_id
WHERE 
    m.medicine_name = 'Paracetamol';

-- How to Get Supplier of Medicine Purchased by a Customer?
SELECT 
    c.customer_name, 
    m.medicine_name, 
    s.supplier_name
FROM 
    purchases p
JOIN 
    customers c ON p.customer_id = c.customer_id
JOIN 
    medicines m ON p.medicine_id = m.medicine_id
JOIN 
    suppliers s ON p.supplier_id = s.supplier_id
WHERE 
    c.customer_name = 'John Doe';

-- How to See All Suppliers for a Customer’s Purchased Medicines?
SELECT 
    c.customer_name, 
    m.medicine_name, 
    s.supplier_name
FROM 
    purchases p
JOIN 
    customers c ON p.customer_id = c.customer_id
JOIN 
    medicines m ON p.medicine_id = m.medicine_id
JOIN 
    suppliers s ON p.supplier_id = s.supplier_id
WHERE 
    c.customer_name = 'Jane Smith';

-- How to Fetch Only Non-Expired Medicines for Purchase?
SELECT 
    medicine_name, 
    medicine_expiry_date
FROM 
    medicines
WHERE 
    medicine_expiry_date > CURRENT_DATE;

-- How to Prevent Expired Medicines from Being Purchased?
SELECT * FROM medicines WHERE medicine_expiry_date > CURRENT_DATE;

-- Query to Get Total Amount Spent by Each Customer
SELECT 
    c.customer_name, 
    SUM(p.total_amt) AS total_spent
FROM 
    purchases p
JOIN 
    customers c ON p.customer_id = c.customer_id
GROUP BY 
    c.customer_name;

-- make invoice
SELECT i.invoice_no, 
       i.invoice_date, 
       c.customer_name, 
       m.medicine_name, 
       p.quantity, 
       p.total_amt, 
       i.discount, 
       (p.total_amt - i.discount) AS net_total, 
       i.paid, 
       i.balance
FROM invoice i
JOIN purchases p ON i.purchase_id = p.purchase_id
JOIN customers c ON p.customer_id = c.customer_id
JOIN medicines m ON p.medicine_id = m.medicine_id
ORDER BY i.invoice_date DESC;


-- reduce stock as purchase happens
-- only admin can generate bill



