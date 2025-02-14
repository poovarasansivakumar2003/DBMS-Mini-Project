const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Render contact page
exports.getContactPage = (req, res) => {
    res.render('contact', {
        profile: req.session.user?.role,
        username: req.session.user?.username,
        pagetitle: 'Contact Us'
    });
};

// Handle form submission
exports.postContactForm = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        const mailOptions = {
            from: email,
            to: process.env.EMAIL_USER,
            subject: `Contact Form: ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.render('contact', {
            success: true,
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: 'Contact Us'
        });
    } catch (error) {
        console.error('Error sending email:', error);
        res.render('contact', {
            error: 'Failed to send message. Please try again later.',
            profile: req.session.user?.role,
            username: req.session.user?.username,
            pagetitle: 'Contact Us'
        });
    }
};
