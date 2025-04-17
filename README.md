# 💊 Pharmacy Management System

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

## 📌 Overview

A full-stack **Pharmacy Management System** developed as a part of the **DBMS Mini Project (5th Semester)**.
Built with Node.js, Express, EJS, and MySQL this project helps pharmacies streamline their operations digitally.

## 🎯 Project Highlights

<div align="center">

| Feature | Description |
|---------|-------------|
| 🏥 **Admin Dashboard** | Manage medicines, suppliers, and customers |
| 🧑 **Customer Management** | Add and update customer details |
| 💊 **Medicine Inventory** | Track stock levels & prevent expired medicines |
| 🚛 **Supplier Management** | Maintain records of medicine suppliers |
| 🛍️ **Purchases & Sales** | Manage medicine purchases & generate invoices |
| 📝 **Invoice Generation** | Automatic invoice creation based on purchases |

</div>

## 📊 Database Schema

### ER Diagram
<div align="center">
<img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/ER%20Diagram.jpg?raw=true" alt="ER Diagram" width="600"/>
</div>

### Relational Schema
<div align="center">
<img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/Relational%20Diagram.jpg?raw=true" alt="Relational Schema" width="600"/>
</div>

## 🖼️ Screenshots

<div align="center">
<table>
  <tr>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture1.png?raw=true" alt="Screenshot 1" width="300"/></td>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture2.png?raw=true" alt="Screenshot 2" width="300"/></td>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture6.png?raw=true" alt="Screenshot 6" width="300"/></td>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture7.png?raw=true" alt="Screenshot 7" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture4.png?raw=true" alt="Screenshot 4" width="300"/></td>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture8.png?raw=true" alt="Screenshot 8" width="300"/></td>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture9.png?raw=true" alt="Screenshot 9" width="300"/></td>
    <td><img src="https://github.com/poovarasansivakumar2003/DBMS-Mini-Project/blob/main/public/img/screenshot/Picture10.png?raw=true" alt="Screenshot 10" width="300"/></td>

  </tr>
</table>
</div>

## 🛠️ Tech Stack

<div align="center">

| Category | Technologies |
|----------|--------------|
| **Backend** | Node.js, Express.js |
| **Frontend** | EJS, Tailwind CSS |
| **Database** | MySQL |
| **Authentication** | Session-based |
| **Email** | Nodemailer |

</div>

## 📁 Project Structure

```bash
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

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- Git

### Installation

1. **Clone the repository**
   ```
   git clone https://github.com/poovarasansivakumar2003/DBMS-Mini-Project.git
   cd DBMS-Mini-Project
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=pharmacyDB
   SESSION_SECRET=your_session_secret
   NODE_ENV=development
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

4. **Set up the database**
   - Create a MySQL database
   - Run the SQL queries from `dbQueries.sql`
   - Update the database credentials in `.env`

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🔒 Security Features

- 🔐 Password hashing using bcrypt
- 🔑 Session-based authentication
- 🔒 Secure environment variable management
- 📧 Email verification system
- 🔄 Password reset functionality

## 📈 Future Roadmap

- 🏷️ Barcode scanning integration
- 📱 Mobile application development
- 📊 Advanced analytics dashboard
- 💰 GST and tax management
- 📦 Online ordering system
- 📱 SMS notifications
- 👥 Multi-role user system

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Poovarasan S**

- GitHub: [@poovarasansivakumar2003](https://github.com/poovarasansivakumar2003)
- Email: [Your Email](poovarasansivakumar2003@gmail.com)

---

<div align="center">
Made with ❤️ by Poovarasan S
</div>
