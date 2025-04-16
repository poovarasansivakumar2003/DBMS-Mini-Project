# 💊 Pharmacy Management System

## 📌 Overview

A full-stack **Pharmacy Management System** developed as a part of the **DBMS Mini Project (5th Semester)**.
Built with Node.js, Express, EJS, and MySQL this project helps pharmacies streamline their operations digitally.

## 📌 Project Highlights

Manage core pharmacy operations like:

✅ Medicine Inventory Tracking  
✅ Customer Purchase Handling  
✅ Supplier Management  
✅ Invoice Generation  
✅ Role-based Dashboard for Admins & Customers

## ✨ Features

- 🏥 **Admin Dashboard**: Manage medicines, suppliers, and customers
- 🧑 **Customer Management**: Add and update customer details
- 🧍 **Customer Registration/Login**: Customers can register, login, add address and feedback and view medicine availability and invoices
- 💊 **Medicine Inventory**: Track stock levels & prevent expired medicines from being sold
- 🚛 **Supplier Management**: Maintain records of medicine suppliers
- 🛍️ **Purchases & Sales**: Manage medicine purchases & generate invoices
- 📝 **Invoice Generation**: Automatic invoice creation based on purchases
- 🗃️ **Data Persistence**: MySQL database to store & retrieve pharmacy records efficiently

## 📊 Database Schema

### ER Diagram
![ER Diagram](path/to/er-diagram.png)

### Relational Schema
![Relational Schema](path/to/relational-schema.png)

### Screenshots
![Website Screenshot](path/to/website-screenshot.png)

## 🛠️ Technologies Used

- **⚙️ Backend**: Node.js with Express.js  
- **🎨 Frontend**: EJS (Embedded JavaScript) + Tailwind CSS
- **🗄️ Database**: MySQL

## 📁 Folder Structure

```
📦 DBMS-Mini-Project
 ┣ 📂 controllers           # Route logic (admin, customer, auth, etc.)
 ┣ 📂 routes                # Express.js routing modules
 ┣ 📂 views                 # EJS templates for all pages
 ┃ ┣ 📂 includes            # Reusable EJS components (header, footer)
 ┣ 📂 public                # Static assets (CSS, JS, images)
 ┣ 📜 db.js                 # MySQL connection setup
 ┣ 📜 app.js                # Main Express server
 ┣ 📜 .env                  # Environment configuration
 ┣ 📜 DBMS Mini Project.sql # SQL schema, triggers, procedures
 ┣ 📜 package.json          # Project metadata & dependencies
 ┣ 📜 README.md             # You're here!
```

## 🏗️ Setup Instructions

### 📌 Prerequisites

Ensure you have the following installed:  
✔️ Node.js  
✔️ MySQL 
✔️ Git  

### 📥 Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/poovarasansivakumar2003/DBMS-Mini-Project.git
   cd DBMS-Mini-Project
   ```

2. Configure Environment Variables:
   Create a `.env` file in the root directory:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pharmacyDB
   SESSION_SECRET=your_session_secret
   NODE_ENV=development
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```
   
   > Note: Make sure to run queries in `dbQueries.sql` in MySQL and create EMAIL_PASS from [this link](https://itsupport.umd.edu/itsupport?id=kb_article_view&sysparm_article=KB0015112)

3. Install dependencies:
   ```bash
   npm install
   ```

4. Configure the database:
   - Create a MySQL database
   - Update the database credentials in the `.env` file

5. Run the server locally:
   ```bash
   npm start
   ```

6. Open the app in your browser:
   🌐 `http://localhost:3000`

## 🧬 Database Schema Overview

The system uses multiple relational tables:

- 📌 **admin** — Admin login info
- 📌 **customers** — Registered users
- 📌 **medicines** — Medicines with expiry, price, etc.
- 📌 **suppliers** — Supplier details
- 📌 **stocks** — Inventory tracking
- 📌 **purchases** — Purchase sessions
- 📌 **invoice** — Billing and receipts

Includes SQL triggers and stored procedures for validation and automation.

## 🔐 Security Notes

- Passwords are hashed before storage
- Authentication is session-based
- `.env` file securely stores credentials
- Basic email verification and reset password flow included

## 📌 Future Enhancements

- Integration with barcode scanning for faster billing and stock updates
- Automated SMS/email alerts for low-stock medicines or upcoming expiry dates
- Implementation of a role-based user system (e.g., admin, cashier, pharmacist) for better access control
- Online ordering system for customers to place medicine orders remotely
- Mobile-friendly web interface or a dedicated Android/iOS application for managing the pharmacy on the go
- GST and tax handling features for compliance and financial accuracy
- Detailed analytics and sales dashboards for monthly or yearly reporting

## 🤝 Contribution Guide

Want to contribute?

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/YourFeature`
3. Commit your changes
4. Push to the branch: `git push origin feature/YourFeature`
5. Open a pull request

## 📜 License

This project is licensed under the MIT License.
Feel free to modify and use for educational or commercial purposes.

## 💬 Contact

Made with ❤️ by Poovarasan S

For queries or collaboration, feel free to reach out!
