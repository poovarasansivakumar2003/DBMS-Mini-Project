const bcrypt = require('bcryptjs');

async function generateHashedPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Hashed Password:', hashedPassword);
}

generateHashedPassword('SecurePass'); // Change 'yourpassword123' to your actual password
