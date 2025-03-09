const bcrypt = require('bcryptjs');

async function verifyPassword(inputPassword, storedHashedPassword) {
    const isMatch = await bcrypt.compare(inputPassword, storedHashedPassword);
    if (isMatch) {
        console.log("Password matches!");
    } else {
        console.log("Invalid password!");
    }
}

// Example usage
const storedHashedPassword = "$2a$10$1RJOmRAHDUaNjzFcrIxW7uQ9idYfSyS7xD5ZDzbRkHiSMwicOdfBO"; 
verifyPassword("87654321", storedHashedPassword);

