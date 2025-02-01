# 🚀 Pharmacy Management System

## 📌 Overview
This is a **Pharmacy Management System** developed as part of the **DBMS Mini Project** for the **5th semester DBMS Laboratory**.  
The project is built using **MySQL, EJS, and Render** to **manage and streamline pharmacy operations** such as:  
✅ Inventory management  
✅ Customer purchases  
✅ Supplier management  
✅ Invoice generation  

---

## ✨ Features
- 🏥 **Admin Dashboard**: Manage medicines, suppliers, and customers.
- 🧑‍⚕️ **Customer Management**: Add and update customer details.
- 💊 **Medicine Inventory**: Track stock levels & prevent expired medicines from being sold.
- 🚛 **Supplier Management**: Maintain records of medicine suppliers.
- 🛍️ **Purchases & Sales**: Manage medicine purchases & generate invoices.
- 📝 **Invoice Generation**: Automatic invoice creation based on purchases.
- 🗃️ **Data Persistence**: MySQL database to store & retrieve pharmacy records efficiently.

---

## 🛠️ Technologies Used
- **⚙️ Backend**: Node.js with Express.js  
- **🎨 Frontend**: EJS (Embedded JavaScript)  
- **🗄️ Database**: MySQL  
- **☁️ Hosting**: Render  

---

## 🏗️ Setup Instructions
### 📌 Prerequisites
Ensure you have the following installed:  
✔️ Node.js & npm  
✔️ MySQL  
✔️ Git  

### 📥 Installation Steps
1️⃣ Clone the repository:
   ```
   git clone https://github.com/poovarasansivakumar2003/DBMS-Mini-Project.git
   cd DBMS-Mini-Project
   ```
2️⃣ Install dependencies:
   ```
   npm install
   ```
3️⃣ Configure the database:

   Create a MySQL database.
   Update the database credentials in the .env file. 
   
4️⃣ Run the server locally:
   ```
   npm start
   ```
5️⃣ Open the app in your browser:
🌐 `http://localhost:3000`

## 🗃️ Database Schema
The project includes the following tables:
📌 admin<br>
📌 customers<br>
📌 medicines<br>
📌 suppliers<br>
📌 stocks<br>
📌 purchases<br>
📌 invoice<br>

## 🚀 Deployment on Render
1️⃣ Create a new Web Service on Render.<br>
2️⃣ Connect your GitHub repository and select the branch to deploy.<br>
3️⃣ Set up environment variables in Render’s dashboard (same as .env file).<br>
4️⃣ Choose Node.js as the runtime and specify the start command:
```
npm start
```
5️⃣ Deploy the service and get the live URL.<br>
6️⃣ Set up a MySQL database on Render and update the .env file.<br>

## 📌 Folder Structure
```
📦 DBMS-Mini-Project
 ┣ 📂 public
 ┃ ┣ 📂 css        # 🎨 Stylesheets
 ┃ ┣ 📂 js         # 📜 Client-side JavaScript
 ┃ ┗ 📂 images     # 🖼️ Assets
 ┣ 📂 views        # 🖥️ EJS Templates
 ┃ ┣ 📜 index.ejs  # 🏠 Home Page
 ┃ ┣ 📜 admin.ejs  # 🔐 Admin Dashboard
 ┃ ┗ 📜 invoice.ejs # 🧾 Invoice Page
 ┣ 📂 routes       # 🛤️ Express.js Routes
 ┃ ┣ 📜 admin.js   # 🔧 Admin-related routes
 ┃ ┗ 📜 index.js   # 🚀 Main routes
 ┣ 📜 .env         # 🔑 Environment Variables
 ┣ 📜 server.js    # 🚀 Main Server File
 ┣ 📜 package.json # 📦 Project Dependencies
 ┗ 📜 README.md    # 📘 Documentation
```
## 📌 Code Snippets
### 📜 server.js (Main Entry Point)
```
const express = require('express');
const mysql = require('mysql');
const app = express();

require('dotenv').config();

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) throw err;
    console.log('🔥 MySQL Connected...');
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index');
});

app.listen(3000, () => {
    console.log('🚀 Server running on http://localhost:3000');
});
```
## 📌 Future Enhancements
🔒 Add authentication for admins.
👥 Implement role-based access.
🎨 Improve UI with a modern frontend framework.
📊 Generate sales reports.

## 🤝 Contributing
💡 Found a bug or have an idea? Feel free to fork this repository and contribute!
📌 Create a pull request with your enhancements.

## 📜 License
📖 This project is licensed under the MIT License.

🎯 Happy Coding! 🚀💻
