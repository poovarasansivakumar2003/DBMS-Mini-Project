# Pharmacy Management System

## Overview
This is a **Pharmacy Management System** developed as a part of the **DBMS Mini Project** for the 5th semester DBMS Laboratory. The project is built using **MySQL, EJS, and Heroku** to manage and streamline pharmacy operations such as inventory management, customer purchases, supplier management, and invoice generation.

## Features
- **Admin Dashboard**: Manage medicines, suppliers, and customers.
- **Customer Management**: Add and update customer details.
- **Medicine Inventory**: Track stock levels and prevent expired medicines from being sold.
- **Supplier Management**: Maintain records of medicine suppliers.
- **Purchases & Sales**: Manage medicine purchases and generate invoices.
- **Invoice Generation**: Automatic invoice creation based on purchases.
- **Data Persistence**: MySQL database to store and retrieve pharmacy records efficiently.

## Technologies Used
- **Backend**: Node.js with Express.js
- **Frontend**: EJS (Embedded JavaScript)
- **Database**: MySQL
- **Hosting**: Heroku

## Setup Instructions
### Prerequisites
Ensure you have the following installed:
- Node.js & npm
- MySQL
- Git
- Heroku CLI (for deployment)

### Installation Steps
1. Clone the repository:
   ```sh
   git clone https://github.com/poovarasansivakumar2003/DBMS-Mini-Project.git
   cd DBMS-Mini-Project
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Configure the database:
   - Create a MySQL database.
   - Update the database credentials in `.env` file.
4. Run the server locally:
   ```sh
   npm start
   ```
5. Access the application at `http://localhost:3000`.

## Database Schema
The project includes the following tables:
- `admin`
- `customers`
- `medicines`
- `suppliers`
- `stocks`
- `purchases`
- `invoice`

## Deployment on Heroku
1. Login to Heroku:
   ```sh
   heroku login
   ```
2. Create a Heroku app:
   ```sh
   heroku create pharmacy-management
   ```
3. Deploy the app:
   ```sh
   git push heroku main
   ```
4. Set up the MySQL database on Heroku and update the `.env` file.

## Future Enhancements
- Add authentication for admins.
- Implement role-based access.
- Improve UI with a modern frontend framework.
- Generate sales reports.

## Contributing
Feel free to fork this repository and contribute! Create a pull request with your enhancements.

## License
This project is licensed under the MIT License.
