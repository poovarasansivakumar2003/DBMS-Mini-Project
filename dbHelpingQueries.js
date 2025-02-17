const pool = require("./db");

// Query definitions
const dashboardQueries = {
    getAdminCount: "SELECT COUNT(*) AS count FROM admin",
    getCustomerCount: "SELECT COUNT(*) AS count FROM customers",
    getMedicineCount: "SELECT COUNT(*) AS count FROM medicines",
    getSupplierCount: "SELECT COUNT(*) AS count FROM suppliers",
    getFeedback: "SELECT customer_name, customer_feedback FROM customers WHERE customer_feedback IS NOT NULL LIMIT 5"
};


// Function to execute all queries in parallel
const executeDashboardQueries = async () => {
    try {
        const results = await Promise.all(
            Object.values(dashboardQueries).map(query => pool.query(query))
        );

        // Return results as an object with meaningful keys
        return {
            getAdminCount: results[0][0],
            getCustomerCount: results[1][0],
            getMedicineCount: results[2][0],
            getSupplierCount: results[3][0],
            getFeedback: results[4]
        };
    } catch (err) {
        throw new Error('Error executing database queries: ' + err.message);
    }
};

module.exports = { executeDashboardQueries };